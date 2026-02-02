-- year_built を築年数から西暦に変換するマイグレーション
-- 従来: year_built = 築年数（例: 28）
-- 変更後: year_built = 築年（西暦）（例: 1998）
-- year_built が 100〜2000 の範囲は築年数と判断（西暦は通常 1900〜2100）

UPDATE properties
SET year_built = EXTRACT(YEAR FROM CURRENT_DATE)::int - year_built
WHERE year_built IS NOT NULL
  AND year_built >= 1
  AND year_built < 150;
