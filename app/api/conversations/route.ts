import { NextResponse } from "next/server";
import { getSupabaseForApi } from "@/lib/supabase-server";
import type { Conversation, Property } from "@/lib/types";

interface ConversationWithProperty extends Conversation {
  property?: Property | null;
}

/**
 * ユーザーの全チャット履歴を取得するエンドポイント
 * 各チャットに関連する物件情報も取得する
 */
export async function GET() {
  try {
    const { supabase, error: supabaseError } = await getSupabaseForApi();
    if (supabaseError || !supabase) {
      return NextResponse.json(
        { success: false, error: supabaseError ?? "Database is not available.", code: "SUPABASE_CONFIG" },
        { status: 503 }
      );
    }

    // 全チャット履歴を取得（時系列で降順）
    const { data: conversations, error: conversationsError } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (conversationsError) {
      console.error("[Conversations API] Error fetching conversations:", conversationsError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch conversations",
          details: conversationsError.message,
        },
        { status: 500 }
      );
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({
        success: true,
        conversations: [],
      });
    }

    // 各チャットに関連する物件を取得
    const conversationIds = conversations.map((c: any) => c.id);
    
    // property_analysesテーブルから、各conversation_idに関連するproperty_idを取得
    const { data: analyses, error: analysesError } = await supabase
      .from("property_analyses")
      .select("conversation_id, property_id")
      .in("conversation_id", conversationIds)
      .not("conversation_id", "is", null);

    if (analysesError) {
      console.error("[Conversations API] Error fetching property_analyses:", analysesError);
      // エラーが発生しても、物件情報なしでチャット履歴は返す
    }

    // conversation_idごとに最初のproperty_idを取得（重複を排除）
    const conversationPropertyMap = new Map<string, string>();
    if (analyses) {
      for (const analysis of analyses) {
        if (analysis.conversation_id && analysis.property_id) {
          // 既にマップにある場合はスキップ（最初の物件のみ使用）
          if (!conversationPropertyMap.has(analysis.conversation_id)) {
            conversationPropertyMap.set(analysis.conversation_id, analysis.property_id);
          }
        }
      }
    }

    // 物件IDのリストを取得
    const propertyIds = Array.from(conversationPropertyMap.values());
    
    // 物件情報を一括取得
    let properties: Property[] = [];
    if (propertyIds.length > 0) {
      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select("*")
        .in("id", propertyIds);

      if (propertiesError) {
        console.error("[Conversations API] Error fetching properties:", propertiesError);
      } else {
        properties = (propertiesData || []) as Property[];
      }
    }

    // 物件IDをキーにしたマップを作成
    const propertyMap = new Map<string, Property>();
    for (const property of properties) {
      propertyMap.set(property.id, property);
    }

    // チャット履歴に物件情報を追加
    const conversationsWithProperties: ConversationWithProperty[] = conversations.map((conv: any) => {
      const propertyId = conversationPropertyMap.get(conv.id);
      const property = propertyId ? propertyMap.get(propertyId) || null : null;
      
      return {
        ...conv,
        property: property,
      } as ConversationWithProperty;
    });

    return NextResponse.json({
      success: true,
      conversations: conversationsWithProperties,
    });
  } catch (error: any) {
    console.error("[Conversations API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
