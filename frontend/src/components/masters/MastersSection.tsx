import { useEffect, useState } from "react";
import { UserRound, Sparkles } from "lucide-react";
import type { MasterPublic } from "../../types";
import { fetchMasters } from "../../api/client";
import { cn } from "../../utils";

const STORAGE_KEY = "salonflow_prefill_master";

interface Props {
  tenantId: string;
}

export function MastersSection({ tenantId }: Props) {
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
    document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading || masters.length === 0) {
    return null;
  }

  return (
    <section id="masters" data-anchor-section className="scroll-mt-24 py-12 md:py-16">
      <div className="mb-10 text-center md:mb-12">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-[10px] font-semibold tracking-widest text-brand-600 uppercase">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Команда
        </div>
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-balance text-ink-dark md:text-4xl">
          Наши мастера
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-ink-light md:text-base">
          Выберите специалиста при записи — у каждого свой график и стиль.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {masters.map((m, idx) => (
          <article
            key={m.id}
            className={cn(
              "group flex flex-col overflow-hidden rounded-[2rem] border border-transparent bg-surface shadow-soft ring-1 ring-black/[0.04] transition-all duration-500 md:rounded-[2.25rem]",
              "hover:-translate-y-1 hover:shadow-soft-md"
            )}
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-brand-50">
              {m.photo_url ? (
                <img
                  src={m.photo_url}
                  alt=""
                  className="h-full w-full object-cover object-center transition-transform duration-700 md:group-hover:scale-[1.04]"
                  loading="lazy"
                />
              ) : (
                <div
                  className="flex h-full w-full flex-col items-center justify-center gap-2"
                  style={{ background: "var(--color-placeholder-surface)" }}
                >
                  <UserRound className="h-16 w-16 opacity-30" style={{ color: "var(--color-primary)" }} aria-hidden />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-80 md:opacity-100" />
            </div>
            <div className="flex flex-1 flex-col p-6 md:p-7">
              {m.title ? (
                <p className="mb-1 text-[10px] font-semibold tracking-[0.2em] text-brand-500 uppercase">{m.title}</p>
              ) : null}
              <h3 className="font-serif text-xl font-semibold text-ink-dark md:text-2xl">{m.display_name}</h3>
              {m.bio ? (
                <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-ink-light md:line-clamp-5">{m.bio}</p>
              ) : (
                <p className="mt-3 text-sm italic text-ink-light/70">Описание скоро появится.</p>
              )}
              <button
                type="button"
                onClick={() => scrollToCatalog(m.id)}
                className="interactive-raise mt-6 w-full rounded-full py-3.5 text-sm font-medium transition-colors"
                style={{
                  background: "var(--color-primary)",
                  color: "var(--color-primary-foreground)",
                }}
              >
                Записаться к мастеру
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
