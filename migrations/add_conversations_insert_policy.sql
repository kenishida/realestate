-- conversationsテーブルへのINSERT権限を追加
-- 認証されていないユーザーでも会話を作成できるようにする

-- 既存のポリシーを確認してから、INSERT権限を追加
CREATE POLICY "Anyone can insert conversations"
  ON conversations FOR INSERT
  WITH CHECK (true);

-- messagesテーブルへのINSERT権限も追加
CREATE POLICY "Anyone can insert messages"
  ON messages FOR INSERT
  WITH CHECK (true);
