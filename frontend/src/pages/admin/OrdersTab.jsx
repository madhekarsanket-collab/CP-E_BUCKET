import { useState } from 'react';

import { api, errorMessage } from '../../api';
import { ConfirmDialog, StatusPill } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { formatDate, formatPrice, statusTone } from '../../lib/format';

const STATUSES = ['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

export default function OrdersTab({ orders, onChanged }) {
  const toast = useToast();
  const [pendingCancel, setPendingCancel] = useState(null);

  const setStatus = async (orderId, status) => {
    try {
      await api(`/api/admin/orders/${orderId}/status`, { method: 'PATCH', body: { status } });
      await onChanged(`Order #${orderId} is now ${status}.`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const handleChange = (order, status) => (status === 'Cancelled' ? setPendingCancel(order) : setStatus(order.order_id, status));

  return (
    <div className="card panel">
      <table className="data-table">
        <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Courier</th><th>Status</th><th>Change status</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.order_id}>
              <td data-label="Order"><strong>#{o.order_id}</strong></td>
              <td data-label="Customer">{o.user_name}</td>
              <td data-label="Date">{formatDate(o.order_date)}</td>
              <td data-label="Total">{formatPrice(o.total)}</td>
              <td data-label="Courier">{o.shipment_name}</td>
              <td data-label="Status"><StatusPill status={o.status} tone={statusTone(o.status)} /></td>
              <td data-label="Change status">
                {o.status === 'Cancelled' ? <span className="muted">Closed</span> : (
                  <select className="input-sm" aria-label={`Status for order ${o.order_id}`} value={o.status} onChange={(e) => handleChange(o, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmDialog isOpen={Boolean(pendingCancel)} title={`Cancel order #${pendingCancel?.order_id}?`} confirmLabel="Cancel order"
        onCancel={() => setPendingCancel(null)} onConfirm={() => { const id = pendingCancel.order_id; setPendingCancel(null); setStatus(id, 'Cancelled'); }}>
        The items go back into stock. A cancelled order cannot be reopened.
      </ConfirmDialog>
    </div>
  );
}
