import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import type { ReviewImage } from "../../types";
import { fetchReviews } from "../../api/client";

export function ReviewsSection({ tenantId }: { tenantId: string }) {
  const [reviews, setReviews] = useState<ReviewImage[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews(tenantId)
      .then(setReviews)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) {
    return (
      <section id="reviews" data-anchor-section>
        <h2 className="font-serif mb-6 text-3xl font-semibold tracking-tight text-balance text-ink-dark sm:text-4xl">Отзывы</h2>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 w-48 shrink-0 animate-pulse rounded-2xl border"
              style={{
                borderColor: "var(--color-border-soft)",
                background: "color-mix(in srgb, var(--color-primary) 7%, var(--color-bg))",
              }}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section id="reviews" data-anchor-section>
      <h2 className="font-serif mb-6 text-3xl font-semibold tracking-tight text-balance text-ink-dark sm:text-4xl">Отзывы</h2>

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-100 bg-surface px-6 py-14 text-center shadow-soft">
          <MessageCircle className="mb-3 text-brand-400" size={44} aria-hidden />
          <p className="max-w-sm text-sm leading-relaxed text-ink-light">
            Скриншоты отзывов появятся здесь после загрузки в Telegram-боте.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-none">
            {reviews.map((rev, i) => (
              <button
                key={rev.id}
                type="button"
                onClick={() => setLightbox(i)}
                className="group h-72 w-52 shrink-0 overflow-hidden rounded-2xl border border-brand-100 bg-surface shadow-soft transition-all hover:shadow-soft-md"
              >
                <img
                  src={rev.url}
                  alt={`Отзыв ${i + 1}`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              </button>
            ))}
          </div>

          {lightbox !== null && (
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
              onClick={() => setLightbox(null)}
            >
              <button type="button" className="absolute right-4 top-4 text-white/80 hover:text-white">
                <X size={28} />
              </button>

              {lightbox > 0 && (
                <button
                  type="button"
                  className="absolute left-4 rounded-full border border-white/20 bg-white/10 p-2 text-white backdrop-blur-sm hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightbox(lightbox - 1);
                  }}
                >
                  <ChevronLeft size={24} />
                </button>
              )}

              <img
                src={reviews[lightbox].url}
                alt=""
                className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />

              {lightbox < reviews.length - 1 && (
                <button
                  type="button"
                  className="absolute right-4 rounded-full border border-white/20 bg-white/10 p-2 text-white backdrop-blur-sm hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightbox(lightbox + 1);
                  }}
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
