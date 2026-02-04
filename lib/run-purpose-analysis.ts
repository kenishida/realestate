import type { SupabaseClient } from "@supabase/supabase-js";
import { generateTextWithGemini } from "@/lib/gemini";
import type { PropertyAnalysis } from "@/lib/types";

export interface RunPurposeAnalysisParams {
  supabase: SupabaseClient;
  propertyId: string;
  analysisId: string;
  purpose: string;
  conversationId?: string;
}

export interface RunPurposeAnalysisResult {
  success: true;
  purposeAnalysis: string;
  updatedAnalysis: PropertyAnalysis;
}

export interface RunPurposeAnalysisError {
  success: false;
  error: string;
  details?: string;
}

export type RunPurposeAnalysisOutput = RunPurposeAnalysisResult | RunPurposeAnalysisError;

/**
 * 投資目的に応じた追加分析を実行（API 経由の fetch を使わず直接呼び出し用）
 * RAG ルートや /api/analyze-purpose から利用
 */
export async function runPurposeAnalysis(
  params: RunPurposeAnalysisParams
): Promise<RunPurposeAnalysisOutput> {
  const { supabase, propertyId, analysisId, purpose, conversationId } = params;
  const purposeText = purpose.trim();

  if (!propertyId || !analysisId || !purposeText) {
    return { success: false, error: "propertyId, analysisId, and purpose are required" };
  }

  const { data: existingAnalysis, error: analysisError } = await supabase
    .from("property_analyses")
    .select("*")
    .eq("id", analysisId)
    .single();

  if (analysisError || !existingAnalysis) {
    console.error("[RunPurposeAnalysis] Error fetching analysis:", analysisError);
    return {
      success: false,
      error: "Analysis not found",
      details: analysisError?.message || "Unknown error",
    };
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();

  if (propertyError || !property) {
    console.error("[RunPurposeAnalysis] Error fetching property:", propertyError);
    return {
      success: false,
      error: "Property not found",
      details: propertyError?.message || "Unknown error",
    };
  }

  const structuredAnalysis = existingAnalysis.structured_analysis || {};
  const existingFinalJudgment = structuredAnalysis.final_judgment || {};
  const purposeLabel = purposeText;

  const purposeAnalysisPrompt = `以下の物件情報と投資判断結果を基に、「${purposeLabel}」という投資目的に特化した追加分析を行ってください。

【物件情報】
- 物件名: ${property.title || "不明"}
- 価格: ${property.price ? property.price.toLocaleString() + "円" : "不明"}
- 所在地: ${property.address || property.location || "不明"}
- 間取り: ${property.floor_plan || "不明"}
- 築年数: ${property.year_built != null ? (property.year_built >= 1900 ? new Date().getFullYear() - property.year_built : property.year_built) + "年" : "不明"}

【既存の投資判断】
${existingAnalysis.summary || "投資判断が完了しています。"}

【投資目的】
${purposeLabel}

【既存の最終判断（参考）】
${existingFinalJudgment[purposeLabel]?.recommendation || "未設定"}

以下の観点から、この投資目的に特化した詳細な分析とアドバイスを提供してください。
出力は必ず以下の4つのセクションで、見出しは「## 1. 〜」の形式で書いてください。

## 1. メリット・デメリット
（この投資目的にとってのメリット・デメリットを記述）

## 2. 注意点・リスク
（具体的な注意点やリスクを記述）

## 3. 推奨アクション
（推奨されるアクションを記述）

## 4. 評価
（この投資目的に適しているかどうかの評価を記述）

【重要】
- 上記4つの見出し（## 1. 〜 など）を必ず含めてください
- 見出し以外ではMarkdown記法（**太字**、###など）は使わず、プレーンテキストで記述してください
- 簡潔で実用的なアドバイスを提供してください`;

  const parsePurposeAnalysis = (text: string): {
    merits_demerits: string;
    risks: string;
    recommended_actions: string;
    evaluation: string;
  } => {
    const section = (pattern: RegExp) => {
      const m = text.match(pattern);
      return m ? m[1].trim() : "";
    };
    return {
      merits_demerits: section(/##\s*1\.\s*メリット・デメリット\s*[\n\r]+([\s\S]*?)(?=##\s*2\.|$)/i),
      risks: section(/##\s*2\.\s*注意点・リスク\s*[\n\r]+([\s\S]*?)(?=##\s*3\.|$)/i),
      recommended_actions: section(/##\s*3\.\s*推奨アクション\s*[\n\r]+([\s\S]*?)(?=##\s*4\.|$)/i),
      evaluation: section(/##\s*4\.\s*評価\s*[\n\r]+([\s\S]*)$/i),
    };
  };

  let purposeAnalysisText: string;
  try {
    purposeAnalysisText = await generateTextWithGemini(purposeAnalysisPrompt);
  } catch (geminiError: unknown) {
    const msg = geminiError instanceof Error ? geminiError.message : String(geminiError);
    console.error("[RunPurposeAnalysis] Gemini API error:", geminiError);
    return {
      success: false,
      error: "Failed to generate purpose-specific analysis",
      details: msg || "Unknown error",
    };
  }

  const parsed = parsePurposeAnalysis(purposeAnalysisText);
  const hasStructuredSections =
    parsed.merits_demerits || parsed.risks || parsed.recommended_actions || parsed.evaluation;
  const purposeStructured = hasStructuredSections
    ? parsed
    : {
        merits_demerits: "",
        risks: "",
        recommended_actions: "",
        evaluation: purposeAnalysisText,
      };

  const updatedStructuredAnalysis = {
    ...structuredAnalysis,
    final_judgment: {
      ...existingFinalJudgment,
      [purposeLabel]: {
        recommendation: existingFinalJudgment[purposeLabel]?.recommendation || "",
        reason: purposeAnalysisText,
        detailed_analysis: purposeAnalysisText,
      },
    },
    purpose_specific_analysis: {
      ...(structuredAnalysis.purpose_specific_analysis || {}),
      [purposeLabel]: purposeStructured,
    },
  };

  const updateData: Record<string, unknown> = {
    investment_purpose: purposeText,
    structured_analysis: updatedStructuredAnalysis,
  };

  const { data: updatedAnalysis, error: updateError } = await supabase
    .from("property_analyses")
    .update(updateData)
    .eq("id", analysisId)
    .select()
    .single();

  if (updateError) {
    console.error("[RunPurposeAnalysis] UPDATE error:", updateError);
    return {
      success: false,
      error: "Failed to update analysis",
      details: updateError.message || "Unknown error",
    };
  }

  if (conversationId) {
    const rec = updatedAnalysis?.recommendation ?? "—";
    const sc = updatedAnalysis?.score ?? "—";
    const assistantMessageContent = `投資目的「${purposeLabel}」の分析が完了しました。【推奨度】${rec} 【投資スコア】${sc} 右側の「投資目的」タブで詳細をご確認ください。`;

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: assistantMessageContent,
      property_id: propertyId,
      metadata: { analysis_id: analysisId, investment_purpose: purposeText },
    });
  }

  return {
    success: true,
    purposeAnalysis: purposeAnalysisText,
    updatedAnalysis: updatedAnalysis as PropertyAnalysis,
  };
}
