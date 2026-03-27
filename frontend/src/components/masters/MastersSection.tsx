import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import type { MasterPublic } from "../../types";
import { fetchMasters } from "../../api/client";

const STORAGE_KEY = "salonflow_prefill_master";

interface Props {
  tenantId: string;
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
    try { sessionStorage.setItem(STORAGE_KEY, masterId); } catch { /* ignore */ }
    if (onNavClick) {
      onNavClick("catalog");
    } else {
      document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (loading || masters.length === 0) return null;

  return (
    <section
      id="masters"
      data-anchor-section
      className="scroll-mt-24 py-16 md:py-24"
    >
      {/* Header */}
      <div className="mb-10 text-center md:mb-14">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40 mb-4">
          Наша команда
        </p>
        <h2 className="font-serif italic text-3xl md:text-5xl text-ink">Мастера</h2>
        <p className="mt-3 mx-auto max-w-lg text-sm text-ink-muted md:text-base">
          Каждый мастер — специалист с опытом и страстью к своему делу
        </p>
      </div>

      <div className={`grid gap-5 ${
        masters.length === 1
          ? "max-w-xs mx-auto"
          : masters.length === 2
          ? "sm:grid-cols-2 max-w-xl mx-auto"
          : masters.length === 3
          ? "sm:grid-cols-3"
          : "sm:grid-cols-2 lg:grid-cols-4"
      }`}>
        {masters.map((m) => (
          <article
            key={m.id}
            className="group flex flex-col overflow-hidden rounded-[28px] bg-white p-2 border border-black/5 transition-all duration-300 hover:-translate-y-1"
            style={{ boxShadow: "none" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(54,49,47,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >
            {/* Portrait image area */}
            <div
              className="rounded-[22px] overflow-hidden w-full"
              style={{ aspectRatio: "3/4", background: "var(--color-placeholder-surface)" }}
            >
              {m.photo_url ? (
                <img
                  src={m.photo_url}
                  alt={m.display_name}
                  className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <UserRound className="h-16 w-16 opacity-20" style={{ color: "var(--color-primary)" }} aria-hidden />
                </div>
              )}
            </div>

            {/* Name / title / bio below image */}
            <div className="px-3 py-3 flex flex-col flex-1">
              <h3 className="font-serif text-xl font-bold text-ink">{m.display_name}</h3>
              {m.title && (
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest opacity-40">
                  {m.title}
                </p>
              )}
              {m.bio ? (
                <p className="mt-2 mb-4 line-clamp-3 text-sm leading-relaxed text-ink-muted">{m.bio}</p>
              ) : (
                <p className="mt-2 mb-4 text-sm italic text-ink-muted/60">Описание скоро появится.</p>
              )}

              <button
                type="button"
                onClick={() => scrollToCatalog(m.id)}
                className="mt-auto w-full rounded-2xl py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-200 active:scale-95 bg-black/5 text-ink/60 hover:bg-ink hover:text-white"
              >
                Записаться
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
