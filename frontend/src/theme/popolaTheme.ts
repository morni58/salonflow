/**
 * Базовая тема как в pox/popola.html.
 * По умолчанию сайт использует эти значения; свои цвета — см. `site_content.theme` в useTenant.
 */
export const POPOLA = {
  bg: "#faf9f7",
  text: "#36312f",
  primary: "#c08973",
  accent: "#e0c6ba",
} as const;

/** Включить свои цвета из БД: в site_content задать "theme": "custom" */
export const SITE_THEME_CUSTOM = "custom" as const;
