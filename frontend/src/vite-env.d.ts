/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Явный subdomain тенанта (если не задан — из hostname или demo на Netlify/Pages) */
  readonly VITE_TENANT_SUBDOMAIN?: string;
}
