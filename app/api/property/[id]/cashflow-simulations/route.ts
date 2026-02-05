import { NextResponse } from "next/server";
import { getSupabaseForApi } from "@/lib/supabase-server";
import { runCashflowSimulation } from "@/lib/run-cashflow-simulation";
import type { CashflowSimulation } from "@/lib/types";

const DEFAULT_DOWN_PAYMENT = 10_000_000;

/**
 * 収支シミュレーションを新規作成（投資判断に紐づけて保存）
 * POST body: { assumed_rent_yen: number, down_payment_yen?: number }
 * ブラウザからの直接呼び出し用。RAG からは runCashflowSimulation を直接利用すること。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;
    const body = await request.json();
    const assumedRentYen = body?.assumed_rent_yen != null ? Number(body.assumed_rent_yen) : null;
    const downPaymentYen = body?.down_payment_yen != null ? Number(body.down_payment_yen) : DEFAULT_DOWN_PAYMENT;

    if (assumedRentYen == null || !Number.isFinite(assumedRentYen) || assumedRentYen <= 0) {
      return NextResponse.json(
        { success: false, error: "assumed_rent_yen is required and must be a positive number." },
        { status: 400 }
      );
    }

    const { supabase, error: supabaseError } = await getSupabaseForApi();
    if (supabaseError || !supabase) {
      return NextResponse.json(
        { success: false, error: supabaseError ?? "Database is not available.", code: "SUPABASE_CONFIG" },
        { status: 503 }
      );
    }

    const result = await runCashflowSimulation({
      supabase,
      propertyId,
      assumed_rent_yen: assumedRentYen,
      down_payment_yen: downPaymentYen,
    });

    if (!result.success) {
      const status =
        result.error === "Property not found" ? 404 :
        result.error.includes("assumed_rent_yen") || result.error.includes("price") || result.error.includes("analysis") ? 400 : 500;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }

    return NextResponse.json({
      success: true,
      simulation: result.simulation as CashflowSimulation,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CashflowSimulations API] Error:", error);
    return NextResponse.json(
      { success: false, error: msg ?? "Unknown error" },
      { status: 500 }
    );
  }
}
