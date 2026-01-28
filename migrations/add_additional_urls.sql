-- 会話テーブルにカスタムパスのカラムを追加
-- 各チャット履歴（conversation）ごとにカスタムURLパスを設定できるようにする（例: /aaaaaa, /bbbb）

ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS custom_path TEXT UNIQUE; -- カスタムURLパス（例: "aaaaaa", "bbbb"）

-- インデックスの追加（検索用）
CREATE INDEX IF NOT EXISTS idx_conversations_custom_path ON conversations(custom_path);
