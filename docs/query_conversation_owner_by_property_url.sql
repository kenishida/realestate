-- 物件URLから、その物件の会話がどのユーザーに紐づいているかを調べる
-- 使用例: 以下の URL を正規化した形で properties.url に保存されている想定
--   https://www.athome.co.jp/buy_other/6987794140/?BKLISTID=... → https://www.athome.co.jp/buy_other/6987794140/

SELECT
  p.id AS property_id,
  p.url AS property_url,
  c.id AS conversation_id,
  c.custom_path,
  c.user_id,
  u.email AS owner_email,
  c.created_at AS conversation_created_at,
  c.updated_at AS conversation_updated_at
FROM properties p
JOIN property_analyses pa ON pa.property_id = p.id
JOIN conversations c ON c.id = pa.conversation_id
LEFT JOIN auth.users u ON u.id = c.user_id
WHERE p.url = 'https://www.athome.co.jp/buy_other/6987794140/'
   OR p.url = 'https://www.athome.co.jp/buy_other/6987794140'
ORDER BY c.updated_at DESC;
