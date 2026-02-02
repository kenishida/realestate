/**
 * 収支シミュレーション（年間キャッシュフロー）の計算
 * 前提: 物件価格は既知、想定家賃を入力して計算
 */

export interface CashflowAssumptions {
  /** 物件価格（円） */
  propertyPriceYen: number;
  /** 諸経費（円）デフォルトは概算（登記・仲介等） */
  acquisitionCostYen?: number;
  /** 自己資金（円） */
  downPaymentYen: number;
  /** 金利（例: 0.02 = 2%） */
  interestRate?: number;
  /** 返済年数 */
  loanYears?: number;
  /** 想定月額家賃（円） */
  monthlyRentYen: number;
  /** 空室・未回収率（0-1、例: 0.05 = 5%） */
  vacancyRate?: number;
  /** OPEX率（家賃収入に対する運営費比率、0-1、例: 0.2 = 20%） */
  opexRate?: number;
}

export interface CashflowResult {
  /** 前提条件 */
  assumptions: {
    propertyPriceYen: number;
    acquisitionCostYen: number;
    downPaymentYen: number;
    loanAmountYen: number;
    interestRate: number;
    loanYears: number;
    monthlyRentYen: number;
    vacancyRate: number;
    opexRate: number;
  };
  /** 年間収支（円） */
  annual: {
    gpi: number;   // 潜在総収入
    vacancyLoss: number;
    egi: number;   // 実効総収入
    opex: number;  // 運営費
    noi: number;   // 営業純利益
    ads: number;   // ローン返済額
    btcf: number;  // 税引前CF
  };
  /** 月額返済（円） */
  monthlyRepayment: number;
}

const DEFAULT_ACQUISITION_COST_RATIO = 5_000_000 / 75_000_000; // 約500万/7500万
const DEFAULT_INTEREST_RATE = 0.02;
const DEFAULT_LOAN_YEARS = 30;
const DEFAULT_VACANCY_RATE = 0.05;
const DEFAULT_OPEX_RATE = 0.2;

/** 元利均等の年間返済額を計算（月次換算して12倍） */
function annualRepayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  const n = years * 12;
  const monthly = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(monthly * 12);
}

export function computeCashflow(params: CashflowAssumptions): CashflowResult {
  const acquisitionCostYen = params.acquisitionCostYen ?? Math.round(params.propertyPriceYen * DEFAULT_ACQUISITION_COST_RATIO);
  const totalCost = params.propertyPriceYen + acquisitionCostYen;
  const loanAmountYen = Math.max(0, totalCost - params.downPaymentYen);
  const interestRate = params.interestRate ?? DEFAULT_INTEREST_RATE;
  const loanYears = params.loanYears ?? DEFAULT_LOAN_YEARS;
  const vacancyRate = params.vacancyRate ?? DEFAULT_VACANCY_RATE;
  const opexRate = params.opexRate ?? DEFAULT_OPEX_RATE;

  const adsAnnual = annualRepayment(loanAmountYen, interestRate, loanYears);
  const monthlyRepayment = loanAmountYen > 0 ? Math.round(adsAnnual / 12) : 0;

  const gpi = params.monthlyRentYen * 12;
  const vacancyLoss = Math.round(gpi * vacancyRate);
  const egi = gpi - vacancyLoss;
  const opex = Math.round(egi * opexRate);
  const noi = egi - opex;
  const btcf = noi - adsAnnual;

  return {
    assumptions: {
      propertyPriceYen: params.propertyPriceYen,
      acquisitionCostYen,
      downPaymentYen: params.downPaymentYen,
      loanAmountYen,
      interestRate,
      loanYears,
      monthlyRentYen: params.monthlyRentYen,
      vacancyRate,
      opexRate,
    },
    annual: {
      gpi,
      vacancyLoss,
      egi,
      opex,
      noi,
      ads: adsAnnual,
      btcf,
    },
    monthlyRepayment,
  };
}

/** DBの cashflow_simulations 行を表示用 CashflowResult に変換（物件同士の比較用に保存したデータを表示） */
export function cashflowSimulationToResult(row: {
  property_price_yen: number;
  acquisition_cost_yen: number;
  down_payment_yen: number;
  loan_amount_yen: number;
  interest_rate: number;
  loan_years: number;
  assumed_rent_yen: number;
  vacancy_rate: number;
  opex_rate: number;
  gpi_yen: number;
  vacancy_loss_yen: number;
  egi_yen: number;
  opex_yen: number;
  noi_yen: number;
  ads_yen: number;
  btcf_yen: number;
  monthly_repayment_yen: number;
}): CashflowResult {
  return {
    assumptions: {
      propertyPriceYen: row.property_price_yen,
      acquisitionCostYen: row.acquisition_cost_yen,
      downPaymentYen: row.down_payment_yen,
      loanAmountYen: row.loan_amount_yen,
      interestRate: Number(row.interest_rate),
      loanYears: row.loan_years,
      monthlyRentYen: row.assumed_rent_yen,
      vacancyRate: Number(row.vacancy_rate),
      opexRate: Number(row.opex_rate),
    },
    annual: {
      gpi: row.gpi_yen,
      vacancyLoss: row.vacancy_loss_yen,
      egi: row.egi_yen,
      opex: row.opex_yen,
      noi: row.noi_yen,
      ads: row.ads_yen,
      btcf: row.btcf_yen,
    },
    monthlyRepayment: row.monthly_repayment_yen,
  };
}
