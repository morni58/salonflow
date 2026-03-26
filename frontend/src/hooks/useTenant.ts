import { useState, useEffect } from "react";
import type { Tenant } from "../types";
import { fetchTenant } from "../api/client";
import { POPOLA, SITE_THEME_CUSTOM } from "../theme/popolaTheme";
import { siteText } from "../utils/siteContent";

function getSubdomain(): string {
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return "demo";

  const fromEnv = import.meta.env.VITE_TENANT_SUBDOMAIN?.trim();
  if (fromEnv) return fromEnv;

  if (hostname.endsWith(".netlify.app") || hostname.endsWith(".pages.dev")) {
    return "demo";
  }

  const parts = hostname.split(".");
  if (parts.length >= 3) return parts[0];
  return "demo";
}

/** Палитра по умолчанию (popola) */
const POKAZ = POPOLA;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace(/^#/, "").trim();
  if (h.length === 6) {
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  return null;
}

/** Поддержка #hex, rgb(), rgba(), rgb с пробелами (modern syntax). */
export function parseCssColor(input: string): { r: number; g: number; b: number } | null {
  const s = input.trim();
  if (!s) return null;
  const hex = hexToRgb(s);
  if (hex) return hex;
  const m =
    s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i) ||
    s.match(/^rgba?\(\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/i);
  if (m) {
    return { r: +m[1], g: +m[2], b: +m[3] };
  }
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("")}`;
}

function rgbaFromRgb(rgb: { r: number; g: number; b: number }, alpha: number): string {
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

function darkenRgb(rgb: { r: number; g: number; b: number }, t: number): string {
  const mix = (x: number) => Math.round(x * (1 - t));
  return rgbToHex(mix(rgb.r), mix(rgb.g), mix(rgb.b));
}

function mixRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): string {
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return rgbToHex(mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b));
}

function pickColorCss(raw: unknown, fallback: string): string {
  if (typeof raw === "string" && raw.trim() && parseCssColor(raw)) return raw.trim();
  return fallback;
}

/** Свои цвета из tenants.color_* — только если в site_content задано theme: "custom". Иначе всегда popola. */
export function usesCustomBrandColors(tenant: Tenant): boolean {
  const sc = tenant.site_content;
  if (!sc || typeof sc !== "object") return false;
  return (sc as Record<string, unknown>).theme === SITE_THEME_CUSTOM;
}

function applyTheme(tenant: Tenant) {
  const root = document.documentElement;

  const custom = usesCustomBrandColors(tenant);
  const primary = custom ? pickColorCss(tenant.color_primary, POKAZ.primary) : POKAZ.primary;
  const accent = custom ? pickColorCss(tenant.color_accent, POKAZ.accent) : POKAZ.accent;
  const bg = custom ? pickColorCss(tenant.color_bg, POKAZ.bg) : POKAZ.bg;
  const text = custom ? pickColorCss(tenant.color_text, POKAZ.text) : POKAZ.text;

  const pRgb = parseCssColor(primary) ?? hexToRgb(POKAZ.primary)!;
  const aRgb = parseCssColor(accent) ?? hexToRgb(POKAZ.accent)!;
  const tRgb = parseCssColor(text) ?? hexToRgb(POKAZ.text)!;

  const primaryDark = darkenRgb(pRgb, 0.12);
  const primarySolid = mixRgb(pRgb, tRgb, 0.28);

  root.style.setProperty("--tenant-primary", primary);
  root.style.setProperty("--tenant-primary-dark", primaryDark);
  root.style.setProperty("--tenant-bg", bg);
  root.style.setProperty("--tenant-text", text);

  root.style.setProperty("--color-primary", primary);
  root.style.setProperty("--color-accent", accent);
  root.style.setProperty("--color-bg", bg);
  root.style.setProperty("--color-text", text);

  root.style.setProperty("--color-primary-foreground", "#ffffff");
  root.style.setProperty("--color-on-solid", "#ffffff");
  root.style.setProperty("--color-primary-solid", primarySolid);

  root.style.setProperty("--color-primary-20", rgbaFromRgb(pRgb, 0.22));
  root.style.setProperty("--color-primary-40", rgbaFromRgb(pRgb, 0.38));
  root.style.setProperty("--color-primary-muted", rgbaFromRgb(pRgb, 0.18));

  root.style.setProperty("--color-bg-card", "rgba(255, 255, 255, 0.95)");
  root.style.setProperty("--color-bg-elevated", "#ffffff");
  root.style.setProperty("--color-bg-glass", "rgba(255, 255, 255, 0.82)");
  root.style.setProperty("--color-border-soft", rgbaFromRgb(tRgb, 0.06));
  root.style.setProperty("--color-border-muted", rgbaFromRgb(tRgb, 0.1));
  root.style.setProperty("--color-border-card", rgbaFromRgb(tRgb, 0.06));
  root.style.setProperty("--color-border-pill", rgbaFromRgb(tRgb, 0.08));
  root.style.setProperty(
    "--color-placeholder-surface",
    mixRgb(aRgb, parseCssColor(bg) ?? hexToRgb(POKAZ.bg)!, 0.65),
  );
  root.style.setProperty("--color-price-bg", rgbaFromRgb(aRgb, 0.15));
  root.style.setProperty("--color-price-border", rgbaFromRgb(aRgb, 0.35));

  root.style.setProperty("--shadow-soft", "0 8px 30px rgba(54, 49, 47, 0.04)");
  root.style.setProperty("--shadow-soft-md", "0 12px 40px rgba(54, 49, 47, 0.08)");

  document.title = `${tenant.name} — Онлайн-запись`;

  const metaDesc = siteText(
    tenant,
    "meta_description",
    `Запись онлайн в ${tenant.name}. Выбирайте услуги и бронируйте удобное время.`,
  );

  const setMeta = (selector: string, content: string) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute("content", content);
  };

  setMeta('meta[name="description"]', metaDesc);
  setMeta('meta[property="og:title"]', `${tenant.name} — Онлайн-запись`);
  setMeta('meta[property="og:description"]', metaDesc);
  setMeta('meta[name="twitter:title"]', `${tenant.name} — Онлайн-запись`);

  if (tenant.logo_url) {
    setMeta('meta[property="og:image"]', tenant.logo_url);
  }

  setMeta('meta[name="theme-color"]', bg);
}

export function useTenant() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const subdomain = getSubdomain();
    fetchTenant(subdomain)
      .then((t) => {
        setTenant(t);
        applyTheme(t);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { tenant, loading, error };
}
