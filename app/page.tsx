import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "トップページ - Real Estate",
  description: "不動産アプリケーション",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Real Estate</h1>
          <p className="text-gray-600">
            不動産情報を管理するアプリケーションです
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            ようこそ
          </h2>
          <p className="text-gray-600">
            このアプリケーションは不動産情報を管理するためのプラットフォームです。
          </p>
        </div>
      </div>
    </div>
  );
}
