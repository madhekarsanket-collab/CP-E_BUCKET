import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useToast } from './ToastContext';

const CartContext = createContext(null);
const CART_KEY = 'ebucket_cart';

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

/** Cart lines hold only what the page needs to draw them; the server re-prices everything at checkout. */
export function CartProvider({ children }) {
  const toast = useToast();
  const [lines, setLines] = useState(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch {
      // Storage blocked: the cart simply won't survive a reload.
    }
  }, [lines]);

  const value = useMemo(() => {
    const add = (product, quantity = 1) => {
      const existing = lines.find((line) => line.product_id === product.product_id);
      const wanted = (existing?.quantity || 0) + quantity;
      if (!product.in_stock) {
        toast.error(`${product.name} is out of stock.`);
        return false;
      }
      if (wanted > product.max_qty) {
        toast.error(`You can add at most ${product.max_qty} of ${product.name}.`);
        return false;
      }
      const line = {
        product_id: product.product_id, name: product.name, price: product.price,
        category_name: product.category_name, image_url: product.image_url, max_qty: product.max_qty, quantity: wanted,
      };
      setLines(existing
        ? lines.map((l) => (l.product_id === line.product_id ? line : l))
        : [...lines, line]);
      toast.success(`${product.name} added to your cart.`);
      return true;
    };

    const setQuantity = (productId, quantity) => {
      if (quantity <= 0) return setLines(lines.filter((l) => l.product_id !== productId));
      setLines(lines.map((l) => (l.product_id === productId ? { ...l, quantity: Math.min(quantity, l.max_qty) } : l)));
    };

    return {
      lines,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      total: lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
      add,
      setQuantity,
      remove: (productId) => setLines(lines.filter((l) => l.product_id !== productId)),
      clear: () => setLines([]),
    };
  }, [lines, toast]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
