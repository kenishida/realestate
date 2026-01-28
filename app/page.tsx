"use client";

import { useState } from "react";
import ChatInput from "@/components/ChatInput";
import ChatMessage from "@/components/ChatMessage";
import PropertyDetails from "@/components/PropertyDetails";
import PropertySidebar from "@/components/PropertySidebar";
import { Property } from "@/lib/types";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export default function Home() {
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"property" | "environment" | "analysis">("property");

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
          // 投資判断結果を表示
          const analysisMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `投資判断が完了しました。\n\n【推奨度】${data.analysis.recommendation || "評価中"}\n【投資スコア】${data.analysis.score || "評価中"}\n\n${data.analysis.summary || data.analysis.full_analysis.substring(0, 500)}`,
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, analysisMessage]);
          setPropertyData(data);
          
          // 会話IDを保存（次回のリクエストで使用）
          if (data.conversationId) {
            // 会話IDをlocalStorageに保存（オプション）
            localStorage.setItem("currentConversationId", data.conversationId);
          }
        } else {
          throw new Error(data.error || "Unknown error");
        }
      } else {
        // 通常のメッセージの場合
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "物件URLを入力していただければ、投資判断を行います。\n例: https://athomes.jp/...",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `エラーが発生しました: ${error.message || "不明なエラー"}\n\n詳細を確認して、もう一度お試しください。\n\n考えられる原因:\n- 物件URLの形式が正しくない\n- サーバーエラー\n- Gemini APIのエラー`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProperty = async (property: Property) => {
    console.log("Selected property:", property);
    setIsSidebarOpen(false);
    setIsLoading(true);

    try {
      // 物件情報、会話履歴、投資判断を取得
      const response = await fetch(`/api/property/${property.id}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch property data");
      }

      const data = await response.json();

      if (data.success) {
        console.log("[Property Select] Received data:", {
          property: data.property?.title,
          messagesCount: data.messages?.length || 0,
          analysis: !!data.analysis,
        });
        console.log("[Property Select] Messages:", data.messages);

        // 物件情報を右側に表示
        setPropertyData({
          property: data.property,
          analysis: data.analysis,
        });
        
        // タブを「物件情報」にリセット
        setActiveTab("property");

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
          // メッセージがない場合は初期メッセージを表示
          setMessages([
            {
              id: "1",
              role: "assistant",
              content: `物件「${data.property.title || data.property.address || "物件"}」の情報を表示しています。\n\n右側に物件詳細と投資判断を表示しています。`,
              timestamp: new Date(),
            },
          ]);
        }
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (error: any) {
      console.error("Error loading property:", error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `エラーが発生しました: ${error.message || "不明なエラー"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* サイドバー */}
      <PropertySidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSelectProperty={handleSelectProperty}
      />

      {/* 左側: チャットUI */}
      <div className="flex w-1/2 flex-col border-r border-gray-200 bg-white">
        {/* ヘッダー */}
        <div className="flex items-center border-b border-gray-200 bg-white px-6 py-4">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="mr-3 rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            aria-label="メニューを開く"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">物件価値わかるくん</h1>
            <p className="mt-1 text-sm text-gray-600">
              物件URLを入力して投資判断を取得
            </p>
          </div>
        </div>

        {/* メッセージ一覧 */}
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
        <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
      </div>

      {/* 右側: 物件データ表示エリア */}
      <div className="w-1/2 overflow-y-auto bg-gray-50 p-6">
        <div className="mx-auto max-w-2xl">
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
                  外部的環境
                </button>
                <button
                  onClick={() => setActiveTab("analysis")}
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
                  <PropertyDetails property={propertyData.property} showTransportation={false} />
                )}
                {activeTab === "environment" && (
                  <PropertyDetails property={propertyData.property} showTransportation={true} showBasicInfo={false} showPropertyDetails={false} showLandInfo={false} />
                )}
                {activeTab === "analysis" && (
                  <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100/50 px-6 py-4">
                      <h3 className="text-lg font-semibold text-gray-900">投資判断</h3>
                    </div>
                    <div className="p-6 space-y-6">
                      {propertyData.analysis.recommendation && (
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-700">推奨度:</span>
                          <span
                            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                              propertyData.analysis.recommendation === "buy"
                                ? "bg-green-100 text-green-800"
                                : propertyData.analysis.recommendation === "hold"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {propertyData.analysis.recommendation === "buy"
                              ? "購入推奨"
                              : propertyData.analysis.recommendation === "hold"
                              ? "要検討"
                              : "非推奨"}
                          </span>
                        </div>
                      )}
                      {propertyData.analysis.score !== null && (
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-700">投資スコア:</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-gray-900">
                              {propertyData.analysis.score}
                            </span>
                            <span className="text-lg text-gray-600">/100</span>
                          </div>
                        </div>
                      )}
                      {propertyData.analysis.summary && (
                        <div>
                          <h4 className="mb-3 text-sm font-semibold text-gray-900">サマリー</h4>
                          <div className="rounded-lg bg-gray-50 p-4">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                              {propertyData.analysis.summary}
                            </p>
                          </div>
                        </div>
                      )}
                      {propertyData.analysis.full_analysis && (
                        <details className="group">
                          <summary className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900">
                            詳細分析を見る
                          </summary>
                          <div className="mt-2 rounded-lg bg-gray-50 p-4">
                            <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                              {propertyData.analysis.full_analysis}
                            </div>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <p className="text-center text-gray-500">
                物件URLを入力すると、ここに物件情報と投資判断が表示されます
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
