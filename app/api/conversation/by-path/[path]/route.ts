import { NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase-server";
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

    let supabase;
    try {
      supabase = createServiceRoleSupabase();
    } catch {
      supabase = await createServerSupabase();
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

    // メッセージから物件IDを取得
    const propertyIds = [...new Set(
      (messages || [])
        .map((msg: any) => msg.property_id)
        .filter(Boolean)
    )];

    let property: Property | null = null;
    let analysis: PropertyAnalysis | null = null;

    if (propertyIds.length > 0) {
      // 最新の物件IDを使用
      const propertyId = propertyIds[propertyIds.length - 1];
      
      // 物件情報を取得
      const { data: propertyData, error: propertyError } = await supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .single();

      if (!propertyError && propertyData) {
        property = propertyData as Property;

        // 投資判断を取得（最新のもの）
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
