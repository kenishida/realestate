-- 既存の auth.users に対応する profiles を 1 件ずつ作成する
-- create_profiles.sql 実行後に 1 回だけ実行
-- Supabase SQLエディタで実行（サービスロールまたは権限のあるロールで）

INSERT INTO public.profiles (id, email)
SELECT id, email
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE profiles.id = auth.users.id
);
