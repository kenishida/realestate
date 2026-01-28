import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase-server";

/**
 * 保存されている物件データ一覧を取得するエンドポイント
 */
export async function GET(request: Request) {
  try {
    let supabase;
    try {
      supabase = createServiceRoleSupabase();
    } catch {
      return NextResponse.json(
        { error: "Supabase client not available" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const url = searchParams.get("url");

    let query = supabase
      .from("properties")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (url) {
      query = query.eq("url", url);
    }

    const { data: properties, error } = await query;

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to query properties",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: properties?.length || 0,
      properties: properties?.map((p: any) => ({
        id: p.id,
        url: p.url,
        source: p.source,
        title: p.title,
        price: p.price,
        address: p.address,
        floor_plan: p.floor_plan,
        year_built: p.year_built,
        building_area: p.building_area,
        land_area: p.land_area,
        building_structure: p.building_structure,
        zoning: p.zoning,
        access: p.access ? p.access.substring(0, 100) : null, // プレビューのみ
        transportation: p.transportation,
        created_at: p.created_at,
        updated_at: p.updated_at,
      })) || [],
    });
  } catch (error: any) {
    console.error("[List Properties] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
