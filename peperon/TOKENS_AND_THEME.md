# Токены дизайна и тема

## CSS-переменные (`:root`)

Задаются в `frontend/src/index.css`, **перезаписываются из API** при загрузке салона (см. `useTenant.ts`).

| Переменная | Назначение |
|------------|------------|
| `--color-primary` | Основной акцент (кнопки, ссылки) |
| `--color-accent` | Второй акцент (цены, часть CTA) |
| `--color-bg` | Фон страницы |
| `--color-text` | Основной текст |
| `--color-primary-20` | Обводка фокуса / лёгкий фон (primary + `33` в hex) |
| `--color-primary-40` | Выделение, selection (primary + `66`) |
| `--color-bg-card` | Фон карточек (bg + `cc`) |
| `--color-bg-glass` | Стекло (bg + `80`) |

Значения по умолчанию (до загрузки tenant) в `index.css`: тёмный фон `#0f172a`, primary фиолетовый `#8b5cf6`, accent янтарный `#f59e0b`.

## Откуда берутся цвета в проде

В базе у каждого салона поля `color_primary`, `color_accent`, `color_bg`, `color_text` (HEX).  
`applyTheme` в `useTenant.ts` выставляет переменные и **сам считает** производные (`+33`, `+66`, `+cc`, `+80` к hex — это альфа в конце строки).

Если меняешь логику «нежности», имеет смысл подправить и эту функцию (например другие оттенки для glass).

## Шрифт

Подключение в `frontend/index.html`:

- Google Fonts: **Inter** (400–800).

Тело: `font-family: "Inter", -apple-system, ...` в `index.css`.

## Утилита `.glass`

Класс в `index.css`: полупрозрачный фон, blur, светлая обводка — основа «glassmorphism» карточек в компонентах.

## Анимации (ключевые имена)

В `index.css`: `bounceIn`, `fadeIn`, `fadeSlideUp`, `fadeSlideDown`, `float`, `drawLine`, `shimmer`, скелетон `.skeleton`.

При смене визуала на более мягкий часто **смягчают** длительности и кривые `ease`, уменьшают амплитуду `float`.
