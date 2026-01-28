-- 投資目的カラムの追加
-- property_analysesテーブルにinvestment_purposeカラムを追加

ALTER TABLE property_analyses 
ADD COLUMN IF NOT EXISTS investment_purpose TEXT;

-- investment_purposeの値:
-- 'yield_focused' - 利回り重視
-- 'asset_protection' - 資産防衛・節税
-- 'soho_use' - 住居兼事務所（SOHO）
-- 'other' - その他
-- NULL - 未回答

-- インデックスの追加（投資目的で検索する場合）
CREATE INDEX IF NOT EXISTS idx_property_analyses_investment_purpose 
ON property_analyses(investment_purpose) 
WHERE investment_purpose IS NOT NULL;
