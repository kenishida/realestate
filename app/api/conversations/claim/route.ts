import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceRoleSupabase } from "@/lib/supabase-server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * 未ログインで開始した会話を、ログイン中のユーザーに紐づける
 * Authorization: Bearer <access_token> でユーザーを特定
 * POST body: { conversationId: string }
 * ユーザー検証後にサービスロールで UPDATE（RLS の SELECT で未紐づけ行が隠れて 404 になるのを避ける）
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token || !supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: "ログインが必要です" },
        { status: 401 }
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "ログインが必要です" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const conversationId = body?.conversationId;

    if (!conversationId || typeof conversationId !== "string") {
      return NextResponse.json(
        { success: false, error: "conversationId が必要です" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleSupabase();

    const { data, error } = await supabase
      .from("conversations")
      .update({ user_id: user.id, updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .is("user_id", null)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      // 404 の原因を特定: 会話が存在するか・user_id の状態をサービスロールで確認
      const { data: existing } = await supabase
        .from("conversations")
        .select("id, user_id")
        .eq("id", conversationId)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json(
          {
            success: false,
            error: "会話IDが存在しません。未ログインで物件URLを送信して会話を作成してから、ログインしてください。",
            reason: "not_found",
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: "会話はすでに別のユーザーに紐づいています。",
          reason: "already_claimed",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, conversationId: data.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
