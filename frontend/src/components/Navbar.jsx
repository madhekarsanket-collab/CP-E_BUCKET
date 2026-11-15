import { LayoutDashboard, LogIn, LogOut, Menu, PackageSearch, ShoppingBasket, ShoppingCart, Store, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const { role, user, isAdmin, isCustomer, signOut } = useAuth();
  const { count } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    toast.success('You are signed out.');
    navigate('/');
  };

  return (
    <header className="site-header">
      <div className="container header-row">
        <Link to="/" className="brand" aria-label="E-Bucket home">
          <span className="brand-mark"><ShoppingBasket size={22} aria-hidden="true" /></span>
          <span className="brand-name">E-Bucket</span>
        </Link>

        <nav id="site-nav" className={`nav ${isOpen ? 'is-open' : ''}`} aria-label="Main">
          <NavLink to="/" end><Store size={18} aria-hidden="true" />Shop</NavLink>
          {isCustomer && <NavLink to="/orders"><PackageSearch size={18} aria-hidden="true" />My orders</NavLink>}
          {isAdmin && <NavLink to="/admin"><LayoutDashboard size={18} aria-hidden="true" />Admin</NavLink>}
          <div className="nav-account">
            {role ? (
              <>
                <span className="nav-user"><UserRound size={18} aria-hidden="true" />{isAdmin ? 'Admin' : user?.name}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleSignOut}>
                  <LogOut size={16} aria-hidden="true" />Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm"><LogIn size={16} aria-hidden="true" />Sign in</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Create account</Link>
              </>
            )}
          </div>
        </nav>

        <div className="header-tools">
          <ThemeToggle />
          <Link to="/cart" className="icon-btn cart-btn" aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}>
            <ShoppingCart size={22} aria-hidden="true" />
            {count > 0 && <span key={count} className="cart-badge">{count}</span>}
          </Link>
          <button
            type="button"
            className="icon-btn menu-btn"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
            aria-controls="site-nav"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
