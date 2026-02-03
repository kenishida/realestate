-- 未ログインで開始した会話を、ログイン後に「自分の会話」として紐づけるためのポリシー
-- user_id が NULL の会話に対してのみ、UPDATE で user_id = auth.uid() を設定可能
-- Supabase SQLエディタで実行

CREATE POLICY "Users can claim unclaimed conversations"
  ON conversations FOR UPDATE
  USING (user_id IS NULL)
  WITH CHECK (user_id = auth.uid());
