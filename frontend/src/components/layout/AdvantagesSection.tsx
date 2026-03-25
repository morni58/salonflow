const ITEMS = [
  {
    icon: "sparkle",
    title: "Премиум материалы",
    text: "Используем только сертифицированную косметику люкс сегмента от мировых брендов.",
    rotate: "rotate-3",
  },
  {
    icon: "clock",
    title: "Экономия времени",
    text: "Услуги в 4 руки. Маникюр, педикюр и укладка одновременно без потери качества.",
    rotate: "-rotate-3",
  },
  {
    icon: "smile",
    title: "Абсолютный релакс",
    text: "Свежесваренный кофе, шампанское, удобные кресла-реклайнеры и приятная музыка.",
    rotate: "rotate-3",
  },
] as const;

function Icon({ name }: { name: (typeof ITEMS)[number]["icon"] }) {
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

export function AdvantagesSection() {
  return (
    <section
      id="advantages"
      data-anchor-section
      className="border-y border-white/10 py-14 md:py-20"
      style={{ background: "color-mix(in srgb, var(--color-text) 4%, var(--color-bg))" }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {ITEMS.map((item, i) => (
            <div
              key={item.title}
              className={`animate-fade-up px-4 text-center ${i === 1 ? "animate-delay-100" : i === 2 ? "animate-delay-200" : ""}`}
            >
              <div
                className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[var(--color-primary)] backdrop-blur-sm transition-transform hover:rotate-0 md:h-16 md:w-16 ${item.rotate}`}
              >
                <Icon name={item.icon} />
              </div>
              <h3 className="mb-2 text-xl font-bold" style={{ color: "var(--color-text)" }}>
                {item.title}
              </h3>
              <p className="mx-auto max-w-xs text-sm leading-relaxed opacity-75" style={{ color: "var(--color-text)" }}>
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
