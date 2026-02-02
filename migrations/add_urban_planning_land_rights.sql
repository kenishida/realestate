-- 都市計画・土地権利のカラムを追加

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS urban_planning TEXT,   -- 都市計画区域（例: 市街化区域、市街化調整区域）
  ADD COLUMN IF NOT EXISTS land_rights TEXT;      -- 土地権利（例: 所有権、借地権）
