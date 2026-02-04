"use client";

import Link from "next/link";

export default function AppVerticalSidebar() {
  return (
    <aside
      className="group flex h-full w-16 shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-200 ease-out hover:w-52"
      aria-label="メインナビゲーション"
    >
      {/* アプリ名（ヘッダー高さ h-16 に揃える） */}
      <div className="flex h-16 shrink-0 items-center border-b border-gray-200 px-3">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-900 transition-colors hover:bg-gray-100"
          title="物件価値わかるくん"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-lg font-bold text-gray-700">
            わ
          </span>
          <span className="whitespace-nowrap text-sm font-bold opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            物件価値わかるくん
          </span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {/* ホーム */}
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title="ホーム"
        >
          <svg
            className="h-6 w-6 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            ホーム
          </span>
        </Link>

        {/* チャットを新規作成 */}
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title="チャットを新規作成"
        >
          <svg
            className="h-6 w-6 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          <span className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            チャットを新規作成
          </span>
        </Link>

        {/* チャット履歴 */}
        <Link
          href="/chats"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title="チャット履歴"
        >
          <svg
            className="h-6 w-6 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            チャット履歴
          </span>
        </Link>

        {/* 物件一覧 */}
        <Link
          href="/properties"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title="物件一覧"
        >
          <svg
            className="h-6 w-6 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <span className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            物件一覧
          </span>
        </Link>
      </nav>
    </aside>
  );
}
