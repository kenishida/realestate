import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.log("✗ 環境変数が設定されていません");
  console.log("   NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.log("   NEXT_PUBLIC_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✓" : "✗");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCustomPath() {
  console.log("==========================================");
  console.log("custom_path の状態を確認します");
  console.log("==========================================\n");

  try {
    // 1. conversationsテーブルの構造を確認
    console.log("1. conversationsテーブルの構造を確認...");
    const { data: sample, error: sampleError } = await supabase
      .from("conversations")
      .select("*")
      .limit(1);

    if (sampleError) {
      if (sampleError.code === "PGRST116") {
        console.log("   ✗ conversationsテーブルが存在しません");
        console.log("   マイグレーションを実行してください: migrations/create_chat_schema.sql");
        return;
      }
      console.log("   ✗ エラー:", sampleError.message);
      return;
    }

    if (sample && sample.length > 0) {
      console.log("   ✓ conversationsテーブルが存在します");
      console.log("   サンプルレコードのカラム:", Object.keys(sample[0]).join(", "));
      
      // custom_pathカラムが存在するか確認
      if ("custom_path" in sample[0]) {
        console.log("   ✓ custom_pathカラムが存在します");
      } else {
        console.log("   ✗ custom_pathカラムが存在しません");
        console.log("   マイグレーションを実行してください: migrations/add_additional_urls.sql");
        return;
      }
    } else {
      console.log("   ⚠️  conversationsテーブルは存在しますが、レコードがありません");
    }

    // 2. 全レコードのcustom_pathの状態を確認
    console.log("\n2. 全レコードのcustom_pathの状態を確認...");
    const { data: allConversations, error: allError } = await supabase
      .from("conversations")
      .select("id, custom_path, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(20);

    if (allError) {
      console.log("   ✗ エラー:", allError.message);
      console.log("   エラーコード:", allError.code);
      if (allError.code === "42501") {
        console.log("   ⚠️  RLSポリシーの問題の可能性があります");
      }
      return;
    }

    if (!allConversations || allConversations.length === 0) {
      console.log("   ⚠️  レコードがありません");
      return;
    }

    console.log(`   ✓ ${allConversations.length}件のレコードを取得しました\n`);

    const withPath = allConversations.filter((c: any) => c.custom_path);
    const withoutPath = allConversations.filter((c: any) => !c.custom_path);

    console.log(`   - custom_pathが設定されている: ${withPath.length}件`);
    console.log(`   - custom_pathが設定されていない: ${withoutPath.length}件`);

    if (withPath.length > 0) {
      console.log("\n   custom_pathが設定されているレコード（最初の5件）:");
      withPath.slice(0, 5).forEach((c: any) => {
        console.log(`     - ID: ${c.id.substring(0, 8)}..., custom_path: ${c.custom_path}, created_at: ${c.created_at}`);
      });
    }

    if (withoutPath.length > 0) {
      console.log("\n   custom_pathが設定されていないレコード（最初の5件）:");
      withoutPath.slice(0, 5).forEach((c: any) => {
        console.log(`     - ID: ${c.id.substring(0, 8)}..., user_id: ${c.user_id}, created_at: ${c.created_at}`);
      });
    }

    // 3. 最新のレコードを詳しく確認
    console.log("\n3. 最新のレコードを詳しく確認...");
    const latest = allConversations[0];
    console.log(`   ID: ${latest.id}`);
    console.log(`   custom_path: ${latest.custom_path || "NULL"}`);
    console.log(`   user_id: ${latest.user_id || "NULL"}`);
    console.log(`   created_at: ${latest.created_at}`);

  } catch (error: any) {
    console.log("✗ エラーが発生しました:", error.message);
    console.log(error.stack);
  }
}

checkCustomPath();
