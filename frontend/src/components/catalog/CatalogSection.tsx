import { useState, useEffect } from "react";
import type { Category } from "../../types";
import { fetchCatalog } from "../../api/client";
import { CategoryFilter } from "./CategoryFilter";
import { ServiceCard } from "./ServiceCard";

interface Props {
  tenantId: string;
  title?: string;
  subtitle?: string;
}

export function CatalogSection({
  tenantId,
  title = "Наши услуги",
  subtitle = 'Выберите процедуры и удобное время. Цены указаны «от», точная стоимость зависит от мастера.',
}: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCatalog(tenantId)
      .then((res) => setCategories(res.categories))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantId]);

  const filteredPairs = active
    ? categories.filter((c) => c.name === active).flatMap((c) => c.services.map((s) => ({ service: s, category: c.name })))
    : categories.flatMap((c) => c.services.map((s) => ({ service: s, category: c.name })));

  if (loading) {
    return (
      <section id="catalog" data-anchor-section>
        <div className="mb-12 text-center">
          <h2 className="font-serif mb-4 text-3xl font-semibold text-ink md:text-4xl lg:text-5xl">{title}</h2>
          <p className="mx-auto max-w-2xl text-ink-muted">Загрузка каталога…</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-96 rounded-[2rem] border border-transparent shadow-soft" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section id="catalog" data-anchor-section className="rounded-[2rem] bg-surface px-4 py-16 shadow-sm sm:px-6 md:py-24 lg:px-8 lg:py-24">
      <div className="mb-10 text-center md:mb-12">
        <h2 className="font-serif mb-4 text-3xl font-semibold tracking-tight text-balance text-ink md:text-5xl">
          {title}
        </h2>
        <p className="mx-auto max-w-xl px-2 text-sm leading-relaxed text-ink-muted md:text-base">{subtitle}</p>
      </div>

      <div className="mb-10 md:mb-12">
        <CategoryFilter categories={categories.map((c) => c.name)} active={active} onSelect={setActive} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
        {filteredPairs.map(({ service, category }) => (
          <ServiceCard key={service.id} service={service} categoryName={category} />
        ))}
      </div>

      {filteredPairs.length === 0 && (
        <p className="mt-8 text-center text-ink-muted opacity-80">Услуги не найдены</p>
      )}
    </section>
  );
}
