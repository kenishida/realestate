"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ChatInput from "@/components/ChatInput";
import ChatMessage from "@/components/ChatMessage";
import PropertyDetails from "@/components/PropertyDetails";
import AppVerticalSidebar from "@/components/AppVerticalSidebar";
import InvestmentAnalysis from "@/components/InvestmentAnalysis";
import ExternalEnvironment from "@/components/ExternalEnvironment";
import HomeRightColumnPlaceholder from "@/components/HomeRightColumnPlaceholder";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/lib/auth-context";
import { createClientSupabase } from "@/lib/supabase";
import { cashflowSimulationToResult } from "@/lib/cashflow-simulation";
import type { CashflowResult } from "@/lib/cashflow-simulation";
import type { CashflowSimulation } from "@/lib/types";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export default function Home() {
  const router = useRouter();
  const { user, session, signOut, isLoading: authLoading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMessage, setAuthModalMessage] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "こんにちは！物件価値わかるくんです。\n物件URLを入力していただければ、投資判断を行います。",
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"property" | "environment" | "analysis">("property");
  const [waitingForPurpose, setWaitingForPurpose] = useState(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [waitingForRent, setWaitingForRent] = useState(false);
  const [cashflowSimulation, setCashflowSimulation] = useState<CashflowResult | null>(null);
  const [cashflowSimulations, setCashflowSimulations] = useState<CashflowSimulation[]>([]);
  const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(null);
  const [openSimulationTab, setOpenSimulationTab] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // メッセージまたはローディング状態が変わったら最下部へスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // トップ（ホーム）は「新規会話の入り口」。古い currentConversationId が残っていると
  // 次の物件URLが古い会話に紐づいてしまうため、表示時にクリアしてメッセージも初期化する。
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("currentConversationId");
    setMessages([
      {
        id: "1",
        role: "assistant",
        content: "こんにちは！物件価値わかるくんです。\n物件URLを入力していただければ、投資判断を行います。",
        timestamp: new Date(),
      },
    ]);
    setPropertyData(null);
    setCurrentAnalysisId(null);
    setWaitingForPurpose(false);
    setWaitingForRent(false);
    setCashflowSimulation(null);
    setOpenSimulationTab(false);
  }, []);

  const handleSendMessage = async (content: string) => {
    // ユーザーメッセージを追加
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

      if (isUrl) {
        // ホーム（/）では常に新規会話として扱う。ログイン中なら Bearer を送り、新規会話をそのユーザーに紐づける。
        let token = session?.access_token;
        if (user?.id && !token) {
          const { data: { session: s } } = await createClientSupabase().auth.getSession();
          token = s?.access_token ?? undefined;
        }
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers,
          body: JSON.stringify({
            url: content,
            conversationId: undefined,
          }),
        });

        const text = await response.text();
        let data: { success?: boolean; isRentalMessage?: boolean; isListOrLibraryMessage?: boolean; content?: string; conversationCustomPath?: string | null; analysis?: { recommendation?: string; score?: string }; analysisId?: string; conversationId?: string; error?: string; details?: string; help?: string; propertyDataUnavailable?: boolean };
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          if (text.trimStart().toLowerCase().startsWith("<!")) {
            throw new Error("サーバーがHTMLを返しました。本番環境のAPI・ネットワークを確認してください。");
          }
          throw new Error("サーバー応答の解析に失敗しました。");
        }

        if (!response.ok) {
          const errorMessage = data.error || "Failed to analyze property";
          const errorDetails = data.details ? `\n詳細: ${data.details}` : "";
          const helpLink = data.help ? `\n\n解決方法: ${data.help}` : "";
          throw new Error(`${errorMessage}${errorDetails}${helpLink}`);
        }

        if (data.success) {
          // 賃貸URLの案内メッセージのみ表示（投資判断は行わない）
          if (data.isRentalMessage && data.content) {
            const rentalMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.content,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, rentalMessage]);
            return;
          }

          // 一覧・建物ライブラリ等の案内メッセージのみ表示
          if (data.isListOrLibraryMessage && data.content) {
            const listMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.content,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, listMessage]);
            return;
          }

          // slug があれば個別チャットURLに切り替え（ChatGPT風：画面は遷移せずURLだけ変わる）
          if (data.conversationCustomPath) {
            setIsLoading(false);
            router.replace(`/chat/${data.conversationCustomPath}`);
            return;
          }

          // custom_path が無い場合の従来挙動（ホーム上で結果表示）
          const analysisMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `投資判断が完了しました。【推奨度】${data.analysis?.recommendation || "評価中"} 【投資スコア】${data.analysis?.score || "評価中"} 右側の「投資判断」で詳細をご確認ください。`,
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, analysisMessage]);
          setPropertyData({ ...data, propertyDataUnavailable: data.propertyDataUnavailable ?? false });
          
          if (data.analysisId) {
            setCurrentAnalysisId(data.analysisId);
          }
          if (data.conversationId) {
            localStorage.setItem("currentConversationId", data.conversationId);
          }

          const purposeQuestion: Message = {
            id: (Date.now() + 2).toString(),
            role: "assistant",
            content: "この物件の投資目的を教えてください。たとえば「利回り重視」や「資産防衛・節税」、「実需」などを明確にしていただくと、より精緻な投資アドバイスが可能です。",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, purposeQuestion]);
          setWaitingForPurpose(true);
        } else {
          throw new Error(data.error || "Unknown error");
        }
      } else {
        // RAG: 物件が紐づいている会話では RAG API に送る
        const conversationId = propertyData?.conversationId ?? localStorage.getItem("currentConversationId");
        const propertyId = propertyData?.property?.id;

        if (propertyId && conversationId) {
          const ragRes = await fetch("/api/chat/rag", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId, userMessage: content, propertyId }),
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
            if (!serverError && text) {
              console.error("[RAG] 500 response body:", text.slice(0, 500));
            }
            throw new Error(serverError ? `${serverError}${details}` : `RAGエラー（${ragRes.status}）。ターミナルのサーバーログで [RAG] を確認してください。`);
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
            content: "物件URLを送信して投資判断を取得してから、質問や収支シミュレーションをご利用ください。",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, noPropertyMessage]);
        }
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      // エラーメッセージを整形
      let errorContent = `エラーが発生しました: ${error.message || "不明なエラー"}\n\n`;
      
      // APIキーの問題の場合、特別なメッセージを表示
      if (error.message?.includes("APIキー") || error.message?.includes("leaked") || error.message?.includes("403")) {
        errorContent += `【重要】Gemini APIキーの問題が検出されました。\n\n`;
        errorContent += `解決方法:\n`;
        errorContent += `1. https://aistudio.google.com/apikey にアクセス\n`;
        errorContent += `2. 新しいAPIキーを生成\n`;
        errorContent += `3. .env.localファイルのGEMINI_API_KEYを更新\n`;
        errorContent += `4. 開発サーバーを再起動\n`;
      } else {
        errorContent += `詳細を確認して、もう一度お試しください。\n\n考えられる原因:\n- 物件URLの形式が正しくない\n- サーバーエラー\n- Gemini APIのエラー\n\nサーバーログを確認してください。`;
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      hasError = true;
    } finally {
      setIsLoading(false);
      // エラー時のみ投資目的待ちをリセット（URL入力の場合のみ）
      if (hasError && waitingForPurpose) {
        setWaitingForPurpose(false);
        setCurrentAnalysisId(null);
      }
    }
  };

  const selectedSim = selectedSimulationId ? cashflowSimulations.find((s) => s.id === selectedSimulationId) : null;
  const displayCashflowResult = selectedSim ? cashflowSimulationToResult(selectedSim) : cashflowSimulation;

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
            <div ref={messagesEndRef} aria-hidden="true" />
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
        <div className="mx-auto max-w-4xl">
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
                  onClick={() => {
                    setActiveTab("analysis");
                    if (!user) {
                      setAuthModalMessage("投資判断を見るにはログインが必要です");
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
                {activeTab === "analysis" && (
                  <>
                    {user ? (
                      <InvestmentAnalysis
                        analysis={propertyData.analysis}
                        cashflowSimulation={displayCashflowResult}
                        cashflowSimulations={cashflowSimulations}
                        selectedSimulationId={selectedSimulationId}
                        onSelectSimulation={setSelectedSimulationId}
                        openSimulationTab={openSimulationTab}
                      />
                    ) : (
                      <div className="rounded-lg border border-gray-200 bg-white p-6">
                        <p className="mb-4 text-center text-gray-600">
                          投資判断を見るにはログインが必要です
                        </p>
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setAuthModalMessage("投資判断を見るにはログインが必要です");
                              setAuthModalOpen(true);
                            }}
                            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                          >
                            ログイン / 新規登録
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <HomeRightColumnPlaceholder />
          )}
        </div>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => setAuthModalOpen(false)}
        message={authModalMessage}
      />
    </div>
  );
}
