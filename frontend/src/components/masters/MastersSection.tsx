import { useEffect, useState } from "react";
import { UserRound, Sparkles } from "lucide-react";
import type { MasterPublic } from "../../types";
import { fetchMasters } from "../../api/client";

const STORAGE_KEY = "salonflow_prefill_master";

interface Props {
  tenantId: string;
  /** Для корректного скролла к каталогу (в т.ч. с checkout-страницы) */
  onNavClick?: (sectionId: string) => void;
}

export function MastersSection({ tenantId, onNavClick }: Props) {
  const [masters, setMasters] = useState<MasterPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMasters(tenantId)
      .then((r) => setMasters(r.masters))
      .catch(() => setMasters([]))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const scrollToCatalog = (masterId: string) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, masterId);
    } catch {
      /* ignore */
    }
    if (onNavClick) {
      onNavClick("catalog");
    } else {
      document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (loading || masters.length === 0) {
    return null;
  }

  return (
    <section
      id="masters"
      data-anchor-section
      className="scroll-mt-24 rounded-[2rem] py-16 sm:px-6 md:py-24 lg:px-8"
      style={{ background: "var(--color-primary-muted, rgba(192,137,115,0.08))" }}
    >
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white/70 px-4 py-2 text-xs font-semibold tracking-wide text-brand-600 uppercase shadow-sm backdrop-blur-sm">
          <Sparkles size={14} aria-hidden />
          Команда профессионалов
        </div>
        <h2 className="font-serif mb-4 text-3xl font-semibold text-ink md:text-5xl">Наши мастера</h2>
        <p className="mx-auto max-w-xl text-sm text-ink-muted md:text-base">
          Искусство создавать красоту — не работа, а призвание. Познакомьтесь с теми, кто сделает вас безупречными.
        </p>
      </div>

      <div className={`grid gap-6 ${masters.length === 1 ? "max-w-sm mx-auto" : masters.length === 2 ? "sm:grid-cols-2 max-w-2xl mx-auto" : masters.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
        {masters.map((m) => (
          <article
            key={m.id}
            className="master-card group flex flex-col items-center rounded-[2rem] bg-white p-6 text-center shadow-soft transition-all duration-300 hover:-translate-y-2 hover:shadow-float"
          >
            {/* Фото */}
            <div className="relative mb-5">
              <div
                className="h-32 w-32 overflow-hidden rounded-full ring-4 ring-white shadow-soft"
                style={{ boxShadow: "0 0 0 4px white, 0 0 0 6px var(--color-primary-20, rgba(192,137,115,0.2))" }}
              >
                {m.photo_url ? (
                  <img
                    src={m.photo_url}
                    alt={m.display_name}
                    className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{ background: "var(--color-placeholder-surface)" }}
                  >
                    <UserRound className="h-16 w-16 opacity-30" style={{ color: "var(--color-primary)" }} aria-hidden />
                  </div>
                )}
              </div>
              {/* Декоративный кружок */}
              <div
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full border-2 border-white shadow-sm"
                style={{ background: "var(--color-primary)" }}
                aria-hidden
              />
            </div>

            <h3 className="font-serif text-2xl font-semibold text-ink">{m.display_name}</h3>
            {m.title && (
              <p className="mt-1 mb-3 text-sm font-semibold tracking-wide text-brand-500 uppercase">{m.title}</p>
            )}
            {m.bio ? (
              <p className="mb-6 line-clamp-4 text-sm leading-relaxed text-ink-muted">{m.bio}</p>
            ) : (
              <p className="mb-6 text-sm italic text-ink-muted/70">Описание скоро появится.</p>
            )}

            <button
              type="button"
              onClick={() => scrollToCatalog(m.id)}
              className="mt-auto w-full rounded-xl border border-brand-200 bg-brand-50 px-6 py-2.5 text-sm font-semibold text-brand-600 transition-all duration-300 hover:bg-brand-500 hover:text-white hover:border-transparent hover:shadow-soft"
            >
              Записаться
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
