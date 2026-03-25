import { createContext, useContext, useReducer, type ReactNode } from "react";
import type { Service, CartItem } from "../types";

// ── State ──────────────────────────────

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: "ADD"; service: Service }
  | { type: "REMOVE"; serviceId: string }
  | { type: "SET_QTY"; serviceId: string; quantity: number }
  | { type: "CLEAR" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const existing = state.items.find(
        (i) => i.service.id === action.service.id
      );
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.service.id === action.service.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return { items: [...state.items, { service: action.service, quantity: 1 }] };
    }
    case "REMOVE":
      return {
        items: state.items.filter((i) => i.service.id !== action.serviceId),
      };
    case "SET_QTY":
      if (action.quantity <= 0) {
        return {
          items: state.items.filter((i) => i.service.id !== action.serviceId),
        };
      }
      return {
        items: state.items.map((i) =>
          i.service.id === action.serviceId
            ? { ...i, quantity: action.quantity }
            : i
        ),
      };
    case "CLEAR":
      return { items: [] };
    default:
      return state;
  }
}

// ── Context ────────────────────────────

interface CartContextValue {
  items: CartItem[];
  addItem: (service: Service) => void;
  removeItem: (serviceId: string) => void;
  setQuantity: (serviceId: string, qty: number) => void;
  clearCart: () => void;
  totalPrice: number;
  totalDuration: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  const totalPrice = state.items.reduce(
    (sum, i) => sum + i.service.price * i.quantity,
    0
  );
  const totalDuration = state.items.reduce(
    (sum, i) => sum + i.service.duration_minutes * i.quantity,
    0
  );
  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        addItem: (service) => dispatch({ type: "ADD", service }),
        removeItem: (id) => dispatch({ type: "REMOVE", serviceId: id }),
        setQuantity: (id, qty) =>
          dispatch({ type: "SET_QTY", serviceId: id, quantity: qty }),
        clearCart: () => dispatch({ type: "CLEAR" }),
        totalPrice,
        totalDuration,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
