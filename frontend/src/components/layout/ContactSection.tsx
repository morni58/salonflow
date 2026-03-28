import { MapPin, Clock, Phone, Send, MessageCircle, Instagram } from "lucide-react";
import type { Tenant } from "../../types";
import { getFooterContact } from "../../utils/siteContent";

const DAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function formatWorkingDays(days?: number[]): string {
  if (!days || days.length === 0) return "Ежедневно";
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return "Ежедневно";
  const isConsecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (isConsecutive && sorted.length >= 3) {
    return DAYS_SHORT[sorted[0]] + "–" + DAYS_SHORT[sorted[sorted.length - 1]];
  }
  return sorted.map((d) => DAYS_SHORT[d]).join(", ");
}

interface Props { tenant: Tenant; }

export function ContactSection({ tenant }: Props) {
  const contact = getFooterContact(tenant);
  const workDays = formatWorkingDays(tenant.working_days);
  const workHours = tenant.working_hours_start + " – " + tenant.working_hours_end;
  const hasAddress = !!contact.address;
  const hasPhone = contact.phones.length > 0;
  const hasSocial =
    (!!contact.telegram && contact.telegram !== "#") ||
    (!!contact.whatsapp && contact.whatsapp !== "#") ||
    (!!contact.instagram && contact.instagram !== "#");

  return (
    <section id="contacts" className="py-16 sm:py-20">
      <div className="mb-10 text-center">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] opacity-40" style={{ color: "var(--color-text)" }}>
          Как нас найти
        </p>
        <h2 className="font-serif text-3xl font-bold md:text-4xl" style={{ color: "var(--color-text)" }}>
          Контакты
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

        {/* Часы работы */}
        <div className="rounded-2xl p-6" style={{ background: "var(--color-primary-muted, #f5eeea)", border: "1px solid rgba(0,0,0,0.05)" }}>
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--color-primary)" }}>
            <Clock size={18} strokeWidth={2} className="text-white" aria-hidden />
          </div>
          <h3 className="mb-1 font-serif text-lg font-bold" style={{ color: "var(--color-text)" }}>Режим работы</h3>
          <p className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>{workDays}</p>
          <p className="mt-0.5 text-sm opacity-65" style={{ color: "var(--color-text)" }}>{workHours}</p>
        </div>

        {/* Телефон */}
        {hasPhone && (
          <div className="rounded-2xl p-6" style={{ background: "#f8f7f5", border: "1px solid rgba(0,0,0,0.05)" }}>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900">
              <Phone size={18} strokeWidth={2} className="text-white" aria-hidden />
            </div>
            <h3 className="mb-2 font-serif text-lg font-bold" style={{ color: "var(--color-text)" }}>Телефон</h3>
            <div className="flex flex-col gap-1.5">
              {contact.phones.map((p) => (
                <a key={p.href} href={p.href} className="text-sm font-semibold transition-opacity hover:opacity-60" style={{ color: "var(--color-text)" }}>
                  {p.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Адрес */}
        {hasAddress && (
          <div className="rounded-2xl p-6" style={{ background: "#f8f7f5", border: "1px solid rgba(0,0,0,0.05)" }}>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--color-primary)" }}>
              <MapPin size={18} strokeWidth={2} className="text-white" aria-hidden />
            </div>
            <h3 className="mb-1 font-serif text-lg font-bold" style={{ color: "var(--color-text)" }}>Адрес</h3>
            <p className="text-sm leading-relaxed opacity-70" style={{ color: "var(--color-text)" }}>{contact.address}</p>
            <a
              href={"https://maps.google.com/?q=" + encodeURIComponent(contact.address!)}
              target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-60"
              style={{ color: "var(--color-primary)" }}
            >
              Открыть на карте
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}

        {/* Соцсети */}
        {hasSocial && (
          <div className="rounded-2xl p-6" style={{ background: "#f8f7f5", border: "1px solid rgba(0,0,0,0.05)" }}>
            <h3 className="mb-4 font-serif text-lg font-bold" style={{ color: "var(--color-text)" }}>Мы в соцсетях</h3>
            <div className="flex flex-col gap-3">
              {contact.telegram && contact.telegram !== "#" && (
                <a href={contact.telegram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm font-medium transition-opacity hover:opacity-70" style={{ color: "var(--color-text)" }}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "#229ED9" }}>
                    <Send size={14} strokeWidth={2} aria-hidden />
                  </span>
                  Telegram
                </a>
              )}
              {contact.whatsapp && contact.whatsapp !== "#" && (
                <a href={contact.whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm font-medium transition-opacity hover:opacity-70" style={{ color: "var(--color-text)" }}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "#25D366" }}>
                    <MessageCircle size={14} strokeWidth={2} aria-hidden />
                  </span>
                  WhatsApp
                </a>
              )}
              {contact.instagram && contact.instagram !== "#" && (
                <a href={contact.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm font-medium transition-opacity hover:opacity-70" style={{ color: "var(--color-text)" }}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)" }}>
                    <Instagram size={14} strokeWidth={2} className="text-white" aria-hidden />
                  </span>
                  Instagram
                </a>
              )}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
