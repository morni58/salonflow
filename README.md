# SalonFlow

Multi-tenant платформа для сервисных бизнесов. Один деплой — бесконечные клиенты.

```
React SPA (Netlify) → FastAPI + aiogram (Railway) → PostgreSQL (Supabase)
```

## Структура

```
salonflow/
├── backend/                    # Python 3.12
│   ├── app/
│   │   ├── api/routes/         # FastAPI endpoints
│   │   ├── bot/handlers/       # Telegram bot handlers
│   │   ├── core/               # Config, DB, scheduler
│   │   ├── models/             # Pydantic schemas
│   │   └── services/           # Business logic
│   ├── migrations/             # SQL миграции
│   ├── scripts/                # Onboarding CLI
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                   # React 19 + Vite 6 + Tailwind v4
│   ├── src/
│   │   ├── api/                # API client
│   │   ├── components/         # UI компоненты
│   │   ├── hooks/              # useTenant, useSession
│   │   ├── store/              # Cart context
│   │   └── types/              # TypeScript типы
│   ├── netlify.toml
│   └── package.json
└── README.md
```

## Быстрый старт

### 1. Supabase

1. Создать проект на [supabase.com](https://supabase.com)
2. Выполнить `backend/migrations/001_initial.sql` в SQL Editor
3. Создать Storage бакеты: `portfolio`, `reviews`, `logos` (публичные)

### 2. Backend

```bash
cd backend
cp .env.example .env
# Заполнить SUPABASE_URL и SUPABASE_KEY (service_role)

pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Откроется на localhost:5173
# Vite проксирует /api/* на localhost:8000
```

### 4. Добавить нового клиента

```bash
cd backend
python scripts/onboard.py
```

## Деплой

### Netlify (фронт)

1. Push `frontend/` в GitHub
2. Подключить к Netlify
3. Wildcard DNS: `*.salonflow.kz → Netlify`
4. Domain aliases для каждого tenant

### Railway (бэкенд)

1. Push `backend/` в GitHub
2. Подключить к Railway
3. ENV: `SUPABASE_URL`, `SUPABASE_KEY`, `BASE_URL`
4. Один контейнер обслуживает всех

## Архитектура

- **Multi-tenant**: данные разделены по `tenant_id`, Supabase RLS
- **RBAC**: owner / admin / master
- **AI**: Groq (Llama 3.3 70B), 3 ключа с ротацией, FAQ fallback
- **Cron**: утренний бриф, еженедельная аналитика, очистка expired, напоминания
- **Темизация**: CSS-переменные, один HEX — весь сайт перекрашивается

## API Endpoints

| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/health` | Health check |
| GET | `/api/tenant?subdomain=xxx` | Настройки tenant |
| GET | `/api/catalog?tenant_id=xxx` | Каталог услуг |
| GET | `/api/slots?tenant_id=xxx&date=YYYY-MM-DD` | Свободные слоты |
| POST | `/api/booking` | Создать заявку |
| POST | `/api/chat` | AI-чат (SSE) |
| POST | `/api/analytics` | Трекинг событий |
| GET | `/api/portfolio?tenant_id=xxx` | Портфолио |
| GET | `/api/reviews?tenant_id=xxx` | Отзывы |
| POST | `/api/webhook/tg/{tenant_id}` | Telegram webhook |
