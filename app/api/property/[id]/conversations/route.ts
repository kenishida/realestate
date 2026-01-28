import { NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase-server";
import type { Conversation } from "@/lib/types";

/**
 * 物件IDに関連するチャット履歴を取得するエンドポイント
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

    // この物件に関連するメッセージを取得
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("conversation_id")
      .eq("property_id", propertyId);

    if (messagesError) {
      console.error("[Property Conversations API] Error fetching messages:", messagesError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch messages",
          details: messagesError.message,
        },
        { status: 500 }
      );
    }

    // 会話IDのリストを取得
    const conversationIds = [...new Set(
      (messages || []).map((msg: any) => msg.conversation_id).filter(Boolean)
    )];

    if (conversationIds.length === 0) {
      return NextResponse.json({
        success: true,
        conversations: [],
      });
    }

    // チャット履歴を取得
    const { data: conversations, error: conversationsError } = await supabase
      .from("conversations")
      .select("*")
      .in("id", conversationIds)
      .order("created_at", { ascending: false });

    if (conversationsError) {
      console.error("[Property Conversations API] Error fetching conversations:", conversationsError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch conversations",
          details: conversationsError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      conversations: (conversations || []) as Conversation[],
    });
  } catch (error: any) {
    console.error("[Property Conversations API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
