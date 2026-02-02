import { NextResponse } from "next/server";
import { getSupabaseForApi } from "@/lib/supabase-server";
import type { Property, PropertyAnalysis, Message, Conversation } from "@/lib/types";

/**
 * カスタムパスからチャット履歴（conversation）、物件情報、投資判断を取得するエンドポイント
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string }> }
) {
  try {
    const { path: customPath } = await params;

    const { supabase, error: supabaseError } = await getSupabaseForApi();
    if (supabaseError || !supabase) {
      return NextResponse.json(
        { success: false, error: supabaseError ?? "Database is not available.", code: "SUPABASE_CONFIG" },
        { status: 503 }
      );
    }

    // カスタムパスでチャット履歴を取得
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("*")
      .eq("custom_path", customPath)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        {
          success: false,
          error: "Conversation not found",
          details: conversationError?.message,
        },
        { status: 404 }
      );
    }

    // このチャット履歴に関連するメッセージを取得
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("[Conversation API] Error fetching messages:", messagesError);
    }

    // メッセージから物件IDを取得（会話内の出現順を維持）
    const propertyIdsOrdered: string[] = [];
    const seen = new Set<string>();
    for (const msg of messages || []) {
      const pid = (msg as any).property_id;
      if (pid && !seen.has(pid)) {
        seen.add(pid);
        propertyIdsOrdered.push(pid);
      }
    }

    let property: Property | null = null;
    let analysis: PropertyAnalysis | null = null;
    let properties: Property[] = [];

    if (propertyIdsOrdered.length > 0) {
      // このチャットで言及されている全物件を取得
      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select("*")
        .in("id", propertyIdsOrdered);

      if (!propertiesError && propertiesData && propertiesData.length > 0) {
        const byId = new Map(propertiesData.map((p: any) => [p.id, p as Property]));
        properties = propertyIdsOrdered.map((id) => byId.get(id)).filter(Boolean) as Property[];
      }

      // デフォルト表示用：最後に言及された物件とその投資判断
      const propertyId = propertyIdsOrdered[propertyIdsOrdered.length - 1];
      const propertyData = properties.find((p) => p.id === propertyId) ?? null;
      if (propertyData) {
        property = propertyData;

        const { data: analyses, error: analysesError } = await supabase
          .from("property_analyses")
          .select("*")
          .eq("property_id", propertyId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!analysesError && analyses && analyses.length > 0) {
          analysis = analyses[0] as PropertyAnalysis;
        }
      }
    }

    const hasKeyData = (p: Property | null) =>
      !!(p?.title || p?.address || p?.floor_plan);
    const propertyDataUnavailable = !!property && !hasKeyData(property);

    return NextResponse.json({
      success: true,
      conversation: conversation as Conversation,
      property: property,
      analysis: analysis,
      properties,
      propertyDataUnavailable,
      messages: (messages || []) as Message[],
    });
  } catch (error: any) {
    console.error("[Conversation API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
