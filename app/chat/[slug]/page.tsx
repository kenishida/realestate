"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import ChatInput from "@/components/ChatInput";
import ChatMessage from "@/components/ChatMessage";
import PropertyDetails from "@/components/PropertyDetails";
import ExternalEnvironment from "@/components/ExternalEnvironment";
import InvestmentAnalysis from "@/components/InvestmentAnalysis";
import { cashflowSimulationToResult } from "@/lib/cashflow-simulation";
import type { CashflowResult } from "@/lib/cashflow-simulation";
import { Property, type CashflowSimulation } from "@/lib/types";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [propertyList, setPropertyList] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"property" | "environment" | "analysis">("property");
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [cashflowSimulation, setCashflowSimulation] = useState<CashflowResult | null>(null);
  const [cashflowSimulations, setCashflowSimulations] = useState<CashflowSimulation[]>([]);
  const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(null);
  const [openSimulationTab, setOpenSimulationTab] = useState(false);

  useEffect(() => {
    if (slug) {
      loadConversationBySlug(slug);
    }
  }, [slug]);

  const loadConversationBySlug = async (customPath: string) => {
    setIsLoading(true);
    try {
      // カスタムパスでチャット履歴を検索
      const response = await fetch(`/api/conversation/by-path/${encodeURIComponent(customPath)}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch conversation");
      }

      const data = await response.json();

      if (data.success) {
        setConversationId(data.conversation?.id ?? null);
        const list = (data.properties ?? []) as Property[];
        setPropertyList(list);
        const defaultId = data.property?.id ?? list[0]?.id ?? null;
        setSelectedPropertyId(defaultId);
        setPropertyData({
          property: data.property,
          analysis: data.analysis,
          propertyDataUnavailable: data.propertyDataUnavailable ?? false,
        });
        setCashflowSimulation(null);
        const sims = (data.cashflowSimulations ?? []) as CashflowSimulation[];
        setCashflowSimulations(sims);
        setSelectedSimulationId(sims.length > 0 ? sims[0].id : null);
        if (sims.length > 0) {
          setActiveTab("analysis");
          setOpenSimulationTab(true);
        } else {
          setActiveTab("property");
          setOpenSimulationTab(false);
        }

        // メッセージ履歴を表示
        if (data.messages && data.messages.length > 0) {
          const messageHistory: Message[] = data.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
            timestamp: new Date(msg.created_at),
          }));
          setMessages(messageHistory);
        } else {
          setMessages([
            {
              id: "1",
              role: "assistant",
              content: `物件「${data.property?.title || data.property?.address || "物件"}」の情報を表示しています。\n\n右側に物件詳細と投資判断を表示しています。`,
              timestamp: new Date(),
            },
          ]);
        }
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (error: any) {
      console.error("Error loading conversation:", error);
      setMessages([
        {
          id: "1",
          role: "assistant",
          content: `エラーが発生しました: ${error.message || "不明なエラー"}\n\nカスタムパス "${customPath}" に対応するチャット履歴が見つかりませんでした。`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    let hasError = false;
    try {
      // URLかどうかをチェック
      let isUrl = false;
      try {
        new URL(content);
        isUrl = true;
      } catch {
        // URLではない場合は通常のメッセージとして処理
      }

      if (isUrl && propertyData?.property) {
        // 既に物件が紐づいているチャットで別URLが送られた場合
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "このチャットルームでは1つの物件の分析のみが可能です。",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else if (isUrl) {
        // 物件URLの場合、投資判断を生成
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: content }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to analyze property");
        }

        if (data.success) {
          const analysisMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `投資判断が完了しました。\n\n【推奨度】${data.analysis.recommendation || "評価中"}\n【投資スコア】${data.analysis.score || "評価中"}\n\n${data.analysis.summary || data.analysis.full_analysis.substring(0, 500)}`,
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, analysisMessage]);
          setPropertyData({
            ...data,
            propertyDataUnavailable: data.propertyDataUnavailable ?? false,
          });
          if (data.property?.id) {
            setPropertyList((prev) =>
              prev.some((p) => p.id === data.property.id)
                ? prev
                : [...prev, data.property]
            );
            setSelectedPropertyId(data.property.id);
          }
          if (data.analysisId) {
            setCurrentAnalysisId(data.analysisId);
          }
          
          if (data.conversationId) {
            localStorage.setItem("currentConversationId", data.conversationId);
          }

          const purposeQuestion: Message = {
            id: (Date.now() + 2).toString(),
            role: "assistant",
            content: "この物件の投資目的を教えてください。\n\n1. 利回り重視\n2. 資産防衛・節税\n3. 住居兼事務所（SOHO）\n4. その他\n\n番号（1-4）または目的を入力してください。",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, purposeQuestion]);
        } else {
          throw new Error(data.error || "Unknown error");
        }
      } else {
        // URL以外: RAG API に送る（物件・会話が紐づいている場合）
        const cid = conversationId ?? null;
        const pid = selectedPropertyId ?? propertyData?.property?.id ?? null;

        if (cid && pid) {
          const ragRes = await fetch("/api/chat/rag", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId: cid, userMessage: content, propertyId: pid }),
          });
          const text = await ragRes.text();
          let ragData: Record<string, unknown> = {};
          try {
            ragData = text ? JSON.parse(text) : {};
          } catch {
            if (!ragRes.ok) throw new Error("サーバーエラーです。しばらくしてからお試しください。");
          }
          if (!ragRes.ok) {
            const serverError = typeof ragData.error === "string" && ragData.error.trim() ? ragData.error : null;
            const details = ragData.details ? `（${String(ragData.details)}）` : "";
            throw new Error(serverError ? `${serverError}${details}` : `RAGエラー（${ragRes.status}）。しばらくしてからお試しください。`);
          }

          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: (ragData.content as string) ?? "申し訳ありません。応答を生成できませんでした。",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);

          if (ragData.updatedAnalysis) {
            setPropertyData((prev: any) => (prev ? { ...prev, analysis: ragData.updatedAnalysis } : prev));
          }
          if (ragData.cashflowSimulation) {
            setCashflowSimulations((prev) => [(ragData.cashflowSimulation as any), ...prev]);
            setSelectedSimulationId((ragData.cashflowSimulation as { id: string }).id);
            setCashflowSimulation((ragData.cashflowResult as any) ?? null);
            setOpenSimulationTab(true);
            setActiveTab("analysis");
          }
        } else {
          const noPropertyMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "物件が紐づいていません。物件URLを送信して投資判断を取得してから、質問や収支シミュレーションをご利用ください。",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, noPropertyMessage]);
        }
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `エラーが発生しました: ${error.message || "不明なエラー"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      hasError = true;
    } finally {
      setIsLoading(false);
    }
  };

  /** 右カラムの物件一覧から物件を選択したとき */
  const handleSelectPropertyFromList = async (property: Property) => {
    if (selectedPropertyId === property.id) return;
    setSelectedPropertyId(property.id);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/property/${property.id}`);
      if (!response.ok) throw new Error("Failed to fetch property data");
      const data = await response.json();
      if (data.success) {
        setPropertyData({
          property: data.property,
          analysis: data.analysis,
          propertyDataUnavailable: data.propertyDataUnavailable ?? false,
        });
        const sims = (data.cashflowSimulations ?? []) as CashflowSimulation[];
        setCashflowSimulations(sims);
        setSelectedSimulationId(sims.length > 0 ? sims[0].id : null);
        setCashflowSimulation(null);
        setActiveTab("property");
      }
    } catch (error: any) {
      console.error("Error loading property:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1">
      {/* 左側: チャットUI（下まで表示） */}
      <div className="flex min-h-0 w-1/2 flex-1 flex-col border-r border-gray-200 bg-white md:w-1/3">
        {/* メッセージ一覧 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
                timestamp={message.timestamp}
              />
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-gray-100 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg
                      className="h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    分析中...
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 入力欄 */}
        <ChatInput 
          onSendMessage={handleSendMessage} 
          isLoading={isLoading} 
          hasUserMessages={messages.some(msg => msg.role === "user")}
        />
      </div>

      {/* 右側: 物件データ表示エリア */}
      <div className="w-1/2 overflow-y-auto bg-gray-50 p-6 md:w-2/3">
        <div className="w-full space-y-6">
          {/* このチャットで言及されている物件一覧 */}
          {propertyList.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold text-gray-600">
                このチャットで言及されている物件
              </h2>
              <ul className="grid grid-cols-3 gap-2">
                {propertyList.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectPropertyFromList(p)}
                      className={`w-full rounded border px-2 py-2 text-left transition-colors ${
                        selectedPropertyId === p.id
                          ? "border-gray-400 bg-white shadow-sm"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="truncate text-xs font-medium text-gray-900">
                        {p.title || p.address || p.location || "（タイトルなし）"}
                      </div>
                      {(p.price != null || p.yield_rate != null) && (
                        <div className="mt-0.5 flex gap-2 text-[10px] text-gray-500">
                          {p.price != null && <span>{p.price.toLocaleString()}万</span>}
                          {p.yield_rate != null && <span>{p.yield_rate}%</span>}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {propertyData ? (
            <>
              {/* タブナビゲーション */}
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
                  onClick={() => setActiveTab("analysis")}
                  className={`flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
                    activeTab === "analysis"
                      ? "bg-white text-gray-900 shadow-[0_4px_8px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)]"
                      : "bg-gray-100 text-gray-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:bg-gray-200"
                  }`}
                >
                  概要
                </button>
              </div>

              {/* タブコンテンツ */}
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
                {activeTab === "analysis" && (() => {
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
                })()}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <p className="text-center text-gray-500">
                {isLoading ? "読み込み中..." : "チャット履歴を読み込んでいます..."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
