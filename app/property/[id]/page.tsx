"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ChatInput from "@/components/ChatInput";
import ChatMessage from "@/components/ChatMessage";
import PropertyDetails from "@/components/PropertyDetails";
import PropertySidebar from "@/components/PropertySidebar";
import InvestmentAnalysis from "@/components/InvestmentAnalysis";
import ExternalEnvironment from "@/components/ExternalEnvironment";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/lib/auth-context";
import { computeCashflow, cashflowSimulationToResult } from "@/lib/cashflow-simulation";
import type { CashflowResult } from "@/lib/cashflow-simulation";
import type { CashflowSimulation } from "@/lib/types";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

function getInitialMessage(propertyTitle: string, hasAnalysis: boolean, hasPurpose: boolean): Message {
  if (!hasAnalysis) {
    return {
      id: "1",
      role: "assistant",
      content: `この物件にはまだ投資判断がありません。トップページで物件URLを入力すると分析を開始できます。`,
      timestamp: new Date(),
    };
  }
  if (!hasPurpose) {
    return {
      id: "1",
      role: "assistant",
      content: `物件「${propertyTitle}」の分析を表示しています。\n\n投資目的を教えてください。\n\n1. 利回り重視\n2. 資産防衛・節税\n3. 住居兼事務所（SOHO）\n4. その他\n\n番号（1-4）または目的を入力してください。`,
      timestamp: new Date(),
    };
  }
  return {
    id: "1",
    role: "assistant",
    content: `物件「${propertyTitle}」の分析を表示しています。他に知りたいことはありますか？`,
    timestamp: new Date(),
  };
}

/** 収支シミュレーションを要求する発言か */
function isCashflowRequest(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/\s/g, "");
  return (
    t.includes("収支シミュレーション") ||
    (t.includes("収支") && (t.includes("出して") || t.includes("知りたい") || t.includes("見たい")))
  );
}

/** 想定家賃（月額・円）をパース。「10万」「10万円」「100000」など */
function parseMonthlyRent(text: string): number | null {
  const t = text.trim().replace(/,/g, "").replace(/\s/g, "");
  const manMatch = t.match(/^(\d+(?:\.\d+)?)\s*万(?:円)?$/);
  if (manMatch) return Math.round(parseFloat(manMatch[1]) * 10000);
  const num = parseInt(t, 10);
  if (!Number.isNaN(num) && num > 0 && num < 1e9) return num;
  return null;
}

const DEFAULT_DOWN_PAYMENT = 10_000_000; // 1,000万円

export default function PropertyPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"property" | "environment" | "analysis">("property");
  const [waitingForPurpose, setWaitingForPurpose] = useState(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cashflowSimulation, setCashflowSimulation] = useState<CashflowResult | null>(null);
  const [cashflowSimulations, setCashflowSimulations] = useState<CashflowSimulation[]>([]);
  const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(null);
  const [waitingForRent, setWaitingForRent] = useState(false);
  const [openSimulationTab, setOpenSimulationTab] = useState(false);

  useEffect(() => {
    if (id) {
      loadProperty(id);
    }
  }, [id]);

  const loadProperty = async (propertyId: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/property/${propertyId}`);
      if (!response.ok) throw new Error("Failed to fetch property");

      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Unknown error");

      const property = data.property;
      const analysis = data.analysis ?? null;
      const hasPurpose = !!(
        analysis?.investment_purpose &&
        String(analysis.investment_purpose).trim() !== ""
      );

      setPropertyData({
        property,
        analysis,
        propertyDataUnavailable: data.propertyDataUnavailable ?? false,
      });
      setActiveTab("property");
      setCurrentAnalysisId(analysis?.id ?? null);
      setWaitingForPurpose(!!analysis && !hasPurpose);
      setCashflowSimulation(null);
      setCashflowSimulations((data.cashflowSimulations ?? []) as CashflowSimulation[]);
      setSelectedSimulationId(null);
      setWaitingForRent(false);
      setOpenSimulationTab(false);

      const title = property?.title || property?.address || property?.location || "物件";
      setMessages([
        getInitialMessage(title, !!analysis, hasPurpose),
      ]);
    } catch (err: any) {
      setLoadError(err.message || "不明なエラー");
      setMessages([
        {
          id: "1",
          role: "assistant",
          content: `読み込みに失敗しました: ${err.message || "不明なエラー"}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const parseInvestmentPurpose = (text: string): string => {
    const normalized = text.trim().toLowerCase();
    if (normalized === "1" || (normalized.includes("利回り") && !normalized.includes("その他"))) return "利回り重視";
    if (normalized === "2" || ((normalized.includes("資産防衛") || normalized.includes("節税")) && !normalized.includes("その他"))) return "資産防衛・節税";
    if (normalized === "3" || (normalized.includes("soho") || normalized.includes("住居兼事務所") || normalized.includes("事務所")) && !normalized.includes("その他")) return "住居兼事務所（SOHO）";
    if (normalized === "4" || normalized.includes("その他")) return text.trim();
    return text.trim();
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    let hasError = false;
    try {
      // 収支シミュレーション: 想定家賃待ちのときは数字を家賃として解釈
      if (waitingForRent && propertyData?.property) {
        const price = propertyData.property.price;
        if (price == null || price <= 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: "物件価格が取得できていません。収支シミュレーションは利用できません。",
              timestamp: new Date(),
            },
          ]);
          setWaitingForRent(false);
          setSending(false);
          return;
        }
        const monthlyRent = parseMonthlyRent(content);
        if (monthlyRent != null) {
          const analysisId = propertyData?.analysis?.id;
          if (analysisId) {
            const res = await fetch(`/api/property/${propertyData.property.id}/cashflow-simulations`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ assumed_rent_yen: monthlyRent, down_payment_yen: DEFAULT_DOWN_PAYMENT }),
            });
            const data = await res.json();
            if (data.success && data.simulation) {
              const sim = data.simulation as CashflowSimulation;
              setCashflowSimulations((prev) => [sim, ...prev]);
              setSelectedSimulationId(sim.id);
              setCashflowSimulation(null);
              setOpenSimulationTab(true);
              setWaitingForRent(false);
              setActiveTab("analysis");
              setMessages((prev) => [
                ...prev,
                {
                  id: (Date.now() + 1).toString(),
                  role: "assistant",
                  content: `想定家賃 月額${monthlyRent.toLocaleString("ja-JP")}円で収支シミュレーションを計算し、保存しました。右側の「投資判断」タブ内「収支シミュレーション」をご確認ください。`,
                  timestamp: new Date(),
                },
              ]);
              setSending(false);
              return;
            }
          }
          const result = computeCashflow({
            propertyPriceYen: price,
            downPaymentYen: DEFAULT_DOWN_PAYMENT,
            monthlyRentYen: monthlyRent,
          });
          setCashflowSimulation(result);
          setOpenSimulationTab(true);
          setWaitingForRent(false);
          setActiveTab("analysis");
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: `想定家賃 月額${monthlyRent.toLocaleString("ja-JP")}円で収支シミュレーションを計算しました。右側の「投資判断」タブ内「収支シミュレーション」をご確認ください。`,
              timestamp: new Date(),
            },
          ]);
          setSending(false);
          return;
        }
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "想定家賃を数字で教えてください。例: 10万、10万円、100000",
            timestamp: new Date(),
          },
        ]);
        setSending(false);
        return;
      }

      // 収支シミュレーションを要求する発言
      if (isCashflowRequest(content) && propertyData?.property) {
        const price = propertyData.property.price;
        if (price == null || price <= 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: "この物件の価格が取得できていません。収支シミュレーションは物件価格が分かっている場合に利用できます。",
              timestamp: new Date(),
            },
          ]);
          setSending(false);
          return;
        }
        setWaitingForRent(true);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `物件価格は${(price / 1_000_000).toFixed(0)}百万円です。収支シミュレーションのため、想定家賃（月額・円）を教えてください。例: 10万円、100000`,
            timestamp: new Date(),
          },
        ]);
        setSending(false);
        return;
      }

      if (waitingForPurpose && propertyData?.property && (currentAnalysisId ?? propertyData?.analysis?.id)) {
        const purposeText = parseInvestmentPurpose(content);
        const analysisIdToUse = currentAnalysisId ?? propertyData?.analysis?.id;

        const response = await fetch("/api/analyze-purpose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: propertyData.property.id,
            analysisId: analysisIdToUse,
            purpose: purposeText,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to analyze purpose");

        if (data.success) {
          const analysisMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.purposeAnalysis || "投資目的に応じた分析を更新しました。",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, analysisMessage]);
          setPropertyData((prev: any) => ({
            ...prev,
            analysis: {
              ...prev.analysis,
              ...data.updatedAnalysis,
              investment_purpose: purposeText,
            },
          }));
          setWaitingForPurpose(false);
          setCurrentAnalysisId(null);
        } else {
          throw new Error(data.error || "Unknown error");
        }
      } else {
        const hasPurpose = !!(
          propertyData?.analysis?.investment_purpose &&
          String(propertyData.analysis.investment_purpose).trim() !== ""
        );
        const replyContent = propertyData?.property
          ? hasPurpose
            ? "この物件について、他に知りたいことはありますか？"
            : "投資目的を教えてください。\n\n1. 利回り重視\n2. 資産防衛・節税\n3. 住居兼事務所（SOHO）\n4. その他"
          : "物件情報を読み込み直してください。";
        if (!hasPurpose && propertyData?.property) setWaitingForPurpose(true);

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: replyContent,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err: any) {
      hasError = true;
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `エラーが発生しました: ${err.message || "不明なエラー"}`,
          timestamp: new Date(),
        },
      ]);
      if (waitingForPurpose) {
        setWaitingForPurpose(false);
        setCurrentAnalysisId(null);
      }
    } finally {
      setSending(false);
    }
  };

  const handleSelectProperty = (property: { id: string }) => {
    setIsSidebarOpen(false);
    if (property.id !== id) {
      window.location.href = `/property/${property.id}`;
    }
  };

  if (!id) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">物件IDが指定されていません</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <PropertySidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSelectProperty={handleSelectProperty}
      />

      <div className="flex w-1/2 flex-col border-r border-gray-200 bg-white md:w-1/3">
        <div className="flex items-center border-b border-gray-200 bg-white px-6 py-4">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="mr-3 rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            aria-label="メニューを開く"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <Link href="/" className="block">
              <h1 className="text-xl font-bold text-gray-900 hover:opacity-80">物件価値わかるくん</h1>
            </Link>
            <p className="mt-1 text-sm text-gray-600">
              この物件で新しいチャット（分析から開始）
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
                timestamp={message.timestamp}
              />
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-gray-100 px-4 py-3">
                  <div className="flex gap-2 text-sm text-gray-600">
                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    送信中...
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={sending}
          hasUserMessages={messages.some((msg) => msg.role === "user")}
        />
      </div>

      <div className="w-1/2 overflow-y-auto bg-gray-50 p-6 md:w-2/3">
        <div className="w-full">
          {loadError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">
              {loadError}
            </div>
          ) : propertyData ? (
            <>
              <div className="mb-6 flex gap-2">
                <button
                  onClick={() => setActiveTab("property")}
                  className={`flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
                    activeTab === "property"
                      ? "bg-white text-gray-900 shadow-[0_4px_8px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)]"
                      : "bg-gray-100 text-gray-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:bg-gray-200"
                  }`}
                >
                  物件情報
                </button>
                <button
                  onClick={() => setActiveTab("environment")}
                  className={`flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
                    activeTab === "environment"
                      ? "bg-white text-gray-900 shadow-[0_4px_8px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)]"
                      : "bg-gray-100 text-gray-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:bg-gray-200"
                  }`}
                >
                  外部環境
                </button>
                <button
                  onClick={() => {
                    setActiveTab("analysis");
                    if (!user) {
                      setAuthModalOpen(true);
                    }
                  }}
                  className={`flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
                    activeTab === "analysis"
                      ? "bg-white text-gray-900 shadow-[0_4px_8px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)]"
                      : "bg-gray-100 text-gray-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:bg-gray-200"
                  }`}
                >
                  投資判断
                </button>
              </div>

              <div className="space-y-4">
                {activeTab === "property" && (
                  <PropertyDetails
                    property={propertyData.property}
                    showTransportation={false}
                    propertyDataUnavailable={propertyData.propertyDataUnavailable}
                  />
                )}
                {activeTab === "environment" && (
                  <div className="space-y-4">
                    <PropertyDetails
                      property={propertyData.property}
                      showTransportation={true}
                      showBasicInfo={false}
                      showPropertyDetails={false}
                      showLandInfo={false}
                      propertyDataUnavailable={propertyData.propertyDataUnavailable}
                    />
                    <ExternalEnvironment propertyId={propertyData.property.id} />
                  </div>
                )}
                {activeTab === "analysis" && (
                  user ? (() => {
                    const selectedSim = selectedSimulationId
                      ? cashflowSimulations.find((s) => s.id === selectedSimulationId)
                      : null;
                    const displayResult = selectedSim
                      ? cashflowSimulationToResult(selectedSim)
                      : cashflowSimulation;
                    return (
                      <InvestmentAnalysis
                        analysis={propertyData.analysis}
                        cashflowSimulation={displayResult}
                        cashflowSimulations={cashflowSimulations}
                        selectedSimulationId={selectedSimulationId}
                        onSelectSimulation={setSelectedSimulationId}
                        openSimulationTab={openSimulationTab}
                      />
                    );
                  })() : (
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                      <p className="mb-4 text-center text-gray-600">
                        投資判断を見るにはログインが必要です
                      </p>
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => setAuthModalOpen(true)}
                          className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                        >
                          ログイン / 新規登録
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <p className="text-center text-gray-500">
                {isLoading ? "読み込み中..." : "物件情報を表示します"}
              </p>
            </div>
          )}
        </div>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => setAuthModalOpen(false)}
        message="投資判断を見るにはログインが必要です"
      />
    </div>
  );
}
