import { Compass } from 'lucide-react';
import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';

import Navbar from './components/Navbar';
import RequireRole from './components/RequireRole';
import { EmptyState, ErrorBoundary } from './components/ui';
import Admin from './pages/Admin';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Orders from './pages/Orders';
import ProductDetail from './pages/ProductDetail';
import Receipt from './pages/Receipt';
import Register from './pages/Register';
import Shop from './pages/Shop';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="container page">
      <EmptyState icon={Compass} title="That page isn't here" action={<Link to="/" className="btn btn-primary">Back to the shop</Link>}>
        The link may be old or mistyped.
      </EmptyState>
    </div>
  );
}

export default function App() {
  const { pathname } = useLocation();
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <ScrollToTop />
      <Navbar />
      <main id="main" key={pathname.split('/')[1]} className="route-fade">
        <ErrorBoundary key={pathname}>
          <Routes>
            <Route path="/" element={<Shop />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/checkout" element={<RequireRole role="user"><Checkout /></RequireRole>} />
            <Route path="/order-confirmed" element={<RequireRole role="user"><Receipt /></RequireRole>} />
            <Route path="/orders" element={<RequireRole role="user"><Orders /></RequireRole>} />
            <Route path="/admin" element={<RequireRole role="admin"><Admin /></RequireRole>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <footer className="site-footer">
        <div className="container footer-row">
          <strong>E-Bucket</strong>
          <span>A multi-category marketplace. Demo store: payments are simulated.</span>
        </div>
      </footer>
    </>
  );
}
