# Network タブで「紐づかない」原因を確認する手順

ログイン中に物件URLを送ってもチャットがユーザーに紐づかない場合、ブラウザの開発者ツールの **Network** タブで次を確認してください。

---

## 1. 確認するリクエスト

1. **F12** で開発者ツールを開く → **Network** タブを選択
2. ログインした状態で、ホーム（またはチャットを新規作成）で **物件URLを1件送信**
3. 一覧から **`analyze`** という名前の **POST** リクエストをクリック

---

## 2. Request（送信側）

### Request Headers

| 項目 | 期待値 | 意味 |
|------|--------|------|
| **Authorization** | `Bearer eyJ...`（長い文字列） | ログイン中のトークンが送られているか |

- **Authorization がない** → クライアントがトークンを送っていない（session が null のまま、またはホームがトークンを付与していない）
- **Authorization がある** → サーバー側でユーザー取得・紐づけができているかは Response で確認

---

## 3. Response（返却側）

### Response Headers

API が次のカスタムヘッダーを返します。

| ヘッダー | 値 | 意味 |
|----------|-----|------|
| **X-Analyze-Had-Bearer** | `1` | リクエストに Bearer があり、ユーザーを特定できた |
| **X-Analyze-Had-Bearer** | `0` | Bearer なし／無効で、ユーザー未特定（紐づけしない） |
| **X-Analyze-User-Id** | UUID | 紐づけたユーザーID（空なら未紐づけ） |

### パターンと対処

| X-Analyze-Had-Bearer | X-Analyze-User-Id | 想定原因 |
|----------------------|------------------|----------|
| `0` | （空） | リクエストに Authorization が付いていない、またはトークンが無効。ホーム側で session が取れていない可能性。 |
| `1` | UUID | サーバー側では紐づけている。DB に `user_id` が入っているか Supabase で確認。 |
| `1` | （空） | 通常は起きない。トークンは有効だが user 取得に失敗している場合のみ。 |

---

## 4. 環境変数

紐づけ処理では **サービスロール** で会話を insert しています（RLS を避けるため）。

- **SUPABASE_SERVICE_ROLE_KEY** が `.env.local` に設定されているか確認
- 未設定だと、`user_id` 付きの insert が RLS で弾かれて失敗する可能性があります

---

## 5. まとめ

1. **analyze** の **Request Headers** に `Authorization: Bearer ...` があるか
2. **analyze** の **Response Headers** で `X-Analyze-Had-Bearer: 1` と `X-Analyze-User-Id: <UUID>` が出ているか
3. 上記が問題なければ、Supabase の `conversations` で該当会話の `user_id` を確認

この順で見ると、「クライアントがトークンを送っていない」「サーバーでユーザーを取れていない」「DB に書けていない」のどこで止まっているか切り分けられます。

---

## 6. X-Analyze-Had-Bearer: 1 のとき、DB で紐づいているか確認する

Response で **X-Analyze-Had-Bearer: 1** かつ **X-Analyze-User-Id** に UUID が出ている場合、Supabase の **SQL エディタ**で次を実行して紐づきを確認してください。

### 直近で更新された会話（user_id と所有者メール付き）

```sql
-- 直近 20 件の会話。user_id が入っていれば紐づいている
SELECT
  c.id,
  c.user_id,
  u.email AS owner_email,
  c.custom_path,
  c.created_at,
  c.updated_at
FROM conversations c
LEFT JOIN auth.users u ON u.id = c.user_id
ORDER BY c.updated_at DESC
LIMIT 20;
```

- **owner_email** に自分のメール（例: kenishida@liberstudio.jp）が出ていれば、その行は自分に紐づいています。
- **user_id** が NULL の行は未紐づけです。

### 特定ユーザーに紐づく会話だけ見る（自分のメールで絞る）

```sql
-- 自分のメールに紐づく会話のみ
SELECT id, user_id, custom_path, created_at, updated_at
FROM conversations
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kenishida@liberstudio.jp')
ORDER BY updated_at DESC;
```

（`kenishida@liberstudio.jp` を実際のログインメールに置き換えてください。）

- **行が返る** → その会話は DB 上でそのユーザーに紐づいています。
- **0 件** → まだ紐づいていません（insert 失敗や RLS の可能性）。
