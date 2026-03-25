import { useState, useEffect } from "react";
import { X, Images } from "lucide-react";
import type { PortfolioCategory } from "../../types";
import { fetchPortfolio } from "../../api/client";
import { SegmentedTabs, type SegmentedTabItem } from "../common/SegmentedTabs";

export function PortfolioSection({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<PortfolioCategory[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortfolio(tenantId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantId]);

  const sectionBg = "color-mix(in srgb, var(--color-text) 6%, var(--color-bg))";

  if (loading) {
    return (
      <section id="portfolio" data-anchor-section className="py-16 md:py-20" style={{ background: sectionBg }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2
            className="mb-4 text-center text-3xl font-bold md:mb-6 md:text-4xl lg:text-5xl"
            style={{ color: "var(--color-text)" }}
          >
            Портфолио
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-36 rounded-xl border border-white/10 md:h-48 md:rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const categories = data.map((d) => d.category);
  const portfolioTabs: SegmentedTabItem[] = [
    { key: null, label: "Все" },
    ...categories.map((c) => ({ key: c, label: c })),
  ];
  const allImages = active
    ? data.filter((d) => d.category === active).flatMap((d) => d.images)
    : data.flatMap((d) => d.images);

  return (
    <section id="portfolio" data-anchor-section className="py-16 md:py-20" style={{ background: sectionBg }}>
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="mb-4 text-3xl font-bold md:mb-6 md:text-4xl lg:text-5xl" style={{ color: "var(--color-text)" }}>
          Портфолио
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-sm opacity-75 md:mb-12 md:text-base" style={{ color: "var(--color-text)" }}>
          Вдохновляйтесь нашими работами. Идеальный результат — наша визитная карточка.
        </p>

        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-14 text-center backdrop-blur-sm">
            <Images className="mb-3 opacity-50" size={44} style={{ color: "var(--color-accent)" }} aria-hidden />
            <p className="max-w-sm text-sm leading-relaxed opacity-80" style={{ color: "var(--color-text)" }}>
              Здесь будут фото работ. Администратор может загрузить их в Telegram-боте в разделе портфолио.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <SegmentedTabs
                ariaLabel="Категории портфолио"
                tabs={portfolioTabs}
                activeKey={active}
                onSelect={setActive}
                dark
                allLabel="Все"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {allImages.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setLightbox(img.url)}
                  className="group h-36 overflow-hidden rounded-xl border border-white/10 opacity-95 transition-all hover:opacity-100 active:scale-[0.98] md:h-48 md:rounded-2xl"
                >
                  <img
                    src={img.url}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <button type="button" className="absolute right-4 top-4 text-white/80 hover:text-white">
            <X size={28} />
          </button>
          <img src={lightbox} alt="" className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl" />
        </div>
      )}
    </section>
  );
}
