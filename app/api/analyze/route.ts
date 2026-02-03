import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseForApi, createServiceRoleSupabase } from "@/lib/supabase-server";
import { generateTextWithGemini } from "@/lib/gemini";
import { scrapePropertyData, fetchPropertyHTML, isBlockedOrRedirectPage } from "@/lib/property-scraper";
import type { Property, PropertyAnalysis } from "@/lib/types";
import { randomBytes } from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * ランダムなURLパスを生成する関数
 * 8文字の英数字（小文字）を生成
 */
function generateRandomPath(): string {
  // ランダムなバイトを生成して、base64urlエンコード（URLセーフ）
  // 8文字のランダムな文字列を生成
  const bytes = randomBytes(6); // 6バイト = 8文字（base64エンコード後）
  return bytes.toString('base64url').substring(0, 8).toLowerCase();
}

/**
 * 物件URLを正規化する（クエリ・ハッシュを除去し、同一物件を同じキーで扱う）
 * 例: https://www.athome.co.jp/buy_other/1014743491/?BKLISTID=001LPC → https://www.athome.co.jp/buy_other/1014743491/
 */
function normalizePropertyUrl(urlString: string): string {
  const u = new URL(urlString);
  u.search = "";
  u.hash = "";
  return u.toString();
}

/** 築年数と築年月の表示用文字列を取得（year_built が西暦または旧形式の築年数の両方に対応） */
function getBuiltYearInfo(yearBuilt: number | null, yearBuiltMonth: number | null): { ageYears: number | null; dateStr: string } {
  if (yearBuilt == null) return { ageYears: null, dateStr: "不明" };
  const currentYear = new Date().getFullYear();
  const isSeireki = yearBuilt >= 1900;
  const builtYear = isSeireki ? yearBuilt : currentYear - yearBuilt;
  const ageYears = currentYear - builtYear;
  const monthPart = yearBuiltMonth != null ? `${yearBuiltMonth}月` : "";
  return { ageYears: ageYears >= 0 ? ageYears : null, dateStr: `${builtYear}年${monthPart}` };
}

/**
 * 物件URLを受け取り、投資判断を生成するAPIエンドポイント
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, conversationId } = body;

    // ログイン中なら Bearer でユーザーを取得（新規会話をそのユーザーに紐づけるため）
    let requestUserId: string | null = null;
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (token && supabaseUrl && supabaseAnonKey) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user } } = await authClient.auth.getUser(token);
      if (user?.id) requestUserId = user.id;
    }
    
    console.log("[Analyze] ========================================");
    console.log("[Analyze] Received request:", { 
      url, 
      hasConversationId: !!conversationId,
      conversationId: conversationId || "none",
      hasRequestUser: !!requestUserId,
    });
    console.log("[Analyze] ========================================");

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // URLが有効かチェック
    let propertyUrl: URL;
    try {
      propertyUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    const normalizedUrl = normalizePropertyUrl(url);

    const { supabase, error: supabaseError } = await getSupabaseForApi();
    if (supabaseError || !supabase) {
      console.error("[Analyze] Supabase init failed:", supabaseError);
      return NextResponse.json(
        { success: false, error: supabaseError ?? "Database is not available.", code: "SUPABASE_CONFIG" },
        { status: 503 }
      );
    }

    // 会話IDが指定されていない場合は、新しい会話を作成
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      console.log("[Analyze] Creating new conversation with custom_path...");
      
      // ランダムなURLパスを生成
      let customPath = generateRandomPath();
      let pathAttempts = 0;
      const maxPathAttempts = 10;
      
      // 重複チェック（既存のパスと重複しないように）
      while (pathAttempts < maxPathAttempts) {
        const { data: existing } = await supabase
          .from("conversations")
          .select("id")
          .eq("custom_path", customPath)
          .single();
        
        if (!existing) {
          // 重複していない場合は使用
          break;
        }
        
        // 重複している場合は新しいパスを生成
        customPath = generateRandomPath();
        pathAttempts++;
      }
      
      // 会話作成をリトライ（最大3回）。user_id を設定する場合は RLS を避けるためサービスロールを使用
      let createAttempts = 0;
      const maxCreateAttempts = 3;
      let conversationCreated = false;
      let insertClient = supabase;
      if (requestUserId) {
        try {
          insertClient = createServiceRoleSupabase();
        } catch {
          insertClient = supabase;
        }
      }

      while (createAttempts < maxCreateAttempts && !conversationCreated) {
        const { data: newConversation, error: convError } = await insertClient
          .from("conversations")
          .insert({
            title: null, // 後で物件名で更新可能
            user_id: requestUserId, // ログイン中なら Bearer で取得したユーザーID、未ログインなら null
            custom_path: customPath, // ランダムなURLパスを設定
          })
          .select()
          .single();
        
        if (convError) {
          console.error(`[Analyze] Failed to create conversation (attempt ${createAttempts + 1}/${maxCreateAttempts}):`, {
            error: convError,
            message: convError.message,
            code: convError.code,
            details: convError.details,
            hint: convError.hint,
            custom_path: customPath,
          });
          
          createAttempts++;
          
          // 最後の試行でも失敗した場合は、custom_pathなしで再試行
          if (createAttempts >= maxCreateAttempts) {
            console.warn("[Analyze] All attempts failed. Trying without custom_path...");
            const { data: fallbackConversation, error: fallbackError } = await insertClient
              .from("conversations")
              .insert({
                title: null,
                user_id: requestUserId,
                // custom_pathは後で更新
              })
              .select()
              .single();
            
            if (fallbackError) {
              console.error("[Analyze] Failed to create conversation even without custom_path:", {
                error: fallbackError,
                message: fallbackError.message,
                code: fallbackError.code,
              });
              // 会話なしで処理を続行（後でcustom_pathを設定できないが、最低限の処理は続行）
            } else {
              currentConversationId = fallbackConversation.id;
              console.log("[Analyze] Created conversation without custom_path:", currentConversationId);
              
              // 後でcustom_pathを設定する試み
              const updatePath = generateRandomPath();
              const { error: updateError } = await supabase
                .from("conversations")
                .update({ custom_path: updatePath })
                .eq("id", currentConversationId);
              
              if (updateError) {
                console.error("[Analyze] Failed to set custom_path after creation:", updateError);
              } else {
                console.log("[Analyze] Set custom_path after creation:", updatePath);
              }
            }
          }
        } else {
          currentConversationId = newConversation.id;
          conversationCreated = true;
          console.log("[Analyze] Successfully created new conversation:", {
            id: currentConversationId,
            custom_path: customPath,
            actual_custom_path: newConversation.custom_path,
          });
          
          // 実際にcustom_pathが保存されたか確認
          if (newConversation.custom_path !== customPath) {
            console.warn("[Analyze] WARNING: custom_path mismatch!", {
              expected: customPath,
              actual: newConversation.custom_path,
            });
          }
        }
      }
    } else {
      console.log("[Analyze] Using existing conversation:", currentConversationId);
      
      // 既存の会話でcustom_pathが設定されていない場合は生成
      const { data: existingConversation, error: fetchError } = await supabase
        .from("conversations")
        .select("custom_path, user_id")
        .eq("id", currentConversationId)
        .single();
      
      if (fetchError) {
        console.error("[Analyze] Failed to fetch existing conversation:", {
          error: fetchError,
          message: fetchError.message,
          code: fetchError.code,
          conversation_id: currentConversationId,
        });
      } else if (existingConversation) {
        console.log("[Analyze] Existing conversation found:", {
          conversation_id: currentConversationId,
          has_custom_path: !!existingConversation.custom_path,
          custom_path: existingConversation.custom_path || "NULL",
          user_id: existingConversation.user_id || "NULL",
        });
        
        if (!existingConversation.custom_path) {
          console.log("[Analyze] custom_path is missing, generating new one...");
          
          // ランダムなURLパスを生成
          let customPath = generateRandomPath();
          let attempts = 0;
          const maxAttempts = 10;
          
          // 重複チェック
          while (attempts < maxAttempts) {
            const { data: existing } = await supabase
              .from("conversations")
              .select("id")
              .eq("custom_path", customPath)
              .single();
            
            if (!existing) {
              break;
            }
            
            customPath = generateRandomPath();
            attempts++;
          }
          
          // custom_pathを更新（リトライロジック付き）
          let updateAttempts = 0;
          const maxUpdateAttempts = 3;
          let updateSuccess = false;
          
          while (updateAttempts < maxUpdateAttempts && !updateSuccess) {
            const { data: updatedConversation, error: updateError } = await supabase
              .from("conversations")
              .update({ custom_path: customPath })
              .eq("id", currentConversationId)
              .select()
              .single();
            
            if (updateError) {
              console.error(`[Analyze] Failed to update conversation custom_path (attempt ${updateAttempts + 1}/${maxUpdateAttempts}):`, {
                error: updateError,
                message: updateError.message,
                code: updateError.code,
                details: updateError.details,
                conversation_id: currentConversationId,
                custom_path: customPath,
              });
              updateAttempts++;
            } else {
              updateSuccess = true;
              console.log("[Analyze] ✓ Successfully updated conversation custom_path:", {
                conversation_id: currentConversationId,
                custom_path: customPath,
                actual_custom_path: updatedConversation?.custom_path,
              });
              
              // 実際にcustom_pathが更新されたか確認
              if (updatedConversation?.custom_path !== customPath) {
                console.warn("[Analyze] ⚠️  WARNING: custom_path update mismatch!", {
                  expected: customPath,
                  actual: updatedConversation?.custom_path,
                });
              }
            }
          }
        }
      }
    }

    // 既存の物件データをチェック（正規化URLで検索、なければ元のURLでも検索）
    let existingProperty: Property | null = null;
    const { data: byNormalized, error: errNormalized } = await supabase
      .from("properties")
      .select("*")
      .eq("url", normalizedUrl)
      .maybeSingle();
    if (errNormalized) {
      console.error("[Analyze] Error checking existing property (normalized):", errNormalized);
      return NextResponse.json(
        { success: false, error: "Failed to check existing property", details: errNormalized.message },
        { status: 500 }
      );
    }
    if (byNormalized) {
      existingProperty = byNormalized as Property;
    } else if (url !== normalizedUrl) {
      const { data: byOriginal, error: errOriginal } = await supabase
        .from("properties")
        .select("*")
        .eq("url", url)
        .maybeSingle();
      if (errOriginal) {
        console.error("[Analyze] Error checking existing property (original url):", errOriginal);
        return NextResponse.json(
          { success: false, error: "Failed to check existing property", details: errOriginal.message },
          { status: 500 }
        );
      }
      existingProperty = (byOriginal as Property) ?? null;
    }

    let property: Property;
    let propertyId: string | undefined = existingProperty?.id;
    let propertyDataUnavailable = false;

    // 既存データがあっても、主要な情報が不足している場合は再スクレイピング
    const shouldRescrape = !existingProperty || 
      !existingProperty.title || 
      !existingProperty.address || 
      !existingProperty.floor_plan;

    if (existingProperty && !shouldRescrape) {
      // 既存データが十分な場合はHTML取得をスキップし、DBのデータをそのまま使う
      property = existingProperty as Property;
      propertyId = property.id;
      console.log("[Analyze] Using existing property (data complete), skipping HTML fetch:", propertyId);
    } else {
    // HTMLを取得して保存（新規 or データ不足時のみ）
    console.log("[Analyze] ========================================");
    console.log("[Analyze] Step 1: Fetching HTML from URL:", url);
    console.log("[Analyze] ========================================");
    
    let htmlContent: string | null = null;
    let htmlStorageId: string | null = null;
    
    try {
      const htmlResult = await fetchPropertyHTML(url);
      htmlContent = htmlResult.html;
      console.log("[Analyze] HTML fetched successfully, length:", htmlContent.length);
      
      // HTMLをデータベースに保存
      const { data: savedHTML, error: htmlSaveError } = await supabase
        .from("property_html_storage")
        .insert({
          property_id: propertyId ?? null,
          url,
          html: htmlContent,
          status: "success",
          content_length: htmlContent.length,
        })
        .select()
        .single();
      
      if (htmlSaveError) {
        console.warn("[Analyze] Failed to save HTML to storage:", htmlSaveError.message);
        console.warn("[Analyze] Error details:", htmlSaveError);
      } else {
        htmlStorageId = savedHTML.id;
        console.log("[Analyze] HTML saved to storage:", htmlStorageId);
      }
    } catch (htmlError: any) {
      console.error("[Analyze] ========================================");
      console.error("[Analyze] HTML fetch error:", htmlError);
      console.error("[Analyze] Error message:", htmlError.message);
      console.error("[Analyze] ========================================");
      
      // HTML取得に失敗しても記録
      try {
        const { data: savedHTML } = await supabase
          .from("property_html_storage")
          .insert({
            property_id: propertyId ?? null,
            url,
            html: "",
            status: "error",
            error_message: htmlError.message,
            content_length: 0,
          })
          .select()
          .single();
        if (savedHTML) {
          htmlStorageId = savedHTML.id;
          console.log("[Analyze] Error saved to HTML storage:", htmlStorageId);
        }
      } catch (saveError: any) {
        console.error("[Analyze] Failed to save error to HTML storage:", saveError);
        console.error("[Analyze] Save error details:", saveError.message);
      }
    }

    const hasKeyData = (p: { title: string | null; address: string | null; floor_plan: string | null } | null) =>
      !!(p?.title || p?.address || p?.floor_plan);
    const blocked =
      !htmlContent || isBlockedOrRedirectPage(htmlContent);

    if (blocked && existingProperty) {
      // 認証中・リダイレクト等で物件HTMLが取れないが、同URLの既存データあり → 使い回す（上書きしない）
      property = existingProperty as Property;
      propertyId = property.id;
      propertyDataUnavailable = !hasKeyData(existingProperty);
      console.log("[Analyze] Blocked/redirect page detected; reusing existing property (no overwrite):", propertyId, "propertyDataUnavailable:", propertyDataUnavailable);
    } else if (blocked && !existingProperty) {
      // 取れない & 既存なし → 最小限の物件レコード作成し、後で「物件データが取得できていません」表示
      const source = propertyUrl.hostname.includes("athome")
        ? "athome"
        : propertyUrl.hostname.includes("suumo")
        ? "suumo"
        : propertyUrl.hostname.includes("homes")
        ? "homes"
        : "unknown";
      const { data: minimalProperty, error: minimalErr } = await supabase
        .from("properties")
        .insert({ url: normalizedUrl, source })
        .select()
        .single();
      if (minimalErr || !minimalProperty) {
        console.error("[Analyze] Failed to create minimal property:", minimalErr);
        return NextResponse.json(
          { success: false, error: "Failed to create property record", details: minimalErr?.message },
          { status: 500 }
        );
      }
      property = minimalProperty as Property;
      propertyId = property.id;
      propertyDataUnavailable = true;
      console.log("[Analyze] Blocked/redirect page detected; created minimal property:", propertyId);
    } else if (existingProperty && !shouldRescrape) {
      // 既存の物件データを使用（データが十分な場合）
      property = existingProperty as Property;
      propertyId = property.id;
      console.log("[Analyze] Using existing property (data complete):", propertyId);
    } else {
      if (existingProperty) {
        console.log("[Analyze] Existing property found but data incomplete, re-scraping...");
      }
      // 新しい物件データを作成または更新
      
      // HTMLが取得できた場合、スクレイピングを実行
      console.log("[Analyze] ========================================");
      console.log("[Analyze] Step 2: Parsing HTML data");
      console.log("[Analyze] ========================================");
      
      let scrapedData;
      try {
        if (htmlContent) {
          scrapedData = await scrapePropertyData(url, htmlContent);
        } else {
          throw new Error("HTML not available for parsing");
        }
        
        console.log("[Analyze] Scraping completed successfully");
        console.log("[Analyze] Scraped data summary:");
        console.log("  - Title:", scrapedData.title ? "✓" : "✗");
        console.log("  - Price:", scrapedData.price ? `✓ (${scrapedData.price.toLocaleString()}円)` : "✗");
        console.log("  - Address:", scrapedData.address ? "✓" : "✗");
        console.log("  - Floor plan:", scrapedData.floor_plan ? "✓" : "✗");
        console.log("  - Year built:", scrapedData.year_built !== null ? "✓" : "✗");
        console.log("  - Building area:", scrapedData.building_area ? "✓" : "✗");
        console.log("  - Land area:", scrapedData.land_area ? "✓" : "✗");
        console.log("  - Building structure:", scrapedData.building_structure ? "✓" : "✗");
        console.log("  - Zoning:", scrapedData.zoning ? "✓" : "✗");
        console.log("  - Transportation:", scrapedData.transportation.length > 0 ? `✓ (${scrapedData.transportation.length} routes)` : "✗");
        console.log("[Analyze] ========================================");
      } catch (scrapeError: any) {
        console.error("[Analyze] ========================================");
        console.error("[Analyze] Scraping/parsing error:", scrapeError);
        console.error("[Analyze] Error message:", scrapeError.message);
        console.error("[Analyze] Error stack:", scrapeError.stack);
        console.error("[Analyze] HTML was saved, ID:", htmlStorageId);
        console.error("[Analyze] ========================================");
        // スクレイピングに失敗しても、基本的な情報で保存を試みる
        scrapedData = {
          title: null,
          price: null,
          price_per_sqm: null,
          address: null,
          location: null,
          property_type: null,
          floor_plan: null,
          year_built: null,
          year_built_month: null,
          building_area: null,
          land_area: null,
          building_floors: null,
          floor_number: null,
          access: null,
          building_structure: null,
          road_access: null,
          floor_area_ratio: null,
          building_coverage_ratio: null,
          land_category: null,
          zoning: null,
          urban_planning: null,
          land_rights: null,
          transportation: [],
          yield_rate: null,
          raw_data: { url, scrape_error: scrapeError.message },
        };
      }

      const source = propertyUrl.hostname.includes("athome")
        ? "athome"
        : propertyUrl.hostname.includes("suumo")
        ? "suumo"
        : propertyUrl.hostname.includes("homes")
        ? "homes"
        : "unknown";

      // 既存データがある場合は更新、ない場合は新規作成
      let newProperty;
      let insertError;
      
      if (existingProperty) {
        // 既存データを更新（url を正規化して保存し、次回から正規化URLでヒットするようにする）
        const { data, error } = await supabase
          .from("properties")
          .update({
            url: normalizedUrl,
            source,
            title: scrapedData.title,
            price: scrapedData.price,
            price_per_sqm: scrapedData.price_per_sqm,
            address: scrapedData.address,
            location: scrapedData.location || scrapedData.address,
            property_type: scrapedData.property_type,
            building_area: scrapedData.building_area,
            land_area: scrapedData.land_area,
            year_built: scrapedData.year_built,
            year_built_month: scrapedData.year_built_month,
            floor_plan: scrapedData.floor_plan,
            building_floors: scrapedData.building_floors,
            floor_number: scrapedData.floor_number,
            access: scrapedData.access && 
                    !scrapedData.access.includes("var ") &&
                    !scrapedData.access.includes("bff-loadbalancer") &&
                    !scrapedData.access.includes("tagmanager") ? scrapedData.access : null,
            building_structure: scrapedData.building_structure,
            road_access: scrapedData.road_access,
            floor_area_ratio: scrapedData.floor_area_ratio,
            building_coverage_ratio: scrapedData.building_coverage_ratio,
            land_category: scrapedData.land_category,
            zoning: scrapedData.zoning,
            urban_planning: scrapedData.urban_planning,
            land_rights: scrapedData.land_rights,
            transportation: scrapedData.transportation.length > 0 && 
                            scrapedData.transportation.every(t => 
                              t.line && 
                              t.station && 
                              t.walk &&
                              !t.line.includes("http") &&
                              !t.station.includes("http") &&
                              !t.line.includes("{") &&
                              !t.station.includes("{")
                            ) ? scrapedData.transportation : null,
            yield_rate: scrapedData.yield_rate,
            raw_data: scrapedData.raw_data,
          })
          .eq("id", propertyId)
          .select()
          .single();
        newProperty = data;
        insertError = error;
      } else {
        // 新規作成
        const { data, error } = await supabase
          .from("properties")
          .insert({
            url: normalizedUrl,
            source,
            title: scrapedData.title,
            price: scrapedData.price,
            price_per_sqm: scrapedData.price_per_sqm,
            address: scrapedData.address,
            location: scrapedData.location || scrapedData.address,
            property_type: scrapedData.property_type,
            building_area: scrapedData.building_area,
            land_area: scrapedData.land_area,
            year_built: scrapedData.year_built,
            year_built_month: scrapedData.year_built_month,
            floor_plan: scrapedData.floor_plan,
            building_floors: scrapedData.building_floors,
            floor_number: scrapedData.floor_number,
            access: scrapedData.access && 
                    !scrapedData.access.includes("var ") &&
                    !scrapedData.access.includes("bff-loadbalancer") &&
                    !scrapedData.access.includes("tagmanager") ? scrapedData.access : null,
            building_structure: scrapedData.building_structure,
            road_access: scrapedData.road_access,
            floor_area_ratio: scrapedData.floor_area_ratio,
            building_coverage_ratio: scrapedData.building_coverage_ratio,
            land_category: scrapedData.land_category,
            zoning: scrapedData.zoning,
            urban_planning: scrapedData.urban_planning,
            land_rights: scrapedData.land_rights,
            transportation: scrapedData.transportation.length > 0 && 
                            scrapedData.transportation.every(t => 
                              t.line && 
                              t.station && 
                              t.walk &&
                              !t.line.includes("http") &&
                              !t.station.includes("http") &&
                              !t.line.includes("{") &&
                              !t.station.includes("{")
                            ) ? scrapedData.transportation : null,
            yield_rate: scrapedData.yield_rate,
          raw_data: {
            ...scrapedData.raw_data,
            html_storage_id: htmlStorageId,
          },
        })
        .select()
        .single();
        newProperty = data;
        insertError = error;
      }

      if (insertError) {
        console.error("[Analyze] Error inserting property:", insertError);
        console.error("[Analyze] Error details:", {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
        });
        return NextResponse.json(
          { 
            success: false,
            error: "Failed to save property data",
            details: insertError.message,
            code: insertError.code,
            hint: insertError.hint || "RLSポリシーが原因の可能性があります。SupabaseのSQLエディタでINSERT権限を追加してください。",
          },
          { status: 500 }
        );
      }

      property = newProperty as Property;
      propertyId = property.id;
      console.log("[Analyze] Property saved successfully:", propertyId);
    }
    }

    // 住所が取得できていれば外部環境リサーチを非同期で開始（レスポンスは待たない）
    if (property?.address?.trim() && propertyId) {
      let base: string | null = null;
      try {
        if (typeof process.env.VERCEL_URL !== "undefined") {
          base = `https://${process.env.VERCEL_URL}`;
        } else if (process.env.NEXT_PUBLIC_APP_URL) {
          base = process.env.NEXT_PUBLIC_APP_URL;
        } else {
          base = new URL(request.url).origin;
        }
      } catch (_) {}
      if (base) {
        const refreshUrl = `${base}/api/property/${propertyId}/external-env/refresh`;
        fetch(refreshUrl, { method: "POST" }).catch((e) =>
          console.warn("[Analyze] External env refresh trigger failed:", e?.message)
        );
        console.log("[Analyze] Triggered external env research:", refreshUrl);
      }
    }

    // Gemini APIで投資判断を生成
    const propertyInfo = [
      `物件URL: ${url}`,
      `データソース: ${property.source || "不明"}`,
      property.title ? `物件名: ${property.title}` : null,
      property.price ? `価格: ${property.price.toLocaleString()}円` : null,
      property.price_per_sqm ? `平米単価: ${property.price_per_sqm.toLocaleString()}円/㎡` : null,
      property.address ? `所在地: ${property.address}` : null,
      property.floor_plan ? `間取り: ${property.floor_plan}` : null,
      (() => {
        const { ageYears, dateStr } = getBuiltYearInfo(property.year_built, property.year_built_month);
        if (ageYears == null) return null;
        return `築年数: ${ageYears}年`;
      })(),
      property.year_built != null
        ? `築年月: ${getBuiltYearInfo(property.year_built, property.year_built_month).dateStr}`
        : null,
      property.building_area ? `建物面積: ${property.building_area}㎡` : null,
      property.land_area ? `土地面積: ${property.land_area}㎡` : null,
      property.building_floors ? `階建: ${property.building_floors}` : null,
      property.floor_number ? `階: ${property.floor_number}` : null,
      property.access ? `交通: ${property.access}` : null,
      property.building_structure ? `建物構造: ${property.building_structure}` : null,
      property.road_access ? `接道状況: ${property.road_access}` : null,
      property.floor_area_ratio ? `容積率: ${property.floor_area_ratio}%` : null,
      property.building_coverage_ratio ? `建ぺい率: ${property.building_coverage_ratio}%` : null,
      property.land_category ? `地目: ${property.land_category}` : null,
      property.zoning ? `用途地域: ${property.zoning}` : null,
      property.urban_planning ? `都市計画: ${property.urban_planning}` : null,
      property.land_rights ? `土地権利: ${property.land_rights}` : null,
      property.yield_rate ? `利回り: ${property.yield_rate}%` : null,
      property.transportation && property.transportation.length > 0
        ? `交通詳細:\n${property.transportation.map((t) => `  - ${t.line} ${t.station} 徒歩${t.walk}分`).join("\n")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const analysisPrompt = `以下の物件情報を基に、不動産投資判断を行ってください。

${propertyInfo}

投資判断は以下のフォーマットで**必ず**返信してください。以下の出力例を参考に、同じ形式で出力してください。

【出力例 - この形式を必ず守ってください】

## 1. 物件概要の評価

立地（★1-5で評価）: ★★★★★ 矢場町駅から徒歩7分、栄エリアも徒歩圏内という、名古屋市内でも屈指の希少立地です。中区栄5丁目は商業地域と住宅地域が混在しており、需要が途切れることはありません。
価格（★1-5で評価）: ★★★☆☆ 7,750万円。土地面積が約39坪（129.19㎡）あり、坪単価は約198万円です。近隣の公示地価や取引事例と比較しても、建物込みでこの単価なら「ほぼ土地代」に近い水準であり、割高感はありません。
建物（★1-5で評価）: ★★☆☆☆ 1998年築（築26年）。木造（あるいは軽量鉄骨）の法定耐用年数（22年）を超えており、建物自体の評価はほぼゼロに近いです。投資用ローンを組む場合、建物残存期間の関係で融資期間が短くなる（または組みにくい）可能性があります。

## 2. 投資シミュレーション（収益性）

想定賃料: 25万円〜32万円程度
想定利回り: 家賃28万円の場合：年収336万円 ÷ 7,750万円 ＝ 表面利回り 約4.3%
判断: 投資物件として4%台の利回りは、修繕費や固定資産税（中区は高い）を考慮すると、キャッシュフローがほとんど出ない「低収益物件」です。純粋な不動産投資としては、利回りが低すぎます。

## 3. メリット（投資すべき理由）

- 出口戦略（売却）の強さ: 栄エリアの土地は値崩れしにくく、将来的には更地にして売却、あるいは小規模なビルやマンション用地としての需要も見込めます。
- 資産価値の維持: インフレに強く、現金を現物資産（都心の土地）に変えておく資産防衛策としては非常に優秀です。
- 希少性: 名古屋のど真ん中にこれだけの土地面積を持つ戸建が出ることは稀です。

## 4. リスク・懸念点（注意すべき理由）

- 融資の難易度: 築古の戸建であるため、銀行の評価が厳しく、自己資金が多く求められる可能性があります。
- 維持費: 3階建てで面積も広いため、屋上防水や外壁塗装などのメンテナンス費用が、一般的な住宅より高額になります。
- 空室リスク: ファミリー向けの広すぎる戸建は、賃貸ターゲットが狭いため、一度退去すると次の入居者を見つけるのに苦労する場合があります。

## 5. 最終判断

「利回り重視の投資家」なら: 見送り（パス） この金額を出すなら、より利回りの高い（6〜8%）中古一棟アパートなどを狙うべきです。
「富裕層の資産防衛・節税」なら: アリ 相続税対策や、将来的な土地価格上昇を見込んだキャピタルゲイン狙いには適しています。
「住居兼事務所（SOHO）として使いたい」なら: 強く推奨 自分が使いながら、将来的に価値が上がったタイミングで売る「実需型投資」としては非常に魅力的な物件です。
アドバイス: もし投資として検討されているのであれば、「更地にした場合の査定額」を不動産業者に確認してください。建物の価値を無視しても土地代だけで7,000万円以上の価値が安定してあるのであれば、下値リスクが極めて低いため、手堅い投資と言えます。

## スコア

各セクションのスコア（1-5点）:
- 立地スコア: 5
- 価格スコア: 3
- 建物スコア: 2
- 収益性スコア: 3

全体の投資スコア: 78
推奨度: hold

【重要】
- 上記の例と**完全に同じフォーマット**で出力してください
- セクション見出しは必ず「## 1. 物件概要の評価」のように「##」で始め、「1.」「2.」などの番号を含めてください
- 各項目のラベル（「立地（★1-5で評価）」など）は必ずそのまま使用してください
- スコアは必ず「## スコア」セクションに「- 立地スコア: 5」の形式で記載してください
- 推奨度は必ず「推奨度: buy」または「推奨度: hold」または「推奨度: avoid」の形式で記載してください
- ★の数は1-5の範囲で、スコアの数値も必ず1-5の範囲で指定してください`;

    // フォーマット検証関数
    const validateAnalysisFormat = (text: string): { valid: boolean; missing: string[] } => {
      const requiredSections = [
        { pattern: /##\s*1\.\s*物件概要の評価/i, name: "1. 物件概要の評価" },
        { pattern: /##\s*2\.\s*投資シミュレーション/i, name: "2. 投資シミュレーション" },
        { pattern: /##\s*3\.\s*メリット/i, name: "3. メリット" },
        { pattern: /##\s*4\.\s*リスク/i, name: "4. リスク" },
        { pattern: /##\s*5\.\s*最終判断/i, name: "5. 最終判断" },
        { pattern: /##\s*スコア/i, name: "スコア" },
      ];

      const requiredFields = [
        { pattern: /立地[（(]★[1-5]で評価[）)]:/i, name: "立地評価" },
        { pattern: /価格[（(]★[1-5]で評価[）)]:/i, name: "価格評価" },
        { pattern: /建物[（(]★[1-5]で評価[）)]:/i, name: "建物評価" },
        { pattern: /想定賃料:/i, name: "想定賃料" },
        { pattern: /想定利回り:/i, name: "想定利回り" },
        { pattern: /立地スコア:\s*\d+/i, name: "立地スコア" },
        { pattern: /全体の投資スコア:\s*\d+/i, name: "全体の投資スコア" },
        { pattern: /推奨度:\s*(buy|hold|avoid)/i, name: "推奨度" },
      ];

      const missingSections = requiredSections
        .filter((section) => !section.pattern.test(text))
        .map((section) => section.name);

      const missingFields = requiredFields
        .filter((field) => !field.pattern.test(text))
        .map((field) => field.name);

      return {
        valid: missingSections.length === 0 && missingFields.length === 0,
        missing: [...missingSections, ...missingFields],
      };
    };

    // 既存の投資判断をチェック（propertyId が確定している場合のみ）
    let existingAnalysis: PropertyAnalysis | null = null;
    if (propertyId) {
      const { data: analysisData, error: analysisError } = await supabase
        .from("property_analyses")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!analysisError && analysisData) {
        existingAnalysis = analysisData as PropertyAnalysis;
        console.log("[Analyze] Found existing analysis, skipping Gemini generation:", existingAnalysis.id);
      }
    }

    let analysisText: string | null = null;
    
    if (existingAnalysis) {
      // 既存の分析結果を使用
      analysisText = (existingAnalysis.analysis_result as any)?.full_analysis || existingAnalysis.summary || null;
      if (!analysisText) {
        console.warn("[Analyze] Existing analysis found but no full_analysis text, falling back to Gemini generation");
        existingAnalysis = null; // フォールバック
      }
    }

    if (!existingAnalysis) {
      // 既存の分析結果がない場合のみ Gemini で生成
      console.log("[Analyze] Generating investment analysis...");
      let retries = 0;
      const maxRetries = 3;
      let currentPrompt = analysisPrompt;
      let lastError: Error | null = null;

      // リトライロジック付きで生成
      do {
      try {
        console.log(`[Analyze] Attempting to generate analysis (attempt ${retries + 1}/${maxRetries})...`);
        analysisText = await generateTextWithGemini(currentPrompt);
        
        if (!analysisText || analysisText.trim().length === 0) {
          throw new Error("Generated analysis text is empty");
        }
        
        console.log("[Analyze] Analysis generated successfully, length:", analysisText.length);

        // フォーマット検証
        const validation = validateAnalysisFormat(analysisText);
        if (validation.valid) {
          console.log("[Analyze] Format validation passed");
          break;
        } else {
          console.warn(
            `[Analyze] Format validation failed. Missing: ${validation.missing.join(", ")}`
          );
          
          // 最後のリトライの場合は、検証に失敗しても処理を続行
          if (retries >= maxRetries - 1) {
            console.warn("[Analyze] Max retries reached. Proceeding with analysis despite validation failures.");
            break;
          }
          
          // リトライ時はより厳密な指示を追加
          console.log(`[Analyze] Retrying... (${retries + 1}/${maxRetries})`);
          currentPrompt = `${analysisPrompt}

【重要】前回の出力がフォーマット要件を満たしていませんでした。以下の点を確認してください：
- すべてのセクション（1-5とスコア）が含まれているか
- 各セクションの見出しが「## 数字. タイトル」の形式になっているか
- 必須項目（立地評価、価格評価、建物評価、想定賃料、想定利回り、スコア、推奨度）がすべて含まれているか
- 上記の出力例と完全に同じフォーマットになっているか

再度、上記の出力例を参考に、正確なフォーマットで出力してください。`;
        }
        retries++;
      } catch (geminiError: any) {
        console.error("[Analyze] Gemini API error:", geminiError);
        lastError = geminiError;
        
        // APIキーの問題を検出
        const errorMessage = geminiError.message || "";
        if (errorMessage.includes("403") || errorMessage.includes("Forbidden") || errorMessage.includes("leaked") || errorMessage.includes("API key")) {
          return NextResponse.json(
            {
              success: false,
              error: "Gemini APIキーのエラー",
              details: "APIキーが無効または漏洩として報告されています。新しいAPIキーを取得して、.env.localファイルのGEMINI_API_KEYを更新してください。",
              help: "https://aistudio.google.com/apikey で新しいAPIキーを取得できます。",
            },
            { status: 403 }
          );
        }
        
        if (retries >= maxRetries - 1) {
          return NextResponse.json(
            {
              success: false,
              error: "Failed to generate analysis with Gemini API",
              details: geminiError.message || "Unknown error",
              stack: geminiError.stack,
            },
            { status: 500 }
          );
        }
        retries++;
      }
    } while (retries < maxRetries);

      // analysisTextが未定義の場合はエラー
      if (!analysisText || analysisText.trim().length === 0) {
        console.error("[Analyze] Analysis text is null or empty after all retries");
        console.error("[Analyze] Last error:", lastError);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to generate analysis with Gemini API",
            details: lastError?.message || "Analysis text is null or empty after retries. Please check server logs for details.",
          },
          { status: 500 }
        );
      }

      // 最終検証（既存の分析結果を使う場合はスキップ）
      const finalValidation = validateAnalysisFormat(analysisText);
      if (!finalValidation.valid) {
        console.warn(
          `[Analyze] Final validation failed after ${maxRetries} retries. Missing: ${finalValidation.missing.join(
            ", "
          )}`
        );
        // 検証に失敗しても処理は続行（パーサーが柔軟に対応）
      }
    }

    // 新しいフォーマットで分析結果をパース
    const parseAnalysis = (text: string) => {
      // スコア抽出（複数のパターンに対応）
      const locationScoreMatch = text.match(/立地スコア:\s*(\d+)/i) ||
                                 text.match(/立地[：:]\s*(\d+)/i);
      const priceScoreMatch = text.match(/価格スコア:\s*(\d+)/i) ||
                             text.match(/価格[：:]\s*(\d+)/i);
      const buildingScoreMatch = text.match(/建物スコア:\s*(\d+)/i) ||
                                text.match(/建物[：:]\s*(\d+)/i);
      const yieldScoreMatch = text.match(/収益性スコア:\s*(\d+)/i) ||
                             text.match(/収益性[：:]\s*(\d+)/i);
      const overallScoreMatch = text.match(/全体の投資スコア:\s*(\d+)/i) ||
                               text.match(/投資スコア:\s*(\d+)/i) ||
                               text.match(/スコア:\s*(\d+)/i);
      const recommendationMatch = text.match(/推奨度:\s*(buy|hold|avoid)/i) ||
                                 text.match(/推奨[：:]\s*(buy|hold|avoid)/i);

      // 物件概要の評価（複数行のコメントに対応：次の「価格」「建物」「##」の手前まで取得）
      const locationMatch = text.match(/立地[（(]★[1-5]で評価[）)]:\s*([\s\S]+?)(?=\n\s*(?:価格|建物|##)|$)/) ||
                           text.match(/立地:\s*([\s\S]+?)(?=\n\s*(?:価格|建物|##)|$)/) ||
                           text.match(/立地評価:\s*([\s\S]+?)(?=\n\s*(?:価格|建物|##)|$)/);
      const priceMatch = text.match(/価格[（(]★[1-5]で評価[）)]:\s*([\s\S]+?)(?=\n\s*(?:建物|##)|$)/) ||
                        text.match(/価格:\s*([\s\S]+?)(?=\n\s*(?:建物|##)|$)/) ||
                        text.match(/価格評価:\s*([\s\S]+?)(?=\n\s*(?:建物|##)|$)/);
      const buildingMatch = text.match(/建物[（(]★[1-5]で評価[）)]:\s*([\s\S]+?)(?=\n\s*##|$)/) ||
                           text.match(/建物:\s*([\s\S]+?)(?=\n\s*##|$)/) ||
                           text.match(/建物評価:\s*([\s\S]+?)(?=\n\s*##|$)/);

      // ★の数を抽出
      const getStarCount = (text: string): number => {
        const starMatch = text.match(/★{1,5}/);
        return starMatch ? starMatch[0].length : 0;
      };

      // 投資シミュレーション（複数のパターンに対応）
      const rentMatch = text.match(/想定賃料[：:]\s*([^\n]+)/) ||
                       text.match(/賃料[：:]\s*([^\n]+)/);
      const yieldMatch = text.match(/想定利回り[：:]\s*([^\n]+)/) ||
                        text.match(/利回り[：:]\s*([^\n]+)/);
      const judgmentMatch = text.match(/判断[：:]\s*([^\n]+(?:\n[^\n]+)*?)(?=##|$)/) ||
                           text.match(/収益性の評価[：:]\s*([^\n]+(?:\n[^\n]+)*?)(?=##|$)/);

      // メリット（複数のパターンに対応）
      const merits: Array<{ title: string; description: string }> = [];
      const meritSection = text.match(/##\s*3[\.．]\s*メリット[\s\S]*?(?=##\s*4[\.．]|$)/i) ||
                          text.match(/##\s*メリット[\s\S]*?(?=##\s*リスク|$)/i);
      if (meritSection) {
        // パターン1: "- タイトル: 説明"
        let meritLines = meritSection[0].match(/- ([^:：]+)[：:]\s*([^\n]+(?:\n(?!-)[^\n]+)*)/g);
        // パターン2: "・タイトル: 説明"
        if (!meritLines || meritLines.length === 0) {
          meritLines = meritSection[0].match(/[・•]\s*([^:：]+)[：:]\s*([^\n]+(?:\n(?![・•])[^\n]+)*)/g);
        }
        if (meritLines) {
          meritLines.forEach((line) => {
            const match = line.match(/[-・•]\s*([^:：]+)[：:]\s*(.+)/s);
            if (match) {
              merits.push({ 
                title: match[1].trim(), 
                description: match[2].trim().replace(/\n+/g, " ").trim()
              });
            }
          });
        }
      }

      // リスク（複数のパターンに対応）
      const risks: Array<{ title: string; description: string }> = [];
      const riskSection = text.match(/##\s*4[\.．]\s*リスク[\s\S]*?(?=##\s*5[\.．]|$)/i) ||
                         text.match(/##\s*リスク[\s\S]*?(?=##\s*最終判断|$)/i);
      if (riskSection) {
        // パターン1: "- タイトル: 説明"
        let riskLines = riskSection[0].match(/- ([^:：]+)[：:]\s*([^\n]+(?:\n(?!-)[^\n]+)*)/g);
        // パターン2: "・タイトル: 説明"
        if (!riskLines || riskLines.length === 0) {
          riskLines = riskSection[0].match(/[・•]\s*([^:：]+)[：:]\s*([^\n]+(?:\n(?![・•])[^\n]+)*)/g);
        }
        if (riskLines) {
          riskLines.forEach((line) => {
            const match = line.match(/[-・•]\s*([^:：]+)[：:]\s*(.+)/s);
            if (match) {
              risks.push({ 
                title: match[1].trim(), 
                description: match[2].trim().replace(/\n+/g, " ").trim()
              });
            }
          });
        }
      }

      // 最終判断（複数のパターンに対応）
      const yieldFocusedMatch = text.match(/「利回り重視の投資家」なら[：:]\s*([^\n]+(?:\n(?!「)[^\n]+)*)/) ||
                                text.match(/利回り重視[：:]\s*([^\n]+)/);
      const assetProtectionMatch = text.match(/「富裕層の資産防衛・節税」なら[：:]\s*([^\n]+(?:\n(?!「)[^\n]+)*)/) ||
                                  text.match(/資産防衛[：:]\s*([^\n]+)/);
      const sohoMatch = text.match(/「住居兼事務所（SOHO）として使いたい」なら[：:]\s*([^\n]+(?:\n(?!「)[^\n]+)*)/) ||
                       text.match(/SOHO[：:]\s*([^\n]+)/);
      const adviceMatch = text.match(/アドバイス[：:]\s*([^\n]+(?:\n[^\n]+)*?)(?=##|$)/) ||
                         text.match(/推奨事項[：:]\s*([^\n]+(?:\n[^\n]+)*?)(?=##|$)/);

      return {
        property_overview: {
          location: {
            score: locationScoreMatch ? parseInt(locationScoreMatch[1], 10) : getStarCount(locationMatch?.[1] || ""),
            max_score: 5,
            stars: "★".repeat(locationScoreMatch ? parseInt(locationScoreMatch[1], 10) : getStarCount(locationMatch?.[1] || "")),
            comment: (locationMatch?.[1]?.replace(/★+/g, "").replace(/\n+/g, " ").replace(/\s+/g, " ").trim()) || "",
          },
          price: {
            score: priceScoreMatch ? parseInt(priceScoreMatch[1], 10) : getStarCount(priceMatch?.[1] || ""),
            max_score: 5,
            stars: "★".repeat(priceScoreMatch ? parseInt(priceScoreMatch[1], 10) : getStarCount(priceMatch?.[1] || "")),
            comment: (priceMatch?.[1]?.replace(/★+/g, "").replace(/\n+/g, " ").replace(/\s+/g, " ").trim()) || "",
          },
          building: {
            score: buildingScoreMatch ? parseInt(buildingScoreMatch[1], 10) : getStarCount(buildingMatch?.[1] || ""),
            max_score: 5,
            stars: "★".repeat(buildingScoreMatch ? parseInt(buildingScoreMatch[1], 10) : getStarCount(buildingMatch?.[1] || "")),
            comment: (buildingMatch?.[1]?.replace(/★+/g, "").replace(/\n+/g, " ").replace(/\s+/g, " ").trim()) || "",
          },
        },
        investment_simulation: {
          estimated_rent: rentMatch?.[1]?.trim() || "",
          estimated_yield: yieldMatch?.[1]?.trim() || "",
          calculation: yieldMatch?.[1]?.trim() || "",
          judgment: judgmentMatch?.[1]?.trim() || "",
        },
        merits: merits,
        risks: risks,
        final_judgment: {
          yield_focused: {
            recommendation: yieldFocusedMatch?.[1]?.trim() || "",
            reason: "",
          },
          asset_protection: {
            recommendation: assetProtectionMatch?.[1]?.trim() || "",
            reason: "",
          },
          soho_use: {
            recommendation: sohoMatch?.[1]?.trim() || "",
            reason: "",
          },
        },
        advice: adviceMatch?.[1]?.trim() || "",
      };
    };

    // 既存の分析結果を使う場合は、既存のデータから直接取得
    let structuredAnalysis: any;
    let recommendation: "buy" | "hold" | "avoid" | null = null;
    let score: number | null = null;
    let yieldScore: number | null = null;
    let sectionScores: any;
    let summary: string;
    let analysisResult: any;

    if (existingAnalysis) {
      // 既存の分析結果から直接取得
      const existingResult = existingAnalysis.analysis_result as any;
      structuredAnalysis = existingResult?.structured || existingAnalysis.structured_analysis;
      recommendation = existingAnalysis.recommendation as "buy" | "hold" | "avoid" | null;
      score = existingAnalysis.score;
      sectionScores = existingAnalysis.section_scores || {
        location: structuredAnalysis?.property_overview?.location?.score || 0,
        price: structuredAnalysis?.property_overview?.price?.score || 0,
        building: structuredAnalysis?.property_overview?.building?.score || 0,
        yield: 0,
        overall: score || 0,
      };
      summary = existingAnalysis.summary || existingResult?.summary || analysisText.substring(0, 500);
      analysisResult = existingResult || {
        summary,
        recommendation: recommendation || undefined,
        score: score || undefined,
        full_analysis: analysisText,
        structured: structuredAnalysis,
      };
    } else {
      // 新規生成の場合はパース処理を実行
      structuredAnalysis = parseAnalysis(analysisText);

      // 全体スコアと推奨度を抽出
      const overallScoreMatch = analysisText.match(/全体の投資スコア:\s*(\d+)/);
      const recommendationMatch = analysisText.match(/推奨度:\s*(buy|hold|avoid)/i);
      const yieldScoreMatch = analysisText.match(/収益性スコア:\s*(\d+)/);

      recommendation = recommendationMatch
        ? (recommendationMatch[1].toLowerCase() as "buy" | "hold" | "avoid")
        : null;
      score = overallScoreMatch ? parseInt(overallScoreMatch[1], 10) : null;
      yieldScore = yieldScoreMatch ? parseInt(yieldScoreMatch[1], 10) : null;

      // セクションスコアを抽出
      sectionScores = {
        location: structuredAnalysis.property_overview.location.score,
        price: structuredAnalysis.property_overview.price.score,
        building: structuredAnalysis.property_overview.building.score,
        yield: yieldScore || 0,
        overall: score || 0,
      };

      // サマリー（最初の段落を取得）
      summary = structuredAnalysis.advice || analysisText.substring(0, 500);

      // 分析結果を構造化
      analysisResult = {
        summary: summary,
        recommendation: recommendation || undefined,
        score: score || undefined,
        full_analysis: analysisText,
        structured: structuredAnalysis,
      };
    }

    // 投資判断結果をデータベースに保存
    // ユーザーメッセージを保存（会話IDがなくても保存）
    let userMessageId: string | null = null;
    console.log("[Analyze] Saving user message:", {
      conversationId: currentConversationId,
      propertyId: propertyId,
      url: url,
    });
    
    const { data: userMessage, error: userMsgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: currentConversationId || null,
        role: "user",
        content: url,
        property_url: url,
        property_id: propertyId,
      })
      .select()
      .single();
    
    if (userMsgError) {
      console.error("[Analyze] Failed to save user message:", userMsgError);
      console.error("[Analyze] Error details:", {
        code: userMsgError.code,
        message: userMsgError.message,
        details: userMsgError.details,
        hint: userMsgError.hint,
      });
    } else {
      userMessageId = userMessage.id;
      console.log("[Analyze] User message saved successfully:", {
        id: userMessageId,
        conversationId: currentConversationId,
        propertyId: propertyId,
      });
    }

    // 投資判断を保存（既存の分析結果を使う場合は新規作成しない）
    let analysis = existingAnalysis;
    if (!existingAnalysis) {
      const { data: newAnalysis, error: analysisError } = await supabase
        .from("property_analyses")
        .insert({
          property_id: propertyId,
          conversation_id: currentConversationId || null,
          message_id: userMessageId || null,
          analysis_result: analysisResult,
          summary,
          recommendation,
          score,
          section_scores: sectionScores,
          structured_analysis: structuredAnalysis,
        })
        .select()
        .single();

      if (analysisError) {
        console.error("[Analyze] Error saving analysis:", analysisError);
        // 分析結果は保存できなくても、レスポンスは返す
      } else {
        analysis = newAnalysis as PropertyAnalysis;
        console.log("[Analyze] Analysis saved:", analysis.id);
      }
    } else {
      console.log("[Analyze] Using existing analysis, skipping save:", analysis.id);
    }

    // アシスタントメッセージを保存（会話IDがなくても保存）
    let assistantMessageId: string | null = null;
    if (analysis) {
      const assistantMessageContent = `投資判断が完了しました。\n\n【推奨度】${recommendation || "評価中"}\n【投資スコア】${score || "評価中"}\n\n${summary || analysisText.substring(0, 500)}`;
      
      console.log("[Analyze] Saving assistant message:", {
        conversationId: currentConversationId,
        propertyId: propertyId,
        analysisId: analysis.id,
        contentLength: assistantMessageContent.length,
      });
      
      const { data: assistantMessage, error: assistantMsgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: currentConversationId || null,
          role: "assistant",
          content: assistantMessageContent,
          property_id: propertyId,
          property_url: url,
          metadata: {
            analysis_id: analysis.id,
          },
        })
        .select()
        .single();
      
      if (assistantMsgError) {
        console.error("[Analyze] Failed to save assistant message:", assistantMsgError);
        console.error("[Analyze] Error details:", {
          code: assistantMsgError.code,
          message: assistantMsgError.message,
          details: assistantMsgError.details,
          hint: assistantMsgError.hint,
        });
      } else {
        assistantMessageId = assistantMessage.id;
        console.log("[Analyze] Assistant message saved successfully:", {
          id: assistantMessageId,
          conversationId: currentConversationId,
          propertyId: propertyId,
        });
      }
    } else {
      console.warn("[Analyze] Analysis not saved, skipping assistant message");
    }

    // 会話のcustom_pathを取得
    let conversationCustomPath: string | null = null;
    if (currentConversationId) {
      const { data: convData } = await supabase
        .from("conversations")
        .select("custom_path")
        .eq("id", currentConversationId)
        .single();
      
      if (convData) {
        conversationCustomPath = convData.custom_path;
        console.log("[Analyze] Conversation custom_path:", conversationCustomPath);
      }
    }

    // Network タブの Response Headers で紐づけ状況を確認できるようにする
    const responseHeaders: Record<string, string> = {
      "X-Analyze-Had-Bearer": requestUserId ? "1" : "0",
      "X-Analyze-User-Id": requestUserId ?? "",
    };

    return NextResponse.json(
      {
      success: true,
      conversationId: currentConversationId || null,
      conversationCustomPath: conversationCustomPath,
      propertyDataUnavailable: propertyDataUnavailable,
      property: {
        id: property.id,
        url: property.url,
        source: property.source,
        title: property.title,
        price: property.price,
        price_per_sqm: property.price_per_sqm,
        address: property.address,
        location: property.location,
        floor_plan: property.floor_plan,
        year_built: property.year_built,
        year_built_month: property.year_built_month,
        building_area: property.building_area,
        land_area: property.land_area,
        building_floors: property.building_floors,
        floor_number: property.floor_number,
        access: property.access,
        building_structure: property.building_structure,
        road_access: property.road_access,
        floor_area_ratio: property.floor_area_ratio,
        building_coverage_ratio: property.building_coverage_ratio,
        land_category: property.land_category,
        zoning: property.zoning,
        urban_planning: property.urban_planning,
        land_rights: property.land_rights,
        transportation: property.transportation,
        yield_rate: property.yield_rate,
      },
      analysis: {
        id: analysis?.id || null,
        summary,
        recommendation,
        score,
        full_analysis: analysisText,
        structured_analysis: structuredAnalysis,
        section_scores: sectionScores,
        investment_purpose: analysis?.investment_purpose || null,
      },
      analysisId: analysis?.id || null,
    },
    { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("[Analyze] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate analysis",
      },
      { status: 500 }
    );
  }
}
