import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import type { Conversation, Property } from "@/lib/types";

interface ConversationWithProperty extends Conversation {
  property?: Property | null;
}

/**
 * ログイン中のユーザーのチャット履歴のみ取得（RLS でフィルタ）
 */
export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        success: true,
        conversations: [],
      });
    }

    const { data: conversations, error: conversationsError } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (conversationsError) {
      return NextResponse.json(
        { success: false, error: conversationsError.message },
        { status: 500 }
      );
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ success: true, conversations: [] });
    }

    const conversationIds = conversations.map((c: any) => c.id);
    const { data: analyses } = await supabase
      .from("property_analyses")
      .select("conversation_id, property_id")
      .in("conversation_id", conversationIds)
      .not("conversation_id", "is", null);

    const conversationPropertyMap = new Map<string, string>();
    if (analyses) {
      for (const a of analyses) {
        if (a.conversation_id && a.property_id && !conversationPropertyMap.has(a.conversation_id)) {
          conversationPropertyMap.set(a.conversation_id, a.property_id);
        }
      }
    }

    const propertyIds = Array.from(conversationPropertyMap.values());
    let properties: Property[] = [];
    if (propertyIds.length > 0) {
      const { data } = await supabase.from("properties").select("*").in("id", propertyIds);
      properties = (data || []) as Property[];
    }
    const propertyMap = new Map(properties.map((p) => [p.id, p]));

    const conversationsWithProperties: ConversationWithProperty[] = conversations.map((conv: any) => {
      const propertyId = conversationPropertyMap.get(conv.id);
      const property = propertyId ? propertyMap.get(propertyId) ?? null : null;
      return { ...conv, property } as ConversationWithProperty;
    });

    return NextResponse.json({
      success: true,
      conversations: conversationsWithProperties,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
