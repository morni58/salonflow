"""Запросы к таблице masters (публичный список, проверки)."""
from __future__ import annotations

from app.core.database import get_supabase


def tenant_has_bookable_masters_sync(tenant_id: str) -> bool:
    sb = get_supabase()
    r = (
        sb.table("masters")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("is_active", True)
        .eq("is_bookable", True)
        .limit(1)
        .execute()
    )
    return bool(r.data)


def master_belongs_to_tenant_sync(master_id: str, tenant_id: str) -> bool:
    sb = get_supabase()
    r = (
        sb.table("masters")
        .select("id")
        .eq("id", master_id)
        .eq("tenant_id", tenant_id)
        .eq("is_active", True)
        .eq("is_bookable", True)
        .limit(1)
        .execute()
    )
    return bool(r.data)


def services_allowed_for_master_sync(tenant_id: str, master_id: str, service_ids: list[str]) -> tuple[bool, str]:
    """
    Если для услуги есть строки в service_masters — мастер должен быть в списке.
    Если строк нет — любой мастер может выполнить услугу.
    """
    sb = get_supabase()
    for sid in service_ids:
        rows = (
            sb.table("service_masters")
            .select("master_id")
            .eq("service_id", sid)
            .execute()
        )
        if not rows.data:
            continue
        allowed = {str(r["master_id"]) for r in rows.data}
        if master_id not in allowed:
            return False, f"Мастер не выполняет услугу (id={sid})"
    return True, ""
