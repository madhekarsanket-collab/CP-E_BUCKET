import { Link, Navigate, useLocation } from 'react-router-dom';

import { useTitle } from '../hooks';
import { formatDate, formatPrice } from '../lib/format';

export default function Receipt() {
  useTitle('Order confirmed');
  const order = useLocation().state?.order;
  if (!order) return <Navigate to="/orders" replace />;

  const paid = order.status === 'Paid';
  const rows = [
    ['Order', `#${order.order_id}`],
    ['Receipt', `RCP-${order.receipt_no}`],
    ['Payment', `${order.payment_method} · ${paid ? 'paid' : 'pay on delivery'}`],
    ['Courier', `${order.shipment_name} · SHIP-${order.shipment_id}`],
    ['Arrives by', formatDate(order.estimated_delivery)],
  ];

  return (
    <div className="container page receipt-wrap">
      <div className="card receipt">
        <svg className="check-draw" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r="24" />
          <path d="M15 27l8 8 15-17" />
        </svg>
        <h1>Order placed</h1>
        <p className="muted">Thank you. We have sent it to the warehouse.</p>
        <dl className="receipt-rows">
          {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          <div className="summary-total"><dt>{paid ? 'Total paid' : 'Total due'}</dt><dd>{formatPrice(order.total)}</dd></div>
        </dl>
        <div className="receipt-actions">
          <Link to="/orders" className="btn btn-outline">View my orders</Link>
          <Link to="/" className="btn btn-primary">Keep shopping</Link>
        </div>
      </div>
    </div>
  );
}
