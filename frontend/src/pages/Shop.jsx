import { ArrowDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { api } from '../api';
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard';
import { EmptyState } from '../components/ui';
import { useDebounced, useTitle } from '../hooks';
import { useProducts } from '../useProducts';
import { categoryStyle } from '../lib/categoryIcons';

const PAGE_SIZE = 12;
const SORTS = [['newest', 'Newest first'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['name', 'Name: A to Z']];
const PRICE_BANDS = [
  { key: 'all', label: 'Any price' },
  { key: 'u1000', label: 'Under ₹1,000', max: 1000 },
  { key: '1to3', label: '₹1,000 to ₹3,000', min: 1000, max: 3000 },
  { key: '3to7', label: '₹3,000 to ₹7,000', min: 3000, max: 7000 },
  { key: 'o7000', label: 'Above ₹7,000', min: 7000 },
];
const HERO_TAGS = ['Electronics', 'Fitness', 'Fashion'];

function Hero({ search, onSearch }) {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">Eight aisles. One cart.</p>
          <h1>The whole bazaar,<br />in one basket.</h1>
          <p className="hero-lede">Headphones to hand drums, yoga mats to denim. Search once, pay once, and track it all in one place.</p>
          <label className="search-field">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">Search products</span>
            <input type="search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search guitars, kettles, keyboards" maxLength={100} />
            {search && (
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => onSearch('')} aria-label="Clear search">
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </label>
        </div>
        <div className="hero-tags" aria-hidden="true">
          {HERO_TAGS.map((name, i) => {
            const { Icon, hue } = categoryStyle(name);
            return (
              <div key={name} className="hang-tag" style={{ '--hue': hue, '--n': i }}>
                <span className="hang-tag-hole" />
                <Icon size={34} strokeWidth={1.5} />
                <strong>{name}</strong>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Ticker({ categories }) {
  if (!categories.length) return null;
  const names = [...categories, ...categories].map((c) => c.name);
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {names.map((name, i) => <span key={`${name}-${i}`}>{name}</span>)}
      </div>
    </div>
  );
}

export default function Shop() {
  useTitle('');
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState(params.get('q') || '');
  const debouncedSearch = useDebounced(search, 350);

  const update = useCallback((changes) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
      return next;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => { update({ q: debouncedSearch.trim() }); }, [debouncedSearch, update]);
  useEffect(() => { api('/api/categories').then(setCategories).catch(() => {}); }, []);

  const category = params.get('category') || '';
  const sort = params.get('sort') || 'newest';
  const band = params.get('price') || 'all';
  const query = params.get('q') || '';

  const buildUrl = useCallback((offset) => {
    const search_ = new URLSearchParams({ limit: PAGE_SIZE, offset, sort });
    const priceBand = PRICE_BANDS.find((b) => b.key === band);
    if (category) search_.set('category_id', category);
    if (query) search_.set('search', query);
    if (priceBand?.min) search_.set('min_price', priceBand.min);
    if (priceBand?.max) search_.set('max_price', priceBand.max);
    return `/api/products?${search_}`;
  }, [category, sort, band, query]);

  const { result, status, error, isLoadingMore, loadMore, retry } = useProducts(buildUrl);

  const hasFilters = Boolean(category || query || band !== 'all');
  const clearFilters = () => { setSearch(''); setParams({}, { replace: true }); };

  return (
    <>
      <Hero search={search} onSearch={setSearch} />
      <Ticker categories={categories} />
      <section className="container shop" aria-labelledby="catalogue-heading">
        <h2 id="catalogue-heading" className="sr-only">Products</h2>
        <div className="chips" role="group" aria-label="Filter by category">
          <button type="button" className={`chip chip-btn ${!category ? 'is-active' : ''}`} aria-pressed={!category} onClick={() => update({ category: '' })}>All</button>
          {categories.map((c) => (
            <button key={c.category_id} type="button" className={`chip chip-btn ${category === String(c.category_id) ? 'is-active' : ''}`}
              aria-pressed={category === String(c.category_id)} onClick={() => update({ category: String(c.category_id) })}>
              {c.name}
            </button>
          ))}
        </div>

        <div className="toolbar">
          <p className="result-count" aria-live="polite">
            {status === 'ready' ? `${result.total} ${result.total === 1 ? 'product' : 'products'}` : ' '}
          </p>
          <div className="toolbar-controls">
            <label className="select-field">
              <SlidersHorizontal size={16} aria-hidden="true" /><span className="sr-only">Price range</span>
              <select value={band} onChange={(e) => update({ price: e.target.value === 'all' ? '' : e.target.value })}>
                {PRICE_BANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
              </select>
            </label>
            <label className="select-field">
              <ArrowDown size={16} aria-hidden="true" /><span className="sr-only">Sort by</span>
              <select value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })}>
                {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
        </div>

        {status === 'error' && (
          <EmptyState title="We couldn't load the products" action={<button type="button" className="btn btn-primary" onClick={retry}>Try again</button>}>
            {error}
          </EmptyState>
        )}

        {status === 'loading' && (
          <div className="grid">{Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
        )}

        {status === 'ready' && result.items.length === 0 && (
          <EmptyState title="Nothing matches those filters" action={hasFilters && <button type="button" className="btn btn-primary" onClick={clearFilters}>Clear filters</button>}>
            Try a shorter search, another category, or a wider price range.
          </EmptyState>
        )}

        {status === 'ready' && result.items.length > 0 && (
          <>
            <div className="grid">
              {result.items.map((product, index) => <ProductCard key={product.product_id} product={product} index={index % PAGE_SIZE} />)}
            </div>
            {result.items.length < result.total && (
              <div className="load-more">
                <button type="button" className="btn btn-outline" onClick={loadMore} disabled={isLoadingMore}>
                  {isLoadingMore ? 'Loading' : `Show more (${result.total - result.items.length} left)`}
                </button>
              </div>
            )}
          </>
        )}
        {status === 'ready' && <p className="fine-print">All prices are in Indian rupees (INR). Delivery is free on every order.</p>}
      </section>
    </>
  );
}
