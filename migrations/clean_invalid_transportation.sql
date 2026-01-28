-- 不適切な交通情報データをクリーンアップ
-- 既存のデータベースに保存されている不適切な値をクリア

-- accessフィールドに不適切な値が含まれている場合、NULLに設定
UPDATE properties
SET access = NULL
WHERE access IS NOT NULL
  AND (
    access LIKE '%var %' OR
    access LIKE '%bff-loadbalancer%' OR
    access LIKE '%tagmanager%' OR
    access LIKE '%G.text%' OR
    access LIKE '%http://%' OR
    POSITION('{' IN access) > 0 OR
    POSITION('}' IN access) > 0 OR
    POSITION('"status"' IN access) > 0 OR
    POSITION('"headers"' IN access) > 0
  );

-- transportationフィールドに不適切な値が含まれている場合、NULLに設定
-- JSONBカラムの検索は複雑なため、一旦すべてNULLにして再取得を推奨
-- または、個別にチェックする場合は以下を使用：
-- 
-- UPDATE properties
-- SET transportation = NULL
-- WHERE transportation IS NOT NULL
--   AND (transportation::text LIKE '%bff-loadbalancer%');
-- 
-- UPDATE properties
-- SET transportation = NULL
-- WHERE transportation IS NOT NULL
--   AND (transportation::text LIKE '%tagmanager%');
-- 
-- UPDATE properties
-- SET transportation = NULL
-- WHERE transportation IS NOT NULL
--   AND (transportation::text LIKE '%http://%');
-- 
-- UPDATE properties
-- SET transportation = NULL
-- WHERE transportation IS NOT NULL
--   AND (transportation::text LIKE '%var %');

-- 簡易版: すべてのtransportationを一旦NULLにする（再スクレイピングで正しい値が入る）
UPDATE properties
SET transportation = NULL
WHERE transportation IS NOT NULL;
