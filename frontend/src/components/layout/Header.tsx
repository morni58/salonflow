import { useState, useEffect } from "react";
import { Menu, X, ShoppingBag, ArrowRight, Info, ImageIcon, MessageCircle, UserRound } from "lucide-react";
import type { Tenant } from "../../types";
import { useCart } from "../../store/cartStore";
import { siteText } from "../../utils/siteContent";

interface Props {
  tenant: Tenant;
  onOpenCart: () => void;
  onGoHome?: () => void;
  /** Навигация по разделам (работает и с checkout-страницы) */
  onNavClick?: (sectionId: string) => void;
}

function navLinks(tenant: Tenant) {
  return [
    { id: "catalog", label: siteText(tenant, "nav_catalog", "Услуги"), icon: ArrowRight },
    { id: "advantages", label: siteText(tenant, "nav_advantages", "О нас"), icon: Info },
    { id: "masters", label: siteText(tenant, "nav_masters", "Мастера"), icon: UserRound },
    { id: "portfolio", label: siteText(tenant, "nav_portfolio", "Портфолио"), icon: ImageIcon },
    { id: "reviews", label: siteText(tenant, "nav_reviews", "Отзывы"), icon: MessageCircle },
  ] as const;
}

export function Header({ tenant, onOpenCart, onGoHome, onNavClick }: Props) {
  const NAV_LINKS = navLinks(tenant);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const { itemCount } = useCart();

  // Подсветка активного раздела при скролле
  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.id);
    const observers: IntersectionObserver[] = [];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      map.set(el, id);
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNav = (id: string) => {
    const wasOpen = drawerOpen;
    setDrawerOpen(false);
    // Wait for mobile drawer close animation + body overflow restore
    const delay = wasOpen ? 350 : 0;
    setTimeout(() => {
      if (onNavClick) {
        onNavClick(id);
      } else {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, delay);
  };

  const goHome = () => {
    setDrawerOpen(false);
    onGoHome?.();
  };

  useEffect(() => {
    if (drawerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [drawerOpen]);

  const initial = tenant.name.trim().charAt(0).toUpperCase() || "•";

  return (
    <>
      <header
        className="glass-nav fixed top-0 z-[100] w-full border-b border-ink/5 transition-all duration-300"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="relative mx-auto max-w-[var(--layout-max)] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-2 md:h-20">
            <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-6">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="-ml-2 shrink-0 p-2 text-ink transition-colors duration-300 ease-out hover:text-brand-500 md:hidden"
                aria-label="Открыть меню"
              >
                <Menu size={24} strokeWidth={2} />
              </button>

              <div className="flex min-w-0 flex-1 items-center justify-center gap-8 md:justify-start md:gap-10">
                <button
                  type="button"
                  onClick={goHome}
                  className="group flex min-w-0 items-center justify-center gap-2 text-left md:justify-start md:gap-3"
                  title="На главную"
                >
                  {tenant.logo_url ? (
                    <img
                      src={tenant.logo_url}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-lg object-cover shadow-sm md:h-10 md:w-10"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 font-serif text-lg font-bold text-brand-600 transition-colors duration-300 ease-out group-hover:bg-brand-500 group-hover:text-white md:h-10 md:w-10 md:text-xl">
                      {initial}
                    </div>
                  )}
                  <span className="font-serif min-w-0 truncate text-xl font-semibold tracking-wide text-ink md:text-2xl">
                    {tenant.name}
                  </span>
                </button>

                <nav className="hidden items-center gap-8 md:flex" aria-label="Разделы страницы">
                  {NAV_LINKS.map((link) => {
                    const isActive = activeSection === link.id;
                    return (
                      <button
                        key={link.id}
                        type="button"
                        onClick={() => handleNav(link.id)}
                        className="relative text-sm font-medium transition-colors duration-300 ease-out"
                        style={{ color: isActive ? "var(--color-primary)" : undefined }}
                        aria-current={isActive ? "true" : undefined}
                      >
                        <span className={isActive ? "" : "text-ink/70 hover:text-brand-500"}>
                          {link.label}
                        </span>
                        {isActive && (
                          <span
                            className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full"
                            style={{ background: "var(--color-primary)" }}
                          />
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onOpenCart();
                setDrawerOpen(false);
              }}
              className="relative -mr-2 flex shrink-0 items-center gap-2 rounded-lg border border-brand-200/80 bg-brand-50 px-3 py-2 text-ink transition-colors duration-300 ease-out hover:border-brand-300 hover:text-brand-600 md:mr-0 md:border-0 md:bg-transparent md:px-0"
              aria-label="Моя запись"
            >
              <span className="hidden text-sm font-medium md:block">Моя запись</span>
              <div className="relative">
                <ShoppingBag size={20} strokeWidth={2} />
                {itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex min-w-[1rem] items-center justify-center rounded-md bg-brand-500 px-0.5 text-[10px] font-bold text-white shadow-sm">
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Мобильное меню */}
      <div
        className={`fixed inset-y-0 left-0 z-[200] flex w-4/5 max-w-sm flex-col bg-surface shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between border-b border-brand-50 px-6 py-5">
          <span className="font-serif text-2xl font-semibold text-ink">Меню</span>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="rounded-lg bg-brand-50 p-2 text-ink-muted transition-colors hover:text-brand-500"
            aria-label="Закрыть меню"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-6" aria-label="Мобильное меню">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = activeSection === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => handleNav(link.id)}
                className="flex items-center rounded-xl p-4 text-left text-lg font-medium transition-colors duration-200 ease-out"
                style={isActive
                  ? { background: "var(--color-primary-muted)", color: "var(--color-primary)" }
                  : undefined}
                aria-current={isActive ? "true" : undefined}
              >
                <Icon
                  className="mr-3 h-5 w-5"
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{ opacity: isActive ? 1 : 0.55 }}
                  aria-hidden
                />
                {link.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-brand-100 bg-base p-6">
          <button
            type="button"
            onClick={() => {
              setDrawerOpen(false);
              onOpenCart();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-4 font-medium tracking-wide text-white shadow-lg shadow-brand-500/20"
          >
            <ShoppingBag size={20} strokeWidth={2} />
            Открыть корзину
          </button>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[199] bg-ink-dark/40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          drawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />
    </>
  );
}
