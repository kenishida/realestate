import { NextResponse } from "next/server";
import { getSupabaseForApi } from "@/lib/supabase-server";
import type { PropertyExternalEnv } from "@/lib/types";

/**
 * 物件IDに紐づく外部環境データを取得する
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;

    const { supabase, error: supabaseError } = await getSupabaseForApi();
    if (supabaseError || !supabase) {
      return NextResponse.json(
        { success: false, error: supabaseError ?? "Database is not available.", code: "SUPABASE_CONFIG" },
        { status: 503 }
      );
    }

    const { data, error } = await supabase
      .from("property_external_env")
      .select("*")
      .eq("property_id", propertyId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: true, data: null, status: "none" },
          { status: 200 }
        );
      }
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as PropertyExternalEnv,
      status: data?.status ?? "none",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
