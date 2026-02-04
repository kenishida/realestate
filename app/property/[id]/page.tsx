"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ChatInput from "@/components/ChatInput";
import ChatMessage from "@/components/ChatMessage";
import PropertyDetails from "@/components/PropertyDetails";
import InvestmentAnalysis from "@/components/InvestmentAnalysis";
import ExternalEnvironment from "@/components/ExternalEnvironment";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/lib/auth-context";
import { cashflowSimulationToResult } from "@/lib/cashflow-simulation";
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

export default function PropertyPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"property" | "environment" | "analysis">("property");
  const [sending, setSending] = useState(false);
  const [cashflowSimulation, setCashflowSimulation] = useState<CashflowResult | null>(null);
  const [cashflowSimulations, setCashflowSimulations] = useState<CashflowSimulation[]>([]);
  const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(null);
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

      setConversationId((data.conversations?.[0] as { id?: string } | undefined)?.id ?? null);
      setPropertyData({
        property,
        analysis,
        propertyDataUnavailable: data.propertyDataUnavailable ?? false,
      });
      const sims = (data.cashflowSimulations ?? []) as CashflowSimulation[];
      setCashflowSimulations(sims);
      setSelectedSimulationId(sims.length > 0 ? sims[0].id : null);
      setCashflowSimulation(null);
      // 保存済みシミュレーションがあれば投資判断タブの収支シミュレーションを開く
      if (sims.length > 0) {
        setActiveTab("analysis");
        setOpenSimulationTab(true);
      } else {
        setActiveTab("property");
        setOpenSimulationTab(false);
      }

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

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    try {
      const cid = conversationId ?? undefined;
      const pid = id;

      const ragRes = await fetch("/api/chat/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(cid && { conversationId: cid }),
          userMessage: content,
          propertyId: pid,
        }),
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

      if (ragData.conversationId) setConversationId(ragData.conversationId as string);

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
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `エラーが発生しました: ${err.message || "不明なエラー"}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (!id) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">物件IDが指定されていません</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 w-1/2 flex-1 flex-col border-r border-gray-200 bg-white md:w-1/3">
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
        <div className="mx-auto max-w-4xl">
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
