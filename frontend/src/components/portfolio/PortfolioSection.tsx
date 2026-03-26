import { useState, useEffect } from "react";
import { X, Images } from "lucide-react";
import type { PortfolioCategory } from "../../types";
import { fetchPortfolio } from "../../api/client";
import { SegmentedTabs, type SegmentedTabItem } from "../common/SegmentedTabs";

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
      <section id="portfolio" data-anchor-section className="overflow-hidden bg-base py-16 md:py-24">
        <div className="mx-auto w-full max-w-[var(--layout-max)] px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif mb-4 text-center text-3xl font-semibold text-ink md:text-5xl">{title}</h2>
          <div className="flex gap-4 overflow-hidden pb-4 md:grid md:grid-cols-4 md:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 w-[70vw] shrink-0 animate-pulse rounded-3xl bg-brand-100 md:h-80 md:w-full" />
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
    <section id="portfolio" data-anchor-section className="overflow-hidden bg-base py-16 md:py-24">
      <div className="mx-auto w-full max-w-[var(--layout-max)] px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="font-serif mb-2 text-3xl font-semibold text-ink md:text-5xl">{title}</h2>
            <p className="text-sm text-ink-muted md:text-base">{subtitle}</p>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-brand-100 bg-brand-50/50 px-6 py-14 text-center">
            <Images className="mb-3 text-brand-400" size={44} aria-hidden />
            <p className="max-w-sm text-sm leading-relaxed text-ink-muted">
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
                allLabel="Все"
              />
            </div>

            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 md:grid md:grid-cols-4 md:gap-6 md:overflow-visible">
              {allImages.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setLightbox(img.url)}
                  className="group h-64 w-[70vw] shrink-0 overflow-hidden rounded-3xl md:h-80 md:w-full"
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
          className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <button type="button" className="absolute right-4 top-4 text-white/90 hover:text-white">
            <X size={28} />
          </button>
          <img src={lightbox} alt="" className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl" />
        </div>
      )}
    </section>
  );
}
