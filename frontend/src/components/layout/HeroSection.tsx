import { Sparkles, ChevronDown } from "lucide-react";
import type { Tenant } from "../../types";

interface Props {
  tenant: Tenant;
}

export function HeroSection({ tenant }: Props) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="relative flex min-h-[min(92vh,52rem)] flex-col items-center justify-center overflow-hidden pt-20 pb-16 md:pt-24 md:pb-24">
      {/* Сетка 3% — как в спецификации */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Gradient orbs + float */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -left-24 top-16 h-[22rem] w-[22rem] rounded-full opacity-45 blur-3xl"
          style={{ background: "var(--color-primary)", animation: "float 9s ease-in-out infinite" }}
        />
        <div
          className="absolute -right-20 bottom-20 h-[26rem] w-[26rem] rounded-full opacity-40 blur-3xl"
          style={{ background: "var(--color-accent)", animation: "float 11s ease-in-out infinite reverse" }}
        />
        <div
          className="absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--color-primary)", animation: "float 13s ease-in-out infinite" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
        <div
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] backdrop-blur-md md:mb-10 md:text-xs"
          style={{
            color: "var(--color-text)",
            animation: "fadeSlideUp 0.8s ease-out 0s both",
          }}
        >
          <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" style={{ color: "var(--color-accent)" }} strokeWidth={2} aria-hidden />
          Онлайн-запись 24/7
        </div>

        <h1
          className="text-4xl font-bold leading-[1.12] sm:text-5xl md:text-6xl lg:text-7xl"
          style={{ color: "var(--color-text)" }}
        >
          <span className="block" style={{ animation: "fadeSlideUp 0.85s ease-out 0.08s both" }}>
            Подчеркните свою
          </span>
          <span className="relative mt-2 inline-block" style={{ animation: "fadeSlideUp 0.85s ease-out 0.18s both" }}>
            <span
              className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] bg-clip-text text-transparent"
              style={{ WebkitBackgroundClip: "text" }}
            >
              естественную красоту
            </span>
            <svg
              className="absolute -bottom-1 left-0 h-3 w-full overflow-visible"
              viewBox="0 0 320 14"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M0 10 Q 160 2 320 10"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="400"
                strokeDashoffset="400"
                style={{ animation: "drawLine 1.1s ease-out 0.75s forwards" }}
              />
            </svg>
          </span>
        </h1>

        <p
          className="mx-auto mt-4 max-w-xl px-1 text-base leading-relaxed sm:text-lg md:mt-6"
          style={{
            color: "var(--color-text)",
            opacity: 0.72,
            animation: "fadeSlideUp 0.85s ease-out 0.28s both",
          }}
        >
          Премиальный сервис в {tenant.name}: мастера и атмосфера релакса. Запишитесь онлайн в два клика.
        </p>

        <div
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5"
          style={{ animation: "fadeSlideUp 0.85s ease-out 0.38s both" }}
        >
          <button
            type="button"
            onClick={() => scrollTo("catalog")}
            className="btn-primary-soft inline-flex w-full min-h-[52px] items-center justify-center gap-2 rounded-full px-10 py-4 text-sm font-semibold tracking-wide sm:w-auto"
            style={{
              background: "var(--color-primary)",
              color: "var(--color-primary-foreground)",
              boxShadow: "0 12px 40px color-mix(in srgb, var(--color-primary) 40%, transparent)",
            }}
          >
            Выбрать услуги
            <ChevronDown className="h-5 w-5 animate-bounce-arrow" strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scrollTo("portfolio")}
            className="glass inline-flex w-full min-h-[52px] items-center justify-center rounded-full px-10 py-4 text-sm font-semibold tracking-wide transition-colors hover:bg-white/10 sm:w-auto"
            style={{ color: "var(--color-text)" }}
          >
            Портфолио
          </button>
        </div>
      </div>
    </section>
  );
}
