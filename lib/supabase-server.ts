import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// 環境変数の検証
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables:");
  console.error("NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✓" : "✗");
}

// サーバーサイド用のSupabaseクライアント（Server Componentsで使用）
// ユーザーの認証情報に基づいてRLSポリシーが適用される
export async function createServerSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase environment variables are not configured. " +
      "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables."
    );
  }
  
  const cookieStore = await cookies();
  
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          // Server Componentからはcookiesをsetできない場合がある
          // その場合はクライアント側で処理する
        }
      },
    },
  });
}

// サーバーサイド用のSupabaseクライアント（RLSをバイパス）
// cronジョブやバックグラウンド処理で使用
// サービスロールキーを使用するため、RLSポリシーをバイパスできる
export function createServiceRoleSupabase() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("[ERROR] Supabase Service Role Key configuration:");
    console.error("  supabaseUrl:", supabaseUrl ? "✓" : "✗");
    console.error("  supabaseServiceRoleKey:", supabaseServiceRoleKey ? "✓" : "✗");
    throw new Error(
      "Supabase Service Role Key is not configured. " +
      "Please set SUPABASE_SERVICE_ROLE_KEY in your environment variables."
    );
  }
  
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/** API 用: Supabase クライアントを取得。失敗時は throw せず error を返す */
export async function getSupabaseForApi(): Promise<
  | { supabase: Awaited<ReturnType<typeof createServerSupabase>>; error: null }
  | { supabase: null; error: string }
> {
  try {
    const supabase = createServiceRoleSupabase();
    return { supabase, error: null };
  } catch {
    try {
      const supabase = await createServerSupabase();
      return { supabase, error: null };
    } catch (e: any) {
      const msg =
        e?.message ||
        "Supabase の環境変数が未設定です。.env.local に NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, および（推奨）SUPABASE_SERVICE_ROLE_KEY を設定してください。";
      return { supabase: null, error: msg };
    }
  }
}
