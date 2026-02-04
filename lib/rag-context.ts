import type { SupabaseClient } from "@supabase/supabase-js";
import type { Property, PropertyAnalysis, PropertyExternalEnv, CashflowSimulation } from "@/lib/types";

export interface RagContextResult {
  /** プロンプトに載せるテキスト（物件・分析・外部環境・収支の要約） */
  chunksText: string;
  /** 投資判断のID（analyze-purpose / cashflow 呼び出し用） */
  analysisId: string | null;
  /** 物件ID */
  propertyId: string;
  /** 物件（価格など収支用） */
  property: Property | null;
  /** 投資判断（最新1件） */
  analysis: PropertyAnalysis | null;
}

/**
 * 物件IDに紐づくデータを取得し、RAG用のテキストチャンクを組み立てる。
 * ベクトル検索は行わず、当該物件の全ソースをテキスト化する。
 */
export async function buildRagContext(
  propertyId: string,
  supabase: SupabaseClient
): Promise<RagContextResult> {
  const chunks: string[] = [];

  // 物件情報
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();

  if (propertyError || !property) {
    return {
      chunksText: "",
      analysisId: null,
      propertyId,
      property: null,
      analysis: null,
    };
  }

  const p = property as Property;
  const propLines = [
    "【物件概要】",
    `物件名: ${p.title ?? "不明"}`,
    `価格: ${p.price != null ? `${p.price.toLocaleString()}円` : "不明"}`,
    `所在地: ${p.address ?? p.location ?? "不明"}`,
    `間取り: ${p.floor_plan ?? "不明"}`,
    `築年数: ${p.year_built != null ? (p.year_built >= 1900 ? `${new Date().getFullYear() - p.year_built}年` : `${p.year_built}年`) : "不明"}`,
    `交通: ${p.access ?? p.transportation?.map((t) => `${t.line} ${t.station} 徒歩${t.walk}`).join(" / ") ?? "不明"}`,
    `用途地域: ${p.zoning ?? p.urban_planning ?? "不明"}`,
  ].filter(Boolean);
  chunks.push(propLines.join("\n"));

  // 投資判断（最新1件）
  const { data: analyses, error: analysesError } = await supabase
    .from("property_analyses")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(1);

  let analysis: PropertyAnalysis | null = null;
  let analysisId: string | null = null;

  if (!analysesError && analyses && analyses.length > 0) {
    analysis = analyses[0] as PropertyAnalysis;
    analysisId = analysis.id;

    const res = analysis.analysis_result as any;
    const summary = analysis.summary ?? res?.summary ?? "";
    const fullAnalysis = res?.full_analysis ?? "";
    const structured = analysis.structured_analysis ?? res?.structured ?? {};
    const purposeAnalysis = analysis.investment_purpose
      ? `投資目的: ${analysis.investment_purpose}`
      : "";

    const analysisLines = [
      "【投資判断】",
      `推奨度: ${analysis.recommendation ?? "不明"}`,
      `スコア: ${analysis.score ?? "不明"}`,
      summary ? `サマリ: ${summary}` : "",
      fullAnalysis ? `詳細:\n${fullAnalysis}` : "",
      purposeAnalysis,
    ];
    if (structured?.property_overview) {
      const po = structured.property_overview;
      if (po.location?.comment) analysisLines.push(`立地評価: ${po.location.comment}`);
      if (po.price?.comment) analysisLines.push(`価格評価: ${po.price.comment}`);
      if (po.building?.comment) analysisLines.push(`建物評価: ${po.building.comment}`);
    }
    if (structured?.purpose_specific_analysis && typeof structured.purpose_specific_analysis === "object") {
      analysisLines.push("【投資目的別分析】");
      for (const [key, val] of Object.entries(structured.purpose_specific_analysis)) {
        const text = typeof val === "string" ? val : (val as any)?.merits_demerits ?? (val as any)?.detailed_analysis ?? JSON.stringify(val);
        analysisLines.push(`${key}:\n${text}`);
      }
    }
    chunks.push(analysisLines.filter(Boolean).join("\n"));
  }

  // 外部環境（学校・コンビニ等）
  const { data: extEnv, error: extError } = await supabase
    .from("property_external_env")
    .select("*")
    .eq("property_id", propertyId)
    .single();

  if (!extError && extEnv) {
    const env = extEnv as PropertyExternalEnv;
    const envLines = ["【周辺環境】"];
    if (env.area_overview) envLines.push(env.area_overview);
    if (env.schools?.length) envLines.push(`学校: ${env.schools.map((s) => `${s.name}${s.distance_m != null ? ` ${s.distance_m}m` : ""}`).join(", ")}`);
    if (env.convenience_stores?.length) envLines.push(`コンビニ: ${env.convenience_stores.map((s) => `${s.name}${s.distance_m != null ? ` ${s.distance_m}m` : ""}`).join(", ")}`);
    if (env.supermarkets?.length) envLines.push(`スーパー: ${env.supermarkets.map((s) => `${s.name}${s.distance_m != null ? ` ${s.distance_m}m` : ""}`).join(", ")}`);
    if (env.hospitals?.length) envLines.push(`病院: ${env.hospitals.map((s) => `${s.name}${s.distance_m != null ? ` ${s.distance_m}m` : ""}`).join(", ")}`);
    if (envLines.length > 1) chunks.push(envLines.join("\n"));
  }

  // 収支シミュレーション（保存済み）
  if (analysisId) {
    const { data: sims, error: simsError } = await supabase
      .from("cashflow_simulations")
      .select("*")
      .eq("property_analysis_id", analysisId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!simsError && sims && sims.length > 0) {
      const simLines = ["【収支シミュレーション（保存済み）】"];
      for (const s of sims as CashflowSimulation[]) {
        const yieldPct = s.gpi_yen > 0 ? ((s.noi_yen / (s.property_price_yen || 1)) * 100).toFixed(2) : "-";
        simLines.push(`想定家賃 月額${s.assumed_rent_yen.toLocaleString()}円 → 利回り目安 ${yieldPct}%、NOI ${s.noi_yen?.toLocaleString()}円/年`);
      }
      chunks.push(simLines.join("\n"));
    }
  }

  const chunksText = chunks.join("\n\n---\n\n");

  return {
    chunksText,
    analysisId,
    propertyId,
    property: p,
    analysis,
  };
}
