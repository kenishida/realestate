import { GoogleGenerativeAI } from "@google/generative-ai";

// Gemini APIクライアントを取得（必要に応じて初期化）
function getGenAI(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Gemini APIを使用してテキストを生成
 */
async function generateText(prompt: string, genAIClient?: GoogleGenerativeAI): Promise<string> {
  const client = genAIClient || getGenAI();
  
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    console.error(`[Gemini] Client is null - API key exists: ${!!apiKey}`);
    throw new Error("Gemini API key is not configured");
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured");
    }
    
    // gemini-flash-latestを使用（常に最新のFlashモデル）
    const modelName = "gemini-flash-latest";
    console.log(`[Gemini] モデル: ${modelName} を使用します`);
    
    const model = client.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log(`[Gemini] テキスト生成成功 (${text.length}文字)`);
    return text;
  } catch (error: any) {
    console.error("[Gemini] API error:", error);
    console.error("[Gemini] Error details:", {
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      response: error.response,
      stack: error.stack,
    });
    
    // より詳細なエラーメッセージを提供
    let errorMessage = "Gemini API error";
    if (error.message) {
      errorMessage = error.message;
    } else if (error.status) {
      errorMessage = `Gemini API error: ${error.status} ${error.statusText || ""}`;
    }
    
    throw new Error(`${errorMessage}`);
  }
}

/**
 * 利用可能なモデル一覧を取得（デバッグ用）
 */
export async function listAvailableModels(): Promise<{
  models: Array<{ name: string; displayName: string; supportedGenerationMethods: string[] }>;
  error?: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured");
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Gemini] API error: ${response.status} ${response.statusText}`);
      return {
        models: [],
        error: `API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    const supportedModels = (data.models || []).filter((model: any) =>
      model.supportedGenerationMethods?.includes("generateContent")
    );
    
    return {
      models: supportedModels.map((model: any) => ({
        name: model.name,
        displayName: model.displayName || model.name,
        supportedGenerationMethods: model.supportedGenerationMethods || [],
      })),
    };
  } catch (error: any) {
    console.error("[Gemini] Error listing models:", error);
    return {
      models: [],
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Gemini APIを使用してテキストを生成（エクスポート用）
 */
export async function generateTextWithGemini(prompt: string): Promise<string> {
  return generateText(prompt);
}

/**
 * Gemini APIクライアントを取得（エクスポート用）
 */
export function getGeminiClient(): GoogleGenerativeAI | null {
  return getGenAI();
}
