"use client";

import { useState } from "react";

interface InvestmentAnalysisProps {
  analysis: {
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
        [key: string]: string;
      };
      advice?: string;
    };
  };
}

export default function InvestmentAnalysis({ analysis }: InvestmentAnalysisProps) {
  const [subTab, setSubTab] = useState<"property" | "purpose">("property");
  const structured = analysis.structured_analysis;
  const sectionScores = analysis.section_scores;

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

  const getRecommendationColor = (rec?: string | null) => {
    if (rec === "buy") return "bg-green-50 border-green-200 text-green-800";
    if (rec === "hold") return "bg-yellow-50 border-yellow-200 text-yellow-800";
    if (rec === "avoid") return "bg-red-50 border-red-200 text-red-800";
    return "bg-gray-50 border-gray-200 text-gray-800";
  };

  const getRecommendationText = (rec?: string | null) => {
    if (rec === "buy") return "購入推奨";
    if (rec === "hold") return "要検討";
    if (rec === "avoid") return "非推奨";
    return "評価中";
  };

  const purposeSpecificAnalysis = structured?.purpose_specific_analysis;
  const investmentPurpose = analysis.investment_purpose;

  // 投資目的に応じた分析があるかチェック
  const hasPurposeAnalysis = purposeSpecificAnalysis && Object.keys(purposeSpecificAnalysis).length > 0;

  return (
    <div className="space-y-6">
      {/* サブタブナビゲーション */}
      {hasPurposeAnalysis && (
        <div className="flex gap-2">
          <button
            onClick={() => setSubTab("property")}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
              subTab === "property"
                ? "bg-white text-gray-900 shadow-[0_4px_8px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)]"
                : "bg-gray-100 text-gray-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:bg-gray-200"
            }`}
          >
            物件への投資判断
          </button>
          <button
            onClick={() => setSubTab("purpose")}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
              subTab === "purpose"
                ? "bg-white text-gray-900 shadow-[0_4px_8px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)]"
                : "bg-gray-100 text-gray-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:bg-gray-200"
            }`}
          >
            投資目的にもとづく投資判断
          </button>
        </div>
      )}

      {/* 投資目的にもとづく投資判断 */}
      {subTab === "purpose" && hasPurposeAnalysis && (
        <div className="space-y-6">
          {/* 投資目的の表示 */}
          {investmentPurpose && (
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-600 mb-2">投資目的</div>
              <div className="text-2xl font-bold text-gray-900">{investmentPurpose}</div>
            </div>
          )}

          {/* 投資目的に応じた分析テキスト */}
          {Object.entries(purposeSpecificAnalysis).map(([purpose, analysisText]) => (
            <div key={purpose} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-5 border-b border-gray-200">
                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
                  {investmentPurpose || purpose}に特化した分析
                </h2>
              </div>
              <div className="p-6">
                <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
                  {analysisText}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 物件への投資判断 */}
      {subTab === "property" && (
        <div className="space-y-6">
          {/* ヘッダー: スコアと推奨度 */}
          <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">投資スコア</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gray-900">
                {analysis.score ?? "-"}
              </span>
              <span className="text-xl text-gray-500">/100</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-600 mb-1">推奨度</div>
            <span
              className={`inline-flex items-center px-4 py-2 rounded-lg border-2 font-semibold text-sm ${getRecommendationColor(
                analysis.recommendation
              )}`}
            >
              {getRecommendationText(analysis.recommendation)}
            </span>
          </div>
        </div>
      </div>

      {/* 1. 物件概要の評価 */}
      {structured?.property_overview && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">1. 物件概要の評価</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {/* 立地 */}
              {structured.property_overview.location && (
                <div className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-base font-semibold text-gray-900">立地</span>
                    <span className="text-amber-500 text-lg font-bold">
                      {structured.property_overview.location.stars}
                    </span>
                    <span className="text-sm text-gray-600">
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
                <div className="border-l-4 border-green-500 pl-4 py-2">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-base font-semibold text-gray-900">価格</span>
                    <span className="text-amber-500 text-lg font-bold">
                      {structured.property_overview.price.stars}
                    </span>
                    <span className="text-sm text-gray-600">
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
                <div className="border-l-4 border-purple-500 pl-4 py-2">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-base font-semibold text-gray-900">建物</span>
                    <span className="text-amber-500 text-lg font-bold">
                      {structured.property_overview.building.stars}
                    </span>
                    <span className="text-sm text-gray-600">
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
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">2. 投資シミュレーション（収益性）</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {structured.investment_simulation.estimated_rent && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-700 mb-1">想定賃料</div>
                  <div className="text-lg font-bold text-gray-900">
                    {removeMarkdown(structured.investment_simulation.estimated_rent)}
                  </div>
                </div>
              )}
              {structured.investment_simulation.estimated_yield && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-700 mb-1">想定利回り</div>
                  <div className="text-lg font-bold text-emerald-700">
                    {removeMarkdown(structured.investment_simulation.estimated_yield)}
                  </div>
                  {structured.investment_simulation.calculation && (
                    <div className="text-xs text-gray-600 mt-2 font-mono">
                      {removeMarkdown(structured.investment_simulation.calculation)}
                    </div>
                  )}
                </div>
              )}
              {structured.investment_simulation.judgment && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="text-sm font-semibold text-gray-700 mb-2">判断</div>
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
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">3. メリット（投資すべき理由）</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {structured.merits.map((merit, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                    <span className="text-green-700 text-xs font-bold">✓</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">{removeMarkdown(merit.title)}</div>
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
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-red-50 to-rose-50 px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">4. リスク・懸念点（注意すべき理由）</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {structured.risks.map((risk, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                    <span className="text-red-700 text-xs font-bold">!</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">{removeMarkdown(risk.title)}</div>
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
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">5. 最終判断</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {structured.final_judgment.yield_focused?.recommendation && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="font-semibold text-gray-900 mb-2">「利回り重視の投資家」なら</div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {removeMarkdown(structured.final_judgment.yield_focused.recommendation)}
                  </p>
                </div>
              )}
              {structured.final_judgment.asset_protection?.recommendation && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="font-semibold text-gray-900 mb-2">「富裕層の資産防衛・節税」なら</div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {removeMarkdown(structured.final_judgment.asset_protection.recommendation)}
                  </p>
                </div>
              )}
              {structured.final_judgment.soho_use?.recommendation && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="font-semibold text-gray-900 mb-2">「住居兼事務所（SOHO）として使いたい」なら</div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {removeMarkdown(structured.final_judgment.soho_use.recommendation)}
                  </p>
                </div>
              )}
              {structured.advice && (
                <div className="bg-blue-50 rounded-lg p-4 mt-4">
                  <div className="font-semibold text-blue-900 mb-2">アドバイス</div>
                  <p className="text-sm text-blue-800 leading-relaxed">{removeMarkdown(structured.advice)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

          {/* フォールバック: 構造化データがない場合 */}
          {!structured && analysis.full_analysis && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 px-6 py-5 border-b border-gray-200">
                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">投資判断</h2>
              </div>
              <div className="p-6">
                <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                  {removeMarkdown(analysis.full_analysis)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
