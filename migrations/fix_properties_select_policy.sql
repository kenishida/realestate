-- propertiesテーブルのSELECT権限を修正
-- 認証されていないユーザーでも閲覧可能にする

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Properties are viewable by all authenticated users" ON properties;

-- 新しいポリシーを作成（全ユーザーが閲覧可能）
CREATE POLICY "Properties are viewable by everyone"
  ON properties FOR SELECT
  USING (true);
