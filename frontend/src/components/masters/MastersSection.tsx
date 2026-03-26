import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import type { MasterPublic } from "../../types";
import { fetchMasters } from "../../api/client";

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
    <section id="masters" data-anchor-section className="scroll-mt-24 rounded-[2rem] bg-brand-50 px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mb-12 text-center">
        <h2 className="font-serif mb-4 text-3xl font-semibold text-ink md:text-5xl">Наши мастера</h2>
        <p className="mx-auto max-w-xl text-sm text-ink-muted md:text-base">
          Команда профессионалов, искренне влюблённых в своё дело и вашу красоту.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {masters.map((m) => (
          <article
            key={m.id}
            className="master-card flex flex-col items-center rounded-[2rem] border border-brand-100 bg-white p-6 text-center shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-float"
          >
            <div className="relative mb-5 h-28 w-28 shrink-0 overflow-hidden rounded-full shadow-inner ring-1 ring-brand-100">
              {m.photo_url ? (
                <img src={m.photo_url} alt="" className="h-full w-full object-cover object-center" loading="lazy" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ background: "var(--color-placeholder-surface)" }}
                >
                  <UserRound className="h-14 w-14 opacity-30" style={{ color: "var(--color-primary)" }} aria-hidden />
                </div>
              )}
            </div>
            <h3 className="font-serif text-2xl font-semibold text-ink">{m.display_name}</h3>
            {m.title ? <p className="mb-3 text-sm font-medium text-brand-500">{m.title}</p> : null}
            {m.bio ? (
              <p className="mb-6 line-clamp-4 text-sm leading-relaxed text-ink-muted">{m.bio}</p>
            ) : (
              <p className="mb-6 text-sm italic text-ink-muted/80">Описание скоро появится.</p>
            )}
            <button
              type="button"
              onClick={() => scrollToCatalog(m.id)}
              className="mt-auto w-full rounded-lg border border-brand-200 px-6 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-brand-50"
            >
              К специалисту
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

