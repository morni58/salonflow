# Карта интерфейса (файлы компонентов)

Корень приложения: `frontend/src/App.tsx` (загрузка, ошибка «Салон не найден», переключение home / checkout).

| Зона экрана | Файл | За что отвечает |
|-------------|------|------------------|
| Шапка, меню | `frontend/src/components/layout/Header.tsx` | Логотип/название, навигация, бургер |
| Герой, градиенты, CTA | `frontend/src/components/layout/HeroSection.tsx` | Первый экран, орбы, подчёркивание заголовка |
| Каталог | `frontend/src/components/catalog/CatalogSection.tsx` | Сетка услуг |
| Фильтр категорий | `frontend/src/components/catalog/CategoryFilter.tsx` | Табы категорий |
| Карточка услуги | `frontend/src/components/catalog/ServiceCard.tsx` | Glass-карточка, цена, кнопка «Добавить» |
| Корзина (кнопка) | `frontend/src/components/cart/CartIcon.tsx` | Плавающая иконка |
| Корзина (панель) | `frontend/src/components/cart/CartDrawer.tsx` | Выдвижная панель |
| Оформление | `frontend/src/components/checkout/CheckoutForm.tsx` | Имя, мессенджер, дата, слоты |
| Чат AI | `frontend/src/components/chat/ChatWidget.tsx` | Виджет чата |
| Портфолио | `frontend/src/components/portfolio/PortfolioSection.tsx` | Сетка фото |
| Отзывы | `frontend/src/components/reviews/ReviewsSection.tsx` | Карусель |
| Анимация по скроллу | `frontend/src/components/common/AnimateIn.tsx` | Появление блоков |
| Ошибки React | `frontend/src/components/common/ErrorBoundary.tsx` | Fallback UI |
| Тосты | `frontend/src/components/common/Toast.tsx` | Уведомления (sonner) |

API и данные: `frontend/src/api/client.ts`  
Утилиты классов: `frontend/src/utils.ts`

## Статика (иконки, PWA)

- `frontend/public/favicon.svg`
- `frontend/public/robots.txt`
- Иконки PWA в `public/` (если есть `icon-192.png`, `icon-512.png`)
