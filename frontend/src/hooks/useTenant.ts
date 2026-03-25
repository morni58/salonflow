import { useState, useEffect } from "react";
import type { Tenant } from "../types";
import { fetchTenant } from "../api/client";

function getSubdomain(): string {
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return "demo";
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

/** Смешивание двух hex (t: доля второго цвета) */
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

function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const lin = [rgb.r, rgb.g, rgb.b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** Базовая палитра (макет terracotta / poca) — смешивается с цветами салона из БД */
const HARMONY_BG = "#faf8f5";
const HARMONY_TEXT = "#36312d";
const HARMONY_PRIMARY = "#c39077";
const HARMONY_ACCENT = "#dfc6b9";

/** Старые тёмные темы из БД → светлый фон, читаемый текст */
function softenLegacyTheme(bg: string, text: string): { bg: string; text: string } {
  if (luminance(bg) >= 0.42) return { bg, text };
  const softBg = mixHex(bg, HARMONY_BG, 0.92);
  const textOut = luminance(text) > 0.55 ? HARMONY_TEXT : text;
  return { bg: softBg, text: textOut };
}

/** Смешиваем цвета салона с палитрой Champagne & Powder */
function harmonizeChampagnePowder(primary: string, accent: string) {
  return {
    primary: mixHex(primary, HARMONY_PRIMARY, 0.45),
    accent: mixHex(accent, HARMONY_ACCENT, 0.45),
  };
}

function applyTheme(tenant: Tenant) {
  const root = document.documentElement;
  const softened = softenLegacyTheme(tenant.color_bg, tenant.color_text);
  const { primary, accent } = harmonizeChampagnePowder(tenant.color_primary, tenant.color_accent);
  const bg = softened.bg;
  const text = softened.text;

  root.style.setProperty("--color-primary", primary);
  root.style.setProperty("--color-accent", accent);
  root.style.setProperty("--color-bg", bg);
  root.style.setProperty("--color-text", text);
  const primaryFg = luminance(primary) > 0.62 ? text : "#ffffff";
  root.style.setProperty("--color-primary-foreground", primaryFg);
  root.style.setProperty("--color-primary-solid", mixHex(primary, text, 0.35));
  root.style.setProperty("--color-placeholder-surface", mixHex(HARMONY_ACCENT, HARMONY_BG, 0.65));
  root.style.setProperty("--color-on-solid", "#ffffff");

  root.style.setProperty("--color-primary-20", rgbaFromHex(primary, 0.2));
  root.style.setProperty("--color-primary-40", rgbaFromHex(primary, 0.34));
  root.style.setProperty("--color-primary-muted", rgbaFromHex(primary, 0.16));

  /* Карточки: полупрозрачный белый — чистый интерфейс при смене брендинга салона */
  root.style.setProperty("--color-bg-card", "rgba(255, 255, 255, 0.8)");
  root.style.setProperty("--color-bg-elevated", "#ffffff");

  root.style.setProperty("--color-bg-glass", "rgba(255, 255, 255, 0.85)");
  root.style.setProperty("--color-border-soft", rgbaFromHex(text, 0.08));
  root.style.setProperty("--color-border-muted", rgbaFromHex(text, 0.1));
  root.style.setProperty("--color-border-card", rgbaFromHex(text, 0.06));
  root.style.setProperty("--color-border-pill", rgbaFromHex(text, 0.08));
  root.style.setProperty("--color-price-bg", rgbaFromHex(accent, 0.2));
  root.style.setProperty("--color-price-border", rgbaFromHex(accent, 0.35));

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
