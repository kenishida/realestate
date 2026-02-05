import { NextResponse } from "next/server";
import { getSupabaseForApi } from "@/lib/supabase-server";
import { runPurposeAnalysis } from "@/lib/run-purpose-analysis";
import type { PropertyAnalysis } from "@/lib/types";

/**
 * 投資目的に応じた追加分析を生成するAPIエンドポイント
 * ブラウザからの直接呼び出し用。RAG からは runPurposeAnalysis を直接利用すること。
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

    if (typeof purpose !== "string" || purpose.trim().length === 0) {
      return NextResponse.json(
        { error: "投資目的は必須です" },
        { status: 400 }
      );
    }

    const { supabase, error: supabaseError } = await getSupabaseForApi();
    if (supabaseError || !supabase) {
      return NextResponse.json(
        { success: false, error: supabaseError ?? "Database is not available.", code: "SUPABASE_CONFIG" },
        { status: 503 }
      );
    }

    const result = await runPurposeAnalysis({
      supabase,
      propertyId,
      analysisId,
      purpose: purpose.trim(),
      conversationId,
    });

    if (!result.success) {
      const status =
        result.error === "Analysis not found" || result.error === "Property not found" ? 404 : 500;
      return NextResponse.json(
        { success: false, error: result.error, details: result.details },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      purposeAnalysis: result.purposeAnalysis,
      updatedAnalysis: result.updatedAnalysis as PropertyAnalysis,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Analyze Purpose] Error:", error);
    return NextResponse.json(
      { success: false, error: msg || "Failed to analyze purpose" },
      { status: 500 }
    );
  }
}
