import { NextResponse } from "next/server";
import { generateTextWithGemini, getGeminiClient } from "@/lib/gemini";

/**
 * Gemini APIの動作確認用エンドポイント
 */
export async function GET() {
  try {
    // APIキーの確認
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("[Test] GEMINI_API_KEY exists:", !!apiKey);
    
    if (apiKey) {
      console.log("[Test] GEMINI_API_KEY length:", apiKey.length);
      console.log("[Test] GEMINI_API_KEY prefix:", apiKey.substring(0, 10));
    }

    // クライアントの確認
    const client = getGeminiClient();
    console.log("[Test] Gemini client created:", !!client);

    if (!client) {
      return NextResponse.json(
        {
          success: false,
          error: "Gemini API key is not configured",
          apiKeyConfigured: false,
        },
        { status: 500 }
      );
    }

    // 簡単なテストプロンプト
    const testPrompt = "こんにちは。あなたは誰ですか？簡潔に答えてください。";
    console.log("[Test] Gemini APIのテストを開始...");
    
    const response = await generateTextWithGemini(testPrompt);
    
    console.log("[Test] Gemini APIのテスト成功");
    console.log("[Test] レスポンス:", response);

    return NextResponse.json({
      success: true,
      message: "Gemini API is working correctly",
      testPrompt,
      response,
      apiKeyConfigured: true,
      apiKeyLength: apiKey?.length || 0,
    });
  } catch (error: any) {
    console.error("[Test] Gemini APIのテストエラー:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
        apiKeyConfigured: !!process.env.GEMINI_API_KEY,
        apiKeyLength: process.env.GEMINI_API_KEY?.length || 0,
      },
      { status: 500 }
    );
  }
}
