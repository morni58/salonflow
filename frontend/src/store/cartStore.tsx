import { createContext, useContext, useReducer, useEffect, type ReactNode } from "react";
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

// ── Persistence ────────────────────────
const CART_KEY = "salonflow_cart_v2";

function loadCart(): CartState {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw) as { items?: unknown };
    if (Array.isArray(parsed.items)) return { items: parsed.items as CartItem[] };
  } catch {/* ignore */}
  return { items: [] };
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
  const [state, dispatch] = useReducer(cartReducer, undefined, loadCart);

  // Save to localStorage whenever cart changes
  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(state)); } catch {/* ignore */}
  }, [state]);

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
