import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase-server";

/**
 * HTML保存状況を確認するエンドポイント
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "URL parameter is required" },
        { status: 400 }
      );
    }

    let supabase;
    try {
      supabase = createServiceRoleSupabase();
    } catch {
      return NextResponse.json(
        { error: "Supabase client not available" },
        { status: 500 }
      );
    }

    // HTML保存データを取得
    const { data: htmlStorage, error } = await supabase
      .from("property_html_storage")
      .select("*")
      .eq("url", url)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to query HTML storage",
          details: error.message,
        },
        { status: 500 }
      );
    }

    if (!htmlStorage) {
      return NextResponse.json({
        success: false,
        found: false,
        message: "HTML not found in storage",
      });
    }

    return NextResponse.json({
      success: true,
      found: true,
      data: {
        id: htmlStorage.id,
        url: htmlStorage.url,
        status: htmlStorage.status,
        error_message: htmlStorage.error_message,
        content_length: htmlStorage.content_length,
        created_at: htmlStorage.created_at,
        html_preview: htmlStorage.html?.substring(0, 1000) || null, // 最初の1000文字のみ
        html_length: htmlStorage.html?.length || 0,
      },
    });
  } catch (error: any) {
    console.error("[Check HTML] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
