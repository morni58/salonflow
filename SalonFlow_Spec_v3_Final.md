# SalonFlow — Полная спецификация продукта (v3.0 Final)

> Финальная версия, отражающая реально написанный код. 77 файлов, полный стек.

---

## Концепция

Премиальная multi-tenant платформа для сервисных бизнесов (салоны красоты, косметология, стоматология, барбершопы). Единая кодовая база, единый деплой. Каждый новый клиент — это строка в БД и поддомен, а не копия репозитория.

Клиент заходит на сайт → видит каталог услуг → собирает корзину → общается с AI-консультантом → оставляет заявку с контактом → админ получает уведомление в Telegram → связывается с клиентом → получает предоплату → подтверждает запись → после визита отмечает "Завершён" → CRM обновляется.

---

## Стек и деплой

| Слой | Технология | Хостинг |
|------|-----------|---------|
| Frontend | React 19 + Vite 6 + TailwindCSS v4 + PWA | **Netlify** (статика + CDN + proxy) |
| API | FastAPI (Python 3.12) | **Railway / Render** (один контейнер) |
| Telegram-бот | aiogram 3.5+ (Python 3.12) | **Тот же контейнер** что и API |
| Cron-задачи | APScheduler | **Тот же контейнер** |
| БД | PostgreSQL | **Supabase** (managed + RLS) |
| Файлы | Supabase Storage | **Supabase** (CDN для картинок) |
| LLM | Llama 3.3 70B | **Groq API** (3 ключа с ротацией) |
| Шифрование | Fernet (cryptography) | Токены ботов зашифрованы в БД |

### Связка Netlify ↔ Backend

Фронт на Netlify НЕ знает адрес бэкенда. Используется проксирование:

```toml
# netlify.toml — Netlify обрабатывает сверху вниз
[[redirects]]
  from = "/api/*"
  to = "https://salonflow-api.railway.app/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Фронт делает запрос на `/api/catalog` → Netlify прозрачно проксирует на Railway → ответ клиенту. Никаких CORS-проблем. Для пользователя — один домен.

Дополнительно: заголовки безопасности (X-Frame-Options, X-Content-Type-Options), immutable cache на `/assets/*`, кэш шрифтов.

---

## Архитектура: Multi-Tenant

### Поддомены

Один Netlify-деплой обслуживает всех клиентов через wildcard DNS:

```
studio-anna.salonflow.kz  →  тот же Netlify-сайт
barber-max.salonflow.kz   →  тот же Netlify-сайт
```

1. DNS: `*.salonflow.kz → Netlify`
2. Netlify: wildcard domain alias
3. SSL: автоматический Let's Encrypt
4. Фронт при загрузке: `window.location.hostname.split('.')[0]` → запрос `/api/tenant?subdomain=xxx` → получает настройки → рендерит

Для премиум-клиентов: кастомный домен (напр. `anna-beauty.kz`) через маппинг в БД по hostname.

### Ролевая модель (RBAC)

| Роль | Доступ |
|------|--------|
| `owner` | Всё: аналитика, финансы, NLP-команды, персонал |
| `admin` | Каталог, расписание, заявки, портфолио, отзывы, клиенты |
| `master` | Только свои записи и личное расписание |

Привязка ролей к Telegram user ID. Проверка на уровне бота (middleware `_get_user_tenant`).

### Безопасность

- **API proxy**: фронт → Netlify → FastAPI, бэкенд принимает только от разрешённых origins
- **Bot auth**: Telegram initData HMAC-валидация
- **Rate limiting**: slowapi, per-tenant — `/api/chat` (30/мин), `/api/booking` (10/мин)
- **Supabase RLS**: все таблицы фильтруются по `tenant_id`
- **Шифрование**: bot tokens зашифрованы через Fernet, расшифровываются в runtime
- **Soft delete**: все критичные сущности (услуги, категории) — поле `deleted_at` вместо физического удаления
- **Audit log**: NLP-команды логируются с полным diff (до/после)
- **Заголовки**: X-Frame-Options DENY, X-Content-Type-Options nosniff, strict Referrer-Policy

### Онбординг нового клиента

CLI-скрипт `scripts/onboard.py` — интерактивный:

1. Ввод: название, поддомен, токен бота, 3× Groq API key, цвета, рабочие часы, Telegram ID владельца
2. Скрипт автоматически:
   - Проверяет токен бота через Telegram API
   - Шифрует токен через Fernet
   - Создаёт запись в `tenants`
   - Создаёт owner в `users`
   - Создаёт дефолтные категории и FAQ
   - Настраивает webhook бота
   - Добавляет domain alias через Netlify API (если `NETLIFY_TOKEN` задан)
3. Время от старта до рабочего продукта: **< 15 минут**

---

## Модуль 1: Клиентский Web App (Netlify)

React 19 SPA с glassmorphism-дизайном. Все данные подтягиваются через API по `tenant_id`.

### 1.1 Загрузка и инициализация

1. `useTenant` hook: определяет subdomain из hostname
2. `GET /api/tenant?subdomain=xxx` → настройки (цвета, лого, часы)
3. CSS-переменные применяются динамически: `--color-primary`, `--color-accent`, `--color-bg`, `--color-text` + производные (`--color-primary-20`, `--color-primary-40`)
4. Динамически обновляются: `<title>`, Open Graph теги, theme-color
5. Параллельный запрос каталога

### 1.2 Hero-секция

- Полноэкранный герой с анимированными gradient orbs (CSS `@keyframes float`)
- Grid-паттерн с opacity 3% (тонкая текстура)
- Staggered fade-in текста (`fadeSlideUp` с разными delay)
- SVG-подчёркивание названия с анимацией отрисовки (`drawLine`)
- Бейдж "Онлайн-запись 24/7" с Sparkles иконкой
- CTA-кнопка "Выбрать услуги" с bounce-стрелкой → scroll до каталога

### 1.3 Каталог услуг

- Категории: горизонтальные табы-фильтры с active-стилем (primary цвет)
- Карточки: glassmorphism (bg-white/5, backdrop-blur-xl, border-white/10)
- Карточка содержит: фото (lazy loading), название, цена (accent цвет), длительность (Clock иконка), кнопка "Добавить"
- Анимация при добавлении: кнопка меняет цвет на зелёный + Check иконка с bounceIn
- Toast-уведомление: "Мужская стрижка добавлено в корзину"
- Skeleton loading при загрузке (shimmer анимация)
- Scroll-triggered появление через `AnimateIn` компонент (IntersectionObserver)

### 1.4 Корзина

- `CartProvider` (React Context + useReducer): add, remove, setQuantity, clear
- `CartIcon` — плавающая кнопка (fixed bottom-right) с бейджем количества, появляется когда `itemCount > 0`
- `CartDrawer` — выдвижная панель справа (translateX анимация):
  - Список услуг с +/- кнопками и удалением
  - Итоговая цена и общее время
  - Кнопка "Очистить"
  - Кнопка "Оформить запись" → переход на checkout

### 1.5 Оформление заявки (Checkout)

- **Имя**: текстовое поле
- **Мессенджер**: 4 кнопки-иконки (Telegram ✈️ / WhatsApp 💬 / Instagram 📸 / Телефон 📞) — при выборе placeholder поля подстраивается
- **Дата**: горизонтальный скроллер на 14 дней вперёд (день недели + число + месяц)
- **Время**: сетка слотов 4 в ряд, загружаются через `GET /api/slots` при выборе даты. Если день закрыт — "Нет доступных слотов"
- **Кнопка отправки**: disabled пока все поля не заполнены, меняется на "Отправка..." при submit
- **Успех**: экран с CheckCircle иконкой + "Заявка отправлена!" + "Мы свяжемся с вами через выбранный мессенджер" + кнопка "На главную"
- **Ошибка**: toast "Ошибка при отправке. Попробуйте ещё раз."
- Трекинг события `checkout` при успешной отправке

### 1.6 Портфолио

- Фотографии работ, подгруженные из Supabase Storage
- Фильтрация по категориям (табы аналогичные каталогу)
- Grid-сетка 2×N (mobile) / 3×N (desktop)
- Lightbox при клике: полноэкранный просмотр на тёмном фоне, закрытие по клику вне

### 1.7 Отзывы

- Горизонтальная карусель скриншотов (overflow-x-auto, snap scroll)
- Фиксированная высота карточек (h-72, w-52)
- Lightbox с навигацией (ChevronLeft / ChevronRight)

### 1.8 AI-Консультант (Chat Widget)

- Плавающая кнопка (accent цвет, bottom-right, z-30)
- Окно чата (360×500px, fixed):
  - Header с Bot иконкой, названием, счётчиком оставшихся сообщений
  - Область сообщений: user (primary) справа, assistant (glass) слева, автоскролл
  - Стриминг ответа через SSE (посимвольное появление)
  - Пустое состояние: "Привет! Задайте вопрос об услугах..."
  - Input field + Send кнопка, disabled при streaming
  - Индикатор "●●●" пока ответ стримится

**Fallback**: если SSE обрезается Netlify proxy → автоматическое переключение на `POST /api/chat/sync` (non-streaming)

**Лимит**: 15 сообщений на сессию. После лимита — input заблокирован, текст "Лимит сообщений исчерпан"

### 1.9 PWA

- `vite-plugin-pwa`: manifest.json, service worker, auto-update
- Иконки: 192×192 и 512×512 (maskable)
- Standalone display mode
- Workbox: кэш статики (globPatterns), NetworkFirst для `/api/*` с TTL 5 мин

### 1.10 Темизация

CSS-переменные на `:root`, устанавливаемые JavaScript при загрузке tenant:

```
--color-primary     (основной цвет кнопок, ссылок)
--color-accent      (цена, CTA-элементы)
--color-bg          (фон страницы)
--color-text        (цвет текста)
--color-primary-20  (primary + 20% opacity, для фонов)
--color-primary-40  (primary + 40% opacity, для теней)
--color-bg-card     (фон карточек)
--color-bg-glass    (glassmorphism фон)
```

Для нового клиента: один HEX-код в настройках → весь сайт перекрашивается.

### 1.11 Аналитика

- Session ID: UUID, генерируется в React state при загрузке
- События: `visit` (при загрузке, deduplicated), `catalog_view`, `cart_open`, `checkout`
- POST `/api/analytics` fire-and-forget

### 1.12 SEO и метатеги

- Open Graph: og:title, og:description, og:image — динамически обновляются per tenant
- Twitter Card: summary_large_image
- theme-color: из tenant settings
- favicon.svg (SVG-иконка салона)
- robots.txt: Allow all

### 1.13 UX-компоненты

- `AnimateIn` — scroll-triggered fade-in (IntersectionObserver, одноразовый, настраиваемый delay)
- `ErrorBoundary` — перехват React ошибок с кнопкой "Попробовать снова"
- `ToastProvider` — toast-уведомления через sonner (dark glass стиль, top-center)
- `Header` — sticky, backdrop-blur, десктоп-навигация + мобильный бургер-меню (Menu/X toggle)
- Loading screen — двойной спиннер (primary + accent, вращающиеся в разные стороны)
- Error screen — emoji + сообщение + "Обновить страницу"

---

## Модуль 2: Командный центр (Telegram-бот)

Один aiogram 3.5+ процесс обслуживает всех tenant'ов. Webhook-режим.

### 2.1 Авторизация

- `/start` → проверка `telegram_user_id` в таблице `users`
- Если найден: приветствие с именем tenant + роль + главное меню
- Если не найден: "У вас нет доступа"
- Главное меню (inline-кнопки): Заявки, Каталог, Расписание, Портфолио, Отзывы, Оффлайн-запись, Клиенты. Owner дополнительно видит: Аналитика

### 2.2 CRM-уведомления о заявках

При оформлении заявки на сайте бот мгновенно шлёт:

```
📋 Новая заявка

👤 Анна Ким
📱 Telegram: @anna_kim (активная ссылка)
💇 Услуги:
  • Стрижка
  • Окрашивание
💰 Итого: 15 000₸
🕐 23.03.2026, 14:00
⏱ 2ч 30мин

⚡ Постоянный клиент!
  Визитов: 5 | Средний чек: 8 500₸
  📝 Аллергия на аммиак

💬 AI-выжимка:
«Клиент интересовалась балаяжем, настроена позитивно.»

[✅ Оплатил] [❌ Не оплатил]
[⏳ Ожидание] [📅 Перенести]
```

**Логика кнопок:**

| Кнопка | Действие | Статус |
|--------|----------|--------|
| ✅ Оплатил | Запись подтверждена + показывается кнопка "✔️ Визит завершён" | `confirmed` |
| ❌ Не оплатил | Слот освобождается | `cancelled` |
| ⏳ Ожидание | Автоудаление через 48 часов | `waiting` |
| 📅 Перенести | Бот просит новую дату/время | — |
| ✔️ Визит завершён | CRM обновляется (visit_count++, total_spent+=, last_visit=now) | `completed` |

**Контакты форматируются как кликабельные ссылки:**
- Telegram: `https://t.me/username`
- WhatsApp: `https://wa.me/77071234567`
- Instagram: `https://instagram.com/username`

### 2.3 Напоминания

Бот отправляет **админу/владельцу** (не клиенту):

- **За 24 часа**: список завтрашних записей + контакты + ожидаемая выручка
- **За 2 часа**: конкретная запись "Через 2 часа: 14:00 — Анна Ким — 15 000₸"
- Флаги `reminder_24h_sent` / `reminder_2h_sent` предотвращают повторную отправку

### 2.4 Мини-CRM

- **Автообогащение заявок**: при повторной заявке бот показывает историю (визиты, средний чек, заметки)
- **Поиск клиентов**: inline-кнопка → ввод имени/контакта → карточка клиента
- **Топ-10 клиентов**: сортировка по total_spent
- **Заметки**: `cl:note:{id}` → ввод текста → сохранение (append к существующим)
- **Данные**: visit_count, total_spent, notes, first_visit, last_visit — обновляются при `complete_booking`

### 2.5 Управление каталогом

- **Просмотр**: категории → услуги в категории (цена, длительность, статус)
- **Создание категории**: inline "Новая категория" → FSM → ввод названия → INSERT
- **Создание услуги**: "Новая услуга" → FSM → название → цена → длительность → INSERT
- **Редактирование цены**: выбрал услугу → "Изменить цену" → FSM → ввод числа → UPDATE
- **Скрыть/показать**: toggle `is_active`
- **Удаление**: soft delete (`deleted_at = now()`)

### 2.6 Управление расписанием

- **Закрыть день**: FSM → ввод даты ДД.ММ.ГГГГ → INSERT/UPDATE в `schedule_exceptions` (is_closed=true)
- **Открыть день**: показать закрытые дни → выбрать → soft reopen (is_closed=false)
- Буферное время и интервалы настраиваются в tenant settings

### 2.7 Портфолио

- **Загрузка**: отправить фото → выбрать категорию (inline-кнопки) → Pillow resize до 1200px + WebP → Supabase Storage → INSERT в БД
- **Удаление**: "Удалить фото" → список последних 10 → выбрать → удаление из Storage + DB

### 2.8 Отзывы

- **Загрузка**: отправить скриншот → Pillow resize + WebP → Storage → INSERT
- **Удаление**: "Удалить отзыв" → список последних 10 → выбрать → удаление из Storage + DB
- **Без AI-распознавания** — скриншоты как есть, просто и надёжно

### 2.9 Оффлайн-запись

FSM: `/book` → имя клиента → выбор услуги (inline из каталога) → дата/время (ДД.ММ.ГГГГ ЧЧ:ММ) → INSERT booking (source='offline', status='confirmed')

Слот блокируется в общем расписании. Клиент создаётся/находится по имени.

---

## Модуль 3: AI-Ассистент (Groq)

Все вызовы — Groq API, модель Llama 3.3 70B Versatile.

### 3.1 AI-Консультант на сайте

**Системный промпт** динамически генерируется из БД tenant:
- Название бизнеса
- Полный каталог с ценами и длительностями
- FAQ из таблицы `faq`
- Правила: дружелюбно, коротко, точные цифры, не выдумывать услуг

**Инфраструктура:**
- 3 Groq API ключа на tenant с ротацией при 429 (rate limit)
- Max 15 сообщений на session_id (счётчик в памяти)
- При исчерпании лимита / ошибке API: FAQ-режим (keyword matching без LLM)
- Max 3 параллельных запроса на tenant
- SSE стриминг через FastAPI → sse-starlette + `X-Accel-Buffering: no`
- Sync fallback endpoint `POST /api/chat/sync` для случаев когда SSE буферизируется

**Smart Alerts (слова-триггеры):**
Список: жалоба, переделайте, рекламация, вернуть деньги, возврат, острая боль, плохо, ужасно, обман, некачественно, испортили, complaint, refund

При срабатывании → 🚨 СРОЧНО уведомление владельцу с контекстом диалога.

**AI-выжимка:** при оформлении заявки — сохранённый диалог из `chat_logs` передаётся с уведомлением.

### 3.2 NLP-команды (свободный ввод)

Владелец пишет в боте произвольный текст → Groq парсит → JSON-массив действий.

**Доступные действия:**
1. `update_price` — изменение цены (абсолютная или дельта через `is_delta` флаг)
2. `close_day` — закрыть день
3. `close_morning` — закрыть утро
4. `open_day` — открыть день
5. `toggle_service` — скрыть/показать услугу

**Процесс:**
1. Текст → Groq (temperature 0.1 для точности) → JSON
2. Мэтчинг по имени услуги (substring, case-insensitive)
3. Бот показывает **превью**: "Я собираюсь: 1. Мужская стрижка: 5,000₸ → 7,000₸ ..."
4. Inline-кнопки [✅ Подтвердить] [❌ Отменить]
5. При подтверждении → выполнение → запись в `audit_log` с diff_before/diff_after
6. Отчёт об успешном выполнении

**Никаких изменений без подтверждения.**

### 3.3 Ежедневный утренний бриф (09:00 по времени tenant)

Автоматическое сообщение:
- Количество записей на сегодня
- Список клиентов с временем и услугами
- Ожидаемая выручка
- Заявки в статусе "Ожидание" (сколько осталось до 48ч)
- Заметки о клиентах (если есть, помечены ⚠️)

### 3.4 Еженедельная аналитика (воскресенье, 20:00)

Автоматическая сводка:

**Воронка** (с процентами и дельтами к прошлой неделе):
- Визиты сайта
- Открыли корзину
- Отправили заявку
- Подтверждено

**Метрики:**
- Выручка (с дельтой %)
- Средний чек (с дельтой %)
- Топ-услуга недели (название + количество записей)
- Клиентов: всего + новых + повторных

**AI-совет:** Groq анализирует цифры и генерирует 2-3 предложения конкретного совета по увеличению продаж (не общие фразы, а привязанные к данным).

### 3.5 Smart Alerts

| Триггер | Реакция |
|---------|---------|
| Негативные слова в чате на сайте | 🚨 СРОЧНО + контекст → владельцу |
| Постоянный клиент (visit_count ≥ 5) | ⭐ VIP-метка на заявке |
| Чек выше среднего × 2 | 💰 Метка крупного заказа |

---

## Модуль 4: Техническая база

### 4.1 Инфраструктура

```
┌─────────────────────────────────────────────────────┐
│                     КЛИЕНТ                           │
│              (браузер / PWA)                          │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│              NETLIFY (CDN + Proxy)                    │
│                                                       │
│  *.salonflow.kz → статика React SPA                  │
│  /api/* → proxy → Railway                             │
│  SSL, кэширование, security headers                  │
└──────────────────┬──────────────────────────────────┘
                   │ /api/*
                   ▼
┌─────────────────────────────────────────────────────┐
│        RAILWAY / RENDER (один контейнер)              │
│                                                       │
│  FastAPI (REST API) — 8 endpoints + health            │
│  aiogram 3.5+ (Telegram Bot) — webhook mode           │
│  APScheduler — 4 cron jobs                            │
│  Rate Limiting (slowapi)                              │
│  Fernet encryption для токенов                        │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│                   SUPABASE                            │
│                                                       │
│  PostgreSQL — 13 таблиц, RLS по tenant_id             │
│  Storage — 3 бакета (portfolio, reviews, logos)       │
│  Daily Backups                                        │
└─────────────────────────────────────────────────────┘
```

### 4.2 API Endpoints

| Method | Path | Rate Limit | Описание |
|--------|------|-----------|----------|
| GET | `/api/health` | — | Health check |
| GET | `/api/tenant?subdomain=xxx` | — | Настройки tenant (цвета, лого, часы) |
| GET | `/api/catalog?tenant_id=xxx` | — | Категории + услуги |
| GET | `/api/slots?tenant_id=xxx&date=YYYY-MM-DD` | — | Свободные слоты |
| POST | `/api/booking` | 10/мин | Создать заявку |
| POST | `/api/chat` | 30/мин | AI-чат (SSE stream) |
| POST | `/api/chat/sync` | 30/мин | AI-чат (fallback, non-streaming) |
| POST | `/api/analytics` | — | Трекинг событий |
| GET | `/api/portfolio?tenant_id=xxx` | — | Фото портфолио по категориям |
| GET | `/api/reviews?tenant_id=xxx` | — | Скриншоты отзывов |
| POST | `/api/webhook/tg/{tenant_id}` | — | Telegram webhook |

### 4.3 База данных (13 таблиц)

**`tenants`** — бизнес-клиенты
- id (UUID), name, subdomain (UNIQUE), custom_domain (UNIQUE, nullable)
- logo_url, color_primary, color_accent, color_bg, color_text
- timezone (default Asia/Almaty), working_hours_start/end, slot_interval_minutes, buffer_minutes
- bot_token_encrypted (Fernet), groq_api_keys (text[])
- is_active, created_at

**`users`** — пользователи бота
- id, tenant_id (FK), telegram_user_id (BIGINT), role (enum), name
- UNIQUE(tenant_id, telegram_user_id)

**`categories`** — категории услуг
- id, tenant_id (FK), name, sort_order, is_active, deleted_at (soft delete)

**`services`** — услуги
- id, tenant_id (FK), category_id (FK), name, price (INT, в тиынах), duration_minutes, photo_url, is_active, deleted_at

**`clients`** — клиенты бизнеса (CRM)
- id, tenant_id (FK), name, contact_type (enum), contact_value
- visit_count, total_spent, notes, first_visit, last_visit
- UNIQUE(tenant_id, contact_type, contact_value)

**`bookings`** — записи/заявки
- id, tenant_id (FK), client_id (FK), service_ids (UUID[])
- total_price, total_duration_minutes, preferred_datetime
- status (enum: pending/waiting/confirmed/completed/cancelled)
- payment_status (enum: unpaid/paid/refunded)
- source (enum: online/offline), ai_chat_summary
- waiting_expires_at (для 48ч TTL), reminder_24h_sent, reminder_2h_sent
- created_at, updated_at (auto-trigger)

**`portfolio`** — фото работ
- id, tenant_id (FK), category_id (FK), image_url, created_at

**`reviews`** — скриншоты отзывов
- id, tenant_id (FK), image_url, created_at

**`schedule_exceptions`** — закрытые дни / кастомные часы
- id, tenant_id (FK), date, is_closed, custom_start, custom_end
- UNIQUE(tenant_id, date)

**`analytics`** — события на сайте
- id, tenant_id (FK), event_type (enum), session_id (UUID), created_at

**`chat_logs`** — логи AI-чата
- id, tenant_id (FK), session_id (UUID, UNIQUE), messages (JSONB), has_alert, ai_summary, created_at

**`faq`** — FAQ для fallback чата
- id, tenant_id (FK), question, answer

**`audit_log`** — лог NLP-изменений
- id, tenant_id (FK), user_id (FK), action_type, diff_before (JSONB), diff_after (JSONB), created_at

**Индексы:** на всех tenant_id, status, datetime, session_id. Partial index на waiting bookings.

**RLS:** включён на всех таблицах. Service role обходит RLS.

**Trigger:** `bookings.updated_at` автоматически обновляется при UPDATE.

### 4.4 Cron-задачи (APScheduler)

| Задача | Расписание | Действие |
|--------|-----------|----------|
| Утренний бриф | 09:00 ежедневно (UTC+5) | Список записей + выручка → всем admin/owner |
| Еженедельная аналитика | Вс 20:00 (UTC+5) | Воронка + дельты + топ-услуга + AI-совет → owner |
| Очистка expired waiting | Каждые 6 часов | `waiting` + expired → `cancelled` + уведомление |
| Напоминания | Каждый час | Проверка 24ч и 2ч записей → уведомление admin |

### 4.5 Файловое хранилище (Supabase Storage)

- Бакеты: `portfolio/{tenant_id}/`, `reviews/{tenant_id}/`, `logos/{tenant_id}/`
- Публичные URL через Supabase CDN
- При загрузке: Pillow resize до 1200px по длинной стороне → WebP (quality=85)
- При удалении: удаление из Storage + из БД

### 4.6 Бэкапы и Disaster Recovery

- Supabase daily backups (автоматические)
- Soft delete на categories, services (deleted_at)
- Soft close/open на schedule_exceptions (is_closed toggle)
- `audit_log` для всех NLP-изменений (полный diff)

---

## Структура проекта (77 файлов)

```
salonflow/
├── README.md                           # Обзор + API reference
├── QUICKSTART.md                       # Пошаговый запуск за 15 минут
│
├── backend/                            # Python 3.12
│   ├── Dockerfile                      # python:3.12-slim + Pillow + cryptography
│   ├── requirements.txt                # 14 зависимостей
│   ├── .env.example                    # Шаблон переменных
│   ├── .gitignore
│   │
│   ├── migrations/
│   │   └── 001_initial.sql             # 13 таблиц + enums + RLS + triggers + seed
│   │
│   ├── scripts/
│   │   └── onboard.py                  # CLI онбординг нового клиента
│   │
│   └── app/
│       ├── main.py                     # FastAPI + aiogram + CORS + rate limit + scheduler
│       │
│       ├── core/
│       │   ├── config.py               # Pydantic Settings из .env
│       │   ├── database.py             # Supabase singleton client
│       │   ├── tenant.py               # Tenant resolver (by subdomain/hostname/id)
│       │   ├── scheduler.py            # 4 cron jobs (brief/analytics/cleanup/reminders)
│       │   ├── rate_limit.py           # slowapi middleware (per-tenant key)
│       │   └── encryption.py           # Fernet encrypt/decrypt для bot tokens
│       │
│       ├── models/
│       │   └── schemas.py              # Все Pydantic модели (tenant/catalog/booking/chat/analytics)
│       │
│       ├── services/
│       │   ├── catalog.py              # Каталог: категории + услуги
│       │   ├── slots.py                # Расчёт свободных слотов (часы - записи - буфер - исключения)
│       │   ├── booking.py              # Создание/confirm/complete/cancel/waiting + CRM update
│       │   ├── chat.py                 # Groq SSE stream + key rotation + FAQ fallback + alerts
│       │   └── analytics.py            # Трекинг + weekly stats + top service + AI advice
│       │
│       ├── api/routes/
│       │   ├── tenant.py               # GET /api/tenant
│       │   ├── catalog.py              # GET /api/catalog
│       │   ├── slots.py                # GET /api/slots
│       │   ├── booking.py              # POST /api/booking (rate limited)
│       │   ├── chat.py                 # POST /api/chat (SSE) + /api/chat/sync (fallback)
│       │   ├── analytics.py            # POST /api/analytics
│       │   └── content.py              # GET /api/portfolio + /api/reviews
│       │
│       └── bot/
│           ├── setup.py                # Dispatcher с 7 роутерами + fallback NLP
│           ├── notifications.py        # Форматирование: заявки, алерты, бриф, аналитика
│           └── handlers/
│               ├── start.py            # /start + RBAC + главное меню
│               ├── booking_actions.py  # Inline: оплатил/отменил/ожидание/перенести/завершён
│               ├── catalog_mgmt.py     # CRUD категорий и услуг через FSM
│               ├── management.py       # Расписание + портфолио + отзывы + оффлайн-запись
│               ├── clients.py          # CRM: поиск, топ-10, заметки
│               └── nlp_commands.py     # NLP: Groq parse → preview → confirm → execute + audit
│
└── frontend/                           # React 19 + TypeScript
    ├── index.html                      # OG tags, favicon, fonts
    ├── netlify.toml                    # API proxy + SPA fallback + security headers + cache
    ├── package.json                    # react, lucide-react, sonner, vite-plugin-pwa
    ├── vite.config.ts                  # React + Tailwind v4 + PWA plugin
    ├── tsconfig.json
    ├── .gitignore
    │
    ├── public/
    │   ├── favicon.svg
    │   └── robots.txt
    │
    └── src/
        ├── main.tsx                    # Entry point
        ├── App.tsx                     # Root: CartProvider + ToastProvider + ErrorBoundary + Router
        ├── index.css                   # Tailwind v4 + CSS vars + animations (float, drawLine, shimmer, fadeSlide)
        ├── utils.ts                    # formatPrice, formatDuration, cn
        ├── vite-env.d.ts
        │
        ├── types/index.ts             # TypeScript типы (Tenant, Service, Category, Cart, Booking, Chat...)
        ├── api/client.ts              # Fetch wrapper + streamChat с SSE + sync fallback
        ├── store/cartStore.tsx         # Cart Context + Reducer (add/remove/setQty/clear)
        │
        ├── hooks/
        │   ├── useTenant.ts            # Resolve tenant by subdomain → apply CSS vars + OG tags
        │   ├── useSession.ts           # Generate sessionId + track analytics
        │   └── useInView.ts            # IntersectionObserver для scroll-анимаций
        │
        └── components/
            ├── layout/
            │   ├── Header.tsx          # Sticky header + mobile burger menu
            │   └── HeroSection.tsx     # Animated gradient orbs + staggered reveal + CTA
            │
            ├── catalog/
            │   ├── CatalogSection.tsx  # Fetch + filter + grid
            │   ├── CategoryFilter.tsx  # Horizontal tabs
            │   └── ServiceCard.tsx     # Glassmorphism card + add animation + toast
            │
            ├── cart/
            │   ├── CartIcon.tsx        # Floating badge button
            │   └── CartDrawer.tsx      # Slide-out panel + qty controls + checkout CTA
            │
            ├── checkout/
            │   └── CheckoutForm.tsx    # Name + messenger + date picker + time slots + submit
            │
            ├── chat/
            │   └── ChatWidget.tsx      # Floating chat + SSE streaming + message limit
            │
            ├── portfolio/
            │   └── PortfolioSection.tsx # Grid + category filter + lightbox
            │
            ├── reviews/
            │   └── ReviewsSection.tsx  # Horizontal carousel + lightbox with nav
            │
            └── common/
                ├── AnimateIn.tsx       # Scroll-triggered fade-in wrapper
                ├── ErrorBoundary.tsx   # Error catch + retry button
                └── Toast.tsx           # Sonner toasts (dark glass theme)
```

---

## Что НЕ входит (добавляется позже)

- Онлайн-оплата (Kaspi Pay API, ЮKassa) — пока ручная предоплата через мессенджер
- Автоматические напоминания клиентам — пока только админу
- Мультимодальность Groq (AI-Vision) — пока скриншоты как картинки
- Многоязычность интерфейса
- Интеграция с Google/Apple Calendar
- Программа лояльности / скидочные купоны
- Тёмная/светлая тема (toggle)
- Мобильное приложение (PWA закрывает потребность)
