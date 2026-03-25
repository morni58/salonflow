# SalonFlow — Первый запуск (пошагово)

## Шаг 1: Supabase (5 минут)

1. Зайди на https://supabase.com → Create Project
2. Запиши:
   - Project URL: `https://xxxxx.supabase.co`
   - Service Role Key (Settings → API → `service_role` — НЕ anon!)
3. Открой SQL Editor → вставь всё содержимое `backend/migrations/001_initial.sql` → Run
4. Storage → Create bucket `portfolio` (Public: ON)
5. Storage → Create bucket `reviews` (Public: ON)
6. Storage → Create bucket `logos` (Public: ON)

## Шаг 2: Backend (5 минут)

```bash
cd backend

# Создай .env
cp .env.example .env

# Заполни .env:
# SUPABASE_URL=https://xxxxx.supabase.co
# SUPABASE_KEY=eyJhbGci... (service_role key)
# BASE_URL=http://localhost:8000
# ENCRYPTION_KEY=просто-любая-строка-для-dev

# Установи зависимости
pip install -r requirements.txt

# Запусти
python -m uvicorn app.main:app --reload --port 8000
```

Должен увидеть:
```
INFO: Started server process
INFO: Waiting for application startup
INFO: Scheduler started with 4 jobs
INFO: Application startup complete
```

Проверь: http://localhost:8000/api/health → `{"status":"ok","service":"salonflow-api"}`
Проверь: http://localhost:8000/api/tenant?subdomain=demo → JSON с данными Demo Beauty Studio

## Шаг 3: Frontend (3 минуты)

```bash
cd frontend

npm install
npm run dev
```

Открой http://localhost:5173 → должен увидеть сайт Demo Beauty Studio

## Шаг 4: Проверь полный цикл

1. Открой сайт → Каталог загрузился с 10 услугами
2. Добавь "Мужская стрижка" в корзину → toast "Мужская стрижка добавлено в корзину"
3. Открой корзину → цена и время правильные
4. Нажми "Оформить запись"
5. Заполни: имя, выбери Telegram, введи @test
6. Выбери дату → должны появиться слоты (10:00, 11:00, ..., 19:00)
7. Выбери время → нажми "Отправить заявку"
8. Должен увидеть "Заявка отправлена!"

Проверь в Supabase: Table Editor → bookings → новая запись с status=pending

## Шаг 5: Подключи бота (если есть токен)

1. В Supabase → Table Editor → tenants → обнови тестовый tenant:
   - `bot_token_encrypted`: твой токен от @BotFather
   - `groq_api_keys`: `{ключ1,ключ2,ключ3}` (формат PostgreSQL массива)
2. В таблицу `users` добавь запись:
   - `tenant_id`: ID из tenants
   - `telegram_user_id`: твой Telegram ID (узнай через @userinfobot)
   - `role`: owner
   - `name`: твоё имя
3. Перезапусти бэкенд
4. Напиши боту /start

---

## Типичные ошибки при первом запуске

### `ModuleNotFoundError: No module named 'app'`
Запускай из папки `backend/`:
```bash
cd backend
python -m uvicorn app.main:app --reload
```

### `relation "tenants" does not exist`
SQL миграция не выполнена. Вставь `001_initial.sql` в Supabase SQL Editor.

### Фронт показывает "Салон не найден"
API не доступен. Проверь что бэкенд запущен на порту 8000 и Vite proxy работает.

### `CORS error` в браузере
Проверь что в `app/main.py` в `allow_origins` есть `http://localhost:5173`

### Бот не отвечает на /start
- Проверь что `bot_token_encrypted` правильный в таблице `tenants`
- Проверь что ты добавлен в таблицу `users` с правильным `telegram_user_id`
- Проверь логи бэкенда на ошибки

### `supabase.PostgrestAPIError` с `.is_()` 
Замени `.is_("deleted_at", "null")` на:
```python
.filter("deleted_at", "is", "null")
```

### Слоты не появляются
Проверь что в таблице `tenants` рабочие часы заполнены (10:00 - 20:00) и дата не закрыта в `schedule_exceptions`.
