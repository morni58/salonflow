-- SalonFlow: сайт, CRM, расписание (после 001_initial.sql)
-- Выполнить в Supabase SQL Editor

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS working_days JSONB DEFAULT '[0,1,2,3,4,5,6]'::jsonb;

COMMENT ON COLUMN tenants.working_days IS 'Дни работы: 0=Пн … 6=Вс (Python weekday) при schedule_mode=weekdays';

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS schedule_mode TEXT NOT NULL DEFAULT 'weekdays';

COMMENT ON COLUMN tenants.schedule_mode IS 'weekdays — по дням недели; every_n_days — каждые N календарных дней от anchor';

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS every_n_days INTEGER NOT NULL DEFAULT 1;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS every_n_days_anchor DATE;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS site_content JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tenants.site_content IS 'Тексты и блоки главной (hero, секции, преимущества)';

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS contact_json JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tenants.contact_json IS 'Контакты для футера: phones[], telegram, whatsapp, instagram, address';

-- Фото услуг (загрузка из бота → public URL)
-- Бакет в Storage: service-photos (публичный), путь: {tenant_id}/{service_id}.webp
