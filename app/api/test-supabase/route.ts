import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Supabase接続テスト用エンドポイント
 */
export async function GET() {
  try {
    const supabase = await createServerSupabase();
    
    // 接続テスト: テーブル一覧を取得してみる
    const { data, error } = await supabase
      .from("conversations")
      .select("id")
      .limit(1);
    
    if (error) {
      if (error.code === "PGRST116" || error.message.includes("does not exist")) {
        return NextResponse.json({
          success: true,
          connected: true,
          message: "Supabaseに接続できましたが、テーブルが存在しません",
          error: error.message,
          code: error.code,
          action: "マイグレーションを実行してください: migrations/create_chat_schema.sql",
        });
      }
      
      return NextResponse.json({
        success: false,
        connected: false,
        error: error.message,
        code: error.code,
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      connected: true,
      message: "Supabaseに正常に接続できました",
      tableExists: true,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      connected: false,
      error: error.message || "Unknown error",
      details: error.stack,
    }, { status: 500 });
  }
}
