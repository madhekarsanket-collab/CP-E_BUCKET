import { Minus, Plus, SearchX } from 'lucide-react';
import { Component, useEffect, useRef } from 'react';

export function StockBadge({ product }) {
  return <span className={`stock-badge stock-${product.stock_tier}`}>{product.stock_display}</span>;
}

export function StatusPill({ status, tone }) {
  return <span className={`pill pill-${tone}`}>{status}</span>;
}

export function QuantityStepper({ value, max, onChange, label }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="icon-btn icon-btn-sm" aria-label="Decrease quantity" onClick={() => onChange(value - 1)}>
        <Minus size={16} aria-hidden="true" />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" className="icon-btn icon-btn-sm" aria-label="Increase quantity" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function EmptyState({ icon: Icon = SearchX, title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon size={36} strokeWidth={1.5} aria-hidden="true" /></span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return <div className="spinner" role="status" aria-label={label} />;
}

/** Native <dialog>: focus trapping, Escape to close and the backdrop come from the browser. */
export function ConfirmDialog({ isOpen, title, children, confirmLabel, onConfirm, onCancel }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);
  return (
    <dialog ref={ref} className="dialog" onCancel={onCancel} onClose={onCancel}>
      <h2>{title}</h2>
      <p>{children}</p>
      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Keep it</button>
        <button type="button" className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}

/** Catches render crashes so a bug shows a message and a way out instead of a blank page. */
export class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <EmptyState title="Something broke on this page" action={
        <button type="button" className="btn btn-primary" onClick={() => window.location.assign('/')}>Back to the shop</button>
      }>
        Reload the page and try again. If it keeps happening, tell us what you were doing.
      </EmptyState>
    );
  }
}
