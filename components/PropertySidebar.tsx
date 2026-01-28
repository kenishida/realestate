"use client";

import { useEffect, useState } from "react";
import { createClientSupabase } from "@/lib/supabase";
import { Property } from "@/lib/types";

interface PropertySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProperty?: (property: Property) => void;
}

export default function PropertySidebar({
  isOpen,
  onClose,
  onSelectProperty,
}: PropertySidebarProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchProperties();
    }
  }, [isOpen]);

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

  const handlePropertyClick = (property: Property) => {
    if (onSelectProperty) {
      onSelectProperty(property);
    }
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
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
          <h2 className="text-lg font-semibold text-gray-900">物件一覧</h2>
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

        {/* コンテンツ */}
        <div className="h-[calc(100%-73px)] overflow-y-auto">
          {isLoading ? (
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
          ) : error ? (
            <div className="p-4">
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            </div>
          ) : properties.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              物件がまだ登録されていません
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {properties.map((property) => (
                <button
                  key={property.id}
                  onClick={() => handlePropertyClick(property)}
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900">
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
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
