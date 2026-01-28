import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// シングルトンインスタンス（クライアントサイド用）
let clientSupabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

// クライアントサイド用のSupabaseクライアント（ブラウザで使用）
export function createClientSupabase() {
  // 既にインスタンスが存在する場合は再利用
  if (typeof window !== "undefined" && clientSupabaseInstance) {
    return clientSupabaseInstance;
  }
  
  // クッキーを適切に処理するための設定
  const client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return document.cookie.split(';').map(cookie => {
          const [name, ...rest] = cookie.split('=');
          return { name: name.trim(), value: rest.join('=') };
        });
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          const cookieOptions = [
            `path=${options?.path || '/'}`,
            options?.domain ? `domain=${options.domain}` : '',
            options?.maxAge ? `max-age=${options.maxAge}` : '',
            options?.expires ? `expires=${options.expires.toUTCString()}` : '',
            options?.secure ? 'secure' : '',
            options?.httpOnly ? 'httpOnly' : '',
            options?.sameSite ? `sameSite=${options.sameSite}` : '',
          ].filter(Boolean).join('; ');
          
          document.cookie = `${name}=${value}; ${cookieOptions}`;
        });
      },
    },
  });
  
  // ブラウザ環境でのみインスタンスを保存
  if (typeof window !== "undefined") {
    clientSupabaseInstance = client;
  }
  
  return client;
}
