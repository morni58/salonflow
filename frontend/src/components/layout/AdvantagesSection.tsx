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

function Icon({ name }: { name: Item["icon"] }) {
  const cls = "h-7 w-7";
  if (name === "sparkle") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    );
  }
  if (name === "clock") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
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
      className="my-12 overflow-hidden rounded-[2rem] md:my-20"
      style={{ background: "#1e1a17" }}
    >
      <div className="px-6 py-14 md:px-12 md:py-20">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <div
            className="mb-5 inline-flex items-center gap-2.5 rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-widest"
            style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-accent, #e0c6ba)", background: "rgba(255,255,255,0.06)" }}
          >
            <span className="h-px w-5 rounded-full" style={{ background: "var(--color-accent, #e0c6ba)" }} aria-hidden />
            Наши преимущества
          </div>
          <h2 className="font-serif text-3xl font-semibold text-white md:text-5xl">
            Почему нас{" "}
            <span className="italic" style={{ color: "var(--color-accent, #e0c6ba)" }}>
              выбирают
            </span>
          </h2>
        </div>

        {/* Cards */}
        <div className="grid gap-4 sm:grid-cols-3 md:gap-6">
          {items.map((item, i) => (
            <div
              key={`${item.title}-${i}`}
              className="flex flex-col gap-4 rounded-2xl p-6 md:p-8 transition-colors duration-300"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Icon */}
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
                style={{ background: "rgba(192,137,115,0.18)", color: "var(--color-accent, #e0c6ba)" }}
              >
                <Icon name={item.icon} />
              </div>

              <div>
                <h3 className="font-serif mb-2 text-xl font-semibold text-white md:text-2xl">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.50)" }}>
                  {item.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center md:mt-14">
          <button
            type="button"
            onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
            style={{
              background: "var(--color-primary)",
              color: "#fff",
              boxShadow: "0 8px 28px rgba(192,137,115,0.35)",
            }}
          >
            Записаться сейчас
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
