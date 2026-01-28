-- investment_purposeカラムの存在確認と状態チェック
-- SupabaseのSQLエディタで実行して、マイグレーションの状態を確認してください

-- ============================================
-- 1. investment_purposeカラムの存在確認
-- ============================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'property_analyses'
  AND column_name = 'investment_purpose';

-- 結果が空の場合 → カラムが存在しません（マイグレーション未実行）
-- 結果がある場合 → カラムは存在します

-- ============================================
-- 2. インデックスの存在確認
-- ============================================
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'property_analyses'
  AND indexname = 'idx_property_analyses_investment_purpose';

-- 結果が空の場合 → インデックスが存在しません
-- 結果がある場合 → インデックスは存在します

-- ============================================
-- 3. UPDATE権限（RLSポリシー）の確認
-- ============================================
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'property_analyses'
  AND cmd = 'UPDATE';

-- 結果が空の場合 → UPDATEポリシーが存在しません
-- "Anyone can update property_analyses" がある場合 → ポリシーは存在します

-- ============================================
-- 4. 現在のテーブル構造の確認（参考）
-- ============================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'property_analyses'
ORDER BY ordinal_position;

-- ============================================
-- 5. サマリー表示
-- ============================================
DO $$
DECLARE
  column_exists BOOLEAN;
  index_exists BOOLEAN;
  policy_exists BOOLEAN;
BEGIN
  -- カラムの存在確認
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'property_analyses' 
      AND column_name = 'investment_purpose'
  ) INTO column_exists;
  
  -- インデックスの存在確認
  SELECT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE tablename = 'property_analyses' 
      AND indexname = 'idx_property_analyses_investment_purpose'
  ) INTO index_exists;
  
  -- ポリシーの存在確認
  SELECT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'property_analyses' 
      AND policyname = 'Anyone can update property_analyses'
  ) INTO policy_exists;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'investment_purpose機能の状態確認';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'カラム (investment_purpose): %', 
    CASE WHEN column_exists THEN '✓ 存在します' ELSE '✗ 存在しません' END;
  RAISE NOTICE 'インデックス (idx_property_analyses_investment_purpose): %', 
    CASE WHEN index_exists THEN '✓ 存在します' ELSE '✗ 存在しません' END;
  RAISE NOTICE 'UPDATEポリシー (Anyone can update property_analyses): %', 
    CASE WHEN policy_exists THEN '✓ 存在します' ELSE '✗ 存在しません' END;
  RAISE NOTICE '========================================';
  
  IF NOT column_exists THEN
    RAISE NOTICE '【必要な対応】migrations/setup_investment_purpose.sql を実行してください';
  END IF;
  
  IF NOT policy_exists THEN
    RAISE NOTICE '【必要な対応】UPDATEポリシーを設定してください';
  END IF;
END $$;
