/** Цена в тиынах → четыре неразрывных пробела, сумма, затем узкие пробелы перед ₸ */
export function formatPrice(tiyn: number): string {
  const tenge = Math.round(tiyn / 100);
  const n = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(tenge);
  const lead = "\u00a0".repeat(4);
  return `${lead}${n}\u202f\u202f₸`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}ч ${m}мин` : `${h}ч`;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
