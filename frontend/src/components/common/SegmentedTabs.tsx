import { cn } from "../../utils";

export type SegmentedTabItem = { key: string | null; label: string };

interface Props {
  tabs: SegmentedTabItem[];
  activeKey: string | null;
  onSelect: (key: string | null) => void;
  className?: string;
  ariaLabel?: string;
  dark?: boolean;
  allLabel?: string;
}

export function SegmentedTabs({ tabs, activeKey, onSelect, className, ariaLabel = "Категории", dark, allLabel = "Все" }: Props) {
  if (dark) {
    return (
      <div className={cn("flex flex-wrap gap-3", className)} role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          const id = tab.key === null ? "__all__" : tab.key;
          return (
            <button
              key={id} type="button" role="tab" aria-selected={isActive}
              onClick={() => onSelect(tab.key)}
              className={cn(
                "whitespace-nowrap rounded-lg border px-6 py-3 text-sm font-semibold transition-all duration-200 active:scale-95",
                isActive
                  ? "bg-white text-ink border-transparent"
                  : "border-white/20 text-white/60 hover:border-white/40 hover:text-white"
              )}
            >
              {tab.key === null ? allLabel : tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    /* Горизонтальный скролл без скроллбара */
    <div className={cn("-mx-4 overflow-x-auto pb-1 hide-scrollbar sm:mx-0", className)}>
      <div className="flex min-w-min gap-3 px-4 sm:px-0" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          const id = tab.key === null ? "__all__" : tab.key;
          return (
            <button
              key={id} type="button" role="tab" aria-selected={isActive}
              onClick={() => onSelect(tab.key)}
              className={cn(
                "shrink-0 min-h-[48px] whitespace-nowrap rounded-xl border-2 px-5 py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.97] sm:min-w-[3rem]",
                isActive
                  ? "bg-ink text-white border-transparent shadow-sm"
                  : "bg-white text-ink border-black/10 hover:border-black/25 hover:text-ink"
              )}
            >
              {tab.key === null ? allLabel : tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
