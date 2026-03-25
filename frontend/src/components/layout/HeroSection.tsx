import { Sparkles } from "lucide-react";
import type { Tenant } from "../../types";

const HERO_IMG =
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1000&q=80";

interface Props {
  tenant: Tenant;
}

export function HeroSection({ tenant }: Props) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="relative overflow-hidden pt-8 pb-16 md:pt-16 md:pb-24 lg:pt-24 lg:pb-32">
      {/* Лёгкое свечение сверху — глубина как в премиум-макетах */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_45%_at_50%_-8%,rgba(195,144,119,0.14),transparent_55%)]"
        aria-hidden
      />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-8">
          <div className="animate-fade-up mt-4 text-center md:mt-0 lg:text-left">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-2 text-[10px] font-semibold tracking-widest text-brand-700 uppercase md:text-xs">
              <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={2} aria-hidden />
              Онлайн-запись 24/7
            </div>
            <h1 className="font-serif mb-4 text-4xl leading-tight font-semibold tracking-tight text-balance text-ink-dark sm:text-5xl md:mb-6 lg:text-6xl xl:text-7xl">
              Подчеркните свою{" "}
              <br className="hidden sm:block" />
              <span className="text-brand-500 italic">естественную красоту</span>
            </h1>
            <p className="mx-auto mb-8 max-w-lg px-2 text-base leading-relaxed font-light text-ink-light sm:px-0 md:mb-10 md:text-lg lg:mx-0">
              Премиальный сервис в {tenant.name}: мастера и атмосфера релакса. Запишитесь онлайн в два клика.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <button
                type="button"
                onClick={() => scrollTo("catalog")}
                className="interactive-raise inline-flex w-full min-h-[52px] items-center justify-center rounded-full bg-brand-500 px-8 py-4 text-sm font-medium tracking-wide text-white shadow-lg shadow-brand-500/30 transition-all duration-300 hover:-translate-y-1 hover:bg-brand-600 hover:shadow-brand-500/50 sm:w-auto"
              >
                Выбрать услуги
              </button>
              <button
                type="button"
                onClick={() => scrollTo("portfolio")}
                className="inline-flex w-full min-h-[52px] items-center justify-center rounded-full border border-brand-200 bg-white px-8 py-4 text-sm font-medium tracking-wide text-ink transition-all duration-300 hover:border-brand-500 hover:text-brand-500 sm:w-auto"
              >
                Портфолио
              </button>
            </div>
          </div>

          <div className="animate-fade-up animate-delay-200 relative mt-4 lg:mt-0">
            <div className="absolute top-1/2 left-1/2 -z-10 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-100 opacity-50 blur-3xl" />
            <div className="relative overflow-hidden rounded-3xl shadow-2xl ring-1 ring-black/[0.04] md:rounded-[2rem]">
              <img
                src={HERO_IMG}
                alt=""
                className="h-[350px] w-full object-cover object-center transition-transform duration-700 ease-out sm:h-[450px] lg:h-[500px] md:hover:scale-[1.03]"
                loading="eager"
              />
              <div className="absolute bottom-4 left-4 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-white/60 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md md:bottom-6 md:left-6 md:gap-4 md:px-6 md:py-4">
                <div className="flex shrink-0 -space-x-3">
                  {["А К", "Е С", "М В"].map((name, idx) => (
                    <img
                      key={name}
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${idx === 0 ? "ebdcd3" : idx === 1 ? "dfc6b9" : "d0a996"}&color=654538`}
                      className="h-8 w-8 rounded-full border-2 border-white md:h-10 md:w-10"
                      alt=""
                    />
                  ))}
                </div>
                <div className="min-w-0">
                  <div className="mb-0.5 flex items-center gap-1 text-amber-400 md:mb-1">
                    <svg className="h-3.5 w-3.5 fill-current md:h-4 md:w-4" viewBox="0 0 20 20" aria-hidden>
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-xs font-bold text-ink-dark md:text-sm">5.0</span>
                  </div>
                  <p className="truncate text-[10px] font-medium text-ink-light md:text-xs">Более 200 отзывов</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
