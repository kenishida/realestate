-- 投資目的機能のセットアップ（統合版）
-- このファイルをSupabaseのSQLエディタで実行してください
-- 
-- 実行手順:
-- 1. Supabaseダッシュボードを開く
-- 2. 左側のメニューから「SQL Editor」を選択
-- 3. 「New query」をクリック
-- 4. このファイルの内容をコピー＆ペースト
-- 5. 「Run」ボタンをクリックして実行

-- ============================================
-- 1. investment_purposeカラムの追加
-- ============================================
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

-- ============================================
-- 2. UPDATE権限の設定
-- ============================================
-- property_analysesテーブルへのUPDATE権限を全ユーザーに付与
-- 投資目的の更新を可能にするため

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Anyone can update property_analyses" ON property_analyses;

-- 新しいポリシーを作成
CREATE POLICY "Anyone can update property_analyses"
  ON property_analyses FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 実行完了メッセージ
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '投資目的機能のセットアップが完了しました！';
END $$;
