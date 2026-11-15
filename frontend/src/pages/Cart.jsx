import { ArrowRight, ShoppingBasket, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { EmptyState, QuantityStepper } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useTitle } from '../hooks';
import { ProductArt } from '../lib/categoryIcons';
import { formatPrice } from '../lib/format';

export default function Cart() {
  useTitle('Your cart');
  const { lines, total, count, setQuantity, remove } = useCart();
  const { isCustomer } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  if (lines.length === 0) {
    return (
      <div className="container page">
        <EmptyState icon={ShoppingBasket} title="Your basket is empty" action={<Link to="/" className="btn btn-primary">Start shopping</Link>}>
          Add something from the shop and it will show up here.
        </EmptyState>
      </div>
    );
  }

  const handleCheckout = () => {
    if (isCustomer) return navigate('/checkout');
    toast.info('Sign in to place your order. Your cart will be waiting.');
    return navigate('/login', { state: { from: '/checkout' } });
  };

  return (
    <div className="container page">
      <h1 className="page-title">Your cart <span className="page-title-count">{count} {count === 1 ? 'item' : 'items'}</span></h1>
      <div className="split">
        <ul className="cart-list">
          {lines.map((line, i) => (
            <li key={line.product_id} className="cart-line card" style={{ '--i': i }}>
              <Link to={`/product/${line.product_id}`} aria-label={`View ${line.name}`}><ProductArt category={line.category_name} size="sm" src={line.image_url} name={line.name} /></Link>
              <div className="cart-line-info">
                <Link to={`/product/${line.product_id}`} className="cart-line-name">{line.name}</Link>
                <span className="muted">{formatPrice(line.price)} each</span>
              </div>
              <QuantityStepper label={`Quantity of ${line.name}`} value={line.quantity} max={line.max_qty} onChange={(n) => setQuantity(line.product_id, n)} />
              <strong className="cart-line-total">{formatPrice(line.price * line.quantity)}</strong>
              <button type="button" className="icon-btn" onClick={() => remove(line.product_id)} aria-label={`Remove ${line.name}`}>
                <Trash2 size={20} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        <aside className="card summary">
          <h2>Order summary</h2>
          <dl className="summary-rows">
            <div><dt>Subtotal</dt><dd>{formatPrice(total)}</dd></div>
            <div><dt>Delivery</dt><dd className="text-good">Free</dd></div>
            <div className="summary-total"><dt>Total</dt><dd>{formatPrice(total)}</dd></div>
          </dl>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={handleCheckout}>
            Checkout<ArrowRight size={20} aria-hidden="true" />
          </button>
          <Link to="/" className="btn btn-ghost btn-block">Keep shopping</Link>
        </aside>
      </div>
    </div>
  );
}
