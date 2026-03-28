/** Блокирует скролл без «прыжка» из-за исчезновения полосы прокрутки. */
export function lockBodyScroll(): () => void {
  const html = document.documentElement;
  const body = document.body;
  const gap = window.innerWidth - html.clientWidth;
  const prevHtmlOverflow = html.style.overflow;
  const prevBodyPadding = body.style.paddingRight;
  html.style.overflow = "hidden";
  if (gap > 0) body.style.paddingRight = `${gap}px`;
  return () => {
    html.style.overflow = prevHtmlOverflow;
    body.style.paddingRight = prevBodyPadding;
  };
}
