import { Check, PackageOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api, errorMessage } from '../api';
import { EmptyState, Spinner, StatusPill } from '../components/ui';
import { useTitle } from '../hooks';
import { formatDate, formatPrice, ORDER_STEPS, orderStep, statusTone } from '../lib/format';

function Progress({ status }) {
  const step = orderStep(status);
  if (step < 0) return null;
  return (
    <ol className="progress" aria-label={`Order progress: ${status}`}>
      {ORDER_STEPS.map((name, i) => (
        <li key={name} className={i <= step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
          <span className="progress-dot">{i < step ? <Check size={12} aria-hidden="true" /> : null}</span>{name}
        </li>
      ))}
    </ol>
  );
}

export default function Orders() {
  useTitle('My orders');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/orders').then(setOrders).catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <div className="container page"><EmptyState title="We couldn't load your orders">{error}</EmptyState></div>;
  if (!orders) return <div className="page-center"><Spinner /></div>;
  if (orders.length === 0) {
    return (
      <div className="container page">
        <EmptyState icon={PackageOpen} title="No orders yet" action={<Link to="/" className="btn btn-primary">Browse products</Link>}>
          When you place an order it will appear here with its delivery progress.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container page">
      <h1 className="page-title">My orders <span className="page-title-count">{orders.length}</span></h1>
      <div className="stack">
        {orders.map((order, i) => (
          <article key={order.order_id} className="card order" style={{ '--i': i }}>
            <header className="order-head">
              <div><h2>Order #{order.order_id}</h2><span className="muted">Placed {formatDate(order.order_date)}</span></div>
              <StatusPill status={order.status} tone={statusTone(order.status)} />
            </header>
            <Progress status={order.status} />
            <ul className="order-items">
              {order.items.map((item) => (
                <li key={item.order_item_id}>
                  <span>{item.quantity} × {item.product_name}</span><strong>{formatPrice(item.subtotal)}</strong>
                </li>
              ))}
            </ul>
            <footer className="order-foot">
              <span>{order.payment_method} · {order.payment_status === 'Success' ? 'paid' : 'payment pending'}</span>
              <span>{order.shipment_name}{order.delivery_date ? ` · by ${formatDate(order.delivery_date)}` : ''}</span>
              <strong>Total {formatPrice(order.total)}</strong>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
