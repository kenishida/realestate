"use client";

import type { CashflowResult } from "@/lib/cashflow-simulation";

function formatYen(n: number): string {
  return n.toLocaleString("ja-JP");
}

/** 万円単位で表示（年間収支用） */
function formatManYen(n: number): string {
  return (n / 10_000).toLocaleString("ja-JP");
}

function formatManYenWithSign(n: number): string {
  const s = (Math.abs(n) / 10_000).toLocaleString("ja-JP");
  return n < 0 ? `▲ ${s}` : s;
}

interface CashflowSimulationProps {
  result: CashflowResult;
  title?: string;
}

export default function CashflowSimulation({ result, title }: CashflowSimulationProps) {
  const { assumptions, annual, monthlyRepayment } = result;
  const btcfMonthly = Math.round(result.annual.btcf / 12);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight">
            {title ?? `${(assumptions.propertyPriceYen / 1_000_000).toFixed(0)}百万円物件の収支シミュレーション（概算）`}
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* 前提条件 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">前提条件</h3>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-gray-100 text-gray-900">
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-gray-700 bg-gray-50/50 w-32">物件価格</td>
                    <td className="py-2.5 px-4 tabular-nums">{formatYen(assumptions.propertyPriceYen)}円</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-gray-700 bg-gray-50/50">諸経費</td>
                    <td className="py-2.5 px-4 tabular-nums">約{formatYen(assumptions.acquisitionCostYen)}円（登記費用・仲介手数料など）</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-gray-700 bg-gray-50/50">自己資金</td>
                    <td className="py-2.5 px-4 tabular-nums">{formatYen(assumptions.downPaymentYen)}円（残{formatYen(assumptions.loanAmountYen)}円をローン）</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-gray-700 bg-gray-50/50">ローン条件</td>
                    <td className="py-2.5 px-4">金利{(assumptions.interestRate * 100).toFixed(0)}% / {assumptions.loanYears}年返済 / 元利均等</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 年間キャッシュフロー計算書 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">年間キャッシュフロー計算書</h3>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">項目</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">年間収支 (万円)</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">備考</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-900">
                  <tr>
                    <td className="py-2.5 px-4 font-medium">GPI (潜在総収入)</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{formatManYen(annual.gpi)}</td>
                    <td className="py-2.5 px-4">月{formatYen(assumptions.monthlyRentYen)}円 × 12ヶ月</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium">空室・未回収損失 ({(assumptions.vacancyRate * 100).toFixed(0)}%)</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-red-700">{formatManYenWithSign(-annual.vacancyLoss)}</td>
                    <td className="py-2.5 px-4">稼働率{((1 - assumptions.vacancyRate) * 100).toFixed(0)}%で算出</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium">EGI (実効総収入)</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{formatManYen(annual.egi)}</td>
                    <td className="py-2.5 px-4">実際に入ってくる家賃</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium">OPEX (運営費/諸経費)</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-red-700">{formatManYenWithSign(-annual.opex)}</td>
                    <td className="py-2.5 px-4">家賃の約{(assumptions.opexRate * 100).toFixed(0)}%（管理費・税金等）</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium">NOI (営業純利益)</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{formatManYen(annual.noi)}</td>
                    <td className="py-2.5 px-4">物件が持つ真の収益力</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium">ADS (ローン返済額)</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-red-700">{formatManYenWithSign(-annual.ads)}</td>
                    <td className="py-2.5 px-4">月額 約{formatYen(monthlyRepayment)}円の返済</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="py-3 px-4 font-semibold">BTCF (税引前CF)</td>
                    <td className={`py-3 px-4 text-right tabular-nums font-semibold ${annual.btcf >= 0 ? "text-gray-900" : "text-red-700"}`}>
                      {formatManYenWithSign(annual.btcf)}
                    </td>
                    <td className="py-3 px-4">
                      {annual.btcf >= 0
                        ? `毎月の黒字額：約${formatYen(Math.round(annual.btcf / 12))}円`
                        : `毎月の赤字額：約${formatYen(Math.abs(btcfMonthly))}円`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
