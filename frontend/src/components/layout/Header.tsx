import { useState, useEffect } from "react";
import { Menu, X, ShoppingBag, ArrowRight, Info, ImageIcon, MessageCircle } from "lucide-react";
import type { Tenant } from "../../types";
import { useCart } from "../../store/cartStore";

interface Props {
  tenant: Tenant;
  onOpenCart: () => void;
}

const NAV_LINKS: { id: string; label: string; icon: typeof ArrowRight }[] = [
  { id: "catalog", label: "Услуги", icon: ArrowRight },
  { id: "advantages", label: "О нас", icon: Info },
  { id: "portfolio", label: "Портфолио", icon: ImageIcon },
  { id: "reviews", label: "Отзывы", icon: MessageCircle },
];

export function Header({ tenant, onOpenCart }: Props) {
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
              className="-ml-2 p-2 transition-opacity hover:opacity-90 md:hidden"
              style={{ color: "var(--color-text)" }}
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
                  className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/15 md:h-10 md:w-10"
                />
              ) : (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-300 md:h-10 md:w-10 md:text-base"
                  style={{
                    background: "color-mix(in srgb, var(--color-primary) 35%, transparent)",
                    color: "var(--color-text)",
                  }}
                >
                  {initial}
                </div>
              )}
              <span className="min-w-0 truncate text-xl font-bold tracking-tight md:text-2xl" style={{ color: "var(--color-text)" }}>
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
                  className="text-xs font-semibold uppercase tracking-[0.15em] transition-opacity hover:opacity-100"
                  style={{ color: "var(--color-text)", opacity: 0.55 }}
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
              className="relative -mr-2 flex items-center gap-2 p-2 transition-opacity hover:opacity-90 md:mr-0"
              style={{ color: "var(--color-text)" }}
              aria-label="Ваша запись"
            >
              <span className="hidden text-xs font-semibold uppercase tracking-[0.12em] opacity-70 md:block">Ваша запись</span>
              <div className="relative">
                <ShoppingBag size={24} strokeWidth={1.75} />
                {itemCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-0.5 text-[10px] font-bold text-white"
                    style={{ background: "var(--color-primary)" }}
                  >
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-y-0 left-0 z-[110] flex w-4/5 max-w-sm flex-col border-r border-white/10 shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--color-bg-elevated)" }}
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <span className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            Меню
          </span>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="rounded-full border border-white/10 p-2 transition-colors hover:bg-white/10"
            style={{ color: "var(--color-text)" }}
            aria-label="Закрыть меню"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-6" aria-label="Мобильное меню">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => scrollTo(link.id)}
                className="flex items-center rounded-xl p-4 text-left text-lg font-medium transition-colors hover:bg-white/5"
                style={{ color: "var(--color-text)" }}
              >
                <Icon className="mr-3 h-5 w-5 opacity-55" strokeWidth={2} aria-hidden />
                {link.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-6">
          <button
            type="button"
            onClick={() => {
              setDrawerOpen(false);
              onOpenCart();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition-transform active:scale-[0.98]"
            style={{
              background: "var(--color-primary)",
              boxShadow: "0 12px 40px color-mix(in srgb, var(--color-primary) 35%, transparent)",
            }}
          >
            <ShoppingBag size={20} strokeWidth={2} />
            Открыть корзину
          </button>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[105] bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          drawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />
    </>
  );
}
