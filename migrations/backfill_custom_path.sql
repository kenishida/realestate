-- 既存のconversationsレコードにcustom_pathを生成して設定する
-- custom_pathがNULLのレコードに対して、ランダムなパスを生成

-- 関数: ランダムな8文字の文字列を生成
CREATE OR REPLACE FUNCTION generate_random_path()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 既存のNULLのcustom_pathを更新
-- 重複を避けるために、既存のcustom_pathと重複しないことを確認
DO $$
DECLARE
  rec RECORD;
  new_path TEXT;
  path_exists BOOLEAN;
  attempts INTEGER;
BEGIN
  FOR rec IN 
    SELECT id FROM conversations WHERE custom_path IS NULL
  LOOP
    attempts := 0;
    LOOP
      new_path := generate_random_path();
      
      -- 重複チェック
      SELECT EXISTS(SELECT 1 FROM conversations WHERE custom_path = new_path) INTO path_exists;
      
      EXIT WHEN NOT path_exists OR attempts >= 10;
      
      attempts := attempts + 1;
    END LOOP;
    
    -- custom_pathを更新
    UPDATE conversations 
    SET custom_path = new_path 
    WHERE id = rec.id;
    
    RAISE NOTICE 'Updated conversation % with custom_path: %', rec.id, new_path;
  END LOOP;
END $$;

-- 関数を削除（一時的なものなので）
DROP FUNCTION generate_random_path();
