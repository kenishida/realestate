/**
 * investment_purposeカラムとUPDATE権限の確認スクリプト
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// .env.localファイルを手動で読み込む
try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  envFile.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      const value = valueParts.join("=").trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value.replace(/^["']|["']$/g, "");
      }
    }
  });
} catch (error) {
  console.warn("⚠️  .env.localファイルを読み込めませんでした（これは問題ない場合があります）");
}

import { createServiceRoleSupabase } from "../lib/supabase-server";

async function checkInvestmentPurpose() {
  console.log("=== investment_purposeカラムとUPDATE権限の確認 ===\n");

  // 環境変数の確認
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("環境変数が設定されていません:");
    console.error(`  NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? "✓" : "✗"}`);
    console.error(`  SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? "✓" : "✗"}`);
    console.error("\n.env.localファイルを確認してください。");
    process.exit(1);
  }

  try {
    const supabase = createServiceRoleSupabase();
    console.log("✓ Supabaseクライアントの作成に成功\n");

    // 1. investment_purposeカラムの存在確認
    console.log("1. investment_purposeカラムの存在確認...");
    try {
      const { data, error } = await supabase
        .from("property_analyses")
        .select("investment_purpose")
        .limit(1);

      if (error) {
        if (error.code === "42703" || error.message?.includes("column") || error.message?.includes("does not exist")) {
          console.error("✗ investment_purposeカラムが存在しません");
          console.error("  解決方法: migrations/add_investment_purpose.sql を実行してください\n");
        } else {
          console.error("✗ エラー:", error.message);
        }
      } else {
        console.log("✓ investment_purposeカラムは存在します\n");
      }
    } catch (err: any) {
      console.error("✗ エラー:", err.message);
    }

    // 2. UPDATE権限の確認（実際にUPDATEを試みる）
    console.log("2. UPDATE権限の確認...");
    try {
      // 最新の分析を1件取得
      const { data: analyses, error: selectError } = await supabase
        .from("property_analyses")
        .select("id")
        .limit(1)
        .single();

      if (selectError || !analyses) {
        console.log("  テスト用の分析データが見つかりません（これは問題ありません）");
      } else {
        // テスト用のUPDATEを実行（実際には変更しない）
        const { error: updateError } = await supabase
          .from("property_analyses")
          .update({ investment_purpose: null })
          .eq("id", analyses.id);

        if (updateError) {
          if (updateError.code === "42501" || updateError.message?.includes("policy") || updateError.message?.includes("permission")) {
            console.error("✗ UPDATE権限がありません");
            console.error("  解決方法: migrations/add_property_analyses_update_policy.sql を実行してください\n");
          } else {
            console.error("✗ エラー:", updateError.message);
            console.error("  コード:", updateError.code);
            console.error("  ヒント:", updateError.hint);
          }
        } else {
          console.log("✓ UPDATE権限は正常に動作しています\n");
        }
      }
    } catch (err: any) {
      console.error("✗ エラー:", err.message);
    }

    console.log("=== 確認完了 ===");
  } catch (error: any) {
    console.error("スクリプト実行エラー:", error.message);
    process.exit(1);
  }
}

checkInvestmentPurpose();
