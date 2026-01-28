# Real Estate Investment Analysis App

不動産投資判断を支援するチャットアプリケーションです。物件URLをチャットに投げると、AIが投資判断を行い、右側に詳細データを表示します。

## 技術スタック

- **フレームワーク**: Next.js 15.5.7 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **データベース**: Supabase (PostgreSQL)
- **AI**: Google Gemini API
- **フォント**: Asap Condensed

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` ファイルを作成し、以下の環境変数を設定してください：

```env
# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. データベースのセットアップ

1. Supabaseプロジェクトを作成
2. Supabase SQLエディタで `migrations/create_chat_schema.sql` を実行

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## データベース構造

### 主要テーブル

1. **conversations** - 会話セッション
   - ユーザーごとの会話を管理

2. **messages** - メッセージ履歴
   - ユーザーとAIのメッセージを保存
   - 物件URLや物件IDへの参照を含む

3. **properties** - 物件データ
   - スクレイピングした物件情報を保存
   - 価格、利回り、立地などの基本情報

4. **property_analyses** - 投資判断結果
   - AIが生成した投資判断を保存
   - スコア、推奨度、詳細分析を含む

## プロジェクト構造

```
realsetate/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── page.tsx           # トップページ
│   └── layout.tsx         # ルートレイアウト
├── lib/                    # ユーティリティ
│   ├── gemini.ts          # Gemini APIクライアント
│   ├── supabase.ts        # Supabaseクライアント（ブラウザ）
│   ├── supabase-server.ts # Supabaseクライアント（サーバー）
│   └── types.ts           # 型定義
├── migrations/             # データベースマイグレーション
│   └── create_chat_schema.sql
└── components/             # Reactコンポーネント（今後追加）
```

## 機能

- [ ] チャットUI（左側）
- [ ] 物件データ表示（右側）
- [ ] 物件URLのスクレイピング
- [ ] AIによる投資判断
- [ ] 会話履歴の保存

## ライセンス

MIT
