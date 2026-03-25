import type { ReactNode } from "react";
import { useInView } from "../../hooks/useInView";

interface Props {
  children: ReactNode;
  delay?: number;
  className?: string;
}

/** Появление при скролле — кривая как в pokaz fade-up */
export function AnimateIn({ children, delay = 0, className = "" }: Props) {
  const { ref, inView } = useInView(0.08);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.75s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.75s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: inView ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
