// Supabaseの設定状況を確認するスクリプト
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

console.log("=== Supabase設定確認 ===\n");

console.log("環境変数の設定状況:");
console.log(`  NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? "✓ 設定済み" : "✗ 未設定"}`);
if (supabaseUrl) {
  console.log(`    値: ${supabaseUrl.substring(0, 30)}...`);
}
console.log(`  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? "✓ 設定済み" : "✗ 未設定"}`);
if (supabaseAnonKey) {
  console.log(`    長さ: ${supabaseAnonKey.length}文字`);
}
console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceRoleKey ? "✓ 設定済み" : "✗ 未設定"}`);
if (supabaseServiceRoleKey) {
  console.log(`    長さ: ${supabaseServiceRoleKey.length}文字`);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.log("\n⚠️  Supabaseの環境変数が設定されていません。");
  console.log("   .env.localファイルに以下を設定してください:");
  console.log("   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url");
  console.log("   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key");
  process.exit(1);
}

console.log("\n接続テストを実行中...");

try {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // テーブル一覧を取得して接続確認
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .limit(1);
  
  if (error) {
    if (error.code === "PGRST116") {
      console.log("✓ Supabaseに接続できました");
      console.log("⚠️  ただし、conversationsテーブルが存在しません。");
      console.log("   マイグレーションを実行してください: migrations/create_chat_schema.sql");
    } else {
      console.log("✗ 接続エラー:", error.message);
      console.log("   エラーコード:", error.code);
    }
  } else {
    console.log("✓ Supabaseに接続できました");
    console.log("✓ conversationsテーブルが存在します");
  }
} catch (error: any) {
  console.log("✗ 接続エラー:", error.message);
}
