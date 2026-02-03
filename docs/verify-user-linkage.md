# ユーザー紐づけの確認方法（コスパ）

## 紐づけの構造

```
auth.users (ユーザー)
    ↑
conversations.user_id  … ここだけが「ユーザー」と直接紐づく
    ↑
property_analyses.conversation_id  … 会話 ↔ 投資判断
    ↑
properties (物件)  … 物件はユーザーと直接のカラムなし
```

- **ユーザー ↔ 会話**: `conversations.user_id` の 1 テーブル・1 カラムのみ。
- **会話 ↔ 物件**: `property_analyses` 経由（conversation_id, property_id）。物件テーブルに user_id はない。

---

## 結論: チャット（会話）起点がコスパ良い

| 確認したいこと | 起点 | テーブル数 | 理由 |
|----------------|------|------------|------|
| 誰に紐づいている会話がどれだけあるか | **チャット** | **1** | `conversations` の `user_id` を見るだけ |
| 未紐づけ会話が何件あるか | **チャット** | **1** | `conversations` で `user_id IS NULL` |
| 特定ユーザーの会話一覧 | **チャット** | **1** | `conversations` で `user_id = ?` |
| 特定物件がどのユーザーに紐づくか | 物件 | 2 | property_analyses → conversations |

**紐づけ不具合の有無を確認するなら、まず `conversations` だけ見るのが一番効率的。**

---

## 推奨クエリ（Supabase SQL エディタで実行）

### 1. 全体サマリ（1 クエリで紐づけ状況を把握）

```sql
-- ユーザーごとの会話数 + 未紐づけ件数
SELECT
  COALESCE(u.email, '(未紐づけ)') AS owner,
  c.user_id,
  COUNT(*) AS conversation_count
FROM conversations c
LEFT JOIN auth.users u ON u.id = c.user_id
GROUP BY c.user_id, u.email
ORDER BY conversation_count DESC;
```

### 2. 未紐づけ会話の一覧（claim 漏れの確認）

```sql
SELECT id, user_id, custom_path, created_at, updated_at
FROM conversations
WHERE user_id IS NULL
ORDER BY updated_at DESC
LIMIT 50;
```

### 3. 特定ユーザーに紐づく会話（例: admin@example.com）

```sql
SELECT c.id, c.custom_path, c.created_at, c.updated_at
FROM conversations c
WHERE c.user_id = (SELECT id FROM auth.users WHERE email = 'admin@example.com')
ORDER BY c.updated_at DESC;
```

### 4. 特定物件がどのユーザーに紐づいているか（物件起点・2 テーブル）

```sql
SELECT p.url, c.user_id, u.email AS owner_email
FROM properties p
JOIN property_analyses pa ON pa.property_id = p.id
JOIN conversations c ON c.id = pa.conversation_id
LEFT JOIN auth.users u ON u.id = c.user_id
WHERE p.url LIKE '%6983062981%';
```

---

## 運用の目安

1. **まず 1 のサマリ**で「未紐づけがどれだけあるか」を確認。
2. **未紐づけがある場合**は 2 で一覧を確認し、claim やログイン後の紐づけが動いているか検証。
3. **「この物件が誰のものか」**だけ知りたいときだけ 4 を使う（2 テーブル必要）。
