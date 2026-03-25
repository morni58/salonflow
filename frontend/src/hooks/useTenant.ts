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

/** #RGB or #RRGGBB → {r,g,b} */
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

function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const lin = [rgb.r, rgb.g, rgb.b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function applyTheme(tenant: Tenant) {
  const root = document.documentElement;
  const { color_primary: primary, color_accent: accent, color_bg: bg, color_text: text } = tenant;

  root.style.setProperty("--color-primary", primary);
  root.style.setProperty("--color-accent", accent);
  root.style.setProperty("--color-bg", bg);
  root.style.setProperty("--color-text", text);

  const primaryFg = luminance(primary) > 0.55 ? text : "#ffffff";
  root.style.setProperty("--color-primary-foreground", primaryFg);
  root.style.setProperty("--color-on-solid", "#ffffff");
  root.style.setProperty("--color-primary-solid", primary);

  root.style.setProperty("--color-primary-20", rgbaFromHex(primary, 0.2));
  root.style.setProperty("--color-primary-40", rgbaFromHex(primary, 0.4));
  root.style.setProperty("--color-primary-muted", rgbaFromHex(primary, 0.18));

  root.style.setProperty("--color-bg-card", rgbaFromHex(bg, 0.78));
  root.style.setProperty("--color-bg-elevated", rgbaFromHex(bg, 0.94));
  root.style.setProperty("--color-bg-glass", rgbaFromHex(bg, 0.52));

  root.style.setProperty("--color-border-soft", "rgba(255, 255, 255, 0.08)");
  root.style.setProperty("--color-border-muted", "rgba(255, 255, 255, 0.12)");
  root.style.setProperty("--color-border-card", "rgba(255, 255, 255, 0.1)");
  root.style.setProperty("--color-border-pill", "rgba(255, 255, 255, 0.12)");
  root.style.setProperty("--color-placeholder-surface", rgbaFromHex(text, 0.06));

  root.style.setProperty("--color-price-bg", rgbaFromHex(accent, 0.18));
  root.style.setProperty("--color-price-border", rgbaFromHex(accent, 0.4));

  root.style.setProperty(
    "--shadow-soft",
    `0 4px 24px -4px ${rgbaFromHex(primary, 0.25)}`
  );
  root.style.setProperty(
    "--shadow-soft-md",
    `0 12px 40px -8px ${rgbaFromHex(bg, 0.6)}`
  );

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
