-- 外部環境データ用テーブル（住所取得後に Google Maps API でリサーチした結果を保存）
-- Supabase SQLエディタで実行

CREATE TABLE IF NOT EXISTS property_external_env (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  -- 地域概要（LLM または API で生成）
  area_overview TEXT,
  -- 周辺施設（Places API の結果をそのまま保存）
  schools JSONB DEFAULT '[]'::jsonb,
  hospitals JSONB DEFAULT '[]'::jsonb,
  supermarkets JSONB DEFAULT '[]'::jsonb,
  convenience_stores JSONB DEFAULT '[]'::jsonb,
  -- 状態・メタ
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id)
);

CREATE INDEX IF NOT EXISTS idx_property_external_env_property_id ON property_external_env(property_id);
CREATE INDEX IF NOT EXISTS idx_property_external_env_status ON property_external_env(status);

-- updated_at 自動更新
CREATE TRIGGER update_property_external_env_updated_at
  BEFORE UPDATE ON property_external_env
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS（既存の properties と同様に SELECT は広めに許可する想定）
ALTER TABLE property_external_env ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read property_external_env"
  ON property_external_env FOR SELECT
  USING (true);

CREATE POLICY "Allow insert property_external_env"
  ON property_external_env FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update property_external_env"
  ON property_external_env FOR UPDATE
  USING (true);
