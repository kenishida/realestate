import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase-server";

/**
 * 保存されたHTMLを取得するエンドポイント（全文）
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const id = searchParams.get("id");

    if (!url && !id) {
      return NextResponse.json(
        { error: "URL or id parameter is required" },
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
    let query = supabase.from("property_html_storage").select("html, id, url, status, created_at");
    
    if (id) {
      query = query.eq("id", id);
    } else {
      query = query.eq("url", url).order("created_at", { ascending: false }).limit(1);
    }

    const { data: htmlStorage, error } = await query.single();

    if (error) {
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
        created_at: htmlStorage.created_at,
        html: htmlStorage.html,
        html_length: htmlStorage.html?.length || 0,
      },
    });
  } catch (error: any) {
    console.error("[Get HTML] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
