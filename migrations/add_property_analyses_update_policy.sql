-- property_analysesテーブルへのUPDATE権限を全ユーザーに付与
-- 投資目的の更新を可能にするため

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Anyone can update property_analyses" ON property_analyses;

-- 新しいポリシーを作成
CREATE POLICY "Anyone can update property_analyses"
  ON property_analyses FOR UPDATE
  USING (true)
  WITH CHECK (true);
