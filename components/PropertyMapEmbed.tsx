"use client";

import { useEffect, useState } from "react";

/**
 * Google Maps Embed API で住所の地図を表示するコンポーネント。
 * 環境変数 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY が必要です。
 * （GOOGLE_MAPS_API_KEY と同じ値を設定し、GCP で HTTP リファラ制限をかけることを推奨）
 */
export default function PropertyMapEmbed({ address }: { address: string }) {
  const [mapSrc, setMapSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = typeof window !== "undefined" ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY : undefined;

  useEffect(() => {
    if (!key || !address?.trim()) {
      setIsLoading(false);
      return;
    }

    // Geocoding API で座標を取得してから地図を表示
    const fetchCoordinates = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/geocode", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ address: address.trim() }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "座標取得に失敗しました");
        }

        // 座標を使って Maps Embed API の center パラメータで地図を表示
        const { lat, lng } = data;
        const src = `https://www.google.com/maps/embed/v1/view?key=${key}&center=${lat},${lng}&zoom=15&language=ja`;
        setMapSrc(src);
      } catch (err: any) {
        console.error("[PropertyMapEmbed] Geocoding error:", err);
        setError(err.message || "地図の読み込みに失敗しました");
        // フォールバック: q パラメータで試す
        const q = encodeURIComponent(address.trim());
        const fallbackSrc = `https://www.google.com/maps/embed/v1/place?key=${key}&q=${q}&language=ja`;
        setMapSrc(fallbackSrc);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCoordinates();
  }, [address, key]);

  if (!key) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 h-[200px] flex items-center justify-center">
        <p className="text-sm text-gray-500">地図を読み込み中...</p>
      </div>
    );
  }

  if (error && !mapSrc) {
    return (
      <div className="mt-3 rounded-lg overflow-hidden border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm text-amber-700">{error}</p>
      </div>
    );
  }

  if (!mapSrc) {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
      <iframe
        title="所在地の地図"
        src={mapSrc}
        width="100%"
        height="200"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block w-full"
      />
    </div>
  );
}
