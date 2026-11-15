import { LayoutDashboard, Package, RefreshCw, ShoppingBag, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api, errorMessage } from '../api';
import { EmptyState, Spinner } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useTitle } from '../hooks';
import CustomersTab from './admin/CustomersTab';
import OrdersTab from './admin/OrdersTab';
import Overview from './admin/Overview';
import ProductsTab from './admin/ProductsTab';

const TABS = [
  ['overview', 'Overview', LayoutDashboard],
  ['products', 'Products', Package],
  ['orders', 'Orders', ShoppingBag],
  ['customers', 'Customers', Users],
];

export default function Admin() {
  useTitle('Admin');
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasData = useRef(false);

  const load = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [metrics, products, orders, customers, categories] = await Promise.all([
        api('/api/admin/metrics'), api('/api/admin/products'), api('/api/admin/orders'),
        api('/api/admin/customers'), api('/api/categories'),
      ]);
      setData({ metrics, products, orders, customers, categories });
      hasData.current = true;
      setError('');
    } catch (e) {
      if (hasData.current) toast.error(errorMessage(e));
      else setError(errorMessage(e));
    } finally {
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (error && !data) return <div className="container page"><EmptyState title="The dashboard could not load" action={<button type="button" className="btn btn-primary" onClick={load}>Try again</button>}>{error}</EmptyState></div>;
  if (!data) return <div className="page-center"><Spinner /></div>;

  // Totals come from the metrics, because the order and customer lists are capped.
  const counts = { products: data.metrics.total_products, orders: data.metrics.total_orders, customers: data.metrics.total_customers };
  const refreshed = (message) => { if (message) toast.success(message); return load(); };

  return (
    <div className="container page">
      <div className="admin-head">
        <h1 className="page-title">Admin</h1>
        <button type="button" className="btn btn-outline btn-sm" onClick={load} disabled={isRefreshing}>
          <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} aria-hidden="true" />Refresh
        </button>
      </div>
      <nav className="tabs" aria-label="Admin sections">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} type="button" aria-current={tab === key ? 'page' : undefined}
            className={`tab ${tab === key ? 'is-active' : ''}`} onClick={() => setTab(key)}>
            <Icon size={18} aria-hidden="true" />{label}{counts[key] !== undefined && <span className="tab-count">{counts[key]}</span>}
          </button>
        ))}
      </nav>
      <div className="tab-panel">
        {tab === 'overview' && <Overview metrics={data.metrics} orders={data.orders} />}
        {tab === 'products' && <ProductsTab products={data.products} categories={data.categories} onChanged={refreshed} />}
        {tab === 'orders' && <OrdersTab orders={data.orders} onChanged={refreshed} />}
        {tab === 'customers' && <CustomersTab customers={data.customers} />}
      </div>
    </div>
  );
}
