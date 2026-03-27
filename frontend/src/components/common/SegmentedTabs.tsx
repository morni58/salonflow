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
      <div className={cn("flex flex-wrap gap-2", className)} role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          const id = tab.key === null ? "__all__" : tab.key;
          return (
            <button
              key={id} type="button" role="tab" aria-selected={isActive}
              onClick={() => onSelect(tab.key)}
              className={cn(
                "whitespace-nowrap rounded-full border px-5 py-2 text-[9px] font-bold uppercase tracking-widest transition-all duration-200 active:scale-95",
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
    <div className={cn("-mx-4 overflow-x-auto pb-2 hide-scrollbar sm:mx-0", className)}>
      <div className="flex min-w-min gap-2 px-4 sm:flex-wrap sm:px-0" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          const id = tab.key === null ? "__all__" : tab.key;
          return (
            <button
              key={id} type="button" role="tab" aria-selected={isActive}
              onClick={() => onSelect(tab.key)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full border px-5 py-2 text-[9px] font-bold uppercase tracking-widest transition-all duration-200 active:scale-95",
                isActive
                  ? "bg-ink text-white border-transparent"
                  : "bg-white text-ink/50 border-ink/10 hover:text-ink hover:border-ink/20"
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
