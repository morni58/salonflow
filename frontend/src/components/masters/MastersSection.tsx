import { useEffect, useState } from "react";
import { UserRound, Sparkles } from "lucide-react";
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
      className="scroll-mt-24 rounded-2xl py-16 md:py-24"
      style={{ background: "var(--color-primary-muted)" }}
    >
      {/* Header */}
      <div className="mb-10 text-center md:mb-14">
        <span
          className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
          style={{ borderColor: "var(--color-primary-20)", background: "white", color: "var(--color-primary)" }}
        >
          <Sparkles size={11} aria-hidden />
          Наша команда
        </span>
        <h2 className="font-serif text-3xl font-semibold text-ink md:text-5xl">Мастера</h2>
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
            className="group flex flex-col items-center rounded-2xl bg-white p-6 text-center shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-float"
          >
            {/* Avatar */}
            <div className="relative mb-5 h-28 w-28 overflow-hidden rounded-full ring-4 ring-white shadow-soft">
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
                  <UserRound className="h-14 w-14 opacity-25" style={{ color: "var(--color-primary)" }} aria-hidden />
                </div>
              )}
            </div>

            <h3 className="font-serif text-xl font-semibold text-ink">{m.display_name}</h3>
            {m.title && (
              <p className="mt-1 mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-primary)" }}>
                {m.title}
              </p>
            )}
            {m.bio ? (
              <p className="mb-5 line-clamp-3 text-sm leading-relaxed text-ink-muted">{m.bio}</p>
            ) : (
              <p className="mb-5 text-sm italic text-ink-muted/60">Описание скоро появится.</p>
            )}

            <button
              type="button"
              onClick={() => scrollToCatalog(m.id)}
              className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-all duration-200 active:scale-[0.97] hover:text-white"
              style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "var(--color-primary)";
                el.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "";
                el.style.color = "var(--color-primary)";
              }}
            >
              Записаться
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
