/**
 * 住所を元に Google Maps で外部環境（学校・病院・スーパー・コンビニ・地域概要）を取得し DB に保存する
 */
import { createServiceRoleSupabase } from "@/lib/supabase-server";
import { geocodeAddress, searchNearby } from "@/lib/google-maps";
import type { ExternalEnvPlace, PropertyExternalEnv } from "@/lib/types";

const RADIUS_M = 1500;
const MAX_PLACES_PER_CATEGORY = 10;

/** カテゴリ別に searchNearby で使う type（Places API の type は1種類ずつで十分） */
const CATEGORY_TYPES: Record<keyof Pick<PropertyExternalEnv, "schools" | "hospitals" | "supermarkets" | "convenience_stores">, string> = {
  schools: "school",
  hospitals: "hospital",
  supermarkets: "supermarket",
  convenience_stores: "convenience_store",
};

export interface RunExternalEnvResearchResult {
  success: boolean;
  property_id: string;
  row_id?: string;
  error?: string;
}

/**
 * 1物件分の外部環境リサーチを実行し、property_external_env に upsert する
 * 住所が無い場合は pending のままにして終了
 */
export async function runExternalEnvResearch(
  propertyId: string,
  address: string | null
): Promise<RunExternalEnvResearchResult> {
  const supabase = createServiceRoleSupabase();

  // レコードが無ければ pending で作成
  const { data: existing } = await supabase
    .from("property_external_env")
    .select("id, status")
    .eq("property_id", propertyId)
    .single();

  if (!address?.trim()) {
    if (!existing) {
      await supabase.from("property_external_env").insert({
        property_id: propertyId,
        status: "pending",
      });
    }
    return { success: true, property_id: propertyId };
  }

  try {
    const geo = await geocodeAddress(address.trim());
    if (!geo) {
      await upsertExternalEnv(supabase, propertyId, {
        status: "failed",
        error_message: "Geocoding failed: no results",
      });
      return { success: false, property_id: propertyId, error: "Geocoding failed" };
    }

    const [schools, hospitals, supermarkets, convenience_stores] = await Promise.all([
      searchNearby(geo.lat, geo.lng, [CATEGORY_TYPES.schools], RADIUS_M, MAX_PLACES_PER_CATEGORY),
      searchNearby(geo.lat, geo.lng, [CATEGORY_TYPES.hospitals], RADIUS_M, MAX_PLACES_PER_CATEGORY),
      searchNearby(geo.lat, geo.lng, [CATEGORY_TYPES.supermarkets], RADIUS_M, MAX_PLACES_PER_CATEGORY),
      searchNearby(geo.lat, geo.lng, [CATEGORY_TYPES.convenience_stores], RADIUS_M, MAX_PLACES_PER_CATEGORY),
    ]);

    const normalize = (list: { name: string; address?: string; distance_m?: number; types?: string[] }[]): ExternalEnvPlace[] =>
      list.map((p) => ({
        name: p.name,
        address: p.address,
        distance_m: p.distance_m,
        types: p.types,
      }));

    await upsertExternalEnv(supabase, propertyId, {
      status: "completed",
      area_overview: null, // 地域概要は別途 Gemini で生成する場合はここで追加
      schools: normalize(schools),
      hospitals: normalize(hospitals),
      supermarkets: normalize(supermarkets),
      convenience_stores: normalize(convenience_stores),
      fetched_at: new Date().toISOString(),
      error_message: null,
    });

    return { success: true, property_id: propertyId };
  } catch (err: any) {
    const message = err?.message ?? String(err);
    await upsertExternalEnv(supabase, propertyId, {
      status: "failed",
      error_message: message,
    });
    return { success: false, property_id: propertyId, error: message };
  }
}

async function upsertExternalEnv(
  supabase: ReturnType<typeof createServiceRoleSupabase>,
  propertyId: string,
  data: {
    status: "pending" | "completed" | "failed";
    area_overview?: string | null;
    schools?: ExternalEnvPlace[];
    hospitals?: ExternalEnvPlace[];
    supermarkets?: ExternalEnvPlace[];
    convenience_stores?: ExternalEnvPlace[];
    fetched_at?: string | null;
    error_message?: string | null;
  }
) {
  await supabase
    .from("property_external_env")
    .upsert(
      {
        property_id: propertyId,
        ...data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "property_id" }
    );
}
