import type {
  Tenant,
  CatalogResponse,
  SlotsResponse,
  BookingCreate,
  BookingOut,
  PortfolioCategory,
  ReviewImage,
  AnalyticsEvent,
  MastersResponse,
} from "../types";

// В dev ходим напрямую на FastAPI — так надёжнее на Windows, чем Vite proxy.
const BASE = import.meta.env.DEV ? "http://127.0.0.1:8000/api" : "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const raw = await res.text();
    let msg = `${res.status} ${res.statusText}`;
    try {
      const err = JSON.parse(raw) as { detail?: string | { msg?: string }[] };
      if (typeof err.detail === "string") msg = err.detail;
      else if (Array.isArray(err.detail)) msg = err.detail.map((d) => d.msg ?? JSON.stringify(d)).join("; ");
    } catch {
      if (raw) msg = raw.slice(0, 300);
    }
    throw new Error(msg);
  }
  if (res.status === 204) return null as T;
  return res.json();
}

// ── Tenant ──────────────────────────────

export async function fetchTenant(subdomain: string): Promise<Tenant> {
  return request<Tenant>(`/tenant?subdomain=${encodeURIComponent(subdomain)}`);
}

// ── Catalog ─────────────────────────────

export async function fetchCatalog(tenantId: string): Promise<CatalogResponse> {
  return request<CatalogResponse>(`/catalog?tenant_id=${tenantId}`);
}

// ── Masters ─────────────────────────────

export async function fetchMasters(tenantId: string): Promise<MastersResponse> {
  return request<MastersResponse>(`/masters?tenant_id=${encodeURIComponent(tenantId)}`);
}

// ── Slots ───────────────────────────────

export async function fetchSlots(
  tenantId: string,
  date: string,
  masterId?: string | null
): Promise<SlotsResponse> {
  let path = `/slots?tenant_id=${encodeURIComponent(tenantId)}&date=${encodeURIComponent(date)}`;
  if (masterId) path += `&master_id=${encodeURIComponent(masterId)}`;
  return request<SlotsResponse>(path);
}

// ── Booking ─────────────────────────────

export async function createBooking(data: BookingCreate): Promise<BookingOut> {
  return request<BookingOut>("/booking", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Portfolio ───────────────────────────

export async function fetchPortfolio(tenantId: string): Promise<PortfolioCategory[]> {
  const res = await request<{ portfolio: PortfolioCategory[] }>(
    `/portfolio?tenant_id=${tenantId}`
  );
  return res.portfolio;
}

// ── Reviews ─────────────────────────────

export async function fetchReviews(tenantId: string): Promise<ReviewImage[]> {
  const res = await request<{ reviews: ReviewImage[] }>(
    `/reviews?tenant_id=${tenantId}`
  );
  return res.reviews;
}

// ── Analytics ───────────────────────────

export async function trackEvent(
  tenantId: string,
  eventType: AnalyticsEvent,
  sessionId: string
): Promise<void> {
  await request<null>("/analytics", {
    method: "POST",
    body: JSON.stringify({
      tenant_id: tenantId,
      event_type: eventType,
      session_id: sessionId,
    }),
  });
}
