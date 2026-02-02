import { NextResponse } from "next/server";
import { getSupabaseForApi } from "@/lib/supabase-server";
import { runExternalEnvResearch } from "@/lib/external-env-research";

/**
 * 物件の住所を元に外部環境リサーチを実行する（非同期トリガー用・手動再取得用）
 */
export async function POST(
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
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("id, address")
      .eq("id", propertyId)
      .single();

    if (propError || !property) {
      return NextResponse.json(
        { success: false, error: "Property not found" },
        { status: 404 }
      );
    }

    const result = await runExternalEnvResearch(propertyId, property.address ?? null);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, property_id: propertyId });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
