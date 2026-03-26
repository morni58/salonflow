-- SalonFlow: роль manager, агрегат выручки после очистки CRM (после 001–004)

-- Роль «менеджер» (CRM, без полного доступа к сайту)
DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE 'manager';
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$$;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS crm_completed_revenue_retained BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN tenants.crm_completed_revenue_retained IS
  'Сумма (тиыны) выполненных записей, удалённых из CRM по политике хранения 7 дней';
