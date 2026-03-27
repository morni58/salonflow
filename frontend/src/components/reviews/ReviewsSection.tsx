import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import type { ReviewImage } from "../../types";
import { fetchReviews } from "../../api/client";
import { cn } from "../../utils";
import { toast } from "../common/Toast";

interface Props {
  tenantId: string;
  title?: string;
}

const CARD_W = 208; // w-52 = 13rem = 208px
const CARD_GAP = 12; // gap-3

export function ReviewsSection({ tenantId, title = "Отзывы" }: Props) {
  const [reviews, setReviews] = useState<ReviewImage[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const isHovered = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchReviews(tenantId)
      .then(setReviews)
      .catch(() => toast.error("Не удалось загрузить отзывы. Проверьте соединение."))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const scrollTo = useCallback((idx: number) => {
    setCurrent(idx);
    containerRef.current?.scrollTo({
      left: idx * (CARD_W + CARD_GAP),
      behavior: "smooth",
    });
  }, []);

  // Авто-прокрутка каждые 4 секунды
  useEffect(() => {
    if (reviews.length <= 1) return;
    intervalRef.current = setInterval(() => {
      if (!isHovered.current) {
        setCurrent((prev) => {
          const next = (prev + 1) % reviews.length;
          containerRef.current?.scrollTo({
            left: next * (CARD_W + CARD_GAP),
            behavior: "smooth",
          });
          return next;
        });
      }
    }, 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [reviews.length]);

  // Keyboard navigation для лайтбокса
  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft" && lightbox > 0) setLightbox(lightbox - 1);
      if (e.key === "ArrowRight" && lightbox < reviews.length - 1) setLightbox(lightbox + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, reviews.length]);

  // Блокировка скролла при открытом лайтбоксе
  useEffect(() => {
    if (lightbox !== null) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [lightbox]);

  // Синхронизация current при ручном скролле
  const handleScroll = () => {
    if (!containerRef.current) return;
    const idx = Math.round(containerRef.current.scrollLeft / (CARD_W + CARD_GAP));
    setCurrent(Math.max(0, Math.min(idx, reviews.length - 1)));
  };

  if (loading) {
    return (
      <section id="reviews" data-anchor-section className="pt-2 md:pt-4">
        <h2 className="font-serif mb-6 text-3xl font-semibold tracking-tight text-balance text-ink-dark sm:text-4xl">{title}</h2>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 w-52 shrink-0 animate-pulse rounded-2xl border border-brand-100 bg-brand-50" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section id="reviews" data-anchor-section className="pt-2 md:pt-4">
      <h2 className="font-serif mb-6 text-3xl font-semibold tracking-tight text-balance text-ink-dark sm:text-4xl">{title}</h2>

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-100 bg-surface px-6 py-14 text-center shadow-soft">
          <MessageCircle className="mb-3 text-brand-400" size={44} aria-hidden />
          <p className="max-w-sm text-sm leading-relaxed text-ink-light">
            Скриншоты отзывов появятся здесь после загрузки в Telegram-боте.
          </p>
        </div>
      ) : (
        <>
          <div
            className="relative"
            onMouseEnter={() => { isHovered.current = true; }}
            onMouseLeave={() => { isHovered.current = false; }}
          >
            {/* Стрелка влево */}
            {reviews.length > 1 && current > 0 && (
              <button
                type="button"
                onClick={() => scrollTo(current - 1)}
                className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-brand-200 bg-white p-2 text-ink shadow-soft transition-all hover:border-brand-400 hover:shadow-soft-md sm:-left-5"
                aria-label="Предыдущий отзыв"
              >
                <ChevronLeft size={18} />
              </button>
            )}

            {/* Полоса карточек */}
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
                  className="group relative w-52 shrink-0 overflow-hidden rounded-2xl border border-brand-100 bg-surface shadow-soft transition-all duration-300 ease-out hover:shadow-soft-md"
                  style={{ scrollSnapAlign: "start", minHeight: "13rem" }}
                  aria-label={`Отзыв ${i + 1}`}
                >
                  <img
                    src={rev.url}
                    alt={`Отзыв ${i + 1}`}
                    className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    style={{ display: "block", maxHeight: "22rem" }}
                    loading="lazy"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/20">
                    <span className="scale-75 rounded-full bg-white/25 px-3 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                      Открыть
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Стрелка вправо */}
            {reviews.length > 1 && current < reviews.length - 1 && (
              <button
                type="button"
                onClick={() => scrollTo(current + 1)}
                className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-brand-200 bg-white p-2 text-ink shadow-soft transition-all hover:border-brand-400 hover:shadow-soft-md sm:-right-5"
                aria-label="Следующий отзыв"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>

          {/* Точки-индикаторы */}
          {reviews.length > 1 && (
            <div className="mt-4 flex justify-center gap-1.5">
              {reviews.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollTo(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    current === i
                      ? "w-6 bg-brand-500"
                      : "w-1.5 bg-brand-200 hover:bg-brand-400"
                  )}
                  aria-label={`Отзыв ${i + 1}`}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Лайтбокс */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/88 backdrop-blur-md animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>

          {/* Счётчик */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
            {lightbox + 1} / {reviews.length}
          </div>

          {lightbox > 0 && (
            <button
              type="button"
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
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur-sm hover:bg-white/25 md:right-6"
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }}
              aria-label="Следующий"
            >
              <ChevronRight size={24} />
            </button>
          )}

          {/* Точки в лайтбоксе */}
          {reviews.length <= 12 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5">
              {reviews.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLightbox(i); }}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === lightbox ? "w-6 bg-white" : "w-1.5 bg-white/40"
                  )}
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
