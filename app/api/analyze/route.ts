import { NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase-server";
import { generateTextWithGemini } from "@/lib/gemini";
import { scrapePropertyData, fetchPropertyHTML } from "@/lib/property-scraper";
import type { Property, PropertyAnalysis } from "@/lib/types";

/**
 * 物件URLを受け取り、投資判断を生成するAPIエンドポイント
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, conversationId } = body;
    
    console.log("[Analyze] Received request:", { url, hasConversationId: !!conversationId });

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

    // RLSをバイパスするためにService Role Supabaseを使用
    // 認証が必要な場合は、createServerSupabase()に変更
    let supabase;
    let usingServiceRole = false;
    try {
      supabase = createServiceRoleSupabase();
      usingServiceRole = true;
      console.log("[Analyze] Using Service Role Supabase client");
    } catch (error: any) {
      // Service Role Keyが設定されていない場合は通常のSupabaseクライアントを使用
      console.warn("[Analyze] Service Role Key not available, using regular Supabase client:", error.message);
      supabase = await createServerSupabase();
      console.log("[Analyze] Using regular Supabase client (RLS policies will apply)");
    }

    // 会話IDが指定されていない場合は、新しい会話を作成
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      const { data: newConversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          title: null, // 後で物件名で更新可能
          user_id: null, // 認証なしの場合
        })
        .select()
        .single();
      
      if (convError) {
        console.warn("[Analyze] Failed to create conversation:", convError);
      } else {
        currentConversationId = newConversation.id;
        console.log("[Analyze] Created new conversation:", currentConversationId);
      }
    }

    // 既存の物件データをチェック
    const { data: existingProperty, error: selectError } = await supabase
      .from("properties")
      .select("*")
      .eq("url", url)
      .single();

    if (selectError && selectError.code !== "PGRST116") {
      console.error("[Analyze] Error checking existing property:", selectError);
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to check existing property",
          details: selectError.message 
        },
        { status: 500 }
      );
    }

    let property: Property;
    let propertyId: string;

    // 既存データがあっても、主要な情報が不足している場合は再スクレイピング
    const shouldRescrape = !existingProperty || 
      !existingProperty.title || 
      !existingProperty.address || 
      !existingProperty.floor_plan;

    // 既存データがある場合はIDを取得
    if (existingProperty) {
      propertyId = existingProperty.id;
    }

    // 常にHTMLを取得して保存（デバッグと再パースのため）
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
          property_id: propertyId || null,
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
            property_id: propertyId || null,
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

    if (existingProperty && !shouldRescrape) {
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
        // 既存データを更新
        const { data, error } = await supabase
          .from("properties")
          .update({
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
            url,
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

    // Gemini APIで投資判断を生成
    const propertyInfo = [
      `物件URL: ${url}`,
      `データソース: ${property.source || "不明"}`,
      property.title ? `物件名: ${property.title}` : null,
      property.price ? `価格: ${property.price.toLocaleString()}円` : null,
      property.price_per_sqm ? `平米単価: ${property.price_per_sqm.toLocaleString()}円/㎡` : null,
      property.address ? `所在地: ${property.address}` : null,
      property.floor_plan ? `間取り: ${property.floor_plan}` : null,
      property.year_built !== null ? `築年数: ${property.year_built}年` : null,
      property.year_built_month ? `築年月: ${property.year_built_month}月` : null,
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
      property.yield_rate ? `利回り: ${property.yield_rate}%` : null,
      property.transportation && property.transportation.length > 0
        ? `交通詳細:\n${property.transportation.map((t) => `  - ${t.line} ${t.station} 徒歩${t.walk}分`).join("\n")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const analysisPrompt = `以下の物件情報を基に、不動産投資判断を行ってください。

${propertyInfo}

投資判断の観点:
1. 立地・アクセス性（交通の利便性、周辺環境）
2. 価格・利回り（適正価格か、投資収益性）
3. 物件の状態・築年数（メンテナンス状況、耐用年数）
4. 用途地域・建ぺい率・容積率（将来の開発可能性、リスク）
5. 市場性・将来性（地域の成長性、需要予測）
6. リスク要因（災害リスク、法規制リスクなど）

以下の形式で回答してください:

【投資判断サマリー】
[簡潔な判断結果を2-3文で]

【推奨度】
buy / hold / avoid のいずれか

【投資スコア】
0-100の数値

【詳細分析】
・[メリット1]
・[メリット2]
・[デメリット1]
・[デメリット2]
・[リスク要因]
・[機会要因]

【総合評価】
[最終的な評価とアドバイス]`;

    console.log("[Analyze] Generating investment analysis...");
    let analysisText: string;
    try {
      analysisText = await generateTextWithGemini(analysisPrompt);
      console.log("[Analyze] Analysis generated successfully, length:", analysisText.length);
    } catch (geminiError: any) {
      console.error("[Analyze] Gemini API error:", geminiError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to generate analysis with Gemini API",
          details: geminiError.message || "Unknown error",
        },
        { status: 500 }
      );
    }

    // 分析結果をパース
    const recommendationMatch = analysisText.match(/【推奨度】\s*(\w+)/);
    const scoreMatch = analysisText.match(/【投資スコア】\s*(\d+)/);
    const summaryMatch = analysisText.match(/【投資判断サマリー】\s*([^\n]+(?:\n[^\n]+)*?)(?=【|$)/);

    const recommendation = recommendationMatch
      ? (recommendationMatch[1].toLowerCase() as "buy" | "hold" | "avoid")
      : null;
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
    const summary = summaryMatch ? summaryMatch[1].trim() : analysisText.substring(0, 500);

    // 分析結果を構造化
    const analysisResult = {
      summary: summary,
      recommendation: recommendation || undefined,
      score: score || undefined,
      full_analysis: analysisText,
    };

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

    // 投資判断を保存
    const { data: analysis, error: analysisError } = await supabase
      .from("property_analyses")
      .insert({
        property_id: propertyId,
        conversation_id: currentConversationId || null,
        message_id: userMessageId || null,
        analysis_result: analysisResult,
        summary,
        recommendation,
        score,
      })
      .select()
      .single();

    if (analysisError) {
      console.error("[Analyze] Error saving analysis:", analysisError);
      // 分析結果は保存できなくても、レスポンスは返す
    } else {
      console.log("[Analyze] Analysis saved:", analysis.id);
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

    return NextResponse.json({
      success: true,
      conversationId: currentConversationId || null,
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
        transportation: property.transportation,
        yield_rate: property.yield_rate,
      },
      analysis: {
        summary,
        recommendation,
        score,
        full_analysis: analysisText,
      },
      analysisId: analysis?.id || null,
    });
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
