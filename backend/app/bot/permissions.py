"""Роли и проверки доступа к разделам бота."""

from __future__ import annotations

# Полный CRM: воронка, отчёты, архив, выгрузки
CRM_ROLES = frozenset({"owner", "admin", "manager"})

# Настройки сайта (цвета, тексты, контакты)
SITE_ROLES = frozenset({"owner", "admin"})

# Приглашение мастеров и менеджеров
STAFF_INVITE_ROLES = frozenset({"owner", "admin"})

# Только владелец
OWNER_ONLY = frozenset({"owner"})


def can_crm(role: str | None) -> bool:
    return role in CRM_ROLES


def can_site(role: str | None) -> bool:
    return role in SITE_ROLES


def can_invite_staff(role: str | None) -> bool:
    return role in STAFF_INVITE_ROLES


def can_add_admin(role: str | None) -> bool:
    return role in OWNER_ONLY
