import { AlertTriangle, IndianRupee, Package, ShoppingBag, Users } from 'lucide-react';

import { StatusPill } from '../../components/ui';
import { formatDate, formatPrice, statusTone } from '../../lib/format';

const RECENT_ORDERS = 5;

function Metric({ icon: Icon, label, value, note, tone }) {
  return (
    <div className={`card metric ${tone ? `metric-${tone}` : ''}`}>
      <span className="metric-icon"><Icon size={22} aria-hidden="true" /></span>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      {note && <span className="metric-note">{note}</span>}
    </div>
  );
}

export default function Overview({ metrics, orders }) {
  return (
    <>
      <div className="metrics">
        <Metric icon={IndianRupee} label="Revenue" value={formatPrice(metrics.total_revenue)} note="Paid orders, excluding cancelled" tone="accent" />
        <Metric icon={ShoppingBag} label="Orders" value={metrics.total_orders} />
        <Metric icon={Users} label="Customers" value={metrics.total_customers} />
        <Metric icon={Package} label="Products" value={metrics.total_products} />
        <Metric icon={AlertTriangle} label="Low or no stock" value={metrics.low_stock_products} note="5 units or fewer" tone={metrics.low_stock_products ? 'warn' : ''} />
      </div>
      <section className="card panel">
        <h2>Recent orders</h2>
        <ul className="recent">
          {orders.slice(0, RECENT_ORDERS).map((o) => (
            <li key={o.order_id}>
              <span><strong>#{o.order_id}</strong> {o.user_name}</span>
              <span className="muted">{formatDate(o.order_date)}</span>
              <StatusPill status={o.status} tone={statusTone(o.status)} />
              <strong>{formatPrice(o.total)}</strong>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
