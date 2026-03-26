-- SalonFlow: мастера, расписание по мастеру, запись к мастеру (после 002)

CREATE TABLE masters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    title TEXT,
    bio TEXT,
    photo_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_bookable BOOLEAN NOT NULL DEFAULT TRUE,
    working_days JSONB DEFAULT '[0,1,2,3,4,5,6]'::jsonb,
    schedule_mode TEXT NOT NULL DEFAULT 'weekdays',
    every_n_days INTEGER NOT NULL DEFAULT 1,
    every_n_days_anchor DATE,
    working_hours_start TIME NOT NULL DEFAULT '10:00',
    working_hours_end TIME NOT NULL DEFAULT '20:00',
    slot_interval_minutes INTEGER,
    buffer_minutes INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_masters_tenant ON masters(tenant_id);
CREATE INDEX idx_masters_user ON masters(user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE masters IS 'Публичные профили мастеров + их график; user_id — привязка к Telegram для бота';

CREATE TABLE master_schedule_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    master_id UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT TRUE,
    custom_start TIME,
    custom_end TIME,
    UNIQUE(master_id, date)
);

CREATE INDEX idx_mse_master ON master_schedule_exceptions(master_id);

CREATE TABLE service_masters (
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    master_id UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
    PRIMARY KEY (service_id, master_id)
);

CREATE INDEX idx_sm_master ON service_masters(master_id);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS master_id UUID REFERENCES masters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_master ON bookings(master_id) WHERE master_id IS NOT NULL;

COMMENT ON COLUMN bookings.master_id IS 'Выбранный мастер; NULL — старые записи до миграции';
