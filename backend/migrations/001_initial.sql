-- SalonFlow: Initial Migration
-- Run this in Supabase SQL Editor

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'master');
CREATE TYPE contact_type AS ENUM ('telegram', 'whatsapp', 'instagram', 'phone');
CREATE TYPE booking_status AS ENUM ('pending', 'waiting', 'confirmed', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'refunded');
CREATE TYPE booking_source AS ENUM ('online', 'offline');
CREATE TYPE analytics_event AS ENUM ('visit', 'catalog_view', 'cart_open', 'checkout');

-- ============================================================
-- TABLES
-- ============================================================

-- Tenants (каждый бизнес-клиент)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    subdomain TEXT NOT NULL UNIQUE,
    custom_domain TEXT UNIQUE,
    logo_url TEXT,
    color_primary TEXT NOT NULL DEFAULT '#6366f1',
    color_accent TEXT NOT NULL DEFAULT '#f59e0b',
    color_bg TEXT NOT NULL DEFAULT '#0f172a',
    color_text TEXT NOT NULL DEFAULT '#f8fafc',
    timezone TEXT NOT NULL DEFAULT 'Asia/Almaty',
    working_hours_start TIME NOT NULL DEFAULT '10:00',
    working_hours_end TIME NOT NULL DEFAULT '20:00',
    slot_interval_minutes INTEGER NOT NULL DEFAULT 60,
    buffer_minutes INTEGER NOT NULL DEFAULT 15,
    bot_token_encrypted TEXT,
    groq_api_keys TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_custom_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL;

-- Users (владельцы, админы, мастера)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,
    role user_role NOT NULL DEFAULT 'admin',
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, telegram_user_id)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_tg ON users(telegram_user_id);

-- Categories (категории услуг)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_categories_tenant ON categories(tenant_id);

-- Services (услуги)
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price INTEGER NOT NULL, -- в тиынах (1₸ = 100 тиын) для точности
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    photo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_services_tenant ON services(tenant_id);
CREATE INDEX idx_services_category ON services(category_id);

-- Clients (клиенты бизнеса)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_type contact_type NOT NULL,
    contact_value TEXT NOT NULL,
    visit_count INTEGER NOT NULL DEFAULT 0,
    total_spent INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    first_visit TIMESTAMPTZ,
    last_visit TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, contact_type, contact_value)
);

CREATE INDEX idx_clients_tenant ON clients(tenant_id);
CREATE INDEX idx_clients_contact ON clients(tenant_id, contact_type, contact_value);

-- Bookings (записи/заявки)
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    service_ids UUID[] NOT NULL DEFAULT '{}',
    total_price INTEGER NOT NULL DEFAULT 0,
    total_duration_minutes INTEGER NOT NULL DEFAULT 0,
    preferred_datetime TIMESTAMPTZ NOT NULL,
    status booking_status NOT NULL DEFAULT 'pending',
    payment_status payment_status NOT NULL DEFAULT 'unpaid',
    source booking_source NOT NULL DEFAULT 'online',
    ai_chat_summary TEXT,
    waiting_expires_at TIMESTAMPTZ,
    reminder_24h_sent BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_2h_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_tenant ON bookings(tenant_id);
CREATE INDEX idx_bookings_status ON bookings(tenant_id, status);
CREATE INDEX idx_bookings_datetime ON bookings(tenant_id, preferred_datetime);
CREATE INDEX idx_bookings_waiting ON bookings(status, waiting_expires_at) WHERE status = 'waiting';

-- Portfolio (фото работ)
CREATE TABLE portfolio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portfolio_tenant ON portfolio(tenant_id);

-- Reviews (скриншоты отзывов)
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_tenant ON reviews(tenant_id);

-- Schedule Exceptions (закрытые дни, кастомные часы)
CREATE TABLE schedule_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT TRUE,
    custom_start TIME,
    custom_end TIME,
    UNIQUE(tenant_id, date)
);

CREATE INDEX idx_schedule_tenant ON schedule_exceptions(tenant_id);

-- Analytics (события на сайте)
CREATE TABLE analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type analytics_event NOT NULL,
    session_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_tenant ON analytics(tenant_id);
CREATE INDEX idx_analytics_created ON analytics(tenant_id, created_at);

-- Chat Logs (логи чата с AI-виджетом)
CREATE TABLE chat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL UNIQUE,
    messages JSONB NOT NULL DEFAULT '[]',
    has_alert BOOLEAN NOT NULL DEFAULT FALSE,
    ai_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_logs_tenant ON chat_logs(tenant_id);
CREATE INDEX idx_chat_logs_session ON chat_logs(session_id);

-- FAQ (для fallback чата без LLM)
CREATE TABLE faq (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL
);

CREATE INDEX idx_faq_tenant ON faq(tenant_id);

-- Audit Log (лог изменений через NLP)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    diff_before JSONB,
    diff_after JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_log(tenant_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at on bookings
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Service role bypass (для FastAPI через service_role key)
-- Supabase service_role автоматически обходит RLS

-- ============================================================
-- SEED DATA (тестовый tenant)
-- ============================================================
INSERT INTO tenants (name, subdomain, color_primary, color_accent, color_bg, color_text, working_hours_start, working_hours_end, slot_interval_minutes, buffer_minutes)
VALUES ('Demo Beauty Studio', 'demo', '#8b5cf6', '#f59e0b', '#0f172a', '#f8fafc', '10:00', '20:00', 60, 15);

-- Тестовые категории
INSERT INTO categories (tenant_id, name, sort_order) VALUES
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), 'Волосы', 1),
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), 'Ногти', 2),
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), 'Лицо', 3);

-- Тестовые услуги (цены в тиынах: 500000 = 5000₸)
INSERT INTO services (tenant_id, category_id, name, price, duration_minutes) VALUES
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), (SELECT id FROM categories WHERE name = 'Волосы' LIMIT 1), 'Мужская стрижка', 500000, 45),
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), (SELECT id FROM categories WHERE name = 'Волосы' LIMIT 1), 'Женская стрижка', 800000, 60),
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), (SELECT id FROM categories WHERE name = 'Волосы' LIMIT 1), 'Окрашивание', 1500000, 120),
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), (SELECT id FROM categories WHERE name = 'Волосы' LIMIT 1), 'Укладка', 400000, 30),
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), (SELECT id FROM categories WHERE name = 'Ногти' LIMIT 1), 'Маникюр', 700000, 60),
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), (SELECT id FROM categories WHERE name = 'Ногти' LIMIT 1), 'Педикюр', 900000, 75),
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), (SELECT id FROM categories WHERE name = 'Ногти' LIMIT 1), 'Наращивание ногтей', 1200000, 120),
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), (SELECT id FROM categories WHERE name = 'Лицо' LIMIT 1), 'Чистка лица', 1000000, 90),
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), (SELECT id FROM categories WHERE name = 'Лицо' LIMIT 1), 'Пилинг', 800000, 60),
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), (SELECT id FROM categories WHERE name = 'Лицо' LIMIT 1), 'Массаж лица', 600000, 45);

-- Тестовые FAQ
INSERT INTO faq (tenant_id, question, answer) VALUES
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), 'Как записаться?', 'Выберите услуги, добавьте в корзину, укажите удобное время и оставьте контакт. Мы свяжемся с вами для подтверждения.'),
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), 'Какие способы оплаты?', 'Принимаем Kaspi перевод, наличные. Предоплата обсуждается с администратором.'),
    ((SELECT id FROM tenants WHERE subdomain = 'demo'), 'Можно ли отменить запись?', 'Да, свяжитесь с нами минимум за 4 часа до визита.');
