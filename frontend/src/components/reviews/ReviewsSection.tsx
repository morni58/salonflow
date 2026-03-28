import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, MessageCircle, Star } from "lucide-react";
import type { ReviewImage } from "../../types";
import { fetchReviews } from "../../api/client";
import { cn } from "../../utils";
import { toast } from "../common/Toast";

interface Props {
  tenantId: string;
  title?: string;
}

const CARD_W = 224;
const CARD_GAP = 12;

export function ReviewsSection({ tenantId, title = "Отзывы клиентов" }: Props) {
  const [reviews, setReviews] = useState<ReviewImage[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const isHovered = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    fetchReviews(tenantId)
      .then(setReviews)
      .catch(() => toast.error("Не удалось загрузить отзывы."))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const scrollTo = useCallback((idx: number) => {
    setCurrent(idx);
    containerRef.current?.scrollTo({ left: idx * (CARD_W + CARD_GAP), behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (reviews.length <= 1) return;
    intervalRef.current = setInterval(() => {
      if (!isHovered.current) {
        setCurrent((prev) => {
          const next = (prev + 1) % reviews.length;
          containerRef.current?.scrollTo({ left: next * (CARD_W + CARD_GAP), behavior: "smooth" });
          return next;
        });
      }
    }, 4500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [reviews.length]);

  useEffect(() => {
    if (lightbox === null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft" && lightbox > 0) setLightbox(lightbox - 1);
      if (e.key === "ArrowRight" && lightbox < reviews.length - 1) setLightbox(lightbox + 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lightbox, reviews.length]);

  useEffect(() => {
    if (lightbox !== null) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [lightbox]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const idx = Math.round(containerRef.current.scrollLeft / (CARD_W + CARD_GAP));
    setCurrent(Math.max(0, Math.min(idx, reviews.length - 1)));
  };

  return (
    <section
      id="reviews"
      data-anchor-section
      className="scroll-mt-24 overflow-hidden rounded-2xl py-14 md:py-20"
      style={{ background: "var(--color-primary-muted, rgba(192,137,115,0.08))" }}
    >
      <div className="px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end md:mb-12">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-4">
              Реальные отзывы
            </p>
            <h2 className="font-serif italic text-3xl md:text-5xl text-ink">{title}</h2>
            <p className="mt-2 text-sm text-ink-muted">Скриншоты из мессенджеров и соцсетей</p>
          </div>

          {/* Rating badge */}
          {reviews.length > 0 && (
            <div
              className="shrink-0 rounded-2xl bg-white px-5 py-3.5"
              style={{ border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 8px 30px rgba(54,49,47,0.04)" }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={16} className="fill-amber-400 text-amber-400" aria-hidden />
                ))}
              </div>
              <p className="text-xs text-ink-muted font-medium">{reviews.length} отзывов</p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-72 w-56 shrink-0 animate-pulse rounded-xl bg-black/5" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-xl bg-white px-6 py-14 text-center"
            style={{ border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 8px 30px rgba(54,49,47,0.04)" }}
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "var(--color-primary-muted)" }}>
              <MessageCircle size={30} style={{ color: "var(--color-primary)" }} aria-hidden />
            </div>
            <p className="font-serif text-lg font-semibold text-ink">Отзывы появятся скоро</p>
            <p className="mt-1 max-w-xs text-sm text-ink-light">
              Администратор может загрузить скриншоты отзывов через Telegram-бот.
            </p>
          </div>
        ) : (
          <div
            className="relative"
            onMouseEnter={() => { isHovered.current = true; }}
            onMouseLeave={() => { isHovered.current = false; }}
          >
            {/* Left arrow */}
            {reviews.length > 1 && current > 0 && (
              <button
                type="button"
                onClick={() => scrollTo(current - 1)}
                className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 rounded-xl border border-black/8 bg-white p-2.5 text-ink transition-all hover:shadow-sm sm:-left-5"
                aria-label="Предыдущий отзыв"
              >
                <ChevronLeft size={18} />
              </button>
            )}

            {/* Cards */}
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="flex gap-3 overflow-x-auto pb-3 scrollbar-none scroll-smooth"
              style={{ scrollSnapType: "x mandatory" }}
            >
              {reviews.map((rev, i) => (
                <button
                  key={rev.id}
                  type="button"
                  onClick={() => setLightbox(i)}
                  className="hover-lift group relative w-56 shrink-0 overflow-hidden rounded-lg bg-white"
                  style={{
                    scrollSnapAlign: "start",
                    minHeight: "13rem",
                    border: "1px solid rgba(0,0,0,0.05)",
                    boxShadow: "0 8px 30px rgba(54,49,47,0.04)",
                  }}
                  aria-label={`Отзыв ${i + 1}`}
                >
                  <img
                    src={rev.url}
                    alt={`Отзыв ${i + 1}`}
                    className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    style={{ display: "block", maxHeight: "22rem" }}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/18">
                    <span className="scale-75 rounded-full bg-white/25 px-3 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                      Открыть
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Right arrow */}
            {reviews.length > 1 && current < reviews.length - 1 && (
              <button
                type="button"
                onClick={() => scrollTo(current + 1)}
                className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 rounded-xl border border-black/8 bg-white p-2.5 text-ink transition-all hover:shadow-sm sm:-right-5"
                aria-label="Следующий отзыв"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {/* Dots */}
        {reviews.length > 1 && (
          <div className="mt-5 flex justify-center gap-1.5">
            {reviews.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollTo(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  current === i ? "w-7 bg-ink" : "w-1.5 bg-black/20 hover:bg-black/35"
                )}
                aria-label={`Отзыв ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={() => setLightbox(null)}
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const diff = touchStartX.current - e.changedTouches[0].clientX;
            if (Math.abs(diff) < 50) return;
            if (diff > 0 && lightbox < reviews.length - 1) setLightbox(lightbox + 1);
            if (diff < 0 && lightbox > 0) setLightbox(lightbox - 1);
            touchStartX.current = null;
          }}
        >
          <button type="button" onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2.5 text-white backdrop-blur-sm hover:bg-white/25"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
            {lightbox + 1} / {reviews.length}
          </div>
          {lightbox > 0 && (
            <button type="button"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur-sm hover:bg-white/25 md:left-6"
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1); }}
              aria-label="Предыдущий"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <img
            key={lightbox}
            src={reviews[lightbox].url}
            alt=""
            className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl animate-scale-in md:max-w-[60vw]"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
          {lightbox < reviews.length - 1 && (
            <button type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur-sm hover:bg-white/25 md:right-6"
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }}
              aria-label="Следующий"
            >
              <ChevronRight size={24} />
            </button>
          )}
          {reviews.length <= 12 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5">
              {reviews.map((_, i) => (
                <button key={i} type="button"
                  onClick={(e) => { e.stopPropagation(); setLightbox(i); }}
                  className={cn("h-1.5 rounded-full transition-all duration-300", i === lightbox ? "w-6 bg-white" : "w-1.5 bg-white/40")}
                  aria-label={`Отзыв ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
