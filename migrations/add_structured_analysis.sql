-- 投資判断の構造化データ対応
-- 既存のproperty_analysesテーブルに新しいカラムを追加

ALTER TABLE property_analyses 
ADD COLUMN IF NOT EXISTS section_scores JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS structured_analysis JSONB DEFAULT '{}'::jsonb;

-- section_scoresの構造例:
-- {
--   "location": 5,
--   "price": 3,
--   "building": 2,
--   "yield": 3,
--   "overall": 78
-- }

-- structured_analysisの構造例:
-- {
--   "property_overview": {
--     "location": { "score": 5, "max_score": 5, "stars": "★★★★★", "comment": "..." },
--     "price": { "score": 3, "max_score": 5, "stars": "★★★☆☆", "comment": "..." },
--     "building": { "score": 2, "max_score": 5, "stars": "★★☆☆☆", "comment": "..." }
--   },
--   "investment_simulation": {
--     "estimated_rent": "25万円〜32万円程度",
--     "estimated_yield": "約4.3%",
--     "calculation": "家賃28万円の場合：年収336万円 ÷ 7,750万円 ＝ 表面利回り 約4.3%",
--     "judgment": "..."
--   },
--   "merits": [
--     { "title": "出口戦略（売却）の強さ", "description": "..." },
--     { "title": "資産価値の維持", "description": "..." }
--   ],
--   "risks": [
--     { "title": "融資の難易度", "description": "..." },
--     { "title": "維持費", "description": "..." }
--   ],
--   "final_judgment": {
--     "yield_focused": { "recommendation": "見送り（パス）", "reason": "..." },
--     "asset_protection": { "recommendation": "アリ", "reason": "..." },
--     "soho_use": { "recommendation": "強く推奨", "reason": "..." }
--   },
--   "advice": "..."
-- }

-- インデックスの追加（JSONBクエリのパフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_property_analyses_section_scores 
ON property_analyses USING GIN (section_scores);

CREATE INDEX IF NOT EXISTS idx_property_analyses_structured_analysis 
ON property_analyses USING GIN (structured_analysis);
