-- SalonFlow Migration 007: колонки добавленные в разработке (после 001–006)
-- Выполнить в Supabase SQL Editor

-- 1. booking_code — короткий читаемый код записи вида "SF-A3K9B2"
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_code TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_code ON bookings(booking_code) WHERE booking_code IS NOT NULL;

COMMENT ON COLUMN bookings.booking_code IS 'Короткий код записи: SF-XXXXXX, показывается клиенту и в боте';

-- 2. pending_expires_at — время истечения заявки в статусе "pending"
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pending_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.pending_expires_at IS 'Если запись в статусе pending и текущее время > pending_expires_at — авто-отмена';

-- 3. experience — стаж мастера (строка, например "3 года")
ALTER TABLE masters
  ADD COLUMN IF NOT EXISTS experience TEXT;

COMMENT ON COLUMN masters.experience IS 'Стаж/опыт мастера — отображается на карточке мастера на сайте';

-- 4. slot_overrides — заблокированные слоты (выходные, занятые часы)
CREATE TABLE IF NOT EXISTS slot_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    master_id UUID REFERENCES masters(id) ON DELETE CASCADE,
    slot_date DATE NOT NULL,
    slot_time TIME NOT NULL,
    is_blocked BOOLEAN NOT NULL DEFAULT TRUE,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slot_overrides_tenant ON slot_overrides(tenant_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_slot_overrides_master ON slot_overrides(master_id, slot_date) WHERE master_id IS NOT NULL;

COMMENT ON TABLE slot_overrides IS 'Заблокированные слоты: мастер занят, технический перерыв и т.д.';
