import { useState, useEffect } from "react";
import { SearchX, Layers } from "lucide-react";
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
  subtitle = "Выбирайте процедуры и добавляйте в запись. Можно несколько за один визит.",
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
    ? categories.filter((c) => c.name === active).flatMap((c) => (c.services ?? []).map((s) => ({ service: s, category: c.name })))
    : categories.flatMap((c) => (c.services ?? []).map((s) => ({ service: s, category: c.name })));

  if (loading) {
    return (
      <section id="catalog" data-anchor-section className="scroll-mt-24 py-20 md:py-28">
        <div className="mb-10 text-center">
          <h2 className="font-serif text-3xl font-semibold text-ink md:text-5xl">{title}</h2>
        </div>
        <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-5 lg:grid-cols-3 lg:gap-7">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton rounded-2xl" style={{ aspectRatio: "3/4" }} />
          ))}
        </div>
      </section>
    );
  }

  const totalServices = categories.reduce((acc, c) => acc + (c.services?.length ?? 0), 0);

  return (
    <section id="catalog" data-anchor-section className="scroll-mt-24 py-20 md:py-28">
      {/* Section header */}
      <div className="mb-10 text-center md:mb-14">
        <span
          className="mb-4 inline-flex items-center gap-2 rounded-lg border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
          style={{ borderColor: "var(--color-primary-20)", background: "var(--color-primary-muted)", color: "var(--color-primary)" }}
        >
          <Layers size={11} aria-hidden />
          {totalServices > 0 ? `${totalServices} услуг` : "Каталог"}
        </span>
        <h2 className="font-serif text-3xl font-semibold text-ink md:text-5xl">{title}</h2>
        <p className="mt-3 mx-auto max-w-lg text-sm leading-relaxed text-ink-muted md:text-base">{subtitle}</p>
      </div>

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="mb-8 md:mb-10">
          <CategoryFilter categories={categories.map((c) => c.name)} active={active} onSelect={setActive} />
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-5 lg:grid-cols-3 lg:gap-7">
        {filteredPairs.map(({ service, category }) => (
          <ServiceCard
            key={service.id}
            service={service}
            categoryName={category}
            onView={(s) => setViewingService({ service: s, category })}
          />
        ))}
      </div>

      {/* Empty filtered state */}
      {filteredPairs.length === 0 && active && (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 py-14 text-center">
          <SearchX size={32} className="text-brand-300" aria-hidden />
          <p className="text-sm text-ink-muted">В категории «{active}» нет услуг</p>
          <button
            type="button"
            onClick={() => setActive(null)}
            className="rounded-xl border border-brand-200 bg-white px-5 py-2.5 text-sm font-medium text-ink transition-all hover:border-brand-400 active:scale-[0.97]"
          >
            Показать все
          </button>
        </div>
      )}

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
