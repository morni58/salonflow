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
      className="fixed z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-soft-md transition duration-300 hover:bg-brand-700 active:scale-95"
      style={{
        bottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
        right: "max(1rem, env(safe-area-inset-right, 0px))",
      }}
    >
      <ShoppingBag size={22} />
      <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-600 shadow-sm">
        {itemCount}
      </span>
    </button>
  );
}
