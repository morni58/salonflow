/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Явный subdomain тенанта (если не задан — из hostname или demo на Netlify/Pages) */
  readonly VITE_TENANT_SUBDOMAIN?: string;
  readonly VITE_CONTACT_PHONE_1?: string;
  readonly VITE_CONTACT_PHONE_1_HREF?: string;
  readonly VITE_CONTACT_PHONE_2?: string;
  readonly VITE_CONTACT_PHONE_2_HREF?: string;
  readonly VITE_TELEGRAM_URL?: string;
  readonly VITE_WHATSAPP_URL?: string;
  readonly VITE_INSTAGRAM_URL?: string;
}
