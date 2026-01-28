-- 直接UPDATEを実行してエラーを確認
-- 物件ID: a82b234e-86f5-47d7-8b79-8044382d291a (property_analysesのid)

-- ============================================
-- 1. 現在の状態を確認
-- ============================================
SELECT 
  id,
  property_id,
  investment_purpose,
  created_at
FROM property_analyses
WHERE id = 'a82b234e-86f5-47d7-8b79-8044382d291a';

-- ============================================
-- 2. UPDATEを実行（エラーが出るか確認）
-- ============================================
UPDATE property_analyses
SET investment_purpose = '民泊転用'
WHERE id = 'a82b234e-86f5-47d7-8b79-8044382d291a';

-- ============================================
-- 3. 更新後の状態を確認
-- ============================================
SELECT 
  id,
  property_id,
  investment_purpose,
  created_at
FROM property_analyses
WHERE id = 'a82b234e-86f5-47d7-8b79-8044382d291a';

-- ============================================
-- 4. 更新された行数を確認
-- ============================================
-- 上記のUPDATE文の後に、以下のクエリで確認できます
-- SELECT COUNT(*) FROM property_analyses 
-- WHERE id = 'a82b234e-86f5-47d7-8b79-8044382d291a' 
--   AND investment_purpose = '民泊転用';
