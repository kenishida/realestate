/**
 * Google Maps Platform: Geocoding API + Places API (New) searchNearby
 * 環境変数 GOOGLE_MAPS_API_KEY が必要です。
 */

const GEOCODING_BASE = "https://maps.googleapis.com/maps/api/geocode/json";
const PLACES_NEARBY_BASE = "https://places.googleapis.com/v1/places:searchNearby";

export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address?: string;
}

export interface PlaceResult {
  name: string;
  address?: string;
  distance_m?: number;
  types?: string[];
}

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error("GOOGLE_MAPS_API_KEY is not set");
  }
  return key;
}

/**
 * 住所を緯度・経度に変換（Geocoding API）
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = getApiKey();
  const url = `${GEOCODING_BASE}?address=${encodeURIComponent(address)}&key=${key}&language=ja`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.[0]) {
    return null;
  }
  const r = data.results[0];
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formatted_address: r.formatted_address,
  };
}

/**
 * 座標周辺の施設を検索（Places API (New) searchNearby）
 * includedTypes: https://developers.google.com/maps/documentation/places/web-service/place-types
 */
export async function searchNearby(
  lat: number,
  lng: number,
  includedTypes: string[],
  radiusMeters = 1500,
  maxResults = 10
): Promise<PlaceResult[]> {
  const key = getApiKey();
  const body = {
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusMeters,
      },
    },
    includedTypes,
    maxResultCount: maxResults,
    languageCode: "ja",
  };
  // Field Mask: 必要最小限のフィールドでコストを抑える（Essentials に寄せる）
  // 注: searchNearby レスポンスには distanceMeters フィールドは含まれないため省略
  const fieldMask =
    "places.displayName,places.formattedAddress,places.types";
  const res = await fetch(PLACES_NEARBY_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API error: ${res.status} ${text}`);
  }
  const data = await res.json();
  const places: PlaceResult[] = (data.places || []).map((p: any) => ({
    name: p.displayName?.text ?? p.displayName ?? "",
    address: p.formattedAddress ?? undefined,
    distance_m: p.distanceMeters ?? undefined,
    types: p.types ?? undefined,
  }));
  return places;
}

/** 外部環境リサーチで使う施設タイプ（Places API の type 名） */
export const EXTERNAL_ENV_PLACE_TYPES = {
  schools: ["school", "primary_school", "secondary_school", "university"],
  hospitals: ["hospital", "doctor", "pharmacy"],
  supermarkets: ["supermarket", "grocery_store"],
  convenience_stores: ["convenience_store"],
} as const;
