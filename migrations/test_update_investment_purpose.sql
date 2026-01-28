-- テスト用: 特定の物件のinvestment_purposeを更新
-- 物件ID: a82b234e-86f5-47d7-8b79-8044382d291a

-- ============================================
-- 1. まず、該当するproperty_analysesレコードを確認
-- ============================================
-- property_idで検索
SELECT 
  id,
  property_id,
  investment_purpose,
  created_at
FROM property_analyses
WHERE property_id = 'a82b234e-86f5-47d7-8b79-8044382d291a';

-- property_analysesのidで検索（もし上記で見つからない場合）
SELECT 
  id,
  property_id,
  investment_purpose,
  created_at
FROM property_analyses
WHERE id = 'a82b234e-86f5-47d7-8b79-8044382d291a';

-- ============================================
-- 2. investment_purposeを「民泊転用」に更新
-- ============================================
-- property_idで更新（最も可能性が高い）
UPDATE property_analyses
SET investment_purpose = '民泊転用'
WHERE property_id = 'a82b234e-86f5-47d7-8b79-8044382d291a';

-- もし上記で更新されない場合、property_analysesのidで更新
-- UPDATE property_analyses
-- SET investment_purpose = '民泊転用'
-- WHERE id = 'a82b234e-86f5-47d7-8b79-8044382d291a';

-- ============================================
-- 3. 更新結果を確認
-- ============================================
SELECT 
  id,
  property_id,
  investment_purpose,
  created_at
FROM property_analyses
WHERE property_id = 'a82b234e-86f5-47d7-8b79-8044382d291a'
   OR id = 'a82b234e-86f5-47d7-8b79-8044382d291a';

-- ============================================
-- 4. 更新された行数を確認
-- ============================================
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '更新された行数: %', updated_count;
  
  IF updated_count = 0 THEN
    RAISE NOTICE '⚠️  警告: 更新された行がありません。IDが正しいか確認してください。';
  ELSE
    RAISE NOTICE '✓ 正常に更新されました';
  END IF;
END $$;
