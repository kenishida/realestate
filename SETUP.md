# Supabaseセットアップガイド

## 1. Supabaseプロジェクトの作成

### ステップ1: Supabaseアカウントにログイン

1. [https://supabase.com](https://supabase.com) にアクセス
2. アカウントにログイン（GitHubアカウントでログイン可能）

### ステップ2: 新しいプロジェクトを作成

1. ダッシュボードで「New Project」をクリック
2. 以下の情報を入力：
   - **Organization**: 既存の組織を選択、または新規作成
   - **Name**: `realsetate`（任意の名前）
   - **Database Password**: 強力なパスワードを設定（**必ずメモしてください**）
   - **Region**: `Northeast Asia (Tokyo)` を推奨
3. 「Create new project」をクリック
4. プロジェクトの作成完了まで2-3分待機

### ステップ3: プロジェクト設定を取得

1. プロジェクトダッシュボードの左サイドバーから「Settings」→「API」を選択
2. 以下の情報をコピー：
   - **Project URL**: `https://xxxxx.supabase.co` の形式
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` の形式
3. 「Settings」→「API」→「Project API keys」セクションで：
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` をコピー（⚠️ このキーは秘密にしてください）

## 2. 環境変数の設定

`.env.local` ファイルに以下を追加：

```env
# Gemini API
GEMINI_API_KEY=AIzaSyAg79yS4clusdDsUj-W6OO_rntLItixFR4

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**重要**: 
- `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` は公開されても問題ありません（ブラウザで使用）
- `SUPABASE_SERVICE_ROLE_KEY` は**絶対に公開しないでください**（サーバーサイドのみで使用）

## 3. データベースマイグレーションの実行

### 方法1: SupabaseダッシュボードのSQLエディタで実行（推奨）

1. Supabaseダッシュボードの左サイドバーから「SQL Editor」を選択
2. 「New query」をクリック
3. `migrations/create_chat_schema.sql` の内容をコピー
4. SQLエディタに貼り付け
5. 「Run」ボタンをクリック（または `Cmd+Enter` / `Ctrl+Enter`）
6. 成功メッセージが表示されることを確認

### 方法2: コマンドラインから実行（上級者向け）

```bash
# Supabase CLIをインストール（初回のみ）
npm install -g supabase

# Supabaseにログイン
supabase login

# プロジェクトをリンク
supabase link --project-ref your-project-ref

# マイグレーションを実行
supabase db push
```

## 4. テーブルの確認

1. Supabaseダッシュボードの左サイドバーから「Table Editor」を選択
2. 以下のテーブルが作成されていることを確認：
   - `conversations`
   - `messages`
   - `properties`
   - `property_analyses`

## 5. 動作確認

開発サーバーを起動：

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) にアクセスして動作を確認してください。

## トラブルシューティング

### エラー: "relation does not exist"
- マイグレーションが実行されていない可能性があります
- SQLエディタで `migrations/create_chat_schema.sql` を再実行してください

### エラー: "permission denied"
- RLSポリシーが原因の可能性があります
- 認証が必要な場合は、Supabase Authでユーザーを作成してください

### 環境変数が読み込まれない
- `.env.local` ファイルがプロジェクトルートにあることを確認
- 開発サーバーを再起動してください
