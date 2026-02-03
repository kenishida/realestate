"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppVerticalSidebar from "@/components/AppVerticalSidebar";
import { useAuth } from "@/lib/auth-context";
import { createClientSupabase } from "@/lib/supabase";

interface InvestigatedProperty {
  id: string;
  title: string | null;
  address: string | null;
  price: number | null;
  url: string | null;
  investigated_at: string;
}

function formatYen(n: number | null): string {
  if (n == null) return "—";
  return `${n.toLocaleString("ja-JP")}円`;
}

export default function PropertiesPage() {
  const { user, session } = useAuth();
  const [properties, setProperties] = useState<InvestigatedProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const getToken = (): Promise<string | null> => {
      if (session?.access_token) return Promise.resolve(session.access_token);
      return createClientSupabase()
        .auth.getSession()
        .then(({ data: { session: s } }) => s?.access_token ?? null);
    };
    getToken()
      .then((token) => {
        if (!token) {
          setLoading(false);
          return;
        }
        return fetch("/api/properties/investigated", {
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.properties) {
              setProperties(data.properties);
            }
          });
      })
      .finally(() => setLoading(false));
  }, [user?.id, session?.access_token]);

  return (
    <div className="flex h-screen bg-gray-50">
      <AppVerticalSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-xl font-bold text-gray-900">物件一覧</h1>
          <p className="mt-1 text-sm text-gray-600">
            自分が調査した物件です
          </p>
          {loading ? (
            <p className="mt-6 text-sm text-gray-500">読み込み中...</p>
          ) : properties.length === 0 ? (
            <p className="mt-6 text-sm text-gray-500">
              調査した物件がありません。トップページで物件URLを送ると調査が始まります。
            </p>
          ) : (
            <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      住所・タイトル
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      価格
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      調査日時
                    </th>
                    <th scope="col" className="relative px-4 py-3">
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {properties.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {p.title || "—"}
                        </div>
                        {p.address && (
                          <div className="text-xs text-gray-500">{p.address}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-900">
                        {formatYen(p.price)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(p.investigated_at).toLocaleString("ja-JP")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/property/${p.id}`}
                          className="text-sm font-medium text-gray-900 hover:underline"
                        >
                          詳細
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
