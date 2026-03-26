// ── Tenant ─────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string | null;
  color_primary: string;
  color_accent: string;
  color_bg: string;
  color_text: string;
  timezone: string;
  working_hours_start: string;
  working_hours_end: string;
  slot_interval_minutes: number;
  buffer_minutes: number;
}

// ── Catalog ───────────────────────────────────

export interface Service {
  id: string;
  name: string;
  price: number; // tiyn
  duration_minutes: number;
  photo_url: string | null;
}

export interface Category {
  id: string;
  name: string;
  services: Service[];
}

export interface CatalogResponse {
  categories: Category[];
}

// ── Cart ──────────────────────────────────────

export interface CartItem {
  service: Service;
  quantity: number;
}

// ── Slots ─────────────────────────────────────

export interface SlotsResponse {
  date: string;
  slots: string[];
}

// ── Booking ───────────────────────────────────

export type ContactType = "telegram" | "whatsapp" | "instagram" | "phone";

export interface BookingCreate {
  tenant_id: string;
  name: string;
  contact_type: ContactType;
  contact_value: string;
  service_ids: string[];
  preferred_datetime: string;
}

export interface BookingOut {
  id: string;
  status: string;
  created_at: string;
}

// ── Portfolio & Reviews ───────────────────────

export interface PortfolioImage {
  id: string;
  url: string;
  created_at: string;
}

export interface PortfolioCategory {
  category: string;
  images: PortfolioImage[];
}

export interface ReviewImage {
  id: string;
  url: string;
  created_at: string;
}

// ── Analytics ─────────────────────────────────

export type AnalyticsEvent = "visit" | "catalog_view" | "cart_open" | "checkout";
