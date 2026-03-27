import type { Tenant } from "../../types";
import { siteText } from "../../utils/siteContent";

const DEFAULT_HERO_IMG =
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&q=80";

interface Props {
  tenant: Tenant;
}

export function HeroSection({ tenant }: Props) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const badge = siteText(tenant, "hero_badge", "Онлайн-запись открыта");
  const line1 = siteText(tenant, "hero_title_line1", "Создаем красоту,");
  const accentTitle = siteText(tenant, "hero_title_accent", "вдохновляясь вами");
  const subtitle = siteText(
    tenant,
    "hero_subtitle",
    `Ваш любимый салон в центре города. Топовые мастера, премиум-материалы и атмосфера абсолютного уюта.`,
  );
  const heroImg = siteText(tenant, "hero_image_url", DEFAULT_HERO_IMG);
  const ctaPrimary = siteText(tenant, "hero_cta_primary", "Выбрать услуги");
  const ctaSecondary = siteText(tenant, "hero_cta_secondary", "Наши мастера");

  return (
    <section className="relative overflow-hidden pt-10 pb-16 lg:pt-20 lg:pb-24">
      <div className="relative z-10 mx-auto w-full">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">

          {/* Text */}
          <div className="animate-fade-up order-2 mt-4 min-w-0 text-center lg:order-1 lg:mt-0 lg:text-left">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-4 py-2 text-xs font-semibold tracking-wide text-brand-600 uppercase shadow-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" aria-hidden />
              {badge}
            </div>

            <h1 className="font-serif mb-6 text-4xl leading-[1.1] font-semibold tracking-tight text-balance text-ink sm:text-5xl lg:text-6xl">
              {line1}
              <br />
              <span className="text-brand-500 italic font-medium">{accentTitle}</span>
            </h1>

            <p className="mx-auto mb-8 max-w-lg px-4 text-base leading-relaxed text-ink-muted sm:px-0 lg:mx-0 lg:px-0 md:text-lg">
              {subtitle}
            </p>

            {/* CTAs */}
            <div className="flex flex-col justify-center gap-3 px-4 sm:flex-row sm:px-0 lg:justify-start">
              <button
                type="button"
                onClick={() => scrollTo("catalog")}
                className="interactive-raise inline-flex w-full min-h-[52px] items-center justify-center gap-2 rounded-xl bg-brand-500 px-8 py-4 text-center text-sm font-semibold text-white shadow-[0_8px_24px_rgba(192,137,115,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-[0_12px_28px_rgba(192,137,115,0.40)] sm:w-auto"
              >
                {ctaPrimary}
              </button>
              <button
                type="button"
                onClick={() => scrollTo("masters")}
                className="inline-flex w-full min-h-[52px] items-center justify-center rounded-xl border border-brand-200 bg-white/80 px-8 py-4 text-center text-sm font-medium text-ink transition-all duration-300 hover:border-brand-400 hover:bg-white hover:text-brand-600 sm:w-auto"
              >
                {ctaSecondary}
              </button>
            </div>

            {/* Scroll hint */}
            <button
              type="button"
              onClick={() => scrollTo("catalog")}
              className="mt-10 hidden items-center gap-2 text-xs text-ink-light opacity-50 transition-opacity hover:opacity-80 lg:inline-flex"
            >
              <span>Прокрутите вниз</span>
              <span className="animate-bounce">↓</span>
            </button>
          </div>

          {/* Image */}
          <div className="animate-fade-up animate-delay-100 relative order-1 px-4 sm:px-0 lg:order-2">
            {/* Glow */}
            <div className="absolute top-1/2 left-1/2 -z-10 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-100/60 blur-3xl" />

            <div className="relative overflow-hidden rounded-[2rem] shadow-float md:rounded-[2.5rem]">
              <img
                src={heroImg}
                alt=""
                className="h-[340px] w-full object-cover sm:h-[440px] lg:h-[540px]"
                loading="eager"
              />
              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-transparent" />
            </div>

            {/* Floating stat card */}
            <div className="absolute -bottom-4 -left-2 sm:-left-6 animate-fade-up animate-delay-200 hidden sm:block">
              <div className="rounded-2xl border border-brand-100 bg-white/95 px-5 py-3.5 shadow-float backdrop-blur-sm">
                <p className="text-xs text-ink-muted">Довольных клиентов</p>
                <p className="font-serif text-2xl font-bold text-ink">1 000+</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
