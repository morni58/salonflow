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

  if (loading) {
    return (
      <section id="portfolio" data-anchor-section className="bg-brand-900 pt-16 pb-0 text-white md:pt-20">
        <div className="mx-auto w-full px-0 pb-16 md:pb-20">
          <h2 className="font-serif mb-4 text-center text-3xl font-semibold tracking-tight text-balance md:mb-6 md:text-4xl lg:text-5xl">Портфолио</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-xl border border-brand-700 bg-brand-800/50 md:h-48 md:rounded-2xl"
              />
            ))}
          </div>
        </div>
        <div className="h-16 w-full bg-gradient-to-b from-brand-900 to-base md:h-24" aria-hidden />
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
    <section id="portfolio" data-anchor-section className="bg-brand-900 pt-16 pb-0 text-white md:pt-20">
      <div className="mx-auto w-full px-0 pb-16 text-center md:pb-20">
        <h2 className="font-serif mb-4 text-3xl font-semibold tracking-tight text-balance md:mb-6 md:text-4xl lg:text-5xl">Портфолио</h2>
        <p className="mx-auto mb-8 max-w-2xl text-sm text-brand-200 md:mb-12 md:text-base">
          Вдохновляйтесь нашими работами. Идеальный результат — наша визитная карточка.
        </p>

        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-700 bg-brand-800/40 px-6 py-14 text-center">
            <Images className="mb-3 text-brand-300" size={44} aria-hidden />
            <p className="max-w-sm text-sm leading-relaxed text-brand-200/90">
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
                  className="group h-36 overflow-hidden rounded-xl opacity-90 transition-opacity hover:opacity-100 active:scale-[0.98] md:h-48 md:rounded-2xl"
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

      <div className="h-16 w-full bg-gradient-to-b from-brand-900 to-base md:h-24" aria-hidden />

      {lightbox && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
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
