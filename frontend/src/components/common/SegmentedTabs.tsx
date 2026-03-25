import { cn } from "../../utils";

export type SegmentedTabItem = { key: string | null; label: string };

interface Props {
  tabs: SegmentedTabItem[];
  activeKey: string | null;
  onSelect: (key: string | null) => void;
  className?: string;
  ariaLabel?: string;
  /** Тёмный фон секции (портфолио) */
  dark?: boolean;
  /** Подпись для вкладки «все» (каталог: «Все услуги», портфолио: «Все») */
  allLabel?: string;
}

/** Пилюли как в макете poca */
export function SegmentedTabs({
  tabs,
  activeKey,
  onSelect,
  className,
  ariaLabel = "Категории",
  dark,
  allLabel = "Все услуги",
}: Props) {
  if (dark) {
    return (
      <div className={cn("flex flex-wrap justify-center gap-3", className)} role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          const id = tab.key === null ? "__all__" : tab.key;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.key)}
              className={cn(
                "tab-btn-poca shrink-0 whitespace-nowrap min-h-[44px] rounded-full border px-5 py-2.5 text-sm font-medium transition-all duration-300 md:px-6",
                !isActive && "border-white/15 bg-white/10 text-white/85 hover:border-white/30",
                isActive && "border-transparent shadow-md"
              )}
              style={
                isActive
                  ? {
                      background: "rgba(255,255,255,0.95)",
                      color: "#654538",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    }
                  : undefined
              }
            >
              {tab.key === null ? allLabel : tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto pb-2 hide-scrollbar px-4 sm:mx-0 sm:overflow-visible sm:px-0">
      <div
        className={cn(
          "flex w-max min-w-full flex-nowrap justify-start gap-2 sm:w-auto sm:flex-wrap sm:justify-center md:gap-3",
          className
        )}
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          const id = tab.key === null ? "__all__" : tab.key;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.key)}
              className={cn(
                "tab-btn-poca shrink-0 whitespace-nowrap min-h-[44px] rounded-full border px-5 py-2.5 text-sm font-medium transition-all duration-300 md:px-6",
                !isActive && "border-brand-100 bg-white text-ink-light hover:border-brand-300",
                isActive && "border-transparent shadow-md"
              )}
              style={
                isActive
                  ? {
                      background: "var(--color-primary)",
                      color: "var(--color-primary-foreground)",
                      boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 35%, transparent)",
                    }
                  : undefined
              }
            >
              {tab.key === null ? allLabel : tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
