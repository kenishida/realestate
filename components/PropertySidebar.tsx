"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientSupabase } from "@/lib/supabase";
import { Property, Conversation } from "@/lib/types";

interface ConversationWithProperty extends Conversation {
  property?: Property | null;
}

interface PropertySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProperty?: (property: Property) => void;
}

type TabType = "chat" | "property";

export default function PropertySidebar({
  isOpen,
  onClose,
  onSelectProperty,
}: PropertySidebarProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [properties, setProperties] = useState<Property[]>([]);
  const [conversations, setConversations] = useState<ConversationWithProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);
  const [propertyConversations, setPropertyConversations] = useState<Record<string, Conversation[]>>({});

  useEffect(() => {
    if (isOpen) {
      if (activeTab === "chat") {
        fetchConversations();
      } else {
        fetchProperties();
      }
    }
  }, [isOpen, activeTab]);

  const fetchConversations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("[PropertySidebar] Fetching conversations...");
      
      const response = await fetch("/api/conversations");
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[PropertySidebar] Error fetching conversations:", errorData);
        setError(errorData.error || "チャット履歴の取得に失敗しました");
        return;
      }

      const data = await response.json();

      if (data.success) {
        console.log("[PropertySidebar] Conversations fetched:", data.conversations?.length || 0);
        setConversations((data.conversations || []) as ConversationWithProperty[]);
      } else {
        console.error("[PropertySidebar] Failed to fetch conversations:", data.error);
        setError(data.error || "チャット履歴の取得に失敗しました");
      }
    } catch (err: any) {
      console.error("[PropertySidebar] Error fetching conversations:", err);
      setError(err.message || "チャット履歴の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProperties = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClientSupabase();
      console.log("[PropertySidebar] Fetching properties...");
      
      const { data, error: fetchError } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      console.log("[PropertySidebar] Fetch result:", {
        dataCount: data?.length || 0,
        error: fetchError,
      });

      if (fetchError) {
        console.error("[PropertySidebar] Fetch error details:", {
          message: fetchError.message,
          code: fetchError.code,
          details: fetchError.details,
          hint: fetchError.hint,
        });
        // RLSポリシーのエラーの場合、より詳細なメッセージを表示
        if (fetchError.code === "42501" || fetchError.message.includes("permission")) {
          setError("アクセス権限がありません。RLSポリシーを確認してください。");
        } else {
          setError(fetchError.message || "物件一覧の取得に失敗しました");
        }
        return;
      }

      console.log("[PropertySidebar] Properties fetched:", data?.length || 0);
      setProperties(data || []);
    } catch (err: any) {
      console.error("[PropertySidebar] Error fetching properties:", err);
      setError(err.message || "物件一覧の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePropertyClick = async (property: Property) => {
    // 展開/折りたたみを切り替え
    if (expandedPropertyId === property.id) {
      setExpandedPropertyId(null);
      return;
    }

    setExpandedPropertyId(property.id);

    // この物件に関連するチャット履歴を取得
    if (!propertyConversations[property.id]) {
      try {
        console.log("[PropertySidebar] Fetching conversations for property:", property.id);
        
        // APIエンドポイントを使用してチャット履歴を取得（RLSポリシーをバイパス）
        const response = await fetch(`/api/property/${property.id}/conversations`);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error("[PropertySidebar] Error fetching conversations:", errorData);
          setPropertyConversations((prev) => ({
            ...prev,
            [property.id]: [],
          }));
          return;
        }

        const data = await response.json();

        if (data.success) {
          console.log("[PropertySidebar] Conversations fetched:", data.conversations?.length || 0);
          setPropertyConversations((prev) => ({
            ...prev,
            [property.id]: (data.conversations || []) as Conversation[],
          }));
        } else {
          console.error("[PropertySidebar] Failed to fetch conversations:", data.error);
          setPropertyConversations((prev) => ({
            ...prev,
            [property.id]: [],
          }));
        }
      } catch (err: any) {
        console.error("[PropertySidebar] Error loading conversations:", err);
        setPropertyConversations((prev) => ({
          ...prev,
          [property.id]: [],
        }));
      }
    }
  };

  const handleConversationClick = (conversation: Conversation) => {
    if (conversation.custom_path) {
      router.push(`/chat/${conversation.custom_path}`);
      onClose();
    }
  };

  const renderChatHistory = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-2">
            <svg
              className="h-6 w-6 animate-spin text-gray-400"
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
            <p className="text-sm text-gray-500">読み込み中...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-4">
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        </div>
      );
    }

    if (conversations.length === 0) {
      return (
        <div className="p-8 text-center text-sm text-gray-500">
          チャット履歴がまだありません
        </div>
      );
    }

    return (
      <div className="divide-y divide-gray-200">
        {conversations.map((conversation) => {
          // 物件の住所を優先的に表示、なければタイトルやcustom_pathを使用
          const displayTitle = conversation.property
            ? conversation.property.address || conversation.property.location || "住所不明"
            : conversation.title || conversation.custom_path || "タイトルなし";
          
          return (
            <button
              key={conversation.id}
              onClick={() => handleConversationClick(conversation)}
              className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                !conversation.custom_path ? "opacity-50 cursor-not-allowed" : ""
              }`}
              disabled={!conversation.custom_path}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-1">
                  <p className="font-medium text-gray-900">
                    {displayTitle}
                  </p>
                  {conversation.property && conversation.property.price && (
                    <p className="text-sm text-gray-600">
                      {conversation.property.price.toLocaleString()}円
                    </p>
                  )}
                  {conversation.custom_path && (
                    <p className="text-xs text-gray-500">
                      /{conversation.custom_path}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {new Date(conversation.updated_at).toLocaleString("ja-JP")}
                  </p>
                </div>
                {conversation.custom_path && (
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderPropertyList = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-2">
            <svg
              className="h-6 w-6 animate-spin text-gray-400"
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
            <p className="text-sm text-gray-500">読み込み中...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-4">
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        </div>
      );
    }

    if (properties.length === 0) {
      return (
        <div className="p-8 text-center text-sm text-gray-500">
          物件がまだ登録されていません
        </div>
      );
    }

    return (
      <div className="divide-y divide-gray-200">
        {properties.map((property) => {
          const isExpanded = expandedPropertyId === property.id;
          const propertyConvs = propertyConversations[property.id] || [];

          return (
            <div key={property.id} className="border-b border-gray-200 last:border-b-0">
              <div className="flex items-start gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    router.push(`/property/${property.id}`);
                    onClose();
                  }}
                  className="flex-1 min-w-0 text-left transition-colors hover:bg-gray-50 rounded -m-1 p-1"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900 truncate">
                      {property.address || property.location || "住所不明"}
                    </p>
                    {property.price && (
                      <p className="text-sm text-gray-600">
                        {property.price.toLocaleString()}円
                      </p>
                    )}
                    {property.property_type && (
                      <p className="text-xs text-gray-500">
                        {property.property_type}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(property.created_at).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePropertyClick(property);
                  }}
                  className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label={isExpanded ? "チャット履歴を閉じる" : "チャット履歴を開く"}
                >
                  <svg
                    className={`h-5 w-5 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>
              
              {/* 展開されたチャット履歴リスト */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700 mb-2">
                      チャット履歴 ({propertyConvs.length})
                    </p>
                    {propertyConvs.length === 0 ? (
                      <p className="text-xs text-gray-500">チャット履歴がありません</p>
                    ) : (
                      propertyConvs.map((conversation) => (
                        <button
                          key={conversation.id}
                          onClick={() => handleConversationClick(conversation)}
                          className={`w-full rounded-md px-3 py-2 text-sm transition-colors border ${
                            conversation.custom_path
                              ? "bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 border-gray-200"
                              : "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                          }`}
                          disabled={!conversation.custom_path}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {conversation.custom_path ? `/${conversation.custom_path}` : "パス未設定"}
                            </span>
                            {conversation.custom_path && (
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(conversation.created_at).toLocaleDateString("ja-JP")}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* サイドバー */}
      <div
        className={`fixed left-0 top-0 z-50 h-full w-80 transform bg-white shadow-xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* ヘッダー */}
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-4">
            <h2 className="text-lg font-semibold text-gray-900">履歴</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="サイドバーを閉じる"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          
          {/* タブ */}
          <div className="flex gap-2 px-4 pb-3">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "chat"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              チャット履歴
            </button>
            <button
              onClick={() => setActiveTab("property")}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "property"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              物件一覧
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="h-[calc(100%-140px)] overflow-y-auto">
          {activeTab === "chat" ? renderChatHistory() : renderPropertyList()}
        </div>
      </div>
    </>
  );
}
