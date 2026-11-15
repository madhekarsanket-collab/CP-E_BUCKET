import { Banknote, CreditCard, Info, Landmark, MapPin, Smartphone, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { api, errorMessage } from '../api';
import { Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useTitle } from '../hooks';
import { formatPrice } from '../lib/format';

const PAYMENT_ICONS = { UPI: Smartphone, 'Credit/Debit Card': CreditCard, 'Net Banking': Landmark, 'Cash on Delivery': Banknote };
const PAYMENT_HINTS = { 'Cash on Delivery': 'Pay when it arrives', UPI: 'Instant', 'Credit/Debit Card': 'Visa, Mastercard, RuPay', 'Net Banking': 'All major banks' };

export default function Checkout() {
  useTitle('Checkout');
  const { user } = useAuth();
  const { lines, total, clear } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [method, setMethod] = useState('UPI');
  const [courier, setCourier] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  const [isPlaced, setIsPlaced] = useState(false);

  useEffect(() => {
    api('/api/meta')
      .then((meta) => { setOptions(meta); setCourier(meta.couriers[0]); })
      .catch((e) => toast.error(errorMessage(e)));
  }, [toast]);

  // After a successful order the cart is empty on purpose: stay put while we move to the confirmation page.
  if (lines.length === 0 && !isPlaced) return <Navigate to="/cart" replace />;
  if (!options) return <div className="page-center"><Spinner /></div>;

  const placeOrder = async (event) => {
    event.preventDefault();
    setIsPlacing(true);
    try {
      const { order } = await api('/api/checkout', {
        method: 'POST',
        body: { items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })), payment_method: method, shipment_name: courier },
      });
      setIsPlaced(true);
      clear();
      navigate('/order-confirmed', { replace: true, state: { order } });
    } catch (e) {
      toast.error(errorMessage(e));
      setIsPlacing(false);
    }
  };

  return (
    <div className="container page">
      <h1 className="page-title">Checkout</h1>
      <form className="split" onSubmit={placeOrder}>
        <div className="stack">
          <section className="card panel">
            <h2><MapPin size={20} aria-hidden="true" />Deliver to</h2>
            <p className="address"><strong>{user.name}</strong><br />{user.address}<br />{user.phone}</p>
          </section>

          <fieldset className="card panel choice-group">
            <legend><Truck size={20} aria-hidden="true" />Courier</legend>
            <div className="choices">
              {options.couriers.map((name) => (
                <label key={name} className={`choice ${courier === name ? 'is-selected' : ''}`}>
                  <input type="radio" name="courier" value={name} checked={courier === name} onChange={() => setCourier(name)} />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="card panel choice-group">
            <legend><CreditCard size={20} aria-hidden="true" />Payment</legend>
            <div className="choices">
              {options.payment_methods.map((name) => {
                const Icon = PAYMENT_ICONS[name] || CreditCard;
                return (
                  <label key={name} className={`choice ${method === name ? 'is-selected' : ''}`}>
                    <input type="radio" name="payment" value={name} checked={method === name} onChange={() => setMethod(name)} />
                    <Icon size={22} aria-hidden="true" />
                    <span><strong>{name}</strong><small>{PAYMENT_HINTS[name]}</small></span>
                  </label>
                );
              })}
            </div>
            <p className="notice notice-info"><Info size={18} aria-hidden="true" />Demo checkout: no real payment is taken and no card details are asked for.</p>
          </fieldset>
        </div>

        <aside className="card summary">
          <h2>Your order</h2>
          <ul className="summary-items">
            {lines.map((l) => (
              <li key={l.product_id}><span>{l.quantity} × {l.name}</span><strong>{formatPrice(l.price * l.quantity)}</strong></li>
            ))}
          </ul>
          <dl className="summary-rows">
            <div><dt>Delivery</dt><dd className="text-good">Free</dd></div>
            <div className="summary-total"><dt>Total</dt><dd>{formatPrice(total)}</dd></div>
          </dl>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={isPlacing}>
            {isPlacing ? 'Placing your order' : `Place order · ${formatPrice(total)}`}
          </button>
          <Link to="/cart" className="btn btn-ghost btn-block">Back to cart</Link>
        </aside>
      </form>
    </div>
  );
}
