import { useState, useEffect, useRef } from "react";
import { Menu, X, ShoppingBag, Phone, ClipboardList } from "lucide-react";
import type { Tenant } from "../../types";
import { useCart } from "../../store/cartStore";
import { hasAdvantagesSection } from "../../utils/advantages";
import { siteText } from "../../utils/siteContent";
import { lockBodyScroll } from "../../utils/bodyScrollLock";

interface Props {
  tenant: Tenant;
  onOpenCart: () => void;
  onGoHome?: () => void;
  onNavClick?: (sectionId: string) => void;
  onMyBookings?: () => void;
}

function navLinks(tenant: Tenant) {
  const all = [
    { id: "catalog", label: siteText(tenant, "nav_catalog", "Услуги") },
    { id: "advantages", label: siteText(tenant, "nav_advantages", "О нас") },
    { id: "masters", label: siteText(tenant, "nav_masters", "Мастера") },
    { id: "portfolio", label: siteText(tenant, "nav_portfolio", "Портфолио") },
    { id: "reviews", label: siteText(tenant, "nav_reviews", "Отзывы") },
    { id: "contacts", label: siteText(tenant, "nav_contacts", "Контакты") },
  ] as const;
  if (!hasAdvantagesSection(tenant)) {
    return all.filter((l) => l.id !== "advantages");
  }
  return all;
}

export function Header({ tenant, onOpenCart, onGoHome, onNavClick, onMyBookings }: Props) {
  const NAV_LINKS = navLinks(tenant);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);
  const { itemCount } = useCart();
  const [prevCount, setPrevCount] = useState(itemCount);
  const [popping, setPopping] = useState(false);

  // Auto-hide на скролле вниз
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastYRef.current + 8 && y > 100) {
        setHidden(true);
      } else if (y < lastYRef.current - 8) {
        setHidden(false);
      }
      lastYRef.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    return lockBodyScroll();
  }, [menuOpen]);

  // Анимация счётчика корзины
  useEffect(() => {
    if (itemCount > prevCount) {
      setPopping(true);
      setTimeout(() => setPopping(false), 300);
    }
    setPrevCount(itemCount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount]);

  const handleNav = (id: string) => {
    const wasOpen = menuOpen;
    setMenuOpen(false);
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
    setMenuOpen(false);
    onGoHome?.();
  };

  return (
    <>
      {/* Floating glass pill nav — как в пример.html */}
      <header
        className={`fixed top-0 w-full z-[100] px-4 transition-all duration-300 ${
          hidden && !menuOpen ? "-translate-y-[120%]" : "translate-y-0"
        }`}
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="glass-nav-float rounded-xl md:rounded-2xl flex h-14 md:h-16 items-center justify-between px-4 md:px-8 shadow-sm">

            {/* Logo / Brand */}
            <div className="flex min-w-0 max-w-[min(100%,58vw)] items-center gap-2 sm:gap-3 lg:max-w-[40%]">
              <button
                type="button"
                onClick={goHome}
                className="flex min-w-0 items-center gap-2.5 shrink-0"
                aria-label="На главную"
              >
                {tenant.logo_url ? (
                  <img
                    src={tenant.logo_url}
                    alt={tenant.name}
                    className="h-8 w-8 shrink-0 rounded-xl object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (sib) sib.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-serif text-sm font-bold text-white"
                  style={{ background: "var(--color-primary)", display: tenant.logo_url ? "none" : "flex" }}
                >
                  {tenant.name.trim().charAt(0).toUpperCase() || "•"}
                </div>
                <span className="truncate font-serif text-xl font-bold tracking-tight text-ink">
                  {tenant.name}
                </span>
              </button>
            </div>

            {/* Desktop nav — centered */}
            <nav
              className="hidden lg:flex items-center gap-7 xl:gap-10 absolute left-1/2 -translate-x-1/2"
              aria-label="Разделы страницы"
            >
              {NAV_LINKS.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleNav(link.id)}
                  className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50 hover:opacity-100 transition-opacity duration-200"
                  style={{ color: "var(--color-text)" }}
                >
                  {link.label}
                </button>
              ))}
            </nav>

            {/* Right: звонок | рядом «Мои записи» + корзина | бургер */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
              {typeof (tenant.contact_json as Record<string, unknown> | undefined)?.phone === "string" && (
                <a
                  href={`tel:${(tenant.contact_json as Record<string, string>).phone}`}
                  className="hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors hover:bg-black/5 lg:flex"
                  style={{ borderColor: "var(--color-border-muted)", color: "var(--color-text)" }}
                  aria-label="Позвонить"
                >
                  <Phone size={13} strokeWidth={2} />
                  <span>{(tenant.contact_json as Record<string, string>).phone}</span>
                </a>
              )}

              <div className="flex items-center gap-1.5 sm:gap-2">
                {onMyBookings && (
                  <button
                    type="button"
                    onClick={onMyBookings}
                    className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border-2 px-2.5 py-1.5 text-[12px] font-bold transition-all hover:brightness-[0.97] active:scale-[0.98] sm:min-h-[42px] sm:gap-2 sm:px-3.5 sm:py-2 sm:text-[13px]"
                    style={{
                      borderColor: "var(--color-primary)",
                      color: "var(--color-primary)",
                      background: "color-mix(in srgb, var(--color-primary) 12%, white)",
                      boxShadow: "0 2px 12px color-mix(in srgb, var(--color-primary) 22%, transparent)",
                    }}
                    aria-label="Мои записи"
                  >
                    <ClipboardList size={17} strokeWidth={2} className="shrink-0 sm:h-[18px] sm:w-[18px]" aria-hidden />
                    <span className="hidden min-[361px]:inline whitespace-nowrap">Мои записи</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onOpenCart();
                    setMenuOpen(false);
                  }}
                  className="relative inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition-all duration-200 active:scale-[0.96] sm:min-h-[46px] sm:gap-2.5 sm:px-5 sm:py-2.5 sm:text-[11px] sm:tracking-[0.12em]"
                  style={{
                    background: "#1c1917",
                    boxShadow: itemCount > 0 ? "0 3px 12px rgba(0,0,0,0.16)" : "0 2px 6px rgba(0,0,0,0.1)",
                  }}
                  aria-label="Корзина и запись"
                >
                  <div className="relative flex items-center justify-center">
                    <ShoppingBag size={24} strokeWidth={2} className="sm:h-[25px] sm:w-[25px]" aria-hidden />
                    {itemCount > 0 && (
                      <span
                        className={`absolute -right-2.5 -top-2.5 flex min-h-[1.2rem] min-w-[1.2rem] items-center justify-center rounded-full bg-white px-0.5 text-[10px] font-bold leading-none${popping ? " cart-pop" : ""}`}
                        style={{ color: "var(--color-primary)" }}
                      >
                        {itemCount > 9 ? "9+" : itemCount}
                      </span>
                    )}
                  </div>
                  <span className="hidden whitespace-nowrap sm:inline">Запись</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors md:hidden"
                style={{ color: "var(--color-text)" }}
                aria-label="Открыть меню"
              >
                <Menu size={22} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Full-screen glass mobile menu (как в пример.html) */}
      <div
        className={`fixed inset-0 z-[200] flex flex-col items-center justify-center md:hidden transition-all duration-500 ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none -translate-y-4"
        }`}
        style={{
          background: "rgba(250,249,247,0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        aria-hidden={!menuOpen}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className="absolute top-8 right-8 flex items-center justify-center w-12 h-12 rounded-2xl bg-black/5 transition-colors hover:bg-black/10"
          style={{ color: "var(--color-text)" }}
          aria-label="Закрыть меню"
        >
          <X size={22} strokeWidth={2} />
        </button>

        {/* Brand top-left */}
        <button
          type="button"
          onClick={goHome}
          className="absolute top-9 left-8 font-serif text-xl font-bold tracking-tight"
          style={{ color: "var(--color-text)" }}
        >
          {tenant.name}
        </button>

        {/* Nav links — centered, large italic serif */}
        <nav className="flex flex-col items-center gap-8" aria-label="Мобильное меню">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => handleNav(link.id)}
              className="font-serif italic text-3xl font-semibold transition-opacity hover:opacity-70"
              style={{ color: "var(--color-text)" }}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Мои записи + корзина — в один ряд */}
        <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-3 px-5">
          {onMyBookings && (
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onMyBookings(); }}
              className="flex min-h-[52px] flex-1 max-w-[48%] items-center justify-center gap-2 rounded-2xl border-2 py-3 text-sm font-bold shadow-md transition-all active:scale-[0.98] sm:min-h-[56px] sm:text-base"
              style={{
                borderColor: "var(--color-primary)",
                color: "var(--color-primary)",
                background: "color-mix(in srgb, var(--color-primary) 10%, white)",
              }}
              aria-label="Мои записи"
            >
              <ClipboardList size={20} strokeWidth={2} aria-hidden />
              <span className="truncate">Мои записи</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onOpenCart();
            }}
            className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-black py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-xl transition-all active:scale-[0.97] sm:min-h-[56px] sm:gap-2.5 sm:text-[11px] ${onMyBookings ? "flex-1 max-w-[48%]" : "w-full max-w-xs"}`}
          >
            <ShoppingBag size={18} strokeWidth={2} aria-hidden />
            <span className="truncate">Запись</span>
            {itemCount > 0 && (
              <span className="ml-0.5 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold tabular-nums">
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
