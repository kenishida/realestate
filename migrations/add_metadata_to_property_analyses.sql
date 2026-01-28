-- property_analysesテーブルにmetadataカラムを追加
-- カスタム投資目的などの追加情報を保存するため

ALTER TABLE property_analyses 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- インデックスの追加（必要に応じて）
-- CREATE INDEX IF NOT EXISTS idx_property_analyses_metadata 
-- ON property_analyses USING GIN (metadata);
