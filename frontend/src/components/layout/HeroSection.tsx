import { Star } from "lucide-react";
import type { Tenant } from "../../types";
import { siteText } from "../../utils/siteContent";

const DEFAULT_HERO_IMG =
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80";

interface Props {
  tenant: Tenant;
}

export function HeroSection({ tenant }: Props) {
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const badge = siteText(tenant, "hero_badge", "Онлайн-запись открыта");
  const line1 = siteText(tenant, "hero_title_line1", "Создаём красоту,");
  const accentTitle = siteText(tenant, "hero_title_accent", "вдохновляясь вами");
  const subtitle = siteText(
    tenant,
    "hero_subtitle",
    "Премиум уход и мастерство в каждой процедуре. Доверьте свою красоту нашим специалистам.",
  );
  const heroImg = siteText(tenant, "hero_image_url", DEFAULT_HERO_IMG);
  const ctaPrimary = siteText(tenant, "hero_cta_primary", "Выбрать услуги");
  const ctaSecondary = siteText(tenant, "hero_cta_secondary", "Наши мастера");
  const ratingNum = siteText(tenant, "hero_rating_text", "4.9");
  const ratingLabel = siteText(tenant, "hero_rating_sub", "Средняя оценка");

  return (
    <section className="relative overflow-hidden pb-16 pt-10 lg:pb-28 lg:pt-20">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-100/70 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-[360px] w-[360px] rounded-full bg-brand-200/40 blur-3xl" />
      </div>

      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* ── Text ─────────────────────────────── */}
        <div className="order-2 min-w-0 text-center lg:order-1 lg:text-left">
          {/* Badge */}
          <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-brand-200 bg-white px-5 py-2 text-xs font-semibold uppercase tracking-widest text-brand-600 shadow-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" aria-hidden />
            {badge}
          </div>

          {/* Headline */}
          <h1
            className="font-serif mb-6 text-balance text-4xl font-semibold leading-[1.07] tracking-tight text-ink sm:text-5xl lg:text-6xl xl:text-[5rem]"
          >
            {line1}
            <br />
            <span className="italic" style={{ color: "var(--color-primary)" }}>
              {accentTitle}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mb-10 max-w-md text-base leading-relaxed text-ink-muted lg:mx-0 md:text-lg">
            {subtitle}
          </p>

          {/* CTAs */}
          <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <button
              type="button"
              onClick={() => scrollTo("catalog")}
              className="group relative inline-flex min-h-[54px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-8 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(192,137,115,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(192,137,115,0.50)] active:scale-[0.98] sm:w-auto"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 75%, #7a3520) 100%)",
              }}
            >
              {ctaPrimary}
              <svg
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => scrollTo("masters")}
              className="inline-flex min-h-[54px] w-full items-center justify-center rounded-xl border border-brand-200 bg-white/80 px-8 text-sm font-medium text-ink backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-400 hover:bg-white hover:text-brand-600 sm:w-auto"
            >
              {ctaSecondary}
            </button>
          </div>

          {/* Stats row */}
          <div className="mt-12 flex flex-wrap justify-center gap-8 border-t border-brand-100 pt-8 lg:justify-start">
            {[
              { value: "1 000+", label: "Клиентов" },
              { value: ratingNum, label: ratingLabel },
              { value: "5+", label: "Лет опыта" },
            ].map((stat, i) => (
              <div key={stat.label} className="flex items-center gap-8">
                {i > 0 && <div className="hidden h-8 w-px bg-brand-200 sm:block" />}
                <div className="text-center lg:text-left">
                  <div
                    className="font-serif text-3xl font-bold text-ink"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {stat.value}
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Image ─────────────────────────────── */}
        <div className="order-1 relative lg:order-2">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-100/50 blur-3xl" aria-hidden />

          {/* Main image */}
          <div className="relative overflow-hidden rounded-[2.5rem] shadow-float md:rounded-[3rem]">
            <img
              src={heroImg}
              alt=""
              className="h-[320px] w-full object-cover sm:h-[420px] lg:h-[520px]"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/15" />
          </div>

          {/* Floating: today's clients */}
          <div className="animate-fade-up animate-delay-200 absolute -bottom-6 -left-4 z-10 hidden sm:-left-8 sm:block">
            <div className="rounded-2xl border border-brand-100 bg-white/96 px-5 py-4 shadow-float backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {["#d4a895", "#c08973", "#a06b57"].map((c) => (
                    <div
                      key={c}
                      className="h-8 w-8 rounded-full border-2 border-white"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div>
                  <p className="text-[11px] font-medium text-ink-muted">Записались сегодня</p>
                  <p className="font-serif text-lg font-bold leading-tight text-ink">12 клиентов</p>
                </div>
              </div>
            </div>
          </div>

          {/* Floating: rating */}
          <div className="animate-fade-up animate-delay-300 absolute -right-4 -top-4 z-10 hidden sm:-right-6 sm:block">
            <div className="rounded-2xl border border-brand-100 bg-white/96 px-5 py-3.5 shadow-float backdrop-blur-md">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={14} className="fill-amber-400 text-amber-400" aria-hidden />
                ))}
              </div>
              <p className="mt-1 font-serif text-sm font-bold text-ink">Сертифицированные мастера</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
