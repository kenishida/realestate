-- チャット会話とメッセージ、物件データのスキーマ
-- Supabase SQLエディタで実行

-- 1. 会話セッションテーブル（conversations）
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. 物件テーブル（properties）- messagesより先に作成する必要がある
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE, -- 物件URL（athomesなど）
  source TEXT, -- データソース（athomes, suumo, homes など）
  title TEXT,
  price INTEGER, -- 価格（円）
  price_per_sqm NUMERIC, -- 平米単価
  location TEXT, -- 所在地
  address TEXT, -- 住所
  property_type TEXT, -- 物件種別（マンション、戸建てなど）
  building_area NUMERIC, -- 建物面積（㎡）
  land_area NUMERIC, -- 土地面積（㎡）
  year_built INTEGER, -- 築年数
  floor_plan TEXT, -- 間取り
  yield_rate NUMERIC, -- 利回り（%）
  raw_data JSONB DEFAULT '{}'::jsonb, -- スクレイピングした生データ
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. メッセージテーブル（messages）
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  property_url TEXT, -- 物件URL（userメッセージの場合に設定）
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL, -- 物件データへの参照
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb -- トークン数、モデル名など
);

-- 4. 投資判断結果テーブル（property_analyses）
CREATE TABLE IF NOT EXISTS property_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL, -- どのメッセージで生成されたか
  analysis_result JSONB NOT NULL DEFAULT '{}'::jsonb, -- 投資判断結果（構造化データ）
  summary TEXT, -- 投資判断の要約テキスト
  recommendation TEXT, -- 推奨度（buy, hold, avoid など）
  score INTEGER, -- 投資スコア（0-100）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_property_id ON messages(property_id);
CREATE INDEX IF NOT EXISTS idx_properties_url ON properties(url);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_analyses_property_id ON property_analyses(property_id);
CREATE INDEX IF NOT EXISTS idx_property_analyses_conversation_id ON property_analyses(conversation_id);

-- updated_atを自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガーの作成
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) の設定
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_analyses ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: ユーザーは自分の会話のみ閲覧可能
CREATE POLICY "Users can view their own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON conversations FOR DELETE
  USING (auth.uid() = user_id);

-- RLSポリシー: ユーザーは自分の会話のメッセージのみ閲覧可能
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- 物件データは全ユーザーが閲覧可能（共有データ）
CREATE POLICY "Properties are viewable by all authenticated users"
  ON properties FOR SELECT
  USING (auth.role() = 'authenticated');

-- 投資判断結果は自分の会話に関連するもののみ閲覧可能
CREATE POLICY "Users can view analyses in their conversations"
  ON property_analyses FOR SELECT
  USING (
    conversation_id IS NULL OR
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = property_analyses.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );
