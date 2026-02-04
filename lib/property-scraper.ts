import * as cheerio from "cheerio";

export interface ScrapedPropertyData {
  // 基本情報
  title: string | null;
  price: number | null;
  price_per_sqm: number | null;
  address: string | null;
  location: string | null;
  property_type: string | null;
  
  // 詳細情報
  floor_plan: string | null; // 間取り
  year_built: number | null; // 築年（西暦、例: 1998）
  year_built_month: number | null; // 築月（1–12）
  building_area: number | null; // 建物面積（㎡）
  land_area: number | null; // 土地面積（㎡）
  building_floors: string | null; // 階建（例: "3階建"）
  floor_number: string | null; // 階（例: "2階"）
  access: string | null; // 交通アクセス情報
  building_structure: string | null; // 建物構造
  road_access: string | null; // 接道状況
  floor_area_ratio: number | null; // 容積率（%）
  building_coverage_ratio: number | null; // 建ぺい率（%）
  land_category: string | null; // 地目
  zoning: string | null; // 用途地域
  urban_planning: string | null; // 都市計画区域（市街化区域など）
  land_rights: string | null; // 土地権利（所有権、借地権など）
  transportation: Array<{ line: string; station: string; walk: string }>; // 交通情報
  
  // その他
  yield_rate: number | null; // 利回り（%）
  raw_data: Record<string, any>; // 生データ
}

/**
 * URLから物件データをスクレイピング
 * @param url 物件URL
 * @param html 既に取得済みのHTML（オプション）
 */
export async function scrapePropertyData(url: string, html?: string): Promise<ScrapedPropertyData> {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;

  // データソースに応じてスクレイピング関数を選択
  if (hostname.includes("athome") || hostname.includes("athomes")) {
    return scrapeAthomes(url, html);
  } else if (hostname.includes("suumo")) {
    return scrapeSuumo(url, html);
  } else if (hostname.includes("homes")) {
    return scrapeHomes(url, html);
  } else {
    throw new Error(`Unsupported property site: ${hostname}`);
  }
}

/**
 * 認証中・リダイレクト・ボット対策ページかどうかを判定する。
 * アットホームの「【アットホーム】認証中」等、物件詳細ではないページを検知する。
 */
export function isBlockedOrRedirectPage(html: string): boolean {
  if (!html || typeof html !== "string") return true;
  const lower = html.toLowerCase();
  const patterns = [
    "認証中",
    "【アットホーム】認証中",
    "onprotectioninitialized",
    "reeseskip",
    "cookieisset",
    "認証してください",
    "アクセスを確認しています",
  ];
  return patterns.some((p) => lower.includes(p.toLowerCase()));
}

/** HTML取得のタイムアウト（ミリ秒）。SUUMO/LIFULL 等で応答が遅い場合に止まらないようにする */
const FETCH_HTML_TIMEOUT_MS = 15000;

/**
 * HTMLを取得する（共通処理）。タイムアウト付き。
 */
export async function fetchPropertyHTML(url: string): Promise<{ html: string; status: number; headers: Record<string, string> }> {
  console.log("[Scraper] Fetching HTML from URL:", url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_HTML_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[Scraper] Failed to fetch HTML:", response.status, response.statusText);
      console.error("[Scraper] Error response:", errorText.substring(0, 500));
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    console.log("[Scraper] HTML fetched successfully");
    console.log("[Scraper] HTML length:", html.length);
    console.log("[Scraper] Content-Type:", headers["content-type"]);

    return { html, status: response.status, headers };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `物件ページの取得がタイムアウトしました（${FETCH_HTML_TIMEOUT_MS / 1000}秒）。サイトが応答しないか、アクセスが制限されている可能性があります。`
      );
    }
    throw err;
  }
}

/**
 * athomesの物件ページをスクレイピング
 */
async function scrapeAthomes(url: string, html?: string): Promise<ScrapedPropertyData> {
  try {
    // HTMLが提供されていない場合は取得
    let htmlContent: string;
    if (html) {
      htmlContent = html;
      console.log("[Scraper] Using provided HTML, length:", htmlContent.length);
    } else {
      const result = await fetchPropertyHTML(url);
      htmlContent = result.html;
    }

    const $ = cheerio.load(htmlContent);
    
    // デバッグ用：HTMLの構造を確認
    console.log("[Scraper] HTML loaded, body text length:", $("body").text().length);

    console.log("[Scraper] HTML length:", htmlContent.length);
    console.log("[Scraper] Page title:", $("title").text());

    const data: ScrapedPropertyData = {
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
      raw_data: {},
    };

    // タイトル - より多くのパターンを試す
    data.title = 
      $("h1.property-title, .property-title, h1, .propertyName, .property-name, [class*='property'][class*='title']").first().text().trim() || null;
    console.log("[Scraper] Title found:", data.title?.substring(0, 50));

    // 価格 - より多くのパターンを試す
    let priceText = "";
    const priceSelectors = [
      ".price", 
      ".property-price", 
      "[class*='price']",
      ".priceValue",
      ".price-value",
      "[class*='Price']",
      "dt:contains('価格') + dd",
      "th:contains('価格') + td",
    ];
    for (const selector of priceSelectors) {
      const text = $(selector).first().text();
      if (text) {
        priceText = text;
        break;
      }
    }
    // 価格テキストから数値を抽出（「万円」「円」などの単位を考慮）
    const priceMatch = priceText.match(/([\d,]+)\s*(万円|円|万)/);
    if (priceMatch) {
      const num = priceMatch[1].replace(/,/g, "");
      const unit = priceMatch[2];
      data.price = unit === "万円" ? parseInt(num, 10) * 10000 : parseInt(num, 10);
    } else {
      const numOnly = priceText.replace(/[^\d]/g, "");
      data.price = numOnly ? parseInt(numOnly, 10) : null;
    }
    console.log("[Scraper] Price found:", data.price);

    // 住所・所在地 - より多くのパターンを試す
    const addressSelectors = [
      ".address",
      "[class*='address']",
      ".location",
      ".propertyAddress",
      "[class*='Address']",
      "dt:contains('所在地') + dd",
      "th:contains('所在地') + td",
      "dt:contains('住所') + dd",
      "th:contains('住所') + td",
    ];
    for (const selector of addressSelectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length > 5) {
        data.address = text;
        break;
      }
    }
    data.location = data.address;
    console.log("[Scraper] Address found:", data.address?.substring(0, 50));

    // 間取り - より多くのパターンを試す
    const floorPlanSelectors = [
      "[class*='floor-plan']",
      ".floor-plan",
      "[data-name='間取り']",
      ".floorPlan",
      "[class*='FloorPlan']",
      "dt:contains('間取り') + dd",
      "th:contains('間取り') + td",
    ];
    for (const selector of floorPlanSelectors) {
      const text = $(selector).first().text().trim();
      if (text) {
        data.floor_plan = text;
        break;
      }
    }
    console.log("[Scraper] Floor plan found:", data.floor_plan);

    // 築年月 - より多くのパターンを試す
    const yearBuiltSelectors = [
      "[class*='year-built']",
      ".year-built",
      "[data-name='築年月']",
      "dt:contains('築年月') + dd",
      "th:contains('築年月') + td",
      "dt:contains('築年') + dd",
      "th:contains('築年') + td",
    ];
    let yearBuiltText = "";
    for (const selector of yearBuiltSelectors) {
      const text = $(selector).first().text().trim();
      if (text) {
        yearBuiltText = text;
        break;
      }
    }
    if (yearBuiltText) {
      const currentYear = new Date().getFullYear();
      const yearMatch = yearBuiltText.match(/(\d{4})年/);
      const monthMatch = yearBuiltText.match(/(\d{1,2})月/);
      const ageMatch = yearBuiltText.match(/築\s*(\d+)\s*年/);
      if (yearMatch) {
        data.year_built = parseInt(yearMatch[1], 10);
      } else if (ageMatch) {
        data.year_built = currentYear - parseInt(ageMatch[1], 10);
      }
      if (monthMatch) {
        data.year_built_month = parseInt(monthMatch[1], 10);
      }
    }
    console.log("[Scraper] Year built found:", data.year_built, "month:", data.year_built_month);

    // 建物面積・土地面積 - テーブル形式や定義リストから取得
    const areaSelectors = [
      "dt:contains('建物面積') + dd",
      "th:contains('建物面積') + td",
      "dt:contains('土地面積') + dd",
      "th:contains('土地面積') + td",
      "[class*='area']",
      ".area",
      "[data-name*='面積']",
    ];
    let areaText = "";
    for (const selector of areaSelectors) {
      const text = $(selector).first().text();
      if (text) {
        areaText += " " + text;
      }
    }
    // ページ全体から面積情報を検索（㎡/m2/m²/平米に対応）
    const bodyText = $("body").text();
    const buildingAreaMatch =
      bodyText.match(/建物[面積]*[：:]\s*(?:合計)?\s*([\d.]+)\s*(?:㎡|m2|m²|平米)/) ??
      bodyText.match(/建物[面積]*[：:]*\s*([\d.]+)\s*(?:㎡|m2|m²|平米)/);
    const landAreaMatch =
      bodyText.match(/土地[面積]*[：:]\s*([\d.]+)\s*(?:㎡|m2|m²|平米)/) ??
      bodyText.match(/土地[面積]*[：:]*\s*([\d.]+)\s*(?:㎡|m2|m²|平米)/);
    if (buildingAreaMatch) {
      data.building_area = parseFloat(buildingAreaMatch[1]);
    }
    if (landAreaMatch) {
      data.land_area = parseFloat(landAreaMatch[1]);
    }
    console.log("[Scraper] Building area found:", data.building_area, "Land area found:", data.land_area);

    // 階建・階
    const floorSelectors = [
      "dt:contains('階建') + dd",
      "th:contains('階建') + td",
      "[class*='floors']",
      ".floors",
      "[data-name*='階建']",
    ];
    for (const selector of floorSelectors) {
      const text = $(selector).first().text().trim();
      if (text) {
        data.building_floors = text;
        break;
      }
    }
    const floorNumberSelectors = [
      "dt:contains('所在階') + dd",
      "th:contains('所在階') + td",
      "[class*='floor'][class*='number']",
    ];
    for (const selector of floorNumberSelectors) {
      const text = $(selector).first().text().trim();
      if (text) {
        data.floor_number = text;
        break;
      }
    }
    console.log("[Scraper] Building floors found:", data.building_floors, "Floor number:", data.floor_number);

    // 交通アクセス - scriptタグやstyleタグを除外して検索
    // まず、scriptとstyleタグを削除したコピーを作成
    const $clean = cheerio.load(htmlContent);
    $clean("script, style, noscript").remove();
    
    const accessSelectors = [
      "dt:contains('交通') + dd",
      "th:contains('交通') + td",
      "dt:contains('アクセス') + dd",
      "th:contains('アクセス') + td",
      "[class*='access'][class*='transport']",
      "[class*='交通']",
      ".access",
      "[data-name*='交通']",
    ];
    
    for (const selector of accessSelectors) {
      const text = $clean(selector).first().text().trim();
      // JavaScriptコードやJSONが含まれていないかチェック（より厳密に）
      if (text && 
          text.length > 3 && 
          text.length < 500 && // 長すぎる場合は除外
          !text.includes("var ") && 
          !text.includes("function") &&
          !text.includes("{") &&
          !text.includes("}") &&
          !text.includes("http://") &&
          !text.includes("https://") &&
          !text.includes("bff-loadbalancer") &&
          !text.includes("tagmanager") &&
          !text.includes("G.text") &&
          !text.includes("responseType") &&
          !text.includes("status") &&
          !text.includes("headers") &&
          !text.includes("body") &&
          !text.includes("AT_TIME") &&
          !text.match(/^\s*var\s+/) && // varで始まる行を除外
          (text.includes("線") || text.includes("駅") || text.includes("徒歩") || text.includes("アクセス"))) {
        data.access = text;
        console.log("[Scraper] Access text found (validated):", text.substring(0, 100));
        break;
      } else if (text && text.length > 3) {
        console.log("[Scraper] Access text found but rejected:", text.substring(0, 200));
      }
    }
    
    // accessが取得できなかった場合はnullにする
    if (!data.access || data.access.length === 0) {
      data.access = null;
    }
    
    // 交通情報を構造化 - クリーンなHTMLから検索
    const cleanBodyText = $clean("body").text();
    // より厳密な正規表現で交通情報を抽出
    const transportPatterns = [
      /([^、\n\s]+線)\s+([^、\n\s]+駅)\s+[徒歩歩]*\s*([\d]+)\s*分/g,
      /([^、\n\s]+線)([^、\n\s]+駅)[徒歩歩]*([\d]+)分/g,
    ];
    
    for (const pattern of transportPatterns) {
      const matches = cleanBodyText.matchAll(pattern);
      for (const match of matches) {
        const line = match[1]?.trim();
        const station = match[2]?.trim();
        const walk = match[3];
        
        // バリデーション：適切な形式かチェック
        if (line && 
            station && 
            walk && 
            line.length < 50 && 
            station.length < 50 &&
            !line.includes("http") &&
            !station.includes("http") &&
            !line.includes("{") &&
            !station.includes("{")) {
          // 重複チェック
          const isDuplicate = data.transportation.some(
            t => t.line === line && t.station === station
          );
          if (!isDuplicate) {
            data.transportation.push({
              line,
              station,
              walk,
            });
          }
        }
      }
    }
    
    // 最大5件まで
    data.transportation = data.transportation.slice(0, 5);
    
    console.log("[Scraper] Transportation found:", data.transportation.length, "routes");
    if (data.transportation.length > 0) {
      console.log("[Scraper] Transportation details:", JSON.stringify(data.transportation));
    }

    // 建物構造
    const structureSelectors = [
      "dt:contains('構造') + dd",
      "th:contains('構造') + td",
      "[class*='structure']",
      ".structure",
      "[data-name*='構造']",
    ];
    for (const selector of structureSelectors) {
      const text = $(selector).first().text().trim();
      if (text) {
        data.building_structure = text;
        break;
      }
    }
    console.log("[Scraper] Building structure found:", data.building_structure);

    // 接道状況
    const roadSelectors = [
      "dt:contains('接道') + dd",
      "th:contains('接道') + td",
      "[class*='road']",
      "[data-name*='接道']",
    ];
    for (const selector of roadSelectors) {
      const text = $(selector).first().text().trim();
      if (text) {
        data.road_access = text;
        break;
      }
    }

    // 容積率・建ぺい率 - ページ全体から検索
    const ratioText = $("body").text();
    const floorAreaRatioMatch = ratioText.match(/容積率[：:]*\s*([\d.]+)\s*%/);
    const coverageRatioMatch = ratioText.match(/建[ぺペ]い率[：:]*\s*([\d.]+)\s*%/);
    if (floorAreaRatioMatch) {
      data.floor_area_ratio = parseFloat(floorAreaRatioMatch[1]);
    }
    if (coverageRatioMatch) {
      data.building_coverage_ratio = parseFloat(coverageRatioMatch[1]);
    }
    console.log("[Scraper] Floor area ratio found:", data.floor_area_ratio, "Coverage ratio:", data.building_coverage_ratio);

    // 地目
    const categorySelectors = [
      "dt:contains('地目') + dd",
      "th:contains('地目') + td",
      "[class*='category']",
      "[data-name*='地目']",
    ];
    for (const selector of categorySelectors) {
      const text = $(selector).first().text().trim();
      if (text) {
        data.land_category = text;
        break;
      }
    }

    // 用途地域
    const zoningSelectors = [
      "dt:contains('用途地域') + dd",
      "th:contains('用途地域') + td",
      "dt:contains('用途') + dd",
      "th:contains('用途') + td",
      "[class*='zoning']",
      "[data-name*='用途']",
    ];
    for (const selector of zoningSelectors) {
      const text = $(selector).first().text().trim();
      if (text && text.includes("地域")) {
        data.zoning = text;
        break;
      }
    }

    // 都市計画区域（市街化区域、市街化調整区域など）
    const urbanPlanningSelectors = [
      "dt:contains('都市計画') + dd",
      "th:contains('都市計画') + td",
      "[data-name*='都市計画']",
    ];
    for (const selector of urbanPlanningSelectors) {
      const text = $(selector).first().text().trim();
      if (text) {
        data.urban_planning = text;
        break;
      }
    }

    // 土地権利（所有権、借地権など）
    const landRightsSelectors = [
      "dt:contains('土地権利') + dd",
      "th:contains('土地権利') + td",
      "[data-name*='土地権利']",
    ];
    for (const selector of landRightsSelectors) {
      const text = $(selector).first().text().trim();
      if (text) {
        data.land_rights = text;
        break;
      }
    }
    if (!data.land_rights) {
      const bodyTextForRights = $("body").text();
      const landRightsMatch = bodyTextForRights.match(/土地権利[：:]*\s*([^\n\s]+(?:\s+[^\n\s]+)*?)(?:\s{2,}|\n|$)/);
      if (landRightsMatch) {
        data.land_rights = landRightsMatch[1].trim();
      }
    }

    console.log("[Scraper] Zoning found:", data.zoning, "Land category:", data.land_category, "Urban planning:", data.urban_planning, "Land rights:", data.land_rights);

    // 利回り
    const yieldText = $("[class*='yield'], [data-name*='利回り']").first().text();
    const yieldMatch = yieldText.match(/([\d.]+)%/);
    if (yieldMatch) {
      data.yield_rate = parseFloat(yieldMatch[1]);
    }

    // 平米単価の計算
    if (data.price && data.land_area) {
      data.price_per_sqm = Math.round(data.price / data.land_area);
    } else if (data.price && data.building_area) {
      data.price_per_sqm = Math.round(data.price / data.building_area);
    }

    // 生データを保存（HTMLの一部のみ）
    data.raw_data = {
      html_preview: htmlContent.substring(0, 5000), // 最初の5000文字のみプレビュー用
      html_length: htmlContent.length,
      scraped_at: new Date().toISOString(),
      scraped_fields: {
        title: !!data.title,
        price: !!data.price,
        address: !!data.address,
        floor_plan: !!data.floor_plan,
        year_built: data.year_built !== null,
        building_area: !!data.building_area,
        land_area: !!data.land_area,
        building_structure: !!data.building_structure,
        zoning: !!data.zoning,
        urban_planning: !!data.urban_planning,
        land_rights: !!data.land_rights,
      },
    };

    console.log("[Scraper] Scraping completed. Fields found:", data.raw_data.scraped_fields);

    return data;
  } catch (error: any) {
    console.error("[Scraper] Error scraping athomes:", error);
    throw new Error(`Failed to scrape athomes: ${error.message}`);
  }
}

/** 空の ScrapedPropertyData を返す（各サイト用パーサで共通） */
function createEmptyScrapedData(): ScrapedPropertyData {
  return {
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
    raw_data: {},
  };
}

/** 本文テキストから交通情報（線・駅・徒歩分）を抽出（SUUMO/LIFULL 等で共通） */
function parseTransportationFromText(text: string): Array<{ line: string; station: string; walk: string }> {
  const results: Array<{ line: string; station: string; walk: string }> = [];
  const seen = new Set<string>();
  // 「○○線」「○○駅」徒歩/歩 N分
  const patterns = [
    /([^\s、\n]+線)\s*[「']?([^「'\n]+駅)[」']?\s*[徒歩歩]*\s*(\d+)\s*分/g,
    /([^\s、\n]+線)([^\s、\n]+駅)\s*[徒歩歩]*\s*(\d+)\s*分/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      const line = m[1]?.trim() ?? "";
      const station = m[2]?.trim() ?? "";
      const walk = m[3] ?? "";
      if (line && station && walk && line.length < 50 && station.length < 50 && !line.includes("http")) {
        const key = `${line}-${station}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ line, station, walk });
        }
      }
    }
  }
  return results.slice(0, 5);
}

/**
 * SUUMO 専用パーサー
 * 物件詳細テーブル: table[summary="表"] または table.bdGrayT / .mt15.bdGrayT
 * th 内の .fl がラベル、隣の td が値。価格は #jsiLoanAmount の value（円）も利用。
 */
async function scrapeSuumo(url: string, html?: string): Promise<ScrapedPropertyData> {
  let htmlContent: string;
  if (html) {
    htmlContent = html;
    console.log("[Scraper] SUUMO: Using provided HTML, length:", htmlContent.length);
  } else {
    const result = await fetchPropertyHTML(url);
    htmlContent = result.html;
  }

  const $ = cheerio.load(htmlContent);
  const data = createEmptyScrapedData();

  // タイトル: h1
  const h1 = $("h1").first().text().trim();
  if (h1) data.title = h1;

  // 価格: まず hidden の円単位を優先、なければテーブルから
  const loanAmount = $("#jsiLoanAmount").attr("value");
  if (loanAmount) {
    const n = parseInt(loanAmount.replace(/\D/g, ""), 10);
    if (!isNaN(n)) data.price = n;
  }
  if (data.price == null) {
    const priceTd = $("th").filter((_, el) => $(el).text().trim().replace(/\s+/g, " ").startsWith("価格")).first().next("td");
    const priceText = priceTd.find("p").first().text().trim() || priceTd.text().trim();
    const priceMatch = priceText.match(/([\d,]+)\s*万円/);
    if (priceMatch) data.price = parseInt(priceMatch[1].replace(/,/g, ""), 10) * 10000;
  }

  // テーブルから th/td ペアを連想配列に
  const table = $('table[summary="表"]').first().length ? $('table[summary="表"]').first() : $("table.bdGrayT").first();
  const getLabel = (th: ReturnType<typeof $>): string =>
    th.find(".fl").first().text().trim() || th.text().trim().replace(/\s+/g, " ").replace(/\s*ヒント.*$/i, "").trim();
  const map: Record<string, string> = {};
  table.find("tbody tr").each((_: number, tr: cheerio.Element) => {
    const cells = $(tr).find("th, td");
    for (let i = 0; i < cells.length - 1; i += 2) {
      const label = getLabel($(cells[i]));
      const val = $(cells[i + 1]).text().trim().replace(/\s+/g, " ");
      if (label && val && val !== "-") map[label] = val;
    }
  });

  const get = (keys: string[]): string | null => {
    for (const k of keys) {
      const v = map[k];
      if (v) return v;
    }
    return null;
  };

  if (!data.address) data.address = get(["住所", "所在地"]) ?? null;
  data.location = data.address;

  const floorPlan = get(["間取り"]);
  if (floorPlan) data.floor_plan = floorPlan;

  const landAreaStr = get(["土地面積"]);
  if (landAreaStr) {
    const m = landAreaStr.match(/([\d.]+)\s*m²|([\d.]+)\s*m2/);
    if (m) data.land_area = parseFloat(m[1] ?? m[2] ?? "0");
  }
  const buildingAreaStr = get(["建物面積"]);
  if (buildingAreaStr) {
    const m = buildingAreaStr.match(/([\d.]+)\s*m²|([\d.]+)\s*m2/);
    if (m) data.building_area = parseFloat(m[1] ?? m[2] ?? "0");
  }

  const yearStr = get(["完成時期（築年月）", "完成時期(築年月)", "築年月"]);
  if (yearStr) {
    const yearM = yearStr.match(/(\d{4})年/);
    const monthM = yearStr.match(/(\d{1,2})月/);
    if (yearM) data.year_built = parseInt(yearM[1], 10);
    if (monthM) data.year_built_month = parseInt(monthM[1], 10);
  }

  const accessStr = get(["交通"]);
  if (accessStr) {
    data.access = accessStr;
    data.transportation = parseTransportationFromText(accessStr);
  }

  const structureStr = get(["構造・工法", "構造"]);
  if (structureStr) data.building_structure = structureStr;

  const roadStr = get(["私道負担・道路", "接道"]);
  if (roadStr) data.road_access = roadStr;

  const ratioStr = get(["建ぺい率・容積率"]);
  if (ratioStr) {
    const cov = ratioStr.match(/([\d.]+)\s*％\s*[・/]\s*[\d.]+/);
    const vol = ratioStr.match(/[・/]\s*([\d.]+)\s*％/);
    if (cov) data.building_coverage_ratio = parseFloat(cov[1]);
    if (vol) data.floor_area_ratio = parseFloat(vol[1]);
  }

  const zoningStr = get(["用途地域", "用途"]);
  if (zoningStr) data.zoning = zoningStr;

  const landRightsStr = get(["土地の権利形態", "土地権利", "権利"]);
  if (landRightsStr) data.land_rights = landRightsStr;

  if (data.price != null && (data.land_area != null || data.building_area != null)) {
    data.price_per_sqm = Math.round(data.price / (data.land_area ?? data.building_area ?? 1));
  }

  data.raw_data = {
    html_preview: htmlContent.substring(0, 5000),
    html_length: htmlContent.length,
    scraped_at: new Date().toISOString(),
    scraped_fields: {
      title: !!data.title,
      price: !!data.price,
      address: !!data.address,
      floor_plan: !!data.floor_plan,
      year_built: data.year_built != null,
      building_area: !!data.building_area,
      land_area: !!data.land_area,
      building_structure: !!data.building_structure,
      zoning: !!data.zoning,
      land_rights: !!data.land_rights,
    },
  };
  console.log("[Scraper] SUUMO completed. Fields:", data.raw_data.scraped_fields);
  return data;
}

/**
 * LIFULL HOME'S 不動産投資（toushi.homes.co.jp）専用パーサー
 * 概要: table.bukkenInfo__excerpt（価格・利回り・住所・交通）、詳細: th/td の物件概要テーブル
 */
async function scrapeHomes(url: string, html?: string): Promise<ScrapedPropertyData> {
  let htmlContent: string;
  if (html) {
    htmlContent = html;
    console.log("[Scraper] LIFULL: Using provided HTML, length:", htmlContent.length);
  } else {
    const result = await fetchPropertyHTML(url);
    htmlContent = result.html;
  }

  const $ = cheerio.load(htmlContent);
  const data = createEmptyScrapedData();

  // タイトル: h1（キャッチコピー） or 物件名
  const h1 = $("h1").first().text().trim();
  if (h1) data.title = h1;

  const getTdByTh = (table: ReturnType<typeof $>, thText: string): string | null => {
    let val: string | null = null;
    table.find("tr").each((_: number, tr: cheerio.Element) => {
      $(tr).find("th").each((__: number, thEl: cheerio.Element) => {
        const th = $(thEl);
        const label = th.text().trim().replace(/\s+/g, " ");
        if (label.includes(thText) || label === thText) {
          const td = th.next("td");
          if (td.length) val = td.text().trim().replace(/\s+/g, " ");
        }
      });
    });
    return val;
  };

  // 概要テーブル（価格・利回り・住所・交通）
  const excerptTable = $("table.bukkenInfo__excerpt");
  if (excerptTable.length) {
    const priceStr = getTdByTh(excerptTable, "価格");
    if (priceStr) {
      const m = priceStr.match(/([\d,]+)\s*万円/);
      if (m) data.price = parseInt(m[1].replace(/,/g, ""), 10) * 10000;
    }
    const yieldStr = getTdByTh(excerptTable, "利回り");
    if (yieldStr && yieldStr !== "未定" && yieldStr !== "-") {
      const ym = yieldStr.match(/([\d.]+)\s*％/);
      if (ym) data.yield_rate = parseFloat(ym[1]);
    }
    const addr = getTdByTh(excerptTable, "住所");
    if (addr) {
      data.address = addr;
      data.location = addr;
    }
    const accessStr = getTdByTh(excerptTable, "交通");
    if (accessStr) {
      data.access = accessStr;
      data.transportation = parseTransportationFromText(accessStr);
    }
  }

  // 詳細テーブル（物件名・築年月・建物面積・土地面積など）。建物面積があるテーブルを採用
  const detailTables = $("table").filter((_, el) => {
    const text = $(el).text();
    return text.includes("建物面積") && text.includes("土地面積");
  });
  const detailTable = detailTables.first();
  if (detailTable.length) {
    if (!data.title) {
      const name = getTdByTh(detailTable, "物件名");
      if (name) data.title = name;
    }
    const floorPlan = getTdByTh(detailTable, "間取り");
    if (floorPlan && floorPlan !== "-") data.floor_plan = floorPlan;

    const yearStr = getTdByTh(detailTable, "築年月");
    if (yearStr) {
      const yearM = yearStr.match(/(\d{4})年/);
      const monthM = yearStr.match(/(\d{1,2})月/);
      if (yearM) data.year_built = parseInt(yearM[1], 10);
      if (monthM) data.year_built_month = parseInt(monthM[1], 10);
    }

    const buildingAreaStr = getTdByTh(detailTable, "建物面積");
    if (buildingAreaStr) {
      const m = buildingAreaStr.match(/([\d.]+)\s*㎡/);
      if (m) data.building_area = parseFloat(m[1]);
    }
    const landAreaStr = getTdByTh(detailTable, "土地面積");
    if (landAreaStr) {
      const m = landAreaStr.match(/([\d.]+)\s*㎡/);
      if (m) data.land_area = parseFloat(m[1]);
    }

    const structureStr = getTdByTh(detailTable, "建物構造");
    if (structureStr && structureStr !== "-") data.building_structure = structureStr;

    const floorsStr = getTdByTh(detailTable, "所在階／階数");
    if (floorsStr && floorsStr !== "-") data.building_floors = floorsStr;

    const landRightsStr = getTdByTh(detailTable, "土地権利");
    if (landRightsStr && landRightsStr !== "-") data.land_rights = landRightsStr;

    const zoningStr = getTdByTh(detailTable, "用途地域");
    if (zoningStr && zoningStr !== "-") data.zoning = zoningStr;

    const landCategoryStr = getTdByTh(detailTable, "地目");
    if (landCategoryStr && landCategoryStr !== "-") data.land_category = landCategoryStr;

    const roadStr = getTdByTh(detailTable, "接道状況");
    if (roadStr && roadStr !== "-") data.road_access = roadStr;

    if (!data.yield_rate) {
      const yieldDetail = getTdByTh(detailTable, "表面利回り");
      if (yieldDetail && yieldDetail !== "未定" && yieldDetail !== "-") {
        const ym = yieldDetail.match(/([\d.]+)\s*％/);
        if (ym) data.yield_rate = parseFloat(ym[1]);
      }
    }
  }

  if (data.price != null && (data.land_area != null || data.building_area != null)) {
    data.price_per_sqm = Math.round(data.price / (data.land_area ?? data.building_area ?? 1));
  }

  data.raw_data = {
    html_preview: htmlContent.substring(0, 5000),
    html_length: htmlContent.length,
    scraped_at: new Date().toISOString(),
    scraped_fields: {
      title: !!data.title,
      price: !!data.price,
      address: !!data.address,
      floor_plan: !!data.floor_plan,
      year_built: data.year_built != null,
      building_area: !!data.building_area,
      land_area: !!data.land_area,
      building_structure: !!data.building_structure,
      zoning: !!data.zoning,
      land_rights: !!data.land_rights,
      yield_rate: data.yield_rate != null,
    },
  };
  console.log("[Scraper] LIFULL completed. Fields:", data.raw_data.scraped_fields);
  return data;
}
