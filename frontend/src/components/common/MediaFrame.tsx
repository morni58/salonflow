import type { ImgHTMLAttributes } from "react";
import { cn } from "../../utils";

type Props = {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
  onError?: ImgHTMLAttributes<HTMLImageElement>["onError"];
};

/**
 * Картинка в фиксированной рамке: всё изображение видно, без обрезки —
 * масштаб под размер контейнера (как «вписать в рамку» в графических редакторах).
 */
export function MediaFrame({ src, alt, className, imgClassName, loading = "lazy", onError }: Props) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center overflow-hidden",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        loading={loading}
        className={cn("max-h-full max-w-full object-contain", imgClassName)}
        draggable={false}
        onError={onError}
      />
    </div>
  );
}
