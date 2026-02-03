import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceRoleSupabase } from "@/lib/supabase-server";
import type { Property } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** 調査日時付きの物件 */
export interface InvestigatedProperty extends Property {
  investigated_at: string;
  conversation_id: string | null;
}

/**
 * ログイン中のユーザーが調査した物件一覧
 * 「言及されている物件」と同じロジック: 自分の会話の messages.property_id から物件を取得する。
 * （property_analyses.conversation_id が未設定でも、メッセージに property_id があれば表示される）
 * Authorization: Bearer <access_token> でトークンを受け取り、そのユーザーの物件のみ返す。
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token || !supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ success: true, properties: [] });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ success: true, properties: [] });
    }

    const supabase = createServiceRoleSupabase();

    // 自分の会話ID一覧を取得（user_id でフィルタ）
    const { data: myConvs, error: convError } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id);

    if (convError || !myConvs || myConvs.length === 0) {
      return NextResponse.json({ success: true, properties: [] });
    }

    const myConvIds = myConvs.map((c) => c.id);

    // by-path と同様: 自分の会話の messages から property_id を取得（言及されている物件の出所）
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("property_id, conversation_id, created_at")
      .in("conversation_id", myConvIds)
      .not("property_id", "is", null)
      .order("created_at", { ascending: false });

    if (messagesError) {
      return NextResponse.json(
        { success: false, error: messagesError.message },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ success: true, properties: [] });
    }

    // 物件IDごとに最新の言及日時を取得（同じ物件が複数会話にあっても1件に）
    const propertyToLatest: Map<string, { investigated_at: string; conversation_id: string }> = new Map();
    for (const m of messages) {
      const pid = m.property_id;
      const cid = m.conversation_id;
      if (!pid || !cid) continue;
      const existing = propertyToLatest.get(pid);
      if (!existing || new Date(m.created_at) > new Date(existing.investigated_at)) {
        propertyToLatest.set(pid, {
          investigated_at: m.created_at,
          conversation_id: cid,
        });
      }
    }

    const propertyIds = Array.from(propertyToLatest.keys());
    if (propertyIds.length === 0) {
      return NextResponse.json({ success: true, properties: [] });
    }

    const { data: properties, error: propError } = await supabase
      .from("properties")
      .select("*")
      .in("id", propertyIds);

    if (propError) {
      return NextResponse.json(
        { success: false, error: propError.message },
        { status: 500 }
      );
    }

    const result: InvestigatedProperty[] = (properties || []).map((p) => {
      const meta = propertyToLatest.get(p.id);
      return {
        ...p,
        investigated_at: meta?.investigated_at ?? p.created_at,
        conversation_id: meta?.conversation_id ?? null,
      } as InvestigatedProperty;
    });

    result.sort(
      (a, b) => new Date(b.investigated_at).getTime() - new Date(a.investigated_at).getTime()
    );

    return NextResponse.json({
      success: true,
      properties: result,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
