import type { Tenant } from "../types";
import { SITE_CONTACT, type PhoneEntry } from "../constants/siteContact";

export function siteText(tenant: Tenant, key: string, fallback: string): string {
  const sc = tenant.site_content;
  if (!sc || typeof sc !== "object") return fallback;
  const v = (sc as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

export type FooterContact = {
  phones: PhoneEntry[];
  telegram: string;
  whatsapp: string;
  instagram: string;
  address?: string;
};

export function getFooterContact(tenant: Tenant): FooterContact {
  const raw = tenant.contact_json;
  if (!raw || typeof raw !== "object") {
    return { ...SITE_CONTACT, phones: [...SITE_CONTACT.phones] };
  }
  const o = raw as Record<string, unknown>;
  const phonesRaw = o.phones;
  let phones: PhoneEntry[] = [...SITE_CONTACT.phones];
  if (Array.isArray(phonesRaw) && phonesRaw.length > 0) {
    const parsed: PhoneEntry[] = [];
    for (const p of phonesRaw) {
      if (p && typeof p === "object" && "label" in p && "href" in p) {
        const label = String((p as PhoneEntry).label ?? "");
        const href = String((p as PhoneEntry).href ?? "");
        if (label && href) parsed.push({ label, href });
      }
    }
    if (parsed.length) phones = parsed;
  }
  const tg = typeof o.telegram === "string" && o.telegram.trim() ? o.telegram.trim() : SITE_CONTACT.telegram;
  const wa = typeof o.whatsapp === "string" && o.whatsapp.trim() ? o.whatsapp.trim() : SITE_CONTACT.whatsapp;
  const ig = typeof o.instagram === "string" && o.instagram.trim() ? o.instagram.trim() : SITE_CONTACT.instagram;
  const address = typeof o.address === "string" && o.address.trim() ? o.address.trim() : undefined;
  return { phones, telegram: tg, whatsapp: wa, instagram: ig, address };
}
