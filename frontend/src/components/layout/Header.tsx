import { useState, useEffect } from "react";
import { Menu, X, ShoppingBag, ArrowRight, Info, ImageIcon, MessageCircle, UserRound } from "lucide-react";
import type { Tenant } from "../../types";
import { useCart } from "../../store/cartStore";
import { siteText } from "../../utils/siteContent";

interface Props {
  tenant: Tenant;
  onOpenCart: () => void;
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

export function Header({ tenant, onOpenCart }: Props) {
  const NAV_LINKS = navLinks(tenant);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { itemCount } = useCart();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setDrawerOpen(false);
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
        className="glass-nav fixed top-0 z-[100] w-full transition-all duration-300"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="relative mx-auto max-w-[var(--layout-max)] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between md:h-20">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="-ml-2 p-2 text-ink-dark transition-colors duration-300 ease-out hover:text-brand-500 md:hidden"
              aria-label="Открыть меню"
            >
              <Menu size={24} strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={() => scrollTo("catalog")}
              className="group flex min-w-0 flex-1 items-center justify-center gap-2 md:flex-none md:justify-start md:gap-3"
            >
              {tenant.logo_url ? (
                <img
                  src={tenant.logo_url}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full object-cover shadow-sm md:h-10 md:w-10"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 font-serif text-lg italic text-brand-600 transition-colors duration-300 ease-out group-hover:bg-brand-500 group-hover:text-white md:h-10 md:w-10 md:text-xl">
                  {initial}
                </div>
              )}
              <span className="font-serif min-w-0 truncate text-xl font-semibold tracking-wide text-ink-dark md:text-2xl">
                {tenant.name}
              </span>
            </button>

            <nav
              className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex"
              aria-label="Разделы страницы"
            >
              {NAV_LINKS.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => scrollTo(link.id)}
                  className="text-xs font-medium tracking-wider text-ink-light uppercase transition-colors duration-300 ease-out hover:text-brand-500"
                >
                  {link.label}
                </button>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => {
                onOpenCart();
                setDrawerOpen(false);
              }}
              className="relative -mr-2 flex items-center gap-2 p-2 text-ink transition-colors duration-300 ease-out hover:text-brand-500 md:mr-0"
              aria-label="Ваша запись"
            >
              <span className="hidden text-xs font-medium tracking-wider uppercase md:block">Ваша запись</span>
              <div className="relative">
                <ShoppingBag size={24} strokeWidth={1.5} />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-y-0 left-0 z-[110] flex w-4/5 max-w-sm flex-col bg-surface shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between border-b border-brand-100 bg-base px-6 py-5">
          <span className="font-serif text-2xl font-semibold text-ink-dark">Меню</span>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="rounded-full bg-brand-50 p-2 text-ink-light transition-colors hover:text-brand-500"
            aria-label="Закрыть меню"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-6" aria-label="Мобильное меню">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => scrollTo(link.id)}
                className="flex items-center rounded-xl p-4 text-left text-lg font-medium text-ink-dark transition-colors duration-300 ease-out hover:bg-brand-50 hover:text-brand-600"
              >
                <Icon className="mr-3 h-5 w-5 opacity-60" strokeWidth={2} aria-hidden />
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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-4 font-medium tracking-wide text-white shadow-lg shadow-brand-500/20"
          >
            <ShoppingBag size={20} strokeWidth={2} />
            Открыть корзину
          </button>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[105] bg-ink-dark/40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          drawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />
    </>
  );
}
