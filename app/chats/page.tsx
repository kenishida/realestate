"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppVerticalSidebar from "@/components/AppVerticalSidebar";

interface ConversationWithProperty {
  id: string;
  custom_path: string | null;
  title: string | null;
  updated_at: string;
  property?: { id: string; title: string | null; address: string | null } | null;
}

export default function ChatsPage() {
  const [conversations, setConversations] = useState<ConversationWithProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/conversations/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.conversations) {
          setConversations(data.conversations);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      <AppVerticalSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-xl font-bold text-gray-900">チャット履歴</h1>
          <p className="mt-1 text-sm text-gray-600">
            ログイン中のチャット一覧です
          </p>
          {loading ? (
            <p className="mt-6 text-sm text-gray-500">読み込み中...</p>
          ) : conversations.length === 0 ? (
            <p className="mt-6 text-sm text-gray-500">
              チャット履歴がありません。トップページで物件URLを送ると会話が始まります。
            </p>
          ) : (
            <ul className="mt-6 space-y-2">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={c.custom_path ? `/chat/${c.custom_path}` : "/"}
                    className="block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {c.property?.title || c.title || "会話"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(c.updated_at).toLocaleString("ja-JP")}
                      </span>
                    </div>
                    {c.property?.address && (
                      <p className="mt-1 text-sm text-gray-600">{c.property.address}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
