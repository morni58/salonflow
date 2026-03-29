import type { Tenant } from "../types";

export type AdvantageIcon = "sparkle" | "clock" | "smile";

export interface AdvantageItem {
  icon: AdvantageIcon;
  title: string;
  text: string;
  /** Прямая ссылка на картинку из бота (опционально) */
  image_url?: string;
}

const _URL_RE = /^https?:\/\/.+/i;

function _isHttpUrl(s: string): boolean {
  return _URL_RE.test(s.trim());
}

/** Парсит `site_content.advantages` — только то, что задано в боте; без дефолтного контента. */
export function parseAdvantages(tenant: Tenant): AdvantageItem[] | null {
  const raw = tenant.site_content?.advantages;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: AdvantageItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const ic = o.icon;
    const icon: AdvantageIcon =
      ic === "clock" || ic === "smile" || ic === "sparkle" ? ic : "sparkle";
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (!title || !text) continue;
    const item: AdvantageItem = { icon, title, text };
    const img = typeof o.image_url === "string" ? o.image_url.trim() : "";
    if (img && _isHttpUrl(img)) item.image_url = img;
    out.push(item);
  }
  return out.length ? out : null;
}

export function hasAdvantagesSection(tenant: Tenant): boolean {
  return parseAdvantages(tenant) !== null;
}
