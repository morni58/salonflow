import { useEffect, useState } from "react";
import { UserRound, Calendar } from "lucide-react";
import type { MasterPublic } from "../../types";
import { fetchMasters } from "../../api/client";
import { MediaFrame } from "../common/MediaFrame";

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

  const gridClass =
    masters.length === 1
      ? "max-w-xs mx-auto"
      : masters.length === 2
      ? "grid sm:grid-cols-2 max-w-xl mx-auto gap-5"
      : masters.length === 3
      ? "grid sm:grid-cols-3 gap-5"
      : "grid sm:grid-cols-2 lg:grid-cols-4 gap-5";

  return (
    <section id="masters" data-anchor-section className="scroll-mt-24 py-20 md:py-28">
      <div className="mb-10 text-center md:mb-14">
        <p
          className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] opacity-40"
          style={{ color: "var(--color-text)" }}
        >
          Наша команда
        </p>
        <h2
          className="font-serif text-3xl font-bold md:text-5xl"
          style={{ color: "var(--color-text)" }}
        >
          Мастера
        </h2>
        <p
          className="mt-3 mx-auto max-w-md text-sm leading-relaxed opacity-60"
          style={{ color: "var(--color-text)" }}
        >
          Каждый специалист — профессионал с опытом и страстью к своему делу
        </p>
      </div>

      <div className={gridClass}>
        {masters.map((m) => (
          <MasterCard key={m.id} master={m} onBook={() => scrollToCatalog(m.id)} />
        ))}
      </div>
    </section>
  );
}

function MasterCard({ master: m, onBook }: { master: MasterPublic; onBook: () => void }) {
  return (
    <article
      className="hover-lift group flex flex-col overflow-hidden rounded-2xl bg-white border border-black/[0.06]"
      style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
    >
      {/* Portrait */}
      <div
        className="relative flex w-full overflow-hidden rounded-t-2xl"
        style={{ aspectRatio: "3/4", background: "var(--color-placeholder-surface, #f0ebe6)" }}
      >
        {m.photo_url ? (
          <MediaFrame
            src={m.photo_url}
            alt={m.display_name}
            className="h-full w-full min-h-0 min-w-0"
            imgClassName="transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UserRound
              className="h-20 w-20 opacity-15"
              style={{ color: "var(--color-primary)" }}
              aria-hidden
            />
          </div>
        )}

        {/* Experience badge */}
        {m.experience && (
          <span
            className="absolute top-3 right-3 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
          >
            {m.experience}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col px-5 py-5">
        <h3
          className="font-serif text-xl font-bold leading-tight"
          style={{ color: "var(--color-text)" }}
        >
          {m.display_name}
        </h3>

        {m.title && (
          <p
            className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] opacity-45"
            style={{ color: "var(--color-text)" }}
          >
            {m.title}
          </p>
        )}

        <div className="mt-3 mb-5 flex-1">
          {m.bio ? (
            <p
              className="line-clamp-3 text-sm leading-relaxed opacity-65"
              style={{ color: "var(--color-text)", wordBreak: "break-word" }}
            >
              {m.bio}
            </p>
          ) : (
            <p className="text-sm italic opacity-35" style={{ color: "var(--color-text)" }}>
              Описание скоро появится.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onBook}
          className="flex h-[60px] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200 active:scale-[0.97] hover:opacity-90"
          style={{
            background: "var(--color-primary)",
            color: "#fff",
          }}
        >
          <Calendar size={16} strokeWidth={2.5} aria-hidden />
          Записаться
        </button>
      </div>
    </article>
  );
}
