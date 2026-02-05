import type { SupabaseClient } from "@supabase/supabase-js";
import type { Property, PropertyAnalysis, CashflowSimulation } from "@/lib/types";
import { computeCashflow } from "@/lib/cashflow-simulation";

const DEFAULT_DOWN_PAYMENT = 10_000_000;

export interface RunCashflowSimulationParams {
  supabase: SupabaseClient;
  propertyId: string;
  assumed_rent_yen: number;
  down_payment_yen?: number;
}

export interface RunCashflowSimulationResult {
  success: true;
  simulation: CashflowSimulation;
}

export interface RunCashflowSimulationError {
  success: false;
  error: string;
}

export type RunCashflowSimulationOutput = RunCashflowSimulationResult | RunCashflowSimulationError;

/**
 * 収支シミュレーションを実行してDBに保存（API 経由の fetch を使わず直接呼び出し用）
 */
export async function runCashflowSimulation(
  params: RunCashflowSimulationParams
): Promise<RunCashflowSimulationOutput> {
  const { supabase, propertyId, assumed_rent_yen, down_payment_yen = DEFAULT_DOWN_PAYMENT } = params;

  if (assumed_rent_yen == null || !Number.isFinite(assumed_rent_yen) || assumed_rent_yen <= 0) {
    return { success: false, error: "assumed_rent_yen is required and must be a positive number." };
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, price")
    .eq("id", propertyId)
    .single();

  if (propertyError || !property) {
    return { success: false, error: "Property not found" };
  }

  const price = (property as Property).price;
  if (price == null || price <= 0) {
    return { success: false, error: "Property price is not set. Cannot run simulation." };
  }

  const { data: analyses, error: analysesError } = await supabase
    .from("property_analyses")
    .select("id")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (analysesError || !analyses?.length) {
    return { success: false, error: "No investment analysis found for this property. Run analysis first." };
  }

  const analysis = analyses[0] as PropertyAnalysis;
  const dp = Number.isFinite(down_payment_yen) ? down_payment_yen : DEFAULT_DOWN_PAYMENT;
  const result = computeCashflow({
    propertyPriceYen: price,
    downPaymentYen: dp,
    monthlyRentYen: Math.round(assumed_rent_yen),
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
    console.error("[RunCashflowSimulation] Insert error:", insertError);
    return { success: false, error: insertError.message };
  }

  return { success: true, simulation: inserted as CashflowSimulation };
}
