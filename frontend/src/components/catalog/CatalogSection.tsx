import { useState, useEffect } from "react";
import { SearchX, Sparkles } from "lucide-react";
import type { Category, Service } from "../../types";
import { fetchCatalog } from "../../api/client";
import { CategoryFilter } from "./CategoryFilter";
import { ServiceCard } from "./ServiceCard";
import { ServiceModal } from "./ServiceModal";
import { toast } from "../common/Toast";

interface Props {
  tenantId: string;
  title?: string;
  subtitle?: string;
}

export function CatalogSection({
  tenantId,
  title = "Наши услуги",
  subtitle = "Выберите процедуры и удобное время. Добавляйте несколько услуг в одну запись.",
}: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingService, setViewingService] = useState<{ service: Service; category: string } | null>(null);

  useEffect(() => {
    fetchCatalog(tenantId)
      .then((res) => setCategories(res.categories))
      .catch(() => toast.error("Не удалось загрузить каталог. Проверьте соединение и обновите страницу."))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const filteredPairs = active
    ? categories.filter((c) => c.name === active).flatMap((c) => c.services.map((s) => ({ service: s, category: c.name })))
    : categories.flatMap((c) => c.services.map((s) => ({ service: s, category: c.name })));

  if (loading) {
    return (
      <section id="catalog" data-anchor-section className="scroll-mt-24 rounded-[2rem] bg-surface px-4 py-16 shadow-sm sm:px-6 lg:px-8 lg:py-24">
        <div className="mb-12 text-center">
          <h2 className="font-serif mb-4 text-3xl font-semibold text-ink md:text-5xl">{title}</h2>
          <p className="mx-auto max-w-2xl text-sm text-ink-muted">Загрузка каталога…</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton rounded-2xl border border-transparent shadow-soft" style={{ aspectRatio: "4/3" }} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      id="catalog"
      data-anchor-section
      className="scroll-mt-24 overflow-hidden rounded-[2rem] bg-surface px-4 py-14 shadow-sm sm:px-6 md:py-20 lg:px-8"
    >
      {/* Section header */}
      <div className="mb-10 text-center md:mb-12">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-brand-600 shadow-sm">
          <Sparkles size={12} aria-hidden />
          {categories.length > 0 ? `${filteredPairs.length} услуг` : "Каталог"}
        </div>
        <h2 className="font-serif mb-3 text-3xl font-semibold tracking-tight text-ink md:text-5xl">
          {title}
        </h2>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-ink-muted md:text-base">
          {subtitle}
        </p>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="mb-8 md:mb-10">
          <CategoryFilter categories={categories.map((c) => c.name)} active={active} onSelect={setActive} />
        </div>
      )}

      {/* Services grid — 2 cols mobile, 3 cols desktop */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        {filteredPairs.map(({ service, category }) => (
          <ServiceCard
            key={service.id}
            service={service}
            categoryName={category}
            onView={(s) => setViewingService({ service: s, category })}
          />
        ))}
      </div>

      {/* Empty state */}
      {filteredPairs.length === 0 && active && (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 py-12 text-center">
          <SearchX size={36} className="text-brand-300" aria-hidden />
          <p className="text-sm text-ink-muted">В категории «{active}» нет услуг</p>
          <button
            type="button"
            onClick={() => setActive(null)}
            className="mt-1 rounded-lg border border-brand-200 bg-white px-5 py-2 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50"
          >
            Показать все услуги
          </button>
        </div>
      )}

      {/* Bottom booking prompt */}
      {filteredPairs.length > 0 && (
        <div
          className="mt-12 overflow-hidden rounded-2xl px-6 py-8 text-center md:mt-16 md:px-10 md:py-10"
          style={{
            background: "linear-gradient(135deg, var(--color-primary-muted, rgba(192,137,115,0.12)) 0%, rgba(255,255,255,0.6) 100%)",
            border: "1px solid rgba(192,137,115,0.2)",
          }}
        >
          <p className="font-serif text-2xl font-semibold text-ink md:text-3xl">
            Готовы преобразиться?
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Добавьте услуги в корзину и запишитесь в удобное время — это займёт 2 минуты.
          </p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="mt-6 inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
            style={{
              background: "var(--color-primary)",
              boxShadow: "0 6px 20px rgba(192,137,115,0.35)",
            }}
          >
            Перейти к оформлению
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Service modal */}
      {viewingService && (
        <ServiceModal
          service={viewingService.service}
          categoryName={viewingService.category}
          onClose={() => setViewingService(null)}
        />
      )}
    </section>
  );
}
