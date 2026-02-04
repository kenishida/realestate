import { NextResponse } from "next/server";
import { getSupabaseForApi } from "@/lib/supabase-server";
import { generateTextWithGemini } from "@/lib/gemini";
import { buildRagContext } from "@/lib/rag-context";
import type { PropertyAnalysis, CashflowSimulation } from "@/lib/types";
import { cashflowSimulationToResult } from "@/lib/cashflow-simulation";

const MAX_RECENT_MESSAGES = 10;

/** 想定家賃（月額・円）をパース */
function parseMonthlyRent(text: string): number | null {
  const t = text.trim().replace(/,/g, "").replace(/\s/g, "");
  const manMatch = t.match(/^(\d+(?:\.\d+)?)\s*万(?:円)?$/);
  if (manMatch) return Math.round(parseFloat(manMatch[1]) * 10000);
  const num = parseInt(t, 10);
  if (!Number.isNaN(num) && num > 0 && num < 1e9) return num;
  return null;
}

const DEFAULT_DOWN_PAYMENT = 10_000_000;

/** RAG応答の構造（LLMにJSONで返させる） */
interface RagActionResponse {
  action: "answer" | "ask_purpose" | "run_purpose_analysis" | "ask_rent" | "run_cashflow";
  purpose?: string;
  rent?: number;
  response: string;
}

function parseRagJson(raw: string): RagActionResponse | null {
  const trimmed = raw.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(jsonStr) as RagActionResponse;
    if (parsed.action && typeof parsed.response === "string") return parsed;
  } catch (_) {
    // fallback: try to extract JSON from first { to last }
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}") + 1;
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(jsonStr.slice(start, end)) as RagActionResponse;
      } catch (_) {}
    }
  }
  return null;
}

/**
 * RAG: 会話・物件コンテキストに基づき意図を解釈し、応答またはアクション（投資目的分析・収支シミュレーション）を返す
 * POST body: { conversationId: string, userMessage: string, propertyId?: string }
 */
export async function POST(request: Request) {
  return handleRagPost(request).catch((e: unknown) => {
    const err = e instanceof Error ? e : new Error(String(e));
    const message = (err.message && err.message.trim()) || String(e) || "Unknown error";
    console.error("[RAG] Error:", err.message || err);
    if (err.stack) console.error("[RAG] Stack:", err.stack);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  });
}

function jsonError(message: string, status: number = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function handleRagPost(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (_) {
    return jsonError("Invalid JSON body.", 400);
  }
  if (body == null || typeof body !== "object") {
    return jsonError("Request body must be an object.", 400);
  }
  const b = body as Record<string, unknown>;
  let conversationId = b.conversationId as string | undefined;
  const userMessage = b.userMessage as string | undefined;
  const bodyPropertyId = b.propertyId as string | undefined;

  if (typeof userMessage !== "string" || !userMessage?.trim()) {
    return jsonError("userMessage is required.", 400);
  }

  const { supabase, error: supabaseError } = await getSupabaseForApi();
  if (supabaseError || !supabase) {
    return NextResponse.json(
      { success: false, error: supabaseError ?? "Database is not available.", code: "SUPABASE_CONFIG" },
      { status: 503 }
    );
  } else {
  // supabase が利用可能な場合の処理（すべての分岐で return する）
  let messages: any[] | null = null;
  if (conversationId) {
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .single();

      if (convError || !conversation) {
        return NextResponse.json(
          { success: false, error: "Conversation not found.", details: convError?.message },
          { status: 404 }
        );
      }

      const { data: msgData, error: msgError } = await supabase
        .from("messages")
        .select("id, role, content, property_id, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(MAX_RECENT_MESSAGES + 1);

      if (msgError) {
        return NextResponse.json(
          { success: false, error: "Failed to load messages.", details: msgError.message },
          { status: 500 }
        );
      }
      messages = msgData;
    } else {
      // conversationId が無い場合は新規会話を作成（propertyId 必須）
      const bodyPropId = bodyPropertyId as string | undefined;
      if (!bodyPropId) {
        return NextResponse.json(
          { success: false, error: "conversationId or propertyId is required." },
          { status: 400 }
        );
      const { data: newConv, error: insertErr } = await supabase!
        .from("conversations")
        .insert({})
        .select("id")
        .single();
      if (insertErr || !newConv) {
        return NextResponse.json(
          { success: false, error: "Failed to create conversation.", details: insertErr?.message },
          { status: 500 }
        );
      }
      conversationId = newConv!.id;
      messages = [];
    }
  }

  // conversationId の有無に関わらず、ここから RAG 本処理
  const createdConversationId = b.conversationId == null ? conversationId : undefined;
  let propertyId = bodyPropertyId as string | undefined;
    const messagesArr: any[] = messages ?? [];
    if (!propertyId && messagesArr.length > 0) {
      const withProp = messagesArr.find((m: any) => m.property_id);
      if (withProp) propertyId = withProp.property_id;
    }

    if (!propertyId) {
      const noPropertyReply = "この会話にはまだ物件が紐づいていません。物件URLを送信して投資判断を取得してから、質問や収支シミュレーションをご利用ください。";
      const { data: insertedAssistant } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          role: "assistant",
          content: noPropertyReply,
        })
        .select("id")
        .single();
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: userMessage.trim(),
      });
      return NextResponse.json({
        success: true,
        content: noPropertyReply,
        ...(createdConversationId && { conversationId: createdConversationId }),
      });
    }

    const contextResult = await buildRagContext(propertyId, supabase);
    if (!contextResult.chunksText || !contextResult.analysisId) {
      const noAnalysisReply = "この物件の投資判断がまだ取得されていません。しばらくお待ちいただくか、もう一度物件URLを送信してください。";
      await supabase.from("messages").insert([
        { conversation_id: conversationId, role: "user", content: userMessage.trim(), property_id: propertyId },
        { conversation_id: conversationId, role: "assistant", content: noAnalysisReply, property_id: propertyId },
      ]);
      return NextResponse.json({
        success: true,
        content: noAnalysisReply,
        ...(createdConversationId && { conversationId: createdConversationId }),
      });
    }

    const recentMessages = (messages || []).reverse();
    const conversationHistory = recentMessages
      .map((m: any) => (m.role === "user" ? "ユーザー" : "アシスタント") + ": " + m.content)
      .join("\n");

    const systemPrompt =
      "あなたは不動産投資のアシスタントです。以下の【コンテキスト】と【会話履歴】だけを根拠に答えてください。書かれていないことは推測で書かず「情報がありません」と答えてください。\n\n" +
      "【重要】応答は必ず次のJSON形式のみで出力してください。他の説明やマークダウンは付けません。\n" +
      '{"action": "answer" | "ask_purpose" | "run_purpose_analysis" | "ask_rent" | "run_cashflow", "purpose": "目的テキスト（run_purpose_analysisのときのみ）", "rent": 数値（run_cashflowのときのみ、月額家賃円）, "response": "ユーザーに返す日本語の応答文"}\n\n' +
      "- action の意味:\n" +
      "  - answer: コンテキストから回答するだけ。\n" +
      "  - ask_purpose: 投資目的（利回り重視・資産防衛・SOHOなど）を聞く。response に質問文を書く。\n" +
      "  - run_purpose_analysis: ユーザーが投資目的を述べたので、その目的で分析を実行する指示。purpose に目的テキスト（例: 利回り重視）を入れる。response には「〇〇の観点で分析します」など短い文を入れる。\n" +
      "  - ask_rent: 収支シミュレーションのため想定家賃（月額・円）を聞く。response に質問文を書く。\n" +
      "  - run_cashflow: ユーザーが家賃を入力したので収支シミュレーションを実行する指示。rent に月額家賃（円）を数値で入れる。response には「想定家賃〇〇円で計算します」など短い文を入れる。\n\n" +
      "コンテキストにない質問には「その情報はコンテキストに含まれていません」と答えるか、ask_purpose / ask_rent で必要な情報を聞いてください。";

    const userPrompt =
      "【コンテキスト】\n" +
      contextResult.chunksText +
      "\n\n【会話履歴】\n" +
      (conversationHistory || "（なし）") +
      "\n\n【今回のユーザー発話】\n" +
      userMessage.trim() +
      "\n\n上記に基づき、JSONのみで応答してください。";

    // ユーザーメッセージを保存
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: userMessage.trim(),
      property_id: propertyId,
    });

    let llmRaw: string;
    try {
      llmRaw = await generateTextWithGemini(systemPrompt + "\n\n" + userPrompt);
    } catch (e: any) {
      console.error("[RAG] Gemini error:", e);
      const errReply = "申し訳ありません。一時的なエラーが発生しました。もう一度お試しください。";
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: errReply,
        property_id: propertyId,
      });
      return NextResponse.json({
        success: true,
        content: errReply,
        ...(createdConversationId && { conversationId: createdConversationId }),
      });
    }

    const parsed = parseRagJson(llmRaw);
    const action = parsed?.action ?? "answer";
    const responseText = parsed?.response?.trim() || "申し訳ありません。応答を生成できませんでした。";

    let finalContent = responseText;
    let updatedAnalysis: PropertyAnalysis | null = null;
    let cashflowSimulation: CashflowSimulation | null = null;
    let openSimulationTab = false;

    if (action === "run_purpose_analysis" && parsed?.purpose && contextResult.analysisId) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? "https://" + process.env.VERCEL_URL
        : "http://localhost:3000";
      const purposeRes = await fetch(baseUrl + "/api/analyze-purpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          analysisId: contextResult.analysisId,
          purpose: parsed.purpose.trim(),
          conversationId,
        }),
      });
      const purposeData = await purposeRes.json();
      if (purposeData.success && purposeData.purposeAnalysis) {
        finalContent = purposeData.purposeAnalysis;
        updatedAnalysis = purposeData.updatedAnalysis ?? null;
      } else {
        finalContent = purposeData.error ? "投資目的の分析でエラーが発生しました: " + purposeData.error : responseText;
      }
      const { error: saveErr } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: finalContent,
        property_id: propertyId,
        metadata: { analysis_id: contextResult.analysisId, investment_purpose: parsed.purpose },
      });
      if (saveErr) console.warn("[RAG] Failed to save assistant message:", saveErr);
      return NextResponse.json({
        success: true,
        content: finalContent,
        updatedAnalysis: updatedAnalysis ?? undefined,
        ...(createdConversationId && { conversationId: createdConversationId }),
      });
    }
    if (action === "run_cashflow") {
      const rent = parsed?.rent ?? parseMonthlyRent(userMessage);
      const price = contextResult.property?.price;
      if (price != null && price > 0 && rent != null && rent > 0) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL
          ?? (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000");
        const cashRes = await fetch(
          baseUrl + "/api/property/" + propertyId + "/cashflow-simulations",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assumed_rent_yen: rent, down_payment_yen: DEFAULT_DOWN_PAYMENT }),
          }
        );
        const cashData = await cashRes.json();
        if (cashData.success && cashData.simulation) {
          cashflowSimulation = cashData.simulation as CashflowSimulation;
          openSimulationTab = true;
          finalContent = "想定家賃 月額" + rent.toLocaleString("ja-JP") + "円で収支シミュレーションを計算しました。右側の「投資判断」タブ内「収支シミュレーション」をご確認ください。";
        } else {
          finalContent = cashData.error ? "収支シミュレーションの計算でエラーが発生しました: " + cashData.error : finalContent;
        }
      }
    }

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: finalContent,
      property_id: propertyId,
    });

    const res: { success: boolean; content: string; updatedAnalysis?: PropertyAnalysis; cashflowSimulation?: CashflowSimulation; cashflowResult?: ReturnType<typeof cashflowSimulationToResult>; openSimulationTab?: boolean; conversationId?: string } = {
      success: true,
      content: finalContent,
    };
    if (updatedAnalysis) res.updatedAnalysis = updatedAnalysis;
    if (cashflowSimulation) {
      res.cashflowSimulation = cashflowSimulation;
      res.cashflowResult = cashflowSimulationToResult(cashflowSimulation);
      res.openSimulationTab = openSimulationTab;
    }
    if (createdConversationId) res.conversationId = createdConversationId;
    return NextResponse.json(res);
  }

  console.error("[RAG] Reached fallback (unhandled path). conversationId=", conversationId, "userMessage length=", userMessage?.length);
  return NextResponse.json(
    { success: false, error: "Unhandled request path." },
    { status: 500 }
  );
}
