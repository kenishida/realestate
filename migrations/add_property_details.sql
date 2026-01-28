-- 物件テーブルに詳細情報のカラムを追加

-- 既存のカラムを確認してから、不足しているカラムを追加
ALTER TABLE properties 
  ADD COLUMN IF NOT EXISTS building_floors TEXT, -- 階建（例: "3階建"）
  ADD COLUMN IF NOT EXISTS floor_number TEXT, -- 階（例: "2階"）
  ADD COLUMN IF NOT EXISTS access TEXT, -- 交通アクセス情報
  ADD COLUMN IF NOT EXISTS building_structure TEXT, -- 建物構造（例: "鉄筋コンクリート造"）
  ADD COLUMN IF NOT EXISTS road_access TEXT, -- 接道状況
  ADD COLUMN IF NOT EXISTS floor_area_ratio NUMERIC, -- 容積率（%）
  ADD COLUMN IF NOT EXISTS building_coverage_ratio NUMERIC, -- 建ぺい率（%）
  ADD COLUMN IF NOT EXISTS land_category TEXT, -- 地目（例: "宅地"）
  ADD COLUMN IF NOT EXISTS zoning TEXT, -- 用途地域（例: "第一種住居地域"）
  ADD COLUMN IF NOT EXISTS year_built_month INTEGER, -- 築年月（月）
  ADD COLUMN IF NOT EXISTS transportation JSONB DEFAULT '[]'::jsonb; -- 交通情報（構造化データ）

-- インデックスの追加（検索用）
CREATE INDEX IF NOT EXISTS idx_properties_zoning ON properties(zoning);
CREATE INDEX IF NOT EXISTS idx_properties_year_built ON properties(year_built);
