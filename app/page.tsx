"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ChatInput from "@/components/ChatInput";
import ChatMessage from "@/components/ChatMessage";
import PropertyDetails from "@/components/PropertyDetails";
import PropertySidebar from "@/components/PropertySidebar";
import InvestmentAnalysis from "@/components/InvestmentAnalysis";
import ExternalEnvironment from "@/components/ExternalEnvironment";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/lib/auth-context";
import { Property } from "@/lib/types";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export default function Home() {
  const router = useRouter();
  const { user, signOut, isLoading: authLoading } = useAuth();
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"property" | "environment" | "analysis">("property");
  const [waitingForPurpose, setWaitingForPurpose] = useState(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);

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
        // 物件URLの場合、投資判断を生成
        // localStorageから既存のconversationIdを取得
        const existingConversationId = localStorage.getItem("currentConversationId");
        
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            url: content,
            conversationId: existingConversationId || undefined,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          const errorMessage = data.error || "Failed to analyze property";
          const errorDetails = data.details ? `\n詳細: ${data.details}` : "";
          const helpLink = data.help ? `\n\n解決方法: ${data.help}` : "";
          throw new Error(`${errorMessage}${errorDetails}${helpLink}`);
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
          setPropertyData({ ...data, propertyDataUnavailable: data.propertyDataUnavailable ?? false });
          
          // 分析IDを保存
          if (data.analysisId) {
            setCurrentAnalysisId(data.analysisId);
          }
          
          // 会話IDを保存（次回のリクエストで使用）
          if (data.conversationId) {
            localStorage.setItem("currentConversationId", data.conversationId);
          }

          // 投資目的の質問を自動追加
          const purposeQuestion: Message = {
            id: (Date.now() + 2).toString(),
            role: "assistant",
            content: "この物件の投資目的を教えてください。\n\n1. 利回り重視\n2. 資産防衛・節税\n3. 住居兼事務所（SOHO）\n4. その他\n\n番号（1-4）または目的を入力してください。",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, purposeQuestion]);
          setWaitingForPurpose(true);
        } else {
          throw new Error(data.error || "Unknown error");
        }
      } else if (waitingForPurpose) {
        // 投資目的の回答を処理（自由なテキストとして受け入れる）
        const parseInvestmentPurpose = (text: string): string => {
          const normalized = text.trim().toLowerCase();
          
          // 番号で判定（後方互換性のため、既存の選択肢も認識）
          if (normalized === "1" || (normalized.includes("利回り") && !normalized.includes("その他"))) {
            return "利回り重視";
          }
          if (normalized === "2" || (normalized.includes("資産防衛") || normalized.includes("節税")) && !normalized.includes("その他")) {
            return "資産防衛・節税";
          }
          if (normalized === "3" || (normalized.includes("soho") || normalized.includes("住居兼事務所") || normalized.includes("事務所")) && !normalized.includes("その他")) {
            return "住居兼事務所（SOHO）";
          }
          if (normalized === "4" || normalized.includes("その他")) {
            // "その他"の場合は、ユーザーに具体的な目的を聞く必要があるが、
            // 今回は自由なテキストとして受け入れるため、入力テキストをそのまま使用
            return text.trim();
          }
          
          // 認識できない場合は、ユーザーの入力テキストをそのまま使用（自由なテキスト）
          return text.trim();
        };

        const purposeText = parseInvestmentPurpose(content);

        // 投資目的に応じた追加分析を取得
        try {
          const response = await fetch("/api/analyze-purpose", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              propertyId: propertyData.property.id,
              analysisId: currentAnalysisId,
              purpose: purposeText, // 自由なテキストをそのまま送信
              conversationId: propertyData.conversationId || localStorage.getItem("currentConversationId"),
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            const errorMessage = data.error || "Failed to analyze purpose";
            const errorDetails = data.details ? `\n${data.details}` : "";
            throw new Error(`${errorMessage}${errorDetails}`);
          }

          if (data.success) {
            // 更新された分析結果を表示
            const purposeAnalysisMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.purposeAnalysis || "投資目的に応じた分析を更新しました。",
              timestamp: new Date(),
            };

            setMessages((prev) => [...prev, purposeAnalysisMessage]);
            
            // プロパティデータを更新
            setPropertyData((prev: any) => ({
              ...prev,
              analysis: {
                ...prev.analysis,
                ...data.updatedAnalysis,
                investment_purpose: purposeText,
              },
              propertyDataUnavailable: prev.propertyDataUnavailable ?? false,
            }));

            setWaitingForPurpose(false);
            setCurrentAnalysisId(null);
          } else {
            // エラーの詳細を取得
            const errorMessage = data.error || "Unknown error";
            const errorDetails = data.details || "";
            throw new Error(`${errorMessage}${errorDetails ? `\n${errorDetails}` : ""}`);
          }
        } catch (error: any) {
          console.error("Error analyzing purpose:", error);
          const errorDetails = error.message || "不明なエラー";
          
          // エラーメッセージを解析
          let errorContent = "";
          
          // カラムが存在しない場合
          if (errorDetails.includes("investment_purposeカラム") || 
              errorDetails.includes("データベースカラムのエラー") ||
              errorDetails.includes("column") || 
              errorDetails.includes("does not exist") ||
              errorDetails.includes("42703")) {
            errorContent = `【エラー】investment_purposeカラムが存在しません\n\n`;
            errorContent += `【解決方法】\n`;
            errorContent += `1. Supabaseのダッシュボードを開く\n`;
            errorContent += `2. 左側メニューから「SQL Editor」を選択\n`;
            errorContent += `3. 「New query」をクリック\n`;
            errorContent += `4. 以下のSQLをコピー＆ペーストして実行:\n\n`;
            errorContent += `-- 1. investment_purposeカラムの追加\n`;
            errorContent += `ALTER TABLE property_analyses \n`;
            errorContent += `ADD COLUMN IF NOT EXISTS investment_purpose TEXT;\n\n`;
            errorContent += `-- 2. インデックスの追加\n`;
            errorContent += `CREATE INDEX IF NOT EXISTS idx_property_analyses_investment_purpose \n`;
            errorContent += `ON property_analyses(investment_purpose) \n`;
            errorContent += `WHERE investment_purpose IS NOT NULL;\n\n`;
            errorContent += `-- 3. UPDATE権限の設定\n`;
            errorContent += `DROP POLICY IF EXISTS "Anyone can update property_analyses" ON property_analyses;\n`;
            errorContent += `CREATE POLICY "Anyone can update property_analyses"\n`;
            errorContent += `  ON property_analyses FOR UPDATE\n`;
            errorContent += `  USING (true)\n`;
            errorContent += `  WITH CHECK (true);\n\n`;
            errorContent += `5. 実行後、このページをリロードして再度お試しください`;
          }
          // RLSポリシーの問題の場合
          else if (errorDetails.includes("UPDATE権限") || 
                   errorDetails.includes("データベース権限のエラー") ||
                   errorDetails.includes("permission") || 
                   errorDetails.includes("policy") ||
                   errorDetails.includes("42501")) {
            errorContent = `【エラー】UPDATE権限がありません\n\n`;
            errorContent += `【解決方法】\n`;
            errorContent += `1. Supabaseのダッシュボードを開く\n`;
            errorContent += `2. SQL Editorを開く\n`;
            errorContent += `3. 以下のSQLを実行してください:\n\n`;
            errorContent += `DROP POLICY IF EXISTS "Anyone can update property_analyses" ON property_analyses;\n\n`;
            errorContent += `CREATE POLICY "Anyone can update property_analyses"\n`;
            errorContent += `  ON property_analyses FOR UPDATE\n`;
            errorContent += `  USING (true)\n`;
            errorContent += `  WITH CHECK (true);\n\n`;
            errorContent += `4. 実行後、再度お試しください`;
          } else {
            errorContent = `エラーが発生しました: ${errorDetails}\n\n`;
            errorContent += `考えられる原因:\n`;
            errorContent += `- データベースの更新権限の問題\n`;
            errorContent += `- investment_purposeカラムが存在しない\n\n`;
            errorContent += `サーバーログを確認してください。`;
          }
          
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: errorContent,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
          setWaitingForPurpose(false);
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

  const handleSelectProperty = async (property: Property) => {
    console.log("Selected property:", property);
    setIsSidebarOpen(false);
    
    // 既存の動作（物件詳細を表示）
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
          propertyDataUnavailable: data.propertyDataUnavailable ?? false,
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
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center">
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
              <Link href="/" className="block">
                <h1 className="text-xl font-bold text-gray-900 hover:opacity-80">物件価値わかるくん</h1>
              </Link>
              <p className="mt-1 text-sm text-gray-600">
                物件URLを入力して投資判断を取得
              </p>
            </div>
          </div>
          {!authLoading && (
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <span className="max-w-[140px] truncate text-sm text-gray-600" title={user.email}>
                    {user.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    ログアウト
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMessage(undefined);
                    setAuthModalOpen(true);
                  }}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  ログイン
                </button>
              )}
            </div>
          )}
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
        <ChatInput 
          onSendMessage={handleSendMessage} 
          isLoading={isLoading} 
          hasUserMessages={messages.some(msg => msg.role === "user")}
        />
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
                  外部環境あ
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
                      <InvestmentAnalysis analysis={propertyData.analysis} />
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
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <p className="text-center text-gray-500">
                物件URLを入力すると、ここに物件情報と投資判断が表示されます
              </p>
            </div>
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
