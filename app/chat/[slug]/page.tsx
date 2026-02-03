"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import ChatInput from "@/components/ChatInput";
import ChatMessage from "@/components/ChatMessage";
import PropertyDetails from "@/components/PropertyDetails";
import ExternalEnvironment from "@/components/ExternalEnvironment";
import AppVerticalSidebar from "@/components/AppVerticalSidebar";
import InvestmentAnalysis from "@/components/InvestmentAnalysis";
import { Property } from "@/lib/types";

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
  const [propertyData, setPropertyData] = useState<any>(null);
  const [propertyList, setPropertyList] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"property" | "environment" | "analysis">("property");
  const [waitingForPurpose, setWaitingForPurpose] = useState(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);

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
        const list = (data.properties ?? []) as Property[];
        setPropertyList(list);
        const defaultId = data.property?.id ?? list[0]?.id ?? null;
        setSelectedPropertyId(defaultId);
        setPropertyData({
          property: data.property,
          analysis: data.analysis,
          propertyDataUnavailable: data.propertyDataUnavailable ?? false,
        });
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
            // "その他"の場合は、ユーザーの入力テキストをそのまま使用
            return text.trim();
          }
          
          // 認識できない場合は、ユーザーの入力テキストをそのまま使用（自由なテキスト）
          return text.trim();
        };

        const purposeText = parseInvestmentPurpose(content);

        // スラグで開いたチャットでは currentAnalysisId が未設定のため、propertyData.analysis.id を利用
        const analysisIdToUse = currentAnalysisId ?? propertyData?.analysis?.id;
        if (!analysisIdToUse) {
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "投資判断データが見つかりません。物件URLを再度送信してから、投資目的を入力してください。",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
          setIsLoading(false);
          return;
        }

        try {
          const response = await fetch("/api/analyze-purpose", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              propertyId: propertyData.property.id,
              analysisId: analysisIdToUse,
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
            const purposeAnalysisMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.purposeAnalysis || "投資目的に応じた分析を更新しました。",
              timestamp: new Date(),
            };

            setMessages((prev) => [...prev, purposeAnalysisMessage]);
            
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
            content: errorContent || `エラーが発生しました: ${errorDetails}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
          setWaitingForPurpose(false);
        }
      } else {
        // 会話状態に応じて返答を切り替え（自由入力時）
        const hasProperty = !!propertyData?.property;
        const hasPurpose = !!(
          propertyData?.analysis?.investment_purpose &&
          propertyData.analysis.investment_purpose.trim() !== ""
        );

        const trimmedContent = content.trim();
        const isGreeting =
          trimmedContent.length <= 20 &&
          (/^(こんにちは|こんばんは|おはよう|はい|やあ|どうも|よろしく)([。！!]?)$/.test(
            trimmedContent
          ) ||
            /^(こんにちは|おはよう|よろしく)[、。]?\s*/.test(trimmedContent));

        const greetingPrefix = isGreeting ? "こんにちは。\n\n" : "";

        let replyContent: string;
        let shouldWaitForPurpose = false;

        if (!hasProperty) {
          replyContent =
            greetingPrefix +
            "物件URLを入力していただければ、投資判断を行います。\n例: https://athomes.jp/...";
        } else if (!hasPurpose) {
          replyContent =
            greetingPrefix +
            "この物件について、投資目的を教えてください。\n\n1. 利回り重視\n2. 資産防衛・節税\n3. 住居兼事務所（SOHO）\n4. その他\n\n番号（1-4）または目的を入力してください。";
          shouldWaitForPurpose = true;
        } else {
          replyContent =
            greetingPrefix +
            "この物件について、他に知りたいことはありますか？";
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: replyContent,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        if (shouldWaitForPurpose) {
          setWaitingForPurpose(true);
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
      // エラー時のみ投資目的待ちをリセット
      if (hasError && waitingForPurpose) {
        setWaitingForPurpose(false);
        setCurrentAnalysisId(null);
      }
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
        setActiveTab("property");
      }
    } catch (error: any) {
      console.error("Error loading property:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <AppVerticalSidebar />

      {/* 左側: チャットUI */}
      <div className="flex w-1/2 flex-col border-r border-gray-200 bg-white md:w-1/3">
        {/* ヘッダー */}
        <div className="flex items-center border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <Link href="/" className="block">
              <h1 className="text-xl font-bold text-gray-900 hover:opacity-80">物件価値わかるくん</h1>
            </Link>
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
                {activeTab === "analysis" && (
                  <InvestmentAnalysis analysis={propertyData.analysis} />
                )}
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
