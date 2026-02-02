"use client";

import { useState, useEffect } from "react";
import CashflowSimulation from "@/components/CashflowSimulation";
import type { CashflowResult } from "@/lib/cashflow-simulation";
import type { CashflowSimulation as CashflowSimulationRow } from "@/lib/types";
import { cashflowSimulationToResult } from "@/lib/cashflow-simulation";

interface InvestmentAnalysisProps {
  analysis?: {
    recommendation?: "buy" | "hold" | "avoid" | null;
    score?: number | null;
    summary?: string | null;
    full_analysis?: string | null;
    investment_purpose?: string | null;
    section_scores?: {
      location?: number;
      price?: number;
      building?: number;
      yield?: number;
      overall?: number;
    };
    structured_analysis?: {
      property_overview?: {
        location?: { score: number; max_score: number; stars: string; comment: string };
        price?: { score: number; max_score: number; stars: string; comment: string };
        building?: { score: number; max_score: number; stars: string; comment: string };
      };
      investment_simulation?: {
        estimated_rent?: string;
        estimated_yield?: string;
        calculation?: string;
        judgment?: string;
      };
      merits?: Array<{ title: string; description: string }>;
      risks?: Array<{ title: string; description: string }>;
      final_judgment?: {
        yield_focused?: { recommendation: string; reason: string };
        asset_protection?: { recommendation: string; reason: string };
        soho_use?: { recommendation: string; reason: string };
        [key: string]: { recommendation?: string; reason?: string; detailed_analysis?: string } | undefined;
      };
      purpose_specific_analysis?: {
        [key: string]:
          | string
          | {
              merits_demerits?: string;
              risks?: string;
              recommended_actions?: string;
              evaluation?: string;
            };
      };
      advice?: string;
    };
  };
  /** 表示する収支シミュレーション結果（一覧で選択したもの or チャットで直前に作成したもの） */
  cashflowSimulation?: CashflowResult | null;
  /** DBに保存済みのシミュレーション一覧（物件同士の比較用） */
  cashflowSimulations?: CashflowSimulationRow[];
  /** 一覧で選択中のシミュレーションID */
  selectedSimulationId?: string | null;
  /** 一覧でシミュレーションを選択したときのコールバック */
  onSelectSimulation?: (id: string | null) => void;
  /** true のとき収支シミュレーションタブを開く（チャット連携用） */
  openSimulationTab?: boolean;
}

function formatYen(n: number): string {
  return n.toLocaleString("ja-JP");
}

export default function InvestmentAnalysis({
  analysis,
  cashflowSimulation,
  cashflowSimulations = [],
  selectedSimulationId,
  onSelectSimulation,
  openSimulationTab,
}: InvestmentAnalysisProps) {
  const [subTab, setSubTab] = useState<"property" | "purpose" | "simulation">("property");

  useEffect(() => {
    if (openSimulationTab && cashflowSimulation) setSubTab("simulation");
  }, [openSimulationTab, cashflowSimulation]);

  const analysisSafe = analysis ?? {};
  const structured = analysisSafe.structured_analysis;
  const sectionScores = analysisSafe.section_scores;

  // マークダウン記法を除去する関数
  const removeMarkdown = (text: string | null | undefined): string => {
    if (!text) return "";
    return text
      .replace(/\*\*/g, "") // **太字**
      .replace(/\*/g, "") // *斜体*
      .replace(/__/g, "") // __太字__
      .replace(/_/g, "") // _斜体_
      .replace(/~~/g, "") // ~~取り消し線~~
      .replace(/`/g, "") // `コード`
      .replace(/#{1,6}\s/g, "") // # 見出し
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // [リンクテキスト](URL)
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, "$1") // ![画像](URL)
      .trim();
  };

  // 推奨度の色（派手にしすぎないルール: 購入推奨=緑, 要検討=アンバー, 非推奨=赤、いずれも彩度控えめ）
  const getRecommendationColor = (rec?: string | null) => {
    if (rec === "buy") return "bg-emerald-50 border-emerald-200 text-emerald-800";
    if (rec === "hold") return "bg-amber-50 border-amber-200 text-amber-800";
    if (rec === "avoid") return "bg-red-50 border-red-200 text-red-800";
    return "bg-gray-100 border-gray-200 text-gray-600";
  };

  const getRecommendationText = (rec?: string | null) => {
    if (rec === "buy") return "購入推奨";
    if (rec === "hold") return "要検討";
    if (rec === "avoid") return "非推奨";
    return "評価中";
  };

  const purposeSpecificAnalysis = structured?.purpose_specific_analysis;
  const investmentPurpose = analysisSafe.investment_purpose;

  // 投資目的に応じた分析があるかチェック
  const hasPurposeAnalysis = purposeSpecificAnalysis && Object.keys(purposeSpecificAnalysis).length > 0;
  const hasSimulation = !!cashflowSimulation;

  return (
    <div className="space-y-6">
      {/* サブタブナビゲーション: 投資判断 | 投資目的 | 収支シミュレーション */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setSubTab("property")}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            subTab === "property"
              ? "border-b-2 border-gray-900 text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          投資判断
        </button>
        {hasPurposeAnalysis && (
          <button
            onClick={() => setSubTab("purpose")}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              subTab === "purpose"
                ? "border-b-2 border-gray-900 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            投資目的
          </button>
        )}
        <button
          onClick={() => setSubTab("simulation")}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            subTab === "simulation"
              ? "border-b-2 border-gray-900 text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          収支シミュレーション
        </button>
      </div>

      {/* 投資目的（構造化データでセクション単位にHTML表示） */}
      {subTab === "purpose" && hasPurposeAnalysis && (
        <div className="space-y-6">
          {/* 投資目的の表示 */}
          {investmentPurpose && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">投資目的</div>
              <div className="text-lg font-semibold text-gray-900">{investmentPurpose}</div>
            </div>
          )}

          {/* 投資目的に応じた分析（構造化時はセクション単位、従来はプレーンテキスト） */}
          {Object.entries(purposeSpecificAnalysis).map(([purposeKey, value]) => {
            const isStructured =
              value &&
              typeof value === "object" &&
              !Array.isArray(value) &&
              ("merits_demerits" in value || "risks" in value || "recommended_actions" in value || "evaluation" in value);
            const sections = isStructured ? (value as { merits_demerits?: string; risks?: string; recommended_actions?: string; evaluation?: string }) : null;
            const rawText = typeof value === "string" ? value : "";

            return (
              <div key={purposeKey} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-5">
                  <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
                    {investmentPurpose || purposeKey}に特化した分析
                  </h2>
                </div>
                <div className="p-6">
                  {sections ? (
                    <div className="space-y-6">
                      {sections.merits_demerits && (
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 mb-2 border-b border-gray-100 pb-2">
                            1. メリット・デメリット
                          </h3>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {removeMarkdown(sections.merits_demerits)}
                          </p>
                        </div>
                      )}
                      {sections.risks && (
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 mb-2 border-b border-gray-100 pb-2">
                            2. 注意点・リスク
                          </h3>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {removeMarkdown(sections.risks)}
                          </p>
                        </div>
                      )}
                      {sections.recommended_actions && (
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 mb-2 border-b border-gray-100 pb-2">
                            3. 推奨アクション
                          </h3>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {removeMarkdown(sections.recommended_actions)}
                          </p>
                        </div>
                      )}
                      {sections.evaluation && (
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 mb-2 border-b border-gray-100 pb-2">
                            4. 評価
                          </h3>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {removeMarkdown(sections.evaluation)}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                      {removeMarkdown(rawText)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 投資判断 */}
      {subTab === "property" && (
        <div className="space-y-6">
          {!analysis && (
            <div className="border border-gray-200 bg-white p-6 text-center text-gray-500 text-sm">
              投資判断がありません。トップページで物件URLを入力すると分析を開始できます。
            </div>
          )}
          {analysis && (
          <>
          {/* ヘッダー: スコアと推奨度 */}
          <div className="border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">投資スコア</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums text-gray-900">
                    {analysisSafe.score ?? "-"}
                  </span>
                  <span className="text-sm text-gray-500">/100</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">推奨度</div>
                <span
                  className={`inline-flex items-center px-3 py-1.5 border text-xs font-medium ${getRecommendationColor(
                    analysisSafe.recommendation
                  )}`}
                >
                  {getRecommendationText(analysisSafe.recommendation)}
                </span>
              </div>
            </div>
          </div>

      {/* 1. 物件概要の評価 */}
      {structured?.property_overview && (
        <div className="border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900 tracking-tight">1. 物件概要の評価</h2>
          </div>
          <div className="p-5">
            <div className="space-y-5">
              {/* 立地 */}
              {structured.property_overview.location && (
                <div className="border-l-2 border-gray-300 pl-4 py-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">立地</span>
                    <span className="text-sm font-medium text-gray-600">
                      {structured.property_overview.location.stars}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({structured.property_overview.location.score}/{structured.property_overview.location.max_score})
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {removeMarkdown(structured.property_overview.location.comment)}
                  </p>
                </div>
              )}

              {/* 価格 */}
              {structured.property_overview.price && (
                <div className="border-l-2 border-gray-300 pl-4 py-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">価格</span>
                    <span className="text-sm font-medium text-gray-600">
                      {structured.property_overview.price.stars}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({structured.property_overview.price.score}/{structured.property_overview.price.max_score})
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {removeMarkdown(structured.property_overview.price.comment)}
                  </p>
                </div>
              )}

              {/* 建物 */}
              {structured.property_overview.building && (
                <div className="border-l-2 border-gray-300 pl-4 py-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">建物</span>
                    <span className="text-sm font-medium text-gray-600">
                      {structured.property_overview.building.stars}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({structured.property_overview.building.score}/{structured.property_overview.building.max_score})
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {removeMarkdown(structured.property_overview.building.comment)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. 投資シミュレーション */}
      {structured?.investment_simulation && (
        <div className="border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900 tracking-tight">2. 投資シミュレーション（収益性）</h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              {structured.investment_simulation.estimated_rent && (
                <div className="border border-gray-200 bg-gray-50/50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">想定賃料</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {removeMarkdown(structured.investment_simulation.estimated_rent)}
                  </div>
                </div>
              )}
              {structured.investment_simulation.estimated_yield && (
                <div className="border border-gray-200 bg-gray-50/50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">想定利回り</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {removeMarkdown(structured.investment_simulation.estimated_yield)}
                  </div>
                  {structured.investment_simulation.calculation && (
                    <div className="text-xs text-gray-500 mt-2 font-mono">
                      {removeMarkdown(structured.investment_simulation.calculation)}
                    </div>
                  )}
                </div>
              )}
              {structured.investment_simulation.judgment && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">判断</div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {removeMarkdown(structured.investment_simulation.judgment)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. メリット */}
      {structured?.merits && structured.merits.length > 0 && (
        <div className="border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900 tracking-tight">3. メリット（投資すべき理由）</h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              {structured.merits.map((merit, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-sm bg-gray-200 flex items-center justify-center mt-0.5">
                    <span className="text-gray-600 text-[10px] font-semibold">✓</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900 mb-0.5">{removeMarkdown(merit.title)}</div>
                    <p className="text-sm text-gray-700 leading-relaxed">{removeMarkdown(merit.description)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. リスク・懸念点 */}
      {structured?.risks && structured.risks.length > 0 && (
        <div className="border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900 tracking-tight">4. リスク・懸念点（注意すべき理由）</h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              {structured.risks.map((risk, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-sm bg-gray-300 flex items-center justify-center mt-0.5">
                    <span className="text-gray-700 text-[10px] font-semibold">!</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900 mb-0.5">{removeMarkdown(risk.title)}</div>
                    <p className="text-sm text-gray-700 leading-relaxed">{removeMarkdown(risk.description)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. 最終判断 */}
      {structured?.final_judgment && (
        <div className="border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900 tracking-tight">5. 最終判断</h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              {structured.final_judgment.yield_focused?.recommendation && (
                <div className="border border-gray-200 bg-gray-50/50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">利回り重視の投資家</div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {removeMarkdown(structured.final_judgment.yield_focused.recommendation)}
                  </p>
                </div>
              )}
              {structured.final_judgment.asset_protection?.recommendation && (
                <div className="border border-gray-200 bg-gray-50/50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">資産防衛・節税</div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {removeMarkdown(structured.final_judgment.asset_protection.recommendation)}
                  </p>
                </div>
              )}
              {structured.final_judgment.soho_use?.recommendation && (
                <div className="border border-gray-200 bg-gray-50/50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">住居兼事務所（SOHO）</div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {removeMarkdown(structured.final_judgment.soho_use.recommendation)}
                  </p>
                </div>
              )}
              {structured.advice && (
                <div className="border border-gray-200 bg-gray-50 p-4 mt-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">アドバイス</div>
                  <p className="text-sm text-gray-700 leading-relaxed">{removeMarkdown(structured.advice)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

          {/* フォールバック: 構造化データがない場合 */}
          {!structured && analysisSafe.full_analysis && (
            <div className="border border-gray-200 bg-white overflow-hidden">
              <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900 tracking-tight">投資判断</h2>
              </div>
              <div className="p-5">
                <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                  {removeMarkdown(analysisSafe.full_analysis)}
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      )}

      {/* 収支シミュレーション（保存済み一覧 + 選択表示 or チャットで作成したもの） */}
      {subTab === "simulation" && (
        <div className="space-y-6">
          {cashflowSimulations.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">保存済みシミュレーション（物件同士の比較用）</h3>
              </div>
              <div className="p-3 flex flex-wrap gap-2">
                {cashflowSimulations.map((sim) => (
                  <button
                    key={sim.id}
                    type="button"
                    onClick={() => onSelectSimulation?.(selectedSimulationId === sim.id ? null : sim.id)}
                    className={`rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                      selectedSimulationId === sim.id
                        ? "border-gray-900 bg-gray-100 text-gray-900"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-medium">月{formatYen(sim.assumed_rent_yen)}円</span>
                    <span className="mx-1.5 text-gray-400">/</span>
                    <span>NOI {formatYen(sim.noi_yen)}</span>
                    <span className="mx-1.5 text-gray-400">/</span>
                    <span className={sim.btcf_yen >= 0 ? "text-gray-700" : "text-red-600"}>
                      BTCF {sim.btcf_yen >= 0 ? formatYen(sim.btcf_yen) : `▲${formatYen(-sim.btcf_yen)}`}
                    </span>
                    <span className="ml-1.5 text-gray-400 text-xs">
                      {new Date(sim.created_at).toLocaleDateString("ja-JP")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {hasSimulation ? (
            <CashflowSimulation result={cashflowSimulation!} />
          ) : cashflowSimulations.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-gray-600 mb-2">
                収支シミュレーションはチャットから表示できます。
              </p>
              <p className="text-sm text-gray-500">
                「収支シミュレーションを出して」「収支シミュレーションが知りたい」などと送信すると、想定家賃を伺ったうえで計算・保存・表示します。
              </p>
            </div>
          ) : !selectedSimulationId ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm text-gray-500">上記の一覧から表示したいシミュレーションを選んでください。</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
