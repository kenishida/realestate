import { NextResponse } from "next/server";

/** Supabase を使わないヘルスチェック。サーバーと環境変数なしで 200 が返るか確認用 */
export async function GET() {
  return NextResponse.json({ ok: true });
}
