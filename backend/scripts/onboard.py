#!/usr/bin/env python3
"""
SalonFlow — Onboarding Script
Adds a new tenant (business client) to the platform.

Usage:
    python scripts/onboard.py

The script will interactively ask for:
- Business name and subdomain
- Telegram bot token
- 3x Groq API keys
- Brand color
- Working hours
- Owner's Telegram user ID
"""

import sys
import os
import asyncio

# Add parent to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from supabase import create_client
from aiogram import Bot


def get_input(prompt: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    val = input(f"{prompt}{suffix}: ").strip()
    return val or default


async def main():
    print("=" * 50)
    print("  SalonFlow — Онбординг нового клиента")
    print("=" * 50)
    print()

    # ── Supabase connection ──────────────────────
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        print("❌ SUPABASE_URL и SUPABASE_KEY должны быть в .env")
        sys.exit(1)

    sb = create_client(url, key)

    # ── Collect info ─────────────────────────────
    print("📋 Информация о бизнесе:\n")

    name = get_input("  Название бизнеса")
    subdomain = get_input("  Поддомен (латиница, дефисы)", name.lower().replace(" ", "-"))

    # Check uniqueness
    existing = sb.table("tenants").select("id").eq("subdomain", subdomain).execute()
    if existing.data:
        print(f"❌ Поддомен '{subdomain}' уже занят!")
        sys.exit(1)

    print()
    print("🤖 Telegram бот:\n")

    bot_token = get_input("  Bot token (от @BotFather)")

    # Verify token
    try:
        bot = Bot(token=bot_token)
        bot_info = await bot.get_me()
        print(f"  ✅ Бот найден: @{bot_info.username}")
        await bot.session.close()
    except Exception as e:
        print(f"  ❌ Невалидный токен: {e}")
        sys.exit(1)

    print()
    print("🧠 Groq API (нужно 3 ключа для ротации):\n")

    groq_keys = []
    for i in range(3):
        key_input = get_input(f"  Groq API Key #{i + 1}")
        if key_input:
            groq_keys.append(key_input)

    if len(groq_keys) == 0:
        print("  ⚠️ Без Groq ключей AI-чат работать не будет.")
    elif len(groq_keys) < 3:
        print(f"  ⚠️ Введено {len(groq_keys)}/3 ключей. Рекомендуется 3 для ротации.")

    print()
    print("🎨 Брендирование:\n")

    color_primary = get_input("  Основной цвет (HEX)", "#8b5cf6")
    color_accent = get_input("  Акцентный цвет (HEX)", "#f59e0b")
    color_bg = get_input("  Цвет фона (HEX)", "#0f172a")
    color_text = get_input("  Цвет текста (HEX)", "#f8fafc")

    print()
    print("🕐 Расписание:\n")

    hours_start = get_input("  Начало работы (ЧЧ:ММ)", "10:00")
    hours_end = get_input("  Конец работы (ЧЧ:ММ)", "20:00")
    interval = int(get_input("  Интервал слотов (минуты)", "60"))
    buffer = int(get_input("  Буфер между записями (минуты)", "15"))

    print()
    print("👑 Владелец:\n")

    owner_tg_id = int(get_input("  Telegram User ID владельца"))
    owner_name = get_input("  Имя владельца")

    # ── Confirm ──────────────────────────────────
    print()
    print("=" * 50)
    print(f"  Название:    {name}")
    print(f"  Поддомен:    {subdomain}.salonflow.kz")
    print(f"  Бот:         @{bot_info.username}")
    print(f"  Groq ключей: {len(groq_keys)}")
    print(f"  Цвет:        {color_primary}")
    print(f"  Часы:        {hours_start}–{hours_end}, шаг {interval} мин")
    print(f"  Владелец:    {owner_name} (ID: {owner_tg_id})")
    print("=" * 50)
    print()

    confirm = input("  Всё верно? (y/n): ").strip().lower()
    if confirm != "y":
        print("  Отменено.")
        sys.exit(0)

    # ── Create tenant ────────────────────────────
    print()
    print("⏳ Создаю tenant...")

    # Encrypt bot token
    encrypted_token = bot_token
    try:
        from app.core.encryption import encrypt
        encrypted_token = encrypt(bot_token)
        print("  🔒 Токен зашифрован")
    except Exception:
        print("  ⚠️ Шифрование недоступно, токен сохранён как есть")

    tenant_result = sb.table("tenants").insert({
        "name": name,
        "subdomain": subdomain,
        "color_primary": color_primary,
        "color_accent": color_accent,
        "color_bg": color_bg,
        "color_text": color_text,
        "working_hours_start": hours_start,
        "working_hours_end": hours_end,
        "slot_interval_minutes": interval,
        "buffer_minutes": buffer,
        "bot_token_encrypted": encrypted_token,
        "groq_api_keys": groq_keys,
    }).execute()

    tenant_id = tenant_result.data[0]["id"]
    print(f"  ✅ Tenant создан: {tenant_id}")

    # ── Create owner user ────────────────────────
    print("⏳ Создаю владельца...")

    sb.table("users").insert({
        "tenant_id": tenant_id,
        "telegram_user_id": owner_tg_id,
        "role": "owner",
        "name": owner_name,
    }).execute()
    print("  ✅ Владелец добавлен")

    # ── Create default categories ────────────────
    print("⏳ Создаю дефолтные категории...")

    for i, cat_name in enumerate(["Основные", "Дополнительные"], 1):
        sb.table("categories").insert({
            "tenant_id": tenant_id,
            "name": cat_name,
            "sort_order": i,
        }).execute()
    print("  ✅ Категории созданы")

    # ── Create default FAQ ───────────────────────
    print("⏳ Создаю FAQ...")

    default_faqs = [
        ("Как записаться?", "Выберите услуги, добавьте в корзину, укажите удобное время и оставьте контакт. Мы свяжемся с вами для подтверждения."),
        ("Какие способы оплаты?", "Принимаем Kaspi перевод, наличные. Предоплата обсуждается с администратором."),
        ("Можно ли отменить запись?", "Да, свяжитесь с нами минимум за 4 часа до визита."),
    ]
    for q, a in default_faqs:
        sb.table("faq").insert({
            "tenant_id": tenant_id,
            "question": q,
            "answer": a,
        }).execute()
    print("  ✅ FAQ создан")

    # ── Set webhook ──────────────────────────────
    print("⏳ Настраиваю webhook бота...")

    base_url = os.getenv("BASE_URL", "https://salonflow-api.railway.app")
    webhook_url = f"{base_url}/api/webhook/tg/{tenant_id}"

    try:
        bot = Bot(token=bot_token)
        await bot.set_webhook(webhook_url)
        print(f"  ✅ Webhook: {webhook_url}")
        await bot.session.close()
    except Exception as e:
        print(f"  ⚠️ Webhook ошибка (настройте вручную): {e}")

    # ── Netlify domain alias ─────────────────────
    netlify_token = os.getenv("NETLIFY_TOKEN")
    netlify_site_id = os.getenv("NETLIFY_SITE_ID")
    domain_suffix = os.getenv("DOMAIN_SUFFIX", "salonflow.kz")

    if netlify_token and netlify_site_id:
        print("⏳ Добавляю поддомен в Netlify...")
        import httpx
        alias = f"{subdomain}.{domain_suffix}"
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"https://api.netlify.com/api/v1/sites/{netlify_site_id}/domain_aliases",
                    headers={"Authorization": f"Bearer {netlify_token}"},
                    json={"domain": alias},
                )
                if resp.status_code in (200, 201):
                    print(f"  ✅ Domain alias добавлен: {alias}")
                elif resp.status_code == 422:
                    print(f"  ℹ️ Domain alias уже существует: {alias}")
                else:
                    print(f"  ⚠️ Netlify ответ {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            print(f"  ⚠️ Netlify API ошибка: {e}")
    else:
        print("  ℹ️ NETLIFY_TOKEN / NETLIFY_SITE_ID не заданы — добавьте domain alias вручную")

    # ── Done ─────────────────────────────────────
    print()
    print("=" * 50)
    print("  ✅ ГОТОВО!")
    print()
    print(f"  🌐 Сайт:  https://{subdomain}.{domain_suffix}")
    print(f"  🤖 Бот:   @{bot_info.username}")
    print(f"  🆔 ID:    {tenant_id}")
    print()
    print("  Следующие шаги:")
    print("  1. Добавьте услуги через бота (/start)")
    print("  2. Загрузите портфолио через бота")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
