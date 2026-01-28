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
  year_built: number | null;
  year_built_month: number | null;
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
  transportation: Array<{ line: string; station: string; walk: string }> | null;
  yield_rate: number | null;
  raw_data: Record<string, any>;
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
  };
  summary: string | null;
  recommendation: "buy" | "hold" | "avoid" | null;
  score: number | null;
  investment_purpose: string | null; // 自由なテキスト（例: "利回り重視", "民泊転用", "資産防衛・節税" など）
  created_at: string;
}
