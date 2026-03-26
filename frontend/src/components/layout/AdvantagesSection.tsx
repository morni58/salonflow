import type { Tenant } from "../../types";

const DEFAULT_ITEMS = [
  {
    icon: "sparkle" as const,
    title: "Премиум материалы",
    text: "Используем только сертифицированную косметику люкс сегмента от мировых брендов.",
    rotate: "rotate-3",
  },
  {
    icon: "clock" as const,
    title: "Экономия времени",
    text: "Услуги в 4 руки. Маникюр, педикюр и укладка одновременно без потери качества.",
    rotate: "-rotate-3",
  },
  {
    icon: "smile" as const,
    title: "Абсолютный релакс",
    text: "Свежесваренный кофе, шампанское, удобные кресла-реклайнеры и приятная музыка.",
    rotate: "rotate-3",
  },
];

type Item = (typeof DEFAULT_ITEMS)[number];

function parseAdvantages(tenant: Tenant): Item[] {
  const raw = tenant.site_content?.advantages;
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_ITEMS;
  const out: Item[] = [];
  raw.forEach((row, i) => {
    if (!row || typeof row !== "object") return;
    const o = row as Record<string, unknown>;
    const ic = o.icon;
    const icon: Item["icon"] =
      ic === "clock" || ic === "smile" || ic === "sparkle" ? ic : "sparkle";
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (!title || !text) return;
    const rotate =
      typeof o.rotate === "string" && o.rotate.trim()
        ? o.rotate.trim()
        : i % 2 === 0
          ? "rotate-3"
          : "-rotate-3";
    out.push({ icon, title, text, rotate });
  });
  return out.length ? out : DEFAULT_ITEMS;
}

function Icon({ name }: { name: Item["icon"] }) {
  const cls = "h-7 w-7 md:h-8 md:w-8";
  if (name === "sparkle") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
        />
      </svg>
    );
  }
  if (name === "clock") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

interface Props {
  tenant: Tenant;
}

export function AdvantagesSection({ tenant }: Props) {
  const items = parseAdvantages(tenant);

  return (
    <section id="advantages" data-anchor-section className="border-y border-brand-100 bg-surface py-12 md:py-16">
      <div className="mx-auto w-full">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={`${item.title}-${i}`}
              className={`animate-fade-up px-4 text-center ${i === 1 ? "animate-delay-100" : i === 2 ? "animate-delay-200" : ""}`}
            >
              <div
                className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 transition-transform hover:rotate-0 md:h-16 md:w-16 ${item.rotate}`}
              >
                <Icon name={item.icon} />
              </div>
              <h3 className="font-serif mb-2 text-xl font-semibold text-ink-dark">{item.title}</h3>
              <p className="mx-auto max-w-xs text-sm leading-relaxed text-ink-light">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
