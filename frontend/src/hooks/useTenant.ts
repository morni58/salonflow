import { useState, useEffect } from "react";
import type { Tenant } from "../types";
import { fetchTenant } from "../api/client";

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

function rgbaFromHex(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${alpha})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A || !B) return a;
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  const r = mix(A.r, B.r);
  const g = mix(A.g, B.g);
  const bb = mix(A.b, B.b);
  return `#${[r, g, bb].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Визуал как в pox/pokaz.html — фиксированная терракотовая палитра.
 * Цвета из API не подмешиваем в UI: в БД часто стоят дефолты фиолетовые/холодные,
 * из‑за этого сайт «плывёт» от референса.
 * Название, лого, описание — по-прежнему с бэкенда.
 */
const POKAZ = {
  bg: "#faf8f5",
  text: "#36312d",
  primary: "#c39077",
  primaryDark: "#b47b60",
  accent: "#dfc6b9",
} as const;

function applyTheme(tenant: Tenant) {
  const root = document.documentElement;
  const primary = POKAZ.primary;
  const primaryDark = POKAZ.primaryDark;
  const bg = POKAZ.bg;
  const text = POKAZ.text;
  const accent = POKAZ.accent;

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
  root.style.setProperty("--color-primary-solid", mixHex(primary, text, 0.28));

  root.style.setProperty("--color-primary-20", rgbaFromHex(primary, 0.22));
  root.style.setProperty("--color-primary-40", rgbaFromHex(primary, 0.38));
  root.style.setProperty("--color-primary-muted", rgbaFromHex(primary, 0.18));

  root.style.setProperty("--color-bg-card", "rgba(255, 255, 255, 0.95)");
  root.style.setProperty("--color-bg-elevated", "#ffffff");
  root.style.setProperty("--color-bg-glass", "rgba(255, 255, 255, 0.82)");
  root.style.setProperty("--color-border-soft", rgbaFromHex(text, 0.06));
  root.style.setProperty("--color-border-muted", rgbaFromHex(text, 0.1));
  root.style.setProperty("--color-border-card", rgbaFromHex(text, 0.06));
  root.style.setProperty("--color-border-pill", rgbaFromHex(text, 0.08));
  root.style.setProperty("--color-placeholder-surface", mixHex(POKAZ.accent, POKAZ.bg, 0.65));
  root.style.setProperty("--color-price-bg", rgbaFromHex(accent, 0.15));
  root.style.setProperty("--color-price-border", rgbaFromHex(accent, 0.35));

  root.style.setProperty("--shadow-soft", "0 4px 20px -2px rgba(54, 49, 45, 0.05)");
  root.style.setProperty("--shadow-soft-md", "0 12px 30px -4px rgba(54, 49, 45, 0.08)");

  document.title = `${tenant.name} — Онлайн-запись`;

  const setMeta = (selector: string, content: string) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute("content", content);
  };

  setMeta('meta[name="description"]', `Запись онлайн в ${tenant.name}. Выбирайте услуги и бронируйте удобное время.`);
  setMeta('meta[property="og:title"]', `${tenant.name} — Онлайн-запись`);
  setMeta('meta[property="og:description"]', `Запись онлайн в ${tenant.name}`);
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
