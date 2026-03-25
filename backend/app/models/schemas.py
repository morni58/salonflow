from pydantic import BaseModel, Field
from datetime import datetime, date, time
from enum import Enum
from typing import Optional


# ── Enums ──────────────────────────────────────────────

class ContactType(str, Enum):
    telegram = "telegram"
    whatsapp = "whatsapp"
    instagram = "instagram"
    phone = "phone"


class BookingStatus(str, Enum):
    pending = "pending"
    waiting = "waiting"
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"


class PaymentStatus(str, Enum):
    unpaid = "unpaid"
    paid = "paid"
    refunded = "refunded"


class AnalyticsEvent(str, Enum):
    visit = "visit"
    catalog_view = "catalog_view"
    cart_open = "cart_open"
    checkout = "checkout"


# ── Tenant ─────────────────────────────────────────────

class TenantPublic(BaseModel):
    """Public tenant info returned to frontend."""
    id: str
    name: str
    subdomain: str
    logo_url: Optional[str] = None
    color_primary: str
    color_accent: str
    color_bg: str
    color_text: str
    timezone: str
    working_hours_start: str
    working_hours_end: str
    slot_interval_minutes: int
    buffer_minutes: int


# ── Catalog ────────────────────────────────────────────

class ServiceOut(BaseModel):
    id: str
    name: str
    price: int  # в тиынах
    duration_minutes: int
    photo_url: Optional[str] = None


class CategoryOut(BaseModel):
    id: str
    name: str
    services: list[ServiceOut] = []


class CatalogResponse(BaseModel):
    categories: list[CategoryOut]


# ── Slots ──────────────────────────────────────────────

class SlotsRequest(BaseModel):
    tenant_id: str
    date: date


class SlotsResponse(BaseModel):
    date: date
    slots: list[str]  # ["10:00", "11:15", "12:30", ...]


# ── Booking ────────────────────────────────────────────

class BookingCreate(BaseModel):
    tenant_id: str
    name: str
    contact_type: ContactType
    contact_value: str
    service_ids: list[str]
    preferred_datetime: datetime


class BookingOut(BaseModel):
    id: str
    status: BookingStatus
    created_at: datetime


# ── Chat ───────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    tenant_id: str
    session_id: str
    message: str
    history: list[ChatMessage] = []


# ── Analytics ──────────────────────────────────────────

class AnalyticsTrack(BaseModel):
    tenant_id: str
    event_type: AnalyticsEvent
    session_id: str
