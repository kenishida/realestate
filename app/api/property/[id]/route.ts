import { NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase-server";
import type { Property, PropertyAnalysis, Message, Conversation } from "@/lib/types";

/**
 * 物件IDから物件情報、会話履歴、投資判断を取得するエンドポイント
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;

    let supabase;
    try {
      supabase = createServiceRoleSupabase();
    } catch {
      supabase = await createServerSupabase();
    }

    // 物件情報を取得
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .single();

    if (propertyError) {
      return NextResponse.json(
        {
          success: false,
          error: "Property not found",
          details: propertyError.message,
        },
        { status: 404 }
      );
    }

    // 投資判断を取得（最新のもの）
    const { data: analyses, error: analysesError } = await supabase
      .from("property_analyses")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (analysesError) {
      console.error("[Property API] Error fetching analyses:", analysesError);
    }

    // この物件に関連するメッセージを取得（property_idまたはproperty_urlで検索）
    console.log("[Property API] Fetching messages for property:", {
      propertyId,
      propertyUrl: property.url,
    });
    
    // property_idで検索
    const { data: messagesByPropertyId, error: messagesByIdError } = await supabase
      .from("messages")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true });

    if (messagesByIdError) {
      console.error("[Property API] Error fetching messages by property_id:", messagesByIdError);
    }

    // property_urlで検索
    const { data: messagesByUrl, error: messagesByUrlError } = await supabase
      .from("messages")
      .select("*")
      .eq("property_url", property.url)
      .order("created_at", { ascending: true });

    if (messagesByUrlError) {
      console.error("[Property API] Error fetching messages by property_url:", messagesByUrlError);
    }

    // 両方の結果をマージして重複を除去
    const allMessages = [
      ...(messagesByPropertyId || []),
      ...(messagesByUrl || []),
    ];
    
    // IDで重複を除去
    const uniqueMessages = Array.from(
      new Map(allMessages.map((msg) => [msg.id, msg])).values()
    );

    console.log("[Property API] Messages found:", {
      byPropertyId: messagesByPropertyId?.length || 0,
      byUrl: messagesByUrl?.length || 0,
      unique: uniqueMessages.length,
      messages: uniqueMessages.map((m: any) => ({
        id: m.id,
        role: m.role,
        contentLength: m.content?.length || 0,
        contentPreview: m.content?.substring(0, 100),
        property_id: m.property_id,
        property_url: m.property_url,
      })),
    });

    const messages: Message[] = uniqueMessages as Message[];

    const hasKeyData = (p: Property | null) =>
      !!(p?.title || p?.address || p?.floor_plan);
    const propertyDataUnavailable = !!property && !hasKeyData(property as Property);

    // メッセージから会話IDを取得
    const conversationIds = [...new Set(messages.map((m: Message) => m.conversation_id).filter(Boolean))];
    
    // 会話情報を取得
    let conversations: Conversation[] = [];
    if (conversationIds.length > 0) {
      const { data: conversationsData, error: conversationsError } = await supabase
        .from("conversations")
        .select("*")
        .in("id", conversationIds)
        .order("created_at", { ascending: false });

      if (conversationsError) {
        console.error("[Property API] Error fetching conversations:", conversationsError);
      } else {
        conversations = (conversationsData || []) as Conversation[];
      }
    }

    return NextResponse.json({
      success: true,
      property: property as Property,
      analysis: analyses && analyses.length > 0 ? (analyses[0] as PropertyAnalysis) : null,
      propertyDataUnavailable,
      conversations: conversations || [],
      messages: messages,
    });
  } catch (error: any) {
    console.error("[Property API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
