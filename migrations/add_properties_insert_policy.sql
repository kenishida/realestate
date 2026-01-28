-- propertiesテーブルへのINSERT権限を追加
-- 認証されていないユーザーでも物件データを追加できるようにする

-- propertiesテーブルへのINSERT権限を全ユーザーに付与
CREATE POLICY "Anyone can insert properties"
  ON properties FOR INSERT
  WITH CHECK (true);

-- propertiesテーブルへのUPDATE権限を全ユーザーに付与（既存データの更新用）
CREATE POLICY "Anyone can update properties"
  ON properties FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- property_analysesテーブルへのINSERT権限を全ユーザーに付与
CREATE POLICY "Anyone can insert property analyses"
  ON property_analyses FOR INSERT
  WITH CHECK (true);
