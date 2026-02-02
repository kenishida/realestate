import { NextResponse } from "next/server";
import { getSupabaseForApi } from "@/lib/supabase-server";
import type { Property, PropertyAnalysis, CashflowSimulation } from "@/lib/types";
import { computeCashflow } from "@/lib/cashflow-simulation";

const DEFAULT_DOWN_PAYMENT = 10_000_000;

/**
 * 収支シミュレーションを新規作成（投資判断に紐づけて保存）
 * POST body: { assumed_rent_yen: number, down_payment_yen?: number }
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

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, price")
      .eq("id", propertyId)
      .single();

    if (propertyError || !property) {
      return NextResponse.json(
        { success: false, error: "Property not found" },
        { status: 404 }
      );
    }

    const price = (property as Property).price;
    if (price == null || price <= 0) {
      return NextResponse.json(
        { success: false, error: "Property price is not set. Cannot run simulation." },
        { status: 400 }
      );
    }

    const { data: analyses, error: analysesError } = await supabase
      .from("property_analyses")
      .select("id")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (analysesError || !analyses?.length) {
      return NextResponse.json(
        { success: false, error: "No investment analysis found for this property. Run analysis first." },
        { status: 400 }
      );
    }

    const analysis = analyses[0] as PropertyAnalysis;
    const result = computeCashflow({
      propertyPriceYen: price,
      downPaymentYen: Number.isFinite(downPaymentYen) ? downPaymentYen : DEFAULT_DOWN_PAYMENT,
      monthlyRentYen: Math.round(assumedRentYen),
    });

    const row = {
      property_analysis_id: analysis.id,
      property_price_yen: result.assumptions.propertyPriceYen,
      acquisition_cost_yen: result.assumptions.acquisitionCostYen,
      down_payment_yen: result.assumptions.downPaymentYen,
      loan_amount_yen: result.assumptions.loanAmountYen,
      interest_rate: result.assumptions.interestRate,
      loan_years: result.assumptions.loanYears,
      assumed_rent_yen: result.assumptions.monthlyRentYen,
      vacancy_rate: result.assumptions.vacancyRate,
      opex_rate: result.assumptions.opexRate,
      gpi_yen: result.annual.gpi,
      vacancy_loss_yen: result.annual.vacancyLoss,
      egi_yen: result.annual.egi,
      opex_yen: result.annual.opex,
      noi_yen: result.annual.noi,
      ads_yen: result.annual.ads,
      btcf_yen: result.annual.btcf,
      monthly_repayment_yen: result.monthlyRepayment,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("cashflow_simulations")
      .insert(row)
      .select("*")
      .single();

    if (insertError) {
      console.error("[CashflowSimulations API] Insert error:", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      simulation: inserted as CashflowSimulation,
    });
  } catch (error: any) {
    console.error("[CashflowSimulations API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
