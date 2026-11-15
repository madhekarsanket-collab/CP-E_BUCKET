import { ArrowLeft, PackageX, ShoppingCart, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api, errorMessage } from '../api';
import { EmptyState, QuantityStepper, Spinner, StockBadge } from '../components/ui';
import { useCart } from '../context/CartContext';
import { useTitle } from '../hooks';
import { ProductArt } from '../lib/categoryIcons';
import { formatPrice } from '../lib/format';

export default function ProductDetail() {
  const { id } = useParams();
  const { add } = useCart();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  useTitle(product?.name);

  useEffect(() => {
    let isCurrent = true;
    setProduct(null);
    setError('');
    setQuantity(1);
    api(`/api/products/${encodeURIComponent(id)}`)
      .then((data) => isCurrent && setProduct(data))
      .catch((e) => isCurrent && setError(errorMessage(e)));
    return () => { isCurrent = false; };
  }, [id]);

  if (error) {
    return (
      <div className="container page">
        <EmptyState icon={PackageX} title="We can't find that product" action={<Link to="/" className="btn btn-primary">Back to the shop</Link>}>{error}</EmptyState>
      </div>
    );
  }
  if (!product) return <div className="page-center"><Spinner /></div>;

  return (
    <div className="container page">
      <Link to="/" className="back-link"><ArrowLeft size={18} aria-hidden="true" />All products</Link>
      <div className="detail">
        <ProductArt category={product.category_name} size="lg" src={product.image_url} name={product.name} />
        <div className="detail-info">
          <div className="product-meta"><span className="chip">{product.category_name}</span><StockBadge product={product} /></div>
          <h1>{product.name}</h1>
          <p className="detail-price">{formatPrice(product.price)}</p>
          <p className="detail-desc">{product.details || 'No description yet.'}</p>

          {product.in_stock ? (
            <div className="detail-buy">
              <QuantityStepper label={`Quantity of ${product.name}`} value={quantity} max={product.max_qty} onChange={(n) => setQuantity(Math.max(1, Math.min(n, product.max_qty)))} />
              <button type="button" className="btn btn-primary btn-lg" onClick={() => add(product, quantity)}>
                <ShoppingCart size={20} aria-hidden="true" />Add {quantity} to cart
              </button>
            </div>
          ) : (
            <p className="notice notice-warn">This product is out of stock right now.</p>
          )}
          <ul className="facts">
            <li><Truck size={20} aria-hidden="true" />Free delivery, usually within 4 days</li>
            <li><ShoppingCart size={20} aria-hidden="true" />Up to {product.max_qty || 10} per order</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
