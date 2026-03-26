"""Список slash-команд для Telegram (меню «/») и тексты справки."""
from __future__ import annotations

from aiogram.types import BotCommand

# Описания видны в подсказке при вводе / в Telegram
BOT_COMMANDS: list[BotCommand] = [
    BotCommand(command="start", description="Главное меню и кнопки"),
    BotCommand(command="help", description="Справка по командам"),
    BotCommand(command="menu", description="Меню разделов (как кнопки)"),
    BotCommand(command="bookings", description="Записи на сегодня"),
    BotCommand(command="today", description="То же, что /bookings"),
    BotCommand(command="catalog", description="Каталог услуг"),
    BotCommand(command="schedule", description="Расписание, дни, закрыть день"),
    BotCommand(command="portfolio", description="Портфолио на сайт"),
    BotCommand(command="reviews", description="Отзывы на сайт"),
    BotCommand(command="offline", description="Оффлайн-запись клиента"),
    BotCommand(command="clients", description="База клиентов"),
    BotCommand(command="site", description="Сайт: цвета, тексты (владелец/админ)"),
    BotCommand(command="crm", description="CRM и CSV (владелец/админ)"),
    BotCommand(command="add_staff", description="Добавить мастера по Telegram ID"),
    BotCommand(command="add_admin", description="Добавить админа (только владелец)"),
    BotCommand(command="staff_list", description="Список пользователей бота"),
    BotCommand(command="my_profile", description="Карточка мастера на сайте"),
    BotCommand(command="my_schedule", description="Свой график (мастер)"),
]

HELP_TEXT_NO_ACCESS = (
    "<b>SalonFlow</b>\n\n"
    "⛔ У вашего аккаунта нет доступа к этому боту.\n"
    "Обратитесь к владельцу салона.\n\n"
    "Команды: /start — попробовать снова."
)

HELP_TEXT = (
    "<b>Команды SalonFlow</b>\n\n"
    "<b>Общее</b>\n"
    "/start — приветствие и главное меню\n"
    "/menu — меню с кнопками разделов\n"
    "/help — эта справка\n\n"
    "<b>Запись и работа</b>\n"
    "/bookings или /today — записи на сегодня\n"
    "/catalog — каталог услуг (цены, фото)\n"
    "/schedule — расписание: дни недели, «каждые N дней», закрыть/открыть день, часы\n"
    "/portfolio — загрузка фото работ на сайт\n"
    "/reviews — скриншоты отзывов на сайт\n"
    "/offline — запись клиента без сайта\n"
    "/clients — поиск и топ клиентов\n\n"
    "<b>Владелец и администратор</b>\n"
    "/site — цвета (hex/rgb), тексты сайта, контакты в футере, лого\n"
    "/crm — сводка и выгрузки .csv в Excel\n\n"
    "<b>Персонал</b>\n"
    "/add_staff &lt;telegram_id&gt; Имя — новый мастер (бот + сайт)\n"
    "/add_admin &lt;telegram_id&gt; Имя — администратор (только владелец)\n"
    "/staff_list — кто в боте и их ID\n\n"
    "<b>Мастер</b>\n"
    "/my_profile — должность, фото, «о себе» на сайте\n"
    "/my_schedule — свои дни, часы, закрыть день\n\n"
    "<i>Подсказка: список команд — кнопка «≡» или / слева от поля ввода.</i>"
)
