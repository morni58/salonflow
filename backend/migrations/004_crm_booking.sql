-- CRM: метки времени по воронке заявок (после 001–003)

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.accepted_at IS 'Когда заявку приняли (статус confirmed)';
COMMENT ON COLUMN bookings.completed_at IS 'Когда визит завершён; для отчётов и политики хранения';

CREATE INDEX IF NOT EXISTS idx_bookings_completed ON bookings(tenant_id, completed_at) WHERE status = 'completed';
