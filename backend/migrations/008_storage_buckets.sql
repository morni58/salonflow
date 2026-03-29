-- SalonFlow Migration 008: бакеты Supabase Storage (портфолио, отзывы, фото услуг/мастеров)
-- Выполнить в Supabase → SQL Editor (один раз).
-- Без этих бакетов загрузка в боте даёт: Bucket not found (404).

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('portfolio', 'portfolio', true),
  ('reviews', 'reviews', true),
  ('master-photos', 'master-photos', true),
  ('service-photos', 'service-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Публичное чтение файлов на сайте (anon). Если политика уже есть — блок DO пропустит создание.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'salonflow_storage_public_read'
  ) THEN
    CREATE POLICY "salonflow_storage_public_read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id IN ('portfolio', 'reviews', 'master-photos', 'service-photos'));
  END IF;
END
$$;

-- Загрузка/удаление через backend (ключ service_role в Supabase) обходит RLS.
