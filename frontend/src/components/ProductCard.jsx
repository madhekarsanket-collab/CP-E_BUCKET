import { Check, ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useCart } from '../context/CartContext';
import { ProductArt } from '../lib/categoryIcons';
import { formatPrice } from '../lib/format';
import { StockBadge } from './ui';

const STAGGER_LIMIT = 12;
const ADDED_FLASH_MS = 1400;

export default function ProductCard({ product, index }) {
  const { add } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!justAdded) return undefined;
    const id = setTimeout(() => setJustAdded(false), ADDED_FLASH_MS);
    return () => clearTimeout(id);
  }, [justAdded]);

  const handleAdd = () => {
    if (add(product)) setJustAdded(true);
  };

  return (
    <article className="card product-card" style={{ '--i': Math.min(index, STAGGER_LIMIT) }}>
      <Link to={`/product/${product.product_id}`} className="product-media" aria-label={`View ${product.name}`}>
        <ProductArt category={product.category_name} src={product.image_url} name={product.name} />
        <span className="price-tag">{formatPrice(product.price)}</span>
      </Link>
      <div className="product-body">
        <div className="product-meta">
          <span className="chip">{product.category_name}</span>
          <StockBadge product={product} />
        </div>
        <h3 className="product-title"><Link to={`/product/${product.product_id}`}>{product.name}</Link></h3>
        <p className="product-desc">{product.details}</p>
        <button
          type="button"
          className={`btn ${justAdded ? 'btn-success' : 'btn-primary'} btn-block`}
          disabled={!product.in_stock}
          onClick={handleAdd}
        >
          {justAdded
            ? <><Check size={18} aria-hidden="true" />Added</>
            : <><ShoppingCart size={18} aria-hidden="true" />{product.in_stock ? 'Add to cart' : 'Out of stock'}</>}
        </button>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="card product-card skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton-media" />
      <div className="product-body">
        <div className="skeleton skeleton-line" style={{ width: '40%' }} />
        <div className="skeleton skeleton-line" style={{ width: '85%' }} />
        <div className="skeleton skeleton-line" style={{ width: '65%' }} />
        <div className="skeleton skeleton-btn" />
      </div>
    </div>
  );
}
