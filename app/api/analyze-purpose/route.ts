import { NextResponse } from "next/server";
import { getSupabaseForApi } from "@/lib/supabase-server";
import { generateTextWithGemini } from "@/lib/gemini";
import type { PropertyAnalysis } from "@/lib/types";

/**
 * 投資目的に応じた追加分析を生成するAPIエンドポイント
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { propertyId, analysisId, purpose, customPurpose, conversationId } = body;

    console.log("[Analyze Purpose] Received request:", {
      propertyId,
      analysisId,
      purpose,
      customPurpose,
      hasConversationId: !!conversationId,
    });

    if (!propertyId || !analysisId || !purpose) {
      return NextResponse.json(
        { error: "propertyId, analysisId, and purpose are required" },
        { status: 400 }
      );
    }

    // 投資目的は自由なテキストとして受け入れる（検証は最小限に）
    if (!purpose || typeof purpose !== "string" || purpose.trim().length === 0) {
      return NextResponse.json(
        { error: "投資目的は必須です" },
        { status: 400 }
      );
    }
    
    // purposeをそのまま使用（自由なテキスト）
    const purposeText = purpose.trim();
    
    // customPurposeパラメータは不要になったが、後方互換性のため残す（使用しない）

    const { supabase, error: supabaseError } = await getSupabaseForApi();
    if (supabaseError || !supabase) {
      return NextResponse.json(
        { success: false, error: supabaseError ?? "Database is not available.", code: "SUPABASE_CONFIG" },
        { status: 503 }
      );
    }

    // 既存の分析を取得
    const { data: existingAnalysis, error: analysisError } = await supabase
      .from("property_analyses")
      .select("*")
      .eq("id", analysisId)
      .single();

    if (analysisError || !existingAnalysis) {
      console.error("[Analyze Purpose] Error fetching analysis:", analysisError);
      return NextResponse.json(
        {
          success: false,
          error: "Analysis not found",
          details: analysisError?.message || "Unknown error",
        },
        { status: 404 }
      );
    }

    // 物件情報を取得
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .single();

    if (propertyError || !property) {
      console.error("[Analyze Purpose] Error fetching property:", propertyError);
      return NextResponse.json(
        {
          success: false,
          error: "Property not found",
          details: propertyError?.message || "Unknown error",
        },
        { status: 404 }
      );
    }

    // 投資目的のラベル（分析用の表示テキスト）
    // purposeは既に自由なテキストなので、そのまま使用
    const purposeLabel = purposeText;

    // 既存の分析結果から情報を抽出
    const structuredAnalysis = existingAnalysis.structured_analysis || {};
    const existingFinalJudgment = structuredAnalysis.final_judgment || {};

    // 投資目的に応じた詳細分析を生成（物件への投資判断と同様に固定フォーマットで出力させる）
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
${existingFinalJudgment[purpose]?.recommendation || "未設定"}

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

    // 投資目的分析テキストをセクション単位でパース（物件への投資判断と同様の構造化）
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
        evaluation: section(/##\s*4\.\s*評価\s*[\n\r]+([\s\S]*?)$/i),
      };
    };

    console.log("[Analyze Purpose] Generating purpose-specific analysis...");
    let purposeAnalysisText: string;
    try {
      purposeAnalysisText = await generateTextWithGemini(purposeAnalysisPrompt);
      console.log("[Analyze Purpose] Purpose analysis generated successfully, length:", purposeAnalysisText.length);
    } catch (geminiError: any) {
      console.error("[Analyze Purpose] Gemini API error:", geminiError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to generate purpose-specific analysis",
          details: geminiError.message || "Unknown error",
        },
        { status: 500 }
      );
    }

    // パースして構造化データを取得（パース失敗時は全文を evaluation に格納してフォールバック）
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

    // 既存のstructured_analysisを更新（purpose_specific_analysis は構造化オブジェクトで保存）
    const updatedStructuredAnalysis = {
      ...structuredAnalysis,
      final_judgment: {
        ...existingFinalJudgment,
        [purpose]: {
          recommendation: existingFinalJudgment[purpose]?.recommendation || "",
          reason: purposeAnalysisText,
          detailed_analysis: purposeAnalysisText,
        },
      },
      purpose_specific_analysis: {
        ...(structuredAnalysis.purpose_specific_analysis || {}),
        [purpose]: purposeStructured,
      },
    };

    // 分析を更新（investment_purposeは自由なテキストとして保存）
    const updateData: any = {
      investment_purpose: purposeText, // 自由なテキストをそのまま保存
      structured_analysis: updatedStructuredAnalysis,
    };
    
    // metadataへの保存は不要（investment_purposeに直接保存するため）

    console.log("[Analyze Purpose] Updating analysis with data:", {
      analysisId,
      updateDataKeys: Object.keys(updateData),
      hasInvestmentPurpose: 'investment_purpose' in updateData,
      hasStructuredAnalysis: 'structured_analysis' in updateData,
      hasMetadata: 'metadata' in updateData,
    });

    // 直接UPDATEを実行（カラム存在確認は削除 - 実際のエラーに基づいて判定）
    const { data: updatedAnalysis, error: updateError } = await supabase
      .from("property_analyses")
      .update(updateData)
      .eq("id", analysisId)
      .select()
      .single();

    if (updateError) {
      console.error("[Analyze Purpose] ========================================");
      console.error("[Analyze Purpose] UPDATEエラーが発生しました");
      console.error("[Analyze Purpose] Error object:", JSON.stringify(updateError, null, 2));
      console.error("[Analyze Purpose] Error code:", updateError.code);
      console.error("[Analyze Purpose] Error message:", updateError.message);
      console.error("[Analyze Purpose] Error details:", updateError.details);
      console.error("[Analyze Purpose] Error hint:", updateError.hint);
      console.error("[Analyze Purpose] 更新しようとしたデータ:", JSON.stringify(updateData, null, 2));
      console.error("[Analyze Purpose] analysisId:", analysisId);
      console.error("[Analyze Purpose] ========================================");
      
      // エラーの種類を判定（実際のエラーコードとメッセージに基づく）
      
      // 1. investment_purposeカラムが存在しない場合のエラー（PostgreSQLエラーコード 42703）
      if (updateError.code === "42703") {
        return NextResponse.json(
          {
            success: false,
            error: "データベースカラムのエラー",
            details: `investment_purposeカラムが存在しません。以下のSQLをSupabaseのSQLエディタで実行してください:

-- 1. investment_purposeカラムの追加
ALTER TABLE property_analyses 
ADD COLUMN IF NOT EXISTS investment_purpose TEXT;

-- 2. インデックスの追加
CREATE INDEX IF NOT EXISTS idx_property_analyses_investment_purpose 
ON property_analyses(investment_purpose) 
WHERE investment_purpose IS NOT NULL;

-- 3. UPDATE権限の設定
DROP POLICY IF EXISTS "Anyone can update property_analyses" ON property_analyses;
CREATE POLICY "Anyone can update property_analyses"
  ON property_analyses FOR UPDATE
  USING (true)
  WITH CHECK (true);

実行手順:
1. Supabaseダッシュボード → SQL Editor → New query
2. 上記のSQLをコピー＆ペースト
3. Runボタンをクリック
4. 実行後、このページをリロードして再度お試しください`,
            code: updateError.code,
            hint: updateError.hint,
          },
          { status: 500 }
        );
      }
      
      // 2. RLSポリシー（UPDATE権限）のエラー（PostgreSQLエラーコード 42501）
      if (updateError.code === "42501") {
        return NextResponse.json(
          {
            success: false,
            error: "データベース権限のエラー",
            details: `UPDATE権限がありません。以下のSQLをSupabaseのSQLエディタで実行してください:

-- UPDATE権限の設定
DROP POLICY IF EXISTS "Anyone can update property_analyses" ON property_analyses;
CREATE POLICY "Anyone can update property_analyses"
  ON property_analyses FOR UPDATE
  USING (true)
  WITH CHECK (true);

実行手順:
1. Supabaseダッシュボード → SQL Editor → New query
2. 上記のSQLをコピー＆ペースト
3. Runボタンをクリック
4. 実行後、このページをリロードして再度お試しください`,
            code: updateError.code,
            hint: updateError.hint,
          },
          { status: 500 }
        );
      }
      
      // 3. その他のエラー（実際のエラーメッセージを表示）
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update analysis",
          details: updateError.message || "Unknown error",
          code: updateError.code,
          hint: updateError.hint || "サーバーログを確認してください",
        },
        { status: 500 }
      );
    }
    
    console.log("[Analyze Purpose] Analysis updated successfully:", updatedAnalysis.id);

    // アシスタントメッセージを保存
    if (conversationId) {
      const assistantMessageContent = `投資目的「${purposeLabel}」に基づいた分析が完了しました。\n\n${purposeAnalysisText}`;

      const { data: assistantMessage, error: assistantMsgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          role: "assistant",
          content: assistantMessageContent,
          property_id: propertyId,
          metadata: {
            analysis_id: analysisId,
            investment_purpose: purposeText,
          },
        })
        .select()
        .single();

      if (assistantMsgError) {
        console.warn("[Analyze Purpose] Failed to save assistant message:", assistantMsgError);
      } else {
        console.log("[Analyze Purpose] Assistant message saved:", assistantMessage.id);
      }
    }

    return NextResponse.json({
      success: true,
      purposeAnalysis: purposeAnalysisText,
      updatedAnalysis: updatedAnalysis as PropertyAnalysis,
    });
  } catch (error: any) {
    console.error("[Analyze Purpose] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to analyze purpose",
      },
      { status: 500 }
    );
  }
}
