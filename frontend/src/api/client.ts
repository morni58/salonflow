import type {
  Tenant,
  CatalogResponse,
  SlotsResponse,
  BookingCreate,
  BookingOut,
  PortfolioCategory,
  ReviewImage,
  AnalyticsEvent,
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

// ── Slots ───────────────────────────────

export async function fetchSlots(tenantId: string, date: string): Promise<SlotsResponse> {
  return request<SlotsResponse>(`/slots?tenant_id=${tenantId}&date=${date}`);
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

// ── Chat (SSE) ──────────────────────────

export function streamChat(
  tenantId: string,
  sessionId: string,
  message: string,
  history: { role: string; content: string }[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
): AbortController {
  const controller = new AbortController();
  const body = JSON.stringify({
    tenant_id: tenantId,
    session_id: sessionId,
    message,
    history,
  });

  fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error("Chat request failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let gotData = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              onDone();
              return;
            }
            gotData = true;
            onChunk(data);
          }
        }
      }

      // If we got no SSE data, stream might have been buffered — try sync
      if (!gotData && buffer.length > 0) {
        throw new Error("SSE_BUFFERED");
      }
      onDone();
    })
    .catch(async (err) => {
      if (err.name === "AbortError") return;

      // Fallback to sync endpoint
      try {
        const res = await fetch(`${BASE}/chat/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (!res.ok) throw new Error("Sync chat failed");
        const data = await res.json();
        onChunk(data.content);
        onDone();
      } catch (syncErr) {
        onError(syncErr instanceof Error ? syncErr : new Error("Chat failed"));
      }
    });

  return controller;
}
