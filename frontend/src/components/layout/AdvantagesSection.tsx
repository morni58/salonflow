import type { Tenant } from "../../types";

const DEFAULT_ITEMS = [
  {
    icon: "sparkle" as const,
    title: "Премиум материалы",
    text: "Используем только сертифицированную косметику люкс-сегмента от мировых брендов.",
  },
  {
    icon: "clock" as const,
    title: "Экономия времени",
    text: "Услуги в 4 руки — маникюр, педикюр и укладка одновременно, без потери качества.",
  },
  {
    icon: "smile" as const,
    title: "Абсолютный релакс",
    text: "Свежесваренный кофе, шампанское, удобные кресла-реклайнеры и приятная атмосфера.",
  },
];

type Item = (typeof DEFAULT_ITEMS)[number];

function parseAdvantages(tenant: Tenant): Item[] {
  const raw = tenant.site_content?.advantages;
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_ITEMS;
  const out: Item[] = [];
  raw.forEach((row) => {
    if (!row || typeof row !== "object") return;
    const o = row as Record<string, unknown>;
    const ic = o.icon;
    const icon: Item["icon"] =
      ic === "clock" || ic === "smile" || ic === "sparkle" ? ic : "sparkle";
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (!title || !text) return;
    out.push({ icon, title, text });
  });
  return out.length ? out : DEFAULT_ITEMS;
}


interface Props {
  tenant: Tenant;
}

export function AdvantagesSection({ tenant }: Props) {
  const items = parseAdvantages(tenant);

  return (
    <section
      id="advantages"
      data-anchor-section
      className="my-12 overflow-hidden rounded-2xl md:my-20"
      style={{ background: "#1c1917" }}
    >
      <div className="px-6 py-14 md:px-12 md:py-20">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 mb-4">
            Наши преимущества
          </p>
          <h2 className="font-serif italic text-3xl md:text-5xl text-white">
            Почему нас{" "}
            <span style={{ color: "var(--color-accent, #e0c6ba)" }}>
              выбирают
            </span>
          </h2>
        </div>

        {/* Cards */}
        <div className="grid gap-4 sm:grid-cols-3 md:gap-5">
          {items.map((item, i) => (
            <div
              key={`${item.title}-${i}`}
              className="flex flex-col rounded-2xl p-6 md:p-8 transition-colors duration-300"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <h3 className="font-serif text-xl font-bold text-white mb-2">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                {item.text}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center md:mt-14">
          <button
            type="button"
            onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.96]"
            style={{
              background: "#ffffff",
              color: "#1c1917",
              boxShadow: "0 4px 16px rgba(255,255,255,0.12)",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "var(--color-primary)";
              el.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "#ffffff";
              el.style.color = "#1c1917";
            }}
          >
            Записаться сейчас
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
