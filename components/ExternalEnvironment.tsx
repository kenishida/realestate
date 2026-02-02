"use client";

import { useEffect, useState } from "react";
import type { PropertyExternalEnv, ExternalEnvPlace } from "@/lib/types";

interface ExternalEnvironmentProps {
  propertyId: string;
}

function PlaceList({ title, places }: { title: string; places: ExternalEnvPlace[] }) {
  if (!places?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100/50 px-6 py-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <ul className="divide-y divide-gray-100">
        {places.map((p, i) => (
          <li key={i} className="px-6 py-3 text-sm">
            <span className="font-medium text-gray-900">{p.name}</span>
            {p.distance_m != null && (
              <span className="ml-2 text-gray-500">徒歩約{p.distance_m}m</span>
            )}
            {p.address && (
              <p className="mt-0.5 text-gray-500 truncate">{p.address}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ExternalEnvironment({ propertyId }: ExternalEnvironmentProps) {
  const [data, setData] = useState<PropertyExternalEnv | null>(null);
  const [status, setStatus] = useState<"none" | "pending" | "completed" | "failed">("none");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEnv = async () => {
    if (!propertyId) return;
    const res = await fetch(`/api/property/${propertyId}/external-env`);
    const json = await res.json();
    if (!res.ok) {
      setStatus("none");
      setData(null);
      setLoading(false);
      return;
    }
    setData(json.data ?? null);
    setStatus((json.status as typeof status) ?? "none");
    setLoading(false);
  };

  useEffect(() => {
    fetchEnv();
  }, [propertyId]);

  // 取得中（pending）のときは一定間隔で再取得
  useEffect(() => {
    if (status !== "pending") return;
    const t = setInterval(fetchEnv, 5000);
    return () => clearInterval(t);
  }, [status, propertyId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`/api/property/${propertyId}/external-env/refresh`, { method: "POST" });
      await fetchEnv();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
        外部環境データを読み込み中...
      </div>
    );
  }

  if (status === "none" && !data) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
        まだデータがありません。住所が取得されると自動でリサーチを開始します。
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-gray-600">周辺の学校・病院・スーパー・コンビニを取得しています...</p>
        <p className="mt-2 text-sm text-gray-400">しばらくお待ちください（自動で更新されます）</p>
      </div>
    );
  }

  if (status === "failed" && data?.error_message) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-amber-800 font-medium">外部環境の取得に失敗しました</p>
        <p className="mt-1 text-sm text-amber-700">{data.error_message}</p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {refreshing ? "再取得中..." : "再取得"}
        </button>
      </div>
    );
  }

  if (status !== "completed" || !data) {
    return null;
  }

  return (
    <div className="space-y-4">
      {data.area_overview && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100/50 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">地域概要</h3>
          </div>
          <div className="px-6 py-4 text-sm text-gray-700 whitespace-pre-wrap">
            {data.area_overview}
          </div>
        </div>
      )}
      <PlaceList title="学校" places={data.schools ?? []} />
      <PlaceList title="病院" places={data.hospitals ?? []} />
      <PlaceList title="スーパー" places={data.supermarkets ?? []} />
      <PlaceList title="コンビニ" places={data.convenience_stores ?? []} />
    </div>
  );
}
