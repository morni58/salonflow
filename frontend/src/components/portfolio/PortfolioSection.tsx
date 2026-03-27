import { useState, useEffect, useRef } from "react";
import { X, Images, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import type { PortfolioCategory, PortfolioImage } from "../../types";
import { fetchPortfolio } from "../../api/client";
import { SegmentedTabs, type SegmentedTabItem } from "../common/SegmentedTabs";
import { cn } from "../../utils";
import { toast } from "../common/Toast";

interface Props {
  tenantId: string;
  title?: string;
  subtitle?: string;
}

export function PortfolioSection({
  tenantId,
  title = "Наши работы",
  subtitle = "Больше фото в наших соцсетях",
}: Props) {
  const [data, setData] = useState<PortfolioCategory[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    fetchPortfolio(tenantId)
      .then(setData)
      .catch(() => toast.error("Не удалось загрузить портфолио. Проверьте соединение."))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const categories = data.map((d) => d.category);
  const portfolioTabs: SegmentedTabItem[] = [
    { key: null, label: "Все" },
    ...categories.map((c) => ({ key: c, label: c })),
  ];
  const allImages: PortfolioImage[] = active
    ? data.filter((d) => d.category === active).flatMap((d) => d.images)
    : data.flatMap((d) => d.images);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft" && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
      if (e.key === "ArrowRight" && lightboxIndex < allImages.length - 1) setLightboxIndex(lightboxIndex + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, allImages.length]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (lightboxIndex !== null) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [lightboxIndex]);

  const imageCount = allImages.length;
  const imageCountLabel =
    imageCount === 1 ? "1 работа" : imageCount < 5 ? `${imageCount} работы` : `${imageCount} работ`;

  if (loading) {
    return (
      <section id="portfolio" data-anchor-section className="overflow-hidden bg-base scroll-mt-24 py-16 md:py-24">
        <div className="mx-auto w-full max-w-[var(--layout-max)] px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-3xl font-semibold text-ink md:text-5xl">{title}</h2>
          </div>
          <div className="columns-2 gap-3 md:columns-3 lg:columns-4 lg:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="mb-3 break-inside-avoid"
                style={{ height: `${160 + (i % 3) * 60}px` }}
              >
                <div className="h-full w-full animate-pulse rounded-2xl bg-brand-100" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="portfolio" data-anchor-section className="overflow-hidden bg-base scroll-mt-24 py-16 md:py-24">
      <div className="mx-auto w-full max-w-[var(--layout-max)] px-4 sm:px-6 lg:px-8">

        {/* Section header — consistent badge treatment */}
        <div className="mb-10 text-center md:mb-14">
          <span
            className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
            style={{ borderColor: "var(--color-primary-20)", background: "var(--color-primary-muted)", color: "var(--color-primary)" }}
          >
            <Images size={11} aria-hidden />
            {data.length > 0 && imageCount > 0 ? imageCountLabel : "Портфолио"}
          </span>
          <h2 className="font-serif text-3xl font-semibold text-ink md:text-5xl">{title}</h2>
          <p className="mt-3 text-sm text-ink-muted md:text-base">{subtitle}</p>
        </div>

        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-100 bg-brand-50/50 px-6 py-14 text-center">
            <Images className="mb-3 text-brand-400" size={44} aria-hidden />
            <p className="max-w-sm text-sm leading-relaxed text-ink-muted">
              Здесь будут фото работ. Администратор может загрузить их в Telegram-боте в разделе портфолио.
            </p>
          </div>
        ) : (
          <>
            {categories.length > 0 && (
              <div className="mb-8">
                <SegmentedTabs
                  ariaLabel="Категории портфолио"
                  tabs={portfolioTabs}
                  activeKey={active}
                  onSelect={setActive}
                  allLabel="Все"
                />
              </div>
            )}

            {/* Masonry grid */}
            <div className="columns-2 gap-3 md:columns-3 lg:columns-4 lg:gap-4">
              {allImages.map((img, idx) => (
                <div key={img.id} className="mb-3 break-inside-avoid lg:mb-4">
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className="portfolio-thumb group relative w-full overflow-hidden rounded-2xl focus-visible:outline-none"
                    aria-label={`Открыть фото ${idx + 1}`}
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                      style={{ display: "block" }}
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/25">
                      <div className="scale-75 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                        <div className="rounded-full bg-white/20 p-3 backdrop-blur-sm">
                          <ZoomIn size={22} className="text-white drop-shadow" />
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/92 backdrop-blur-md animate-fade-in"
          onClick={() => setLightboxIndex(null)}
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const diff = touchStartX.current - e.changedTouches[0].clientX;
            if (Math.abs(diff) < 50) return;
            if (diff > 0 && lightboxIndex < allImages.length - 1) setLightboxIndex(lightboxIndex + 1);
            if (diff < 0 && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
            touchStartX.current = null;
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
            {lightboxIndex + 1} / {allImages.length}
          </div>

          {/* Prev arrow */}
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/25 md:left-6"
              aria-label="Предыдущее фото"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Image */}
          <img
            key={lightboxIndex}
            src={allImages[lightboxIndex].url}
            alt=""
            className="max-h-[85vh] max-w-[88vw] rounded-xl object-contain shadow-2xl animate-scale-in md:max-w-[78vw]"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />

          {/* Next arrow */}
          {lightboxIndex < allImages.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/25 md:right-6"
              aria-label="Следующее фото"
            >
              <ChevronRight size={24} />
            </button>
          )}

          {/* Dot indicators (up to 12 images) */}
          {allImages.length <= 12 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5">
              {allImages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === lightboxIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                  )}
                  aria-label={`Фото ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
