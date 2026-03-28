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
  /** С бэкенда после миграции 002; иначе undefined */
  working_days?: number[];
  schedule_mode?: string;
  every_n_days?: number;
  every_n_days_anchor?: string | null;
  site_content?: Record<string, unknown>;
  contact_json?: Record<string, unknown>;
}

// ── Catalog ───────────────────────────────────

export interface Service {
  id: string;
  name: string;
  price: number; // tiyn
  duration_minutes: number;
  photo_url: string | null;
  description?: string | null;
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
  alternate_master_id?: string | null;
  alternate_master_name?: string | null;
}

// ── Booking ───────────────────────────────────

export type ContactType = "telegram" | "whatsapp" | "instagram" | "phone";

export interface MasterPublic {
  id: string;
  display_name: string;
  title: string | null;
  bio: string | null;
  photo_url: string | null;
  sort_order: number;
}

export interface MastersResponse {
  masters: MasterPublic[];
  requires_master: boolean;
}

export interface BookingCreate {
  tenant_id: string;
  name: string;
  contact_type: ContactType;
  contact_value: string;
  service_ids: string[];
  preferred_datetime: string;
  master_id?: string | null;
}

export interface BookingOut {
  id: string;
  status: string;
  created_at: string;
  booking_code: string;  // Короткий код: "SF-A3K9B2"
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
