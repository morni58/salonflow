import { ShoppingBag } from "lucide-react";
import { useCart } from "../../store/cartStore";

interface Props {
  onClick: () => void;
}

export function CartIcon({ onClick }: Props) {
  const { itemCount } = useCart();

  if (itemCount === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-soft-md transition duration-300 hover:brightness-[0.96] active:scale-95"
      style={{
        background: "var(--color-primary-solid)",
        color: "var(--color-on-solid)",
        bottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
        right: "max(1rem, env(safe-area-inset-right, 0px))",
      }}
    >
      <ShoppingBag size={22} />
      <span
        className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow-sm"
        style={{
          background: "var(--color-on-solid)",
          color: "var(--color-primary-solid)",
        }}
      >
        {itemCount}
      </span>
    </button>
  );
}
