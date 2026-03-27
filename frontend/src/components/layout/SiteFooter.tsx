import type { Tenant } from "../../types";
import { getFooterContact } from "../../utils/siteContent";

function IconTelegram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm3.98-10.822a1.424 1.424 0 100 2.848 1.424 1.424 0 000-2.848z" />
    </svg>
  );
}

const NAV_LINKS = [
  { label: "Услуги", id: "catalog" },
  { label: "Мастера", id: "masters" },
  { label: "Портфолио", id: "portfolio" },
  { label: "Отзывы", id: "reviews" },
];

interface Props {
  tenant: Tenant;
  onNavClick?: (sectionId: string) => void;
}

export function SiteFooter({ tenant, onNavClick }: Props) {
  const initial = tenant.name.trim().charAt(0).toUpperCase() || "•";
  const contact = getFooterContact(tenant);
  const year = new Date().getFullYear();

  const scrollTo = (id: string) => {
    if (onNavClick) {
      onNavClick(id);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <footer className="mt-4 overflow-hidden" style={{ background: "#1a1714" }}>
      {/* Top CTA strip */}
      <div
        className="px-4 py-10 text-center sm:px-6 lg:px-8"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <p className="font-serif text-2xl font-semibold text-white md:text-3xl">
          Готовы к преображению?
        </p>
        <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Запишитесь онлайн — свободные окна обновляются в реальном времени
        </p>
        <button
          type="button"
          onClick={() => scrollTo("catalog")}
          className="mt-6 inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
          style={{ background: "var(--color-primary, #c08973)", boxShadow: "0 8px 28px rgba(192,137,115,0.4)" }}
        >
          Записаться сейчас
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Main columns */}
      <div className="mx-auto max-w-[var(--layout-max)] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="mb-5 flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-serif text-base font-bold"
                style={{ background: "var(--color-primary, #c08973)", color: "#fff" }}
                aria-hidden
              >
                {initial}
              </div>
              <span className="font-serif text-xl font-semibold text-white">{tenant.name}</span>
            </div>
            <p className="mb-6 max-w-sm text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              Ваш beauty-салон с заботой о каждом клиенте. Профессиональные мастера, премиум материалы и атмосфера уюта.
            </p>
            <div className="flex items-center gap-2">
              {[
                { href: contact.telegram, Icon: IconTelegram, label: "Telegram" },
                { href: contact.whatsapp, Icon: IconWhatsApp, label: "WhatsApp" },
                { href: contact.instagram, Icon: IconInstagram, label: "Instagram" },
              ].map(({ href, Icon, label }) =>
                href && href !== "#" ? (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="group flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 hover:-translate-y-0.5"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ) : null
              )}
            </div>
          </div>

          {/* Nav */}
          <div>
            <h3 className="mb-5 text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
              Навигация
            </h3>
            <ul className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <li key={link.id}>
                  <button
                    type="button"
                    onClick={() => scrollTo(link.id)}
                    className="text-sm transition-all duration-200 hover:translate-x-1"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <h3 className="mb-5 text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
              Контакты
            </h3>
            <div className="flex flex-col gap-3">
              {contact.phones.map((p) => (
                <a key={p.href} href={p.href} className="text-sm font-medium tabular-nums transition-colors duration-200 hover:text-white" style={{ color: "rgba(255,255,255,0.7)" }}>
                  {p.label}
                </a>
              ))}
              {contact.address && (
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{contact.address}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-5 sm:px-6 lg:px-8" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="mx-auto flex max-w-[var(--layout-max)] flex-col items-center justify-between gap-3 text-center text-xs sm:flex-row sm:text-left">
          <p style={{ color: "rgba(255,255,255,0.25)" }}>
            © {year} {tenant.name}. Все права защищены.
          </p>
          <p style={{ color: "rgba(255,255,255,0.18)" }}>Работает на SalonFlow</p>
        </div>
      </div>
    </footer>
  );
}
