import { NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/google-maps";

/**
 * 住所を座標に変換するAPIエンドポイント
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "住所が必要です" },
        { status: 400 }
      );
    }

    const result = await geocodeAddress(address.trim());

    if (!result) {
      return NextResponse.json(
        { error: "住所が見つかりませんでした" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      lat: result.lat,
      lng: result.lng,
      formatted_address: result.formatted_address,
    });
  } catch (error: any) {
    console.error("[Geocode] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "座標取得に失敗しました",
      },
      { status: 500 }
    );
  }
}
