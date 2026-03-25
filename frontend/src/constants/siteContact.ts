/**
 * Контакты в футере. Подставьте реальные ссылки и номера или задайте в .env (VITE_*).
 */
const e = import.meta.env;

export type PhoneEntry = { label: string; href: string };

export const SITE_CONTACT = {
  phones: [
    {
      label: e.VITE_CONTACT_PHONE_1 ?? "+7 (900) 000-00-00",
      href: e.VITE_CONTACT_PHONE_1_HREF ?? "tel:+79000000000",
    },
    {
      label: e.VITE_CONTACT_PHONE_2 ?? "+7 (901) 111-22-33",
      href: e.VITE_CONTACT_PHONE_2_HREF ?? "tel:+79011112233",
    },
  ] satisfies PhoneEntry[],
  telegram: e.VITE_TELEGRAM_URL ?? "https://t.me/",
  whatsapp: e.VITE_WHATSAPP_URL ?? "https://wa.me/79000000000",
  instagram: e.VITE_INSTAGRAM_URL ?? "https://instagram.com/",
} as const;
