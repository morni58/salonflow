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
          <div className="animate-fade-up order-2 mt-4 min-w-0 text-center lg:order-1 lg:mt-0 lg:text-left">
            <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50 px-4 py-2 text-xs font-semibold tracking-wide text-brand-600 uppercase shadow-sm">
              <span className="h-2 w-2 animate-pulse rounded-sm bg-brand-500" aria-hidden />
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
            <div className="flex flex-col justify-center gap-4 px-4 sm:flex-row sm:px-0 lg:justify-start">
              <button
                type="button"
                onClick={() => scrollTo("catalog")}
                className="interactive-raise inline-flex w-full min-h-[52px] items-center justify-center rounded-lg bg-brand-500 px-8 py-4 text-center text-sm font-medium text-white shadow-[0_8px_20px_rgba(192,137,115,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-600 sm:w-auto"
              >
                {ctaPrimary}
              </button>
              <button
                type="button"
                onClick={() => scrollTo("masters")}
                className="inline-flex w-full min-h-[52px] items-center justify-center rounded-lg border border-brand-200 bg-white px-8 py-4 text-center text-sm font-medium text-ink transition-all duration-300 hover:border-brand-500 hover:text-brand-500 sm:w-auto"
              >
                {ctaSecondary}
              </button>
            </div>
          </div>

          <div className="animate-fade-up animate-delay-100 relative order-1 px-4 sm:px-0 lg:order-2">
            <div className="absolute top-1/2 left-1/2 -z-10 h-[110%] w-[110%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-100/50 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] shadow-float md:rounded-[2.5rem]">
              <img
                src={heroImg}
                alt=""
                className="h-[350px] w-full object-cover transition-transform duration-700 sm:h-[450px] lg:h-[550px] md:hover:scale-105"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
