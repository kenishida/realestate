// データベースの型定義

export interface Conversation {
  id: string;
  user_id: string | null;
  title: string | null;
  custom_path: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  property_url: string | null;
  property_id: string | null;
  created_at: string;
  metadata: Record<string, any>;
}

export interface Property {
  id: string;
  url: string;
  source: string | null;
  title: string | null;
  price: number | null;
  price_per_sqm: number | null;
  location: string | null;
  address: string | null;
  property_type: string | null;
  building_area: number | null;
  land_area: number | null;
  year_built: number | null; // 築年（西暦、例: 1998）。旧データでは築年数の場合あり（後方互換のため 1900未満は築年数として扱う）
  year_built_month: number | null; // 築月（1–12）
  floor_plan: string | null;
  building_floors: string | null;
  floor_number: string | null;
  access: string | null;
  building_structure: string | null;
  road_access: string | null;
  floor_area_ratio: number | null;
  building_coverage_ratio: number | null;
  land_category: string | null;
  zoning: string | null;
  urban_planning: string | null;  // 都市計画区域（市街化区域、市街化調整区域など）
  land_rights: string | null;     // 土地権利（所有権、借地権など）
  transportation: Array<{ line: string; station: string; walk: string }> | null;
  yield_rate: number | null;
  raw_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/** 外部環境の1件の施設（Places API の結果を正規化） */
export interface ExternalEnvPlace {
  name: string;
  address?: string;
  distance_m?: number;
  types?: string[];
}

export interface PropertyExternalEnv {
  id: string;
  property_id: string;
  area_overview: string | null;
  schools: ExternalEnvPlace[];
  hospitals: ExternalEnvPlace[];
  supermarkets: ExternalEnvPlace[];
  convenience_stores: ExternalEnvPlace[];
  status: "pending" | "completed" | "failed";
  error_message: string | null;
  fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyAnalysis {
  id: string;
  property_id: string;
  conversation_id: string | null;
  message_id: string | null;
  analysis_result: {
    pros?: string[];
    cons?: string[];
    risks?: string[];
    opportunities?: string[];
    market_comparison?: any;
    financial_analysis?: {
      expected_yield?: number;
      cash_flow?: number;
      roi?: number;
    };
    structured?: any;
    summary?: string;
    full_analysis?: string;
  };
  /** 構造化分析結果（API/DBで保存される場合） */
  structured_analysis?: any;
  /** セクション別スコア */
  section_scores?: Record<string, number>;
  summary: string | null;
  recommendation: "buy" | "hold" | "avoid" | null;
  score: number | null;
  investment_purpose: string | null; // 自由なテキスト（例: "利回り重視", "民泊転用", "資産防衛・節税" など）
  created_at: string;
}

/** 収支シミュレーション（投資判断に紐づく、前提・結果を保存して物件同士の比較用） */
export interface CashflowSimulation {
  id: string;
  property_analysis_id: string;
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
  created_at: string;
}
