"use client";

/**
 * トップページ右カラム: 物件価値わかるくんの説明（物件未選択時）
 * 明るい配色で「できること」と「使い方」を表示
 */
export default function HomeRightColumnPlaceholder() {
  return (
    <div className="space-y-10">
      {/* ヘッドライン */}
      <section>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-800 md:text-3xl">
          物件価値わかるくん
        </h2>
        <p className="mt-2 text-base text-slate-600 md:text-lg">
          物件URLを入力するだけで、投資判断と目的別の分析ができます
        </p>
      </section>

      {/* できること：明るい背景・カード＋ティールアクセントのみ */}
      <section>
        <h3 className="mb-5 border-l-4 border-teal-500 pl-3 text-base font-semibold text-slate-800 md:text-lg">
          できること
        </h3>
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow md:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </span>
              <span className="text-base font-semibold text-slate-800 md:text-lg">物件URLで即時分析</span>
            </div>
            <ul className="space-y-3 text-sm text-slate-600 md:text-base">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-teal-500 font-medium">✓</span>
                物件URLを貼るだけ
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-teal-500 font-medium">✓</span>
                立地・価格・建物を自動評価
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-teal-500 font-medium">✓</span>
                投資スコアと推奨度を表示
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow md:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </span>
              <span className="text-base font-semibold text-slate-800 md:text-lg">投資目的別の分析</span>
            </div>
            <ul className="space-y-3 text-sm text-slate-600 md:text-base">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-teal-500 font-medium">✓</span>
                利回り重視・資産防衛・SOHOなど
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-teal-500 font-medium">✓</span>
                目的に合わせたアドバイスを生成
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-teal-500 font-medium">✓</span>
                構造化された分析結果
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow md:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <span className="text-base font-semibold text-slate-800 md:text-lg">収支・環境データ</span>
            </div>
            <ul className="space-y-3 text-sm text-slate-600 md:text-base">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-teal-500 font-medium">✓</span>
                収支シミュレーション
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-teal-500 font-medium">✓</span>
                周辺環境・交通の情報
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-teal-500 font-medium">✓</span>
                地図で立地を確認
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 使い方：ステップ形式・薄いグレー背景でセクション区切り */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 md:p-8">
        <h3 className="mb-6 border-l-4 border-teal-500 pl-3 text-base font-semibold text-slate-800 md:text-lg">
          使い方
        </h3>
        <ol className="space-y-5">
          <li className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">
              1
            </span>
            <div>
              <span className="font-medium text-slate-800">左の入力欄に物件URLを貼る</span>
              <p className="mt-1 text-sm text-slate-600">
                アットホームやSUUMOなどの物件詳細ページのURLをコピーして、左のチャット欄に貼り付けて送信してください。
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">
              2
            </span>
            <div>
              <span className="font-medium text-slate-800">投資目的を選ぶ</span>
              <p className="mt-1 text-sm text-slate-600">
                分析が終わったら、利回り重視・資産防衛・SOHOなど、目的に合った番号やキーワードを入力すると、目的別のアドバイスが表示されます。
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">
              3
            </span>
            <div>
              <span className="font-medium text-slate-800">分析結果・収支を確認する</span>
              <p className="mt-1 text-sm text-slate-600">
                右のタブで「物件情報」「外部環境」「投資判断」を切り替えて確認できます。収支シミュレーションや周辺環境の詳細もチャットで依頼できます。
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* CTA */}
      <p className="text-center text-base text-slate-500 md:text-lg">
        左の入力欄に物件URLを貼り付けて、分析を開始してください
      </p>
    </div>
  );
}
