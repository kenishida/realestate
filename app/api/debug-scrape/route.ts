import { NextResponse } from "next/server";
import { scrapePropertyData } from "@/lib/property-scraper";

/**
 * スクレイピングのデバッグ用エンドポイント
 */
export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    console.log("[Debug] Scraping URL:", url);
    const data = await scrapePropertyData(url);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("[Debug] Scraping error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
