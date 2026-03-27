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
    <section className="relative overflow-hidden pt-32 md:pt-44 pb-16 md:pb-24">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* ── Text ─────────────────────────────── */}
        <div className="order-2 min-w-0 text-center lg:order-1 lg:text-left">
          {/* Badge — small label above title */}
          <div className="mb-6 flex justify-center lg:justify-start">
            <span className="inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest opacity-40">
              <span className="h-1 w-1 rounded-full bg-current animate-pulse" aria-hidden />
              {badge}
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-serif italic mb-7 text-balance text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem] leading-[1.05] text-ink">
            {line1}
            <br />
            <span style={{ color: "var(--color-primary)" }}>
              {accentTitle}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mb-10 max-w-md text-base leading-relaxed text-ink-muted lg:mx-0">
            {subtitle}
          </p>

          {/* CTAs */}
          <div className="flex flex-col justify-center gap-4 sm:flex-row lg:justify-start items-center">
            <button
              type="button"
              onClick={() => scrollTo("catalog")}
              className="btn-ink w-full sm:w-auto"
            >
              {ctaPrimary}
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => scrollTo("masters")}
              className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-ink/50 hover:text-ink transition-colors"
            >
              {ctaSecondary}
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Stats row */}
          <div className="mt-14 flex flex-wrap justify-center gap-8 border-t border-black/5 pt-8 lg:justify-start">
            {[
              { value: "1 000+", label: "Клиентов" },
              { value: ratingNum, label: ratingLabel },
              { value: "5+", label: "Лет опыта" },
            ].map((stat, i) => (
              <div key={stat.label} className="flex items-center gap-8">
                {i > 0 && <div className="hidden h-7 w-px bg-black/8 sm:block" />}
                <div className="text-center lg:text-left">
                  <div className="font-serif italic text-3xl font-bold text-ink" style={{ letterSpacing: "-0.02em" }}>
                    {stat.value}
                  </div>
                  <div className="mt-0.5 text-[9px] font-bold uppercase tracking-widest opacity-40">
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Image ─────────────────────────────── */}
        <div className="order-1 relative lg:order-2">
          {/* Asymmetric clip-path image */}
          <div className="hero-img-clip overflow-hidden">
            <img
              src={heroImg}
              alt=""
              className="h-[300px] w-full object-cover sm:h-[420px] lg:h-[540px]"
              loading="eager"
            />
          </div>

          {/* Floating card: today's clients */}
          <div className="animate-fade-up animate-delay-200 animate-bounce-slow absolute -bottom-4 -left-4 z-10 hidden sm:-left-6 sm:block">
            <div
              className="rounded-2xl px-5 py-4 backdrop-blur-md"
              style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 12px 40px rgba(54,49,47,0.08)" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {["#d4a895", "#c08973", "#a06b57"].map((c) => (
                    <div
                      key={c}
                      className="h-7 w-7 rounded-full border-2 border-white"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Записались сегодня</p>
                  <p className="font-serif text-base font-bold leading-tight text-ink">12 клиентов</p>
                </div>
              </div>
            </div>
          </div>

          {/* Floating card: rating */}
          <div className="animate-fade-up animate-delay-300 animate-bounce-slow absolute -right-3 top-6 z-10 hidden sm:-right-5 sm:block" style={{ animationDelay: "0.8s" }}>
            <div
              className="rounded-2xl px-4 py-3 backdrop-blur-md"
              style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 12px 40px rgba(54,49,47,0.08)" }}
            >
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={13} className="fill-amber-400 text-amber-400" aria-hidden />
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
