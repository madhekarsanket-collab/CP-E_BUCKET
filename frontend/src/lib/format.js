const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const rupeesWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** 7999 -> ₹7,999 ; 899.5 -> ₹899.50 */
export function formatPrice(amount) {
  const value = Number(amount) || 0;
  return Number.isInteger(value) ? rupeesWhole.format(value) : rupees.format(value);
}

/** '2026-11-15' -> '15 Nov 2026' (parsed as a local date so the day never shifts with timezone). */
export function formatDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = String(isoDate).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const ORDER_STEPS = ['Paid', 'Processing', 'Shipped', 'Delivered'];

/** Position of an order status on the Paid -> Delivered progress bar (-1 when it is off the track). */
export function orderStep(status) {
  return ORDER_STEPS.indexOf(status);
}

/** Tone used by status pills: 'good' | 'warn' | 'bad' | 'info'. */
export function statusTone(status) {
  if (status === 'Delivered' || status === 'Paid') return 'good';
  if (status === 'Cancelled') return 'bad';
  if (status === 'Pending') return 'warn';
  return 'info';
}
