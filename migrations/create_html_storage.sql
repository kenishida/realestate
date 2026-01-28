-- HTML保存用テーブル
-- スクレイピングで取得したHTMLを保存し、デバッグや再パースに使用

CREATE TABLE IF NOT EXISTS property_html_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  html TEXT NOT NULL, -- 取得したHTML（全文）
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  error_message TEXT,
  content_length INTEGER, -- HTMLの文字数
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_property_html_storage_property_id ON property_html_storage(property_id);
CREATE INDEX IF NOT EXISTS idx_property_html_storage_url ON property_html_storage(url);
CREATE INDEX IF NOT EXISTS idx_property_html_storage_created_at ON property_html_storage(created_at DESC);

-- updated_atを自動更新するトリガー
CREATE TRIGGER update_property_html_storage_updated_at BEFORE UPDATE ON property_html_storage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLSポリシー（全ユーザーが閲覧可能、INSERTも可能）
ALTER TABLE property_html_storage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view HTML storage"
  ON property_html_storage FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert HTML storage"
  ON property_html_storage FOR INSERT
  WITH CHECK (true);
