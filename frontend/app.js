const { useState, useEffect, useMemo, useRef } = React;

// ==========================================
// API Configuration for Localhost vs Vercel
// ==========================================
// When running locally, use relative API paths.
// When deployed on Vercel or external domain, route requests to the public tunnel URL.
const TUNNEL_URL = 'https://cp-ebucket-frontend.vercel.app.ngrok-free.app';

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocalhost ? '' : TUNNEL_URL;
axios.defaults.baseURL = API_BASE_URL;

// Add ngrok browser warning bypass header ONLY when using an ngrok tunnel
if (!isLocalhost && API_BASE_URL.includes('ngrok')) {
  axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';
}

// Automatically attach HMAC admin token to all admin requests
axios.interceptors.request.use(config => {
  if (config.url && config.url.includes('/api/admin/')) {
    try {
      const savedAdmin = JSON.parse(localStorage.getItem('ebucket_admin'));
      if (savedAdmin && savedAdmin.token) {
        config.headers['Authorization'] = `Bearer ${savedAdmin.token}`;
      }
    } catch (e) {
      // Ignored
    }
  }
  return config;
});

// Helper component to render customer stock badge based on stock rules
function CustomerStockBadge({ product }) {
  const stock = product.stock !== undefined ? product.stock : 0;
  if (stock > 10) {
    return <span className="badge badge-stock-green rounded-pill">In Stock</span>;
  } else if (stock >= 4) {
    return <span className="badge badge-stock-yellow rounded-pill">Only {stock} left!</span>;
  } else if (stock >= 1) {
    return <span className="badge badge-stock-red rounded-pill">Only {stock} left!</span>;
  } else {
    return <span className="badge badge-stock-out rounded-pill">Out of Stock</span>;
  }
}

function App() {
  const [view, setView] = useState('shop'); // shop, product-detail, cart, checkout, receipt, orders, admin, login, register
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('ebucket_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [admin, setAdmin] = useState(() => {
    try {
      const saved = localStorage.getItem('ebucket_admin');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('ebucket_cart');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [lastOrder, setLastOrder] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  // Admin state
  const [adminTab, setAdminTab] = useState('overview'); // overview, products, orders, customers
  const [adminMetrics, setAdminMetrics] = useState(null);
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminCustomers, setAdminCustomers] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    localStorage.setItem('ebucket_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('ebucket_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ebucket_user');
    }
  }, [user]);

  useEffect(() => {
    if (admin) {
      localStorage.setItem('ebucket_admin', JSON.stringify(admin));
    } else {
      localStorage.removeItem('ebucket_admin');
    }
  }, [admin]);

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const loadCategories = async () => {
    try {
      const res = await axios.get('/api/categories');
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      let url = '/api/products';
      const params = [];
      if (selectedCategory) params.push(`category_id=${selectedCategory}`);
      if (searchQuery) params.push(`search=${encodeURIComponent(searchQuery)}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await axios.get(url);
      setProducts(res.data);
    } catch (err) {
      showAlert('Failed to load products: ' + (err.response?.data?.error || err.message), 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (view === 'shop') {
      loadProducts();
    }
  }, [selectedCategory, searchQuery, view]);

  // Cart operations
  const addToCart = (product, quantity = 1) => {
    if (product.stock <= 0) {
      showAlert('Product is out of stock!', 'danger');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.product_id);
      if (existing) {
        if (existing.quantity + quantity > product.stock) {
          showAlert(`Cannot add more than available stock (${product.stock})`, 'warning');
          return prev;
        }
        return prev.map(item =>
          item.product_id === product.product_id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
    showAlert(`Added ${product.name} to cart!`);
  };

  const updateCartQty = (productId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product_id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.stock) {
            showAlert(`Only ${item.stock} units available in stock`, 'warning');
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Load user order history
  const loadUserOrders = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await axios.get(`/api/orders/user/${user.user_id}`);
      setUserOrders(res.data);
    } catch (err) {
      showAlert('Error loading orders: ' + (err.response?.data?.error || err.message), 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Admin loaders
  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [mRes, oRes, cRes, pRes] = await Promise.all([
        axios.get('/api/admin/metrics'),
        axios.get('/api/admin/orders'),
        axios.get('/api/admin/customers'),
        axios.get('/api/admin/products')
      ]);
      setAdminMetrics(mRes.data);
      setAdminOrders(oRes.data);
      setAdminCustomers(cRes.data);
      setProducts(pRes.data);
    } catch (err) {
      showAlert('Failed to load admin dashboard: ' + (err.response?.data?.error || err.message), 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'admin' && admin) {
      loadAdminData();
    }
  }, [view, admin]);

  // Auth Handlers
  const handleLogout = () => {
    setUser(null);
    setAdmin(null);
    setView('shop');
    showAlert('Logged out successfully.');
  };

  return (
    <div>
      {/* Navigation Bar */}
      <nav className="navbar navbar-expand-lg navbar-dark navbar-custom sticky-top py-3">
        <div className="container">
          <a className="navbar-brand d-flex align-items-center cursor-pointer" onClick={() => setView('shop')}>
            <span className="fs-3 me-2">🛒</span>
            <span className="fs-4 brand-text">E-BUCKET</span>
          </a>

          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navContent">
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="navContent">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <a className={`nav-link ${view === 'shop' ? 'active text-info fw-bold' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setView('shop'); }}>
                  Shop All Products
                </a>
              </li>
              {user && (
                <li className="nav-item">
                  <a className={`nav-link ${view === 'orders' ? 'active text-info fw-bold' : ''}`} href="#" onClick={(e) => { e.preventDefault(); loadUserOrders(); setView('orders'); }}>
                    My Orders
                  </a>
                </li>
              )}
              {admin && (
                <li className="nav-item">
                  <a className={`nav-link ${view === 'admin' ? 'active text-warning fw-bold' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setView('admin'); }}>
                    ⚡ Admin Panel
                  </a>
                </li>
              )}
            </ul>

            <div className="d-flex align-items-center gap-2">
              <button className="btn btn-outline-cyan position-relative me-2" onClick={() => setView('cart')}>
                🛒 Cart
                {cartCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                    {cartCount}
                  </span>
                )}
              </button>

              {user ? (
                <div className="dropdown">
                  <button className="btn btn-cyan dropdown-toggle" type="button" data-bs-toggle="dropdown">
                    👤 {user.name}
                  </button>
                  <ul className="dropdown-menu dropdown-menu-dark dropdown-menu-end">
                    <li><h6 className="dropdown-header text-muted">{user.email}</h6></li>
                    <li><a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); loadUserOrders(); setView('orders'); }}>My Orders</a></li>
                    <li><hr className="dropdown-divider" /></li>
                    <li><a className="dropdown-item text-danger" href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>Logout</a></li>
                  </ul>
                </div>
              ) : admin ? (
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-warning text-dark px-2 py-2">Admin Mode</span>
                  <button className="btn btn-outline-danger btn-sm" onClick={handleLogout}>Exit Admin</button>
                </div>
              ) : (
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-light btn-sm" onClick={() => setView('login')}>Login</button>
                  <button className="btn btn-cyan btn-sm" onClick={() => setView('register')}>Sign Up</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Global Alert Notification */}
      {alert && (
        <div className="container mt-3">
          <div className={`alert alert-${alert.type} alert-dismissible fade show d-flex align-items-center shadow-lg`} role="alert">
            <span className="me-2">{alert.type === 'danger' ? '⚠️' : '✅'}</span>
            <div>{alert.message}</div>
            <button type="button" className="btn-close" onClick={() => setAlert(null)}></button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="pb-5">
        {view === 'shop' && (
          <ShopView
            categories={categories}
            products={products}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            loading={loading}
            onSelectProduct={(p) => { setSelectedProduct(p); setView('product-detail'); }}
            onAddToCart={addToCart}
          />
        )}

        {view === 'product-detail' && selectedProduct && (
          <ProductDetailView
            product={selectedProduct}
            onBack={() => setView('shop')}
            onAddToCart={addToCart}
          />
        )}

        {view === 'cart' && (
          <CartView
            cart={cart}
            cartTotal={cartTotal}
            onUpdateQty={updateCartQty}
            onRemove={removeFromCart}
            onProceedCheckout={() => {
              if (!user) {
                showAlert('Please login or register to complete your order.', 'warning');
                setView('login');
              } else {
                setView('checkout');
              }
            }}
            onContinueShopping={() => setView('shop')}
          />
        )}

        {view === 'checkout' && (
          <CheckoutView
            cart={cart}
            cartTotal={cartTotal}
            user={user}
            onBack={() => setView('cart')}
            onOrderSuccess={(orderData) => {
              setCart([]);
              setLastOrder(orderData);
              setView('receipt');
            }}
            showAlert={showAlert}
          />
        )}

        {view === 'receipt' && lastOrder && (
          <ReceiptView
            order={lastOrder}
            onContinueShopping={() => setView('shop')}
            onViewOrders={() => { loadUserOrders(); setView('orders'); }}
          />
        )}

        {view === 'orders' && (
          <OrdersView
            orders={userOrders}
            loading={loading}
            onContinueShopping={() => setView('shop')}
          />
        )}

        {view === 'login' && (
          <LoginView
            onLoginSuccess={(userData) => {
              setUser(userData);
              setView('shop');
              showAlert(`Welcome back, ${userData.name}!`);
            }}
            onAdminLoginSuccess={(adminData) => {
              setAdmin(adminData);
              setView('admin');
              showAlert('Admin session authenticated.');
            }}
            onSwitchToRegister={() => setView('register')}
            showAlert={showAlert}
          />
        )}

        {view === 'register' && (
          <RegisterView
            onRegisterSuccess={(userData) => {
              setUser(userData);
              setView('shop');
              showAlert(`Account created successfully! Welcome, ${userData.name}!`);
            }}
            onSwitchToLogin={() => setView('login')}
            showAlert={showAlert}
          />
        )}

        {view === 'admin' && admin && (
          <AdminView
            metrics={adminMetrics}
            orders={adminOrders}
            customers={adminCustomers}
            products={products}
            categories={categories}
            tab={adminTab}
            setTab={setAdminTab}
            loading={loading}
            refreshData={loadAdminData}
            showAlert={showAlert}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 border-top border-secondary mt-5 text-center text-muted">
        <div className="container">
          <p className="mb-1 text-light"><strong>E-Bucket</strong> &mdash; Multi-Category E-Commerce Marketplace</p>
          <small>College DBMS Project &bull; Powered by MySQL (e_bucket), Python Flask & React 18</small>
        </div>
      </footer>
    </div>
  );
}

// ----------------- SHOP VIEW -----------------
function ShopView({ categories, products, selectedCategory, setSelectedCategory, searchQuery, setSearchQuery, loading, onSelectProduct, onAddToCart }) {
  return (
    <div>
      {/* Hero Header */}
      <section className="hero-section text-center mb-4">
        <div className="container">
          <h1 className="display-5 fw-bold mb-2">Everything You Need, All in One Place.</h1>
          <p className="text-secondary fs-5 mb-4">Discover electronics, fitness gear, musical instruments, accessories, apparel and more &mdash; explore products across multiple categories at E-Bucket.</p>

          <div className="row justify-content-center">
            <div className="col-md-7">
              <div className="input-group">
                <input
                  type="text"
                  className="form-control form-control-custom"
                  placeholder="Search products across all categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="btn btn-outline-secondary" onClick={() => setSearchQuery('')}>Clear</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        {/* Category Filter Pills */}
        <div className="d-flex flex-wrap gap-2 justify-content-center mb-4">
          <button
            className={`btn btn-sm ${selectedCategory === null ? 'btn-cyan' : 'btn-outline-cyan'}`}
            onClick={() => setSelectedCategory(null)}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button
              key={cat.category_id}
              className={`btn btn-sm ${selectedCategory === cat.category_id ? 'btn-cyan' : 'btn-outline-cyan'}`}
              onClick={() => setSelectedCategory(cat.category_id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-info" role="status"></div>
            <p className="mt-2 text-muted">Loading live products from database...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-5">
            <h4>No products found</h4>
            <p className="text-muted">Try clearing the search query or selecting another category.</p>
          </div>
        ) : (
          <div className="row g-4">
            {products.map(p => (
              <div key={p.product_id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                <div className="card card-custom h-100 d-flex flex-column">
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="badge badge-category rounded-pill px-2 py-1">
                        {p.category_name || 'General'}
                      </span>
                      <CustomerStockBadge product={p} />
                    </div>

                    <h5 className="card-title text-light mb-1 mt-1 cursor-pointer" onClick={() => onSelectProduct(p)}>
                      {p.name}
                    </h5>

                    <p className="card-text text-secondary small flex-grow-1" style={{ minHeight: '40px' }}>
                      {p.details && p.details.length > 70 ? p.details.substring(0, 70) + '...' : p.details}
                    </p>

                    <div className="d-flex align-items-center justify-content-between mt-3 pt-2 border-top border-secondary">
                      <div>
                        <small className="text-muted d-block">Price</small>
                        <span className="fs-5 fw-bold text-info">₹{p.price.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="d-flex gap-1">
                        <button className="btn btn-outline-cyan btn-sm" onClick={() => onSelectProduct(p)}>
                          Details
                        </button>
                        <button
                          className="btn btn-cyan btn-sm"
                          disabled={p.stock <= 0}
                          onClick={() => onAddToCart(p)}
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------- PRODUCT DETAIL VIEW -----------------
function ProductDetailView({ product, onBack, onAddToCart }) {
  const [qty, setQty] = useState(1);

  return (
    <div className="container py-5">
      <button className="btn btn-outline-secondary mb-4" onClick={onBack}>
        &larr; Back to Products
      </button>

      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="card card-custom p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="badge badge-category fs-6 px-3 py-1">{product.category_name}</span>
              <CustomerStockBadge product={product} />
            </div>

            <h2 className="text-light fw-bold mb-3">{product.name}</h2>
            <h4 className="text-info fw-bold mb-4">₹{product.price.toLocaleString('en-IN')}</h4>

            <div className="p-3 rounded mb-4" style={{ background: '#0e1726' }}>
              <h6 className="text-muted text-uppercase small">Specifications & Details:</h6>
              <p className="mb-0 fs-5 text-light">{product.details || 'No detailed specifications provided.'}</p>
            </div>

            <div className="d-flex align-items-center gap-3 mt-3">
              <div className="input-group" style={{ width: '140px' }}>
                <button className="btn btn-outline-secondary" onClick={() => setQty(Math.max(1, qty - 1))}>-</button>
                <input
                  type="number"
                  className="form-control form-control-custom text-center"
                  value={qty}
                  min="1"
                  max={product.stock}
                  onChange={(e) => setQty(Math.min(product.stock, Math.max(1, parseInt(e.target.value) || 1)))}
                />
                <button className="btn btn-outline-secondary" onClick={() => setQty(Math.min(product.stock, qty + 1))}>+</button>
              </div>

              <button
                className="btn btn-cyan px-4 py-2"
                disabled={product.stock <= 0}
                onClick={() => onAddToCart(product, qty)}
              >
                Add to Cart ({qty})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------- CART VIEW -----------------
function CartView({ cart, cartTotal, onUpdateQty, onRemove, onProceedCheckout, onContinueShopping }) {
  if (cart.length === 0) {
    return (
      <div className="container py-5 text-center">
        <div className="card card-custom p-5 mx-auto" style={{ maxWidth: '500px' }}>
          <span className="display-3 mb-3">🛒</span>
          <h3>Your cart is empty</h3>
          <p className="text-muted">Looks like you haven't added any items to your cart yet.</p>
          <button className="btn btn-cyan mt-3" onClick={onContinueShopping}>Explore Categories & Products</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <h3 className="mb-4">Shopping Cart ({cart.length} unique items)</h3>
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card card-custom p-3">
            <div className="table-responsive">
              <table className="table table-custom">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th className="text-center">Quantity</th>
                    <th>Subtotal</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item.product_id}>
                      <td>
                        <strong>{item.name}</strong>
                        <div className="small text-muted">{item.category_name}</div>
                        <div className="mt-1">
                          <CustomerStockBadge product={item} />
                        </div>
                      </td>
                      <td>₹{item.price.toLocaleString('en-IN')}</td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-secondary" onClick={() => onUpdateQty(item.product_id, -1)}>-</button>
                          <span className="btn btn-outline-secondary disabled text-light">{item.quantity}</span>
                          <button className="btn btn-outline-secondary" onClick={() => onUpdateQty(item.product_id, 1)}>+</button>
                        </div>
                      </td>
                      <td className="fw-bold text-info">₹{(item.price * item.quantity).toLocaleString('en-IN')}</td>
                      <td>
                        <button className="btn btn-outline-danger btn-sm" onClick={() => onRemove(item.product_id)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card card-custom p-4">
            <h4 className="mb-3">Order Summary</h4>
            <div className="d-flex justify-content-between mb-2">
              <span className="text-secondary">Subtotal</span>
              <span>₹{cartTotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="d-flex justify-content-between mb-2">
              <span className="text-secondary">Shipping</span>
              <span className="text-success">FREE</span>
            </div>
            <hr className="border-secondary" />
            <div className="d-flex justify-content-between mb-4">
              <strong className="fs-5">Total</strong>
              <strong className="fs-5 text-info">₹{cartTotal.toLocaleString('en-IN')}</strong>
            </div>

            <button className="btn btn-cyan w-100 py-2 fs-6 mb-2" onClick={onProceedCheckout}>
              Proceed to Checkout
            </button>
            <button className="btn btn-outline-secondary w-100" onClick={onContinueShopping}>
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------- CHECKOUT VIEW -----------------
function CheckoutView({ cart, cartTotal, user, onBack, onOrderSuccess, showAlert }) {
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [shipmentName, setShipmentName] = useState('BlueDart Express');
  const [submitting, setSubmitting] = useState(false);

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        user_id: user.user_id,
        items: cart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity
        })),
        payment_method: paymentMethod,
        shipment_name: shipmentName
      };

      const res = await axios.post('/api/checkout', payload);
      showAlert('Order placed and saved to MySQL successfully!', 'success');
      onOrderSuccess(res.data.order);
    } catch (err) {
      showAlert('Order failed: ' + (err.response?.data?.error || err.message), 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-5">
      <button className="btn btn-outline-secondary mb-4" onClick={onBack}>
        &larr; Back to Cart
      </button>

      <div className="row g-4 justify-content-center">
        <div className="col-lg-7">
          <div className="card card-custom p-4">
            <h3 className="mb-4">Secure Checkout</h3>

            {/* Customer Details */}
            <div className="mb-4 p-3 rounded" style={{ background: '#0e1726' }}>
              <h6 className="text-info text-uppercase small mb-2">Delivery Recipient (USERR Record)</h6>
              <div className="fw-bold fs-5">{user.name}</div>
              <div className="text-secondary small">{user.email} | Phone: {user.phone}</div>
              <div className="text-light mt-1">📍 Shipping Address: {user.address}</div>
            </div>

            <form onSubmit={handlePlaceOrder}>
              {/* Delivery Courier Selection */}
              <div className="mb-4">
                <label className="form-label">Select Courier Service (DELIVERY Table):</label>
                <select
                  className="form-select form-select-custom"
                  value={shipmentName}
                  onChange={(e) => setShipmentName(e.target.value)}
                >
                  <option value="BlueDart Express">BlueDart Express (Air Courier)</option>
                  <option value="Delhivery Surface">Delhivery Surface Cargo</option>
                  <option value="DTDC Priority">DTDC Priority Logistics</option>
                  <option value="India Post EMS">India Post EMS Speed Post</option>
                </select>
              </div>

              {/* Payment Method */}
              <div className="mb-4">
                <label className="form-label">Select Simulated Payment Method (PAYMENT Table):</label>
                <div className="row g-2">
                  {['UPI', 'Credit/Debit Card', 'Net Banking', 'Cash on Delivery'].map(method => (
                    <div key={method} className="col-6">
                      <div
                        className={`payment-select-card ${paymentMethod === method ? 'active' : ''}`}
                        onClick={() => setPaymentMethod(method)}
                      >
                        <div className="fw-bold text-light">{method}</div>
                        <small style={{ color: '#94a3b8' }}>Simulated Demo</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 mb-4 rounded border border-info" style={{ background: 'rgba(0, 242, 254, 0.05)' }}>
                <small className="text-info d-block mb-1"><strong>Database Safety Note:</strong></small>
                <small className="text-secondary">
                  Clicking "Place Order" will execute an atomic MySQL transaction inserting into <code>ORDERS</code>, <code>ORDER_ITEM</code>, <code>PAYMENT</code>, and <code>DELIVERY</code>, firing database triggers to reduce stock.
                </small>
              </div>

              <button
                type="submit"
                className="btn btn-cyan w-100 py-3 fw-bold fs-5"
                disabled={submitting}
              >
                {submitting ? 'Executing MySQL Transaction...' : `Confirm Order (₹${cartTotal.toLocaleString('en-IN')})`}
              </button>
            </form>
          </div>
        </div>

        {/* Order Items Review */}
        <div className="col-lg-5">
          <div className="card card-custom p-4">
            <h5 className="mb-3">Order Items ({cart.length})</h5>
            <ul className="list-group list-group-flush mb-3">
              {cart.map(item => (
                <li key={item.product_id} className="list-group-item bg-transparent text-light border-secondary d-flex justify-content-between px-0">
                  <div>
                    <strong>{item.name}</strong>
                    <div className="small text-muted">{item.quantity} x ₹{item.price.toLocaleString('en-IN')}</div>
                  </div>
                  <span className="fw-bold text-info">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>

            <div className="d-flex justify-content-between mb-2">
              <span className="text-secondary">Total Amount</span>
              <span className="fs-4 fw-bold text-info">₹{cartTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------- RECEIPT VIEW -----------------
function ReceiptView({ order, onContinueShopping, onViewOrders }) {
  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-6">
          <div className="card card-custom p-4 text-center">
            <span className="display-4 text-success mb-2">🎉</span>
            <h2 className="fw-bold mb-1">Order Confirmed!</h2>
            <p className="text-secondary mb-4">Your order has been recorded into the MySQL database.</p>

            <div className="p-4 rounded text-start mb-4 receipt-card">
              <div className="row g-3">
                <div className="col-6">
                  <span className="receipt-label">Order ID (ORDERS)</span>
                  <span className="receipt-value">#{order.order_id}</span>
                </div>
                <div className="col-6">
                  <span className="receipt-label">Receipt No (PAYMENT)</span>
                  <span className="receipt-value">RCP-{order.receipt_no}</span>
                </div>
                <div className="col-6">
                  <span className="receipt-label">Shipment ID (DELIVERY)</span>
                  <span className="receipt-value">SHIP-{order.shipment_id}</span>
                </div>
                <div className="col-6">
                  <span className="receipt-label">Payment Method</span>
                  <span className="receipt-value">{order.payment_method} ({order.status})</span>
                </div>
                <div className="col-6">
                  <span className="receipt-label">Courier</span>
                  <span className="receipt-value">{order.shipment_name}</span>
                </div>
                <div className="col-6">
                  <span className="receipt-label">Estimated Delivery</span>
                  <span className="receipt-value">{order.estimated_delivery}</span>
                </div>
                <div className="col-12 mt-3 pt-3 border-top border-secondary">
                  <span className="receipt-total-label">Total Paid</span>
                  <span className="receipt-total-value">₹{order.total.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="d-flex gap-2">
              <button className="btn btn-outline-cyan w-100" onClick={onViewOrders}>View Order History</button>
              <button className="btn btn-cyan w-100" onClick={onContinueShopping}>Shop More</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------- ORDERS VIEW -----------------
function OrdersView({ orders, loading, onContinueShopping }) {
  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-info" role="status"></div>
        <p className="mt-2 text-muted">Loading your orders from MySQL...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="container py-5 text-center">
        <div className="card card-custom p-5 mx-auto" style={{ maxWidth: '500px' }}>
          <h4>No orders found</h4>
          <p className="text-muted">You haven't placed any orders yet.</p>
          <button className="btn btn-cyan mt-3" onClick={onContinueShopping}>Start Shopping</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <h3 className="mb-4">My Orders ({orders.length})</h3>
      <div className="row g-4">
        {orders.map(order => (
          <div key={order.order_id} className="col-12">
            <div className="card card-custom p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-3 border-bottom border-secondary">
                <div>
                  <span className="fs-5 fw-bold text-light me-3">Order #{order.order_id}</span>
                  <span className="badge bg-success me-2">{order.status}</span>
                  <span className="text-muted small">Date: {order.order_date}</span>
                </div>
                <div className="fs-5 fw-bold text-info mt-2 mt-md-0">
                  Total: ₹{order.total.toLocaleString('en-IN')}
                </div>
              </div>

              {/* Items */}
              <div className="table-responsive mb-3">
                <table className="table table-custom table-sm">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Quantity</th>
                      <th>Unit Price</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map(it => (
                      <tr key={it.order_item_id}>
                        <td>{it.product_name}</td>
                        <td>{it.quantity}</td>
                        <td>₹{it.price.toLocaleString('en-IN')}</td>
                        <td>₹{it.subtotal.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Logistics & Payment */}
              <div className="row g-2 small p-3 rounded order-info-strip">
                <div className="col-md-4">
                  <strong>Payment:</strong> {order.payment_method} &bull; Receipt: #{order.receipt_no}
                </div>
                <div className="col-md-4">
                  <strong>Courier:</strong> {order.shipment_name} &bull; Shipment: #{order.shipment_id}
                </div>
                <div className="col-md-4">
                  <strong>Delivery Date:</strong> {order.delivery_date || 'In transit'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------- LOGIN VIEW -----------------
function LoginView({ onLoginSuccess, onAdminLoginSuccess, onSwitchToRegister, showAlert }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (isAdminMode) {
        const res = await axios.post('/api/auth/admin-login', { username: email, password });
        onAdminLoginSuccess(res.data.admin);
      } else {
        const res = await axios.post('/api/auth/login', { email, password });
        onLoginSuccess(res.data.user);
      }
    } catch (err) {
      showAlert(err.response?.data?.error || 'Login failed. Please check credentials.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-5">
          <div className="card card-custom p-4">
            <h3 className="text-center mb-4">{isAdminMode ? 'Admin Portal' : 'Welcome Back'}</h3>

            <div className="btn-group w-100 mb-4">
              <button
                type="button"
                className={`btn btn-sm ${!isAdminMode ? 'btn-cyan' : 'btn-outline-secondary'}`}
                onClick={() => setIsAdminMode(false)}
              >
                Customer Login
              </button>
              <button
                type="button"
                className={`btn btn-sm ${isAdminMode ? 'btn-cyan' : 'btn-outline-secondary'}`}
                onClick={() => setIsAdminMode(true)}
              >
                Admin Login
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">{isAdminMode ? 'Admin Username' : 'Email Address'}</label>
                <input
                  type={isAdminMode ? "text" : "email"}
                  className="form-control form-control-custom"
                  required
                  placeholder={isAdminMode ? "Enter admin username" : "Enter your email"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="mb-4">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-control form-control-custom"
                  required
                  placeholder={isAdminMode ? "Enter admin password" : "Enter your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-cyan w-100 py-2 fw-bold" disabled={submitting}>
                {submitting ? 'Authenticating...' : (isAdminMode ? 'Access Admin Dashboard' : 'Sign In')}
              </button>
            </form>

            {!isAdminMode && (
              <div className="text-center mt-4">
                <span className="text-secondary">Don't have an account? </span>
                <a href="#" className="text-info fw-bold" onClick={(e) => { e.preventDefault(); onSwitchToRegister(); }}>
                  Sign Up
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------- REGISTER VIEW -----------------
function RegisterView({ onRegisterSuccess, onSwitchToLogin, showAlert }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    dob: '2000-01-01',
    address: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await axios.post('/api/auth/register', formData);
      onRegisterSuccess(res.data.user);
    } catch (err) {
      showAlert(err.response?.data?.error || 'Registration failed.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card card-custom p-4">
            <h3 className="text-center mb-2">Create Customer Account</h3>
            <p className="text-center text-muted small mb-4">Inserts a new record into MySQL <code>userr</code> table with PBKDF2 salt & hash.</p>

            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-control form-control-custom"
                    required
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-control form-control-custom"
                    required
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-control form-control-custom"
                    required
                    placeholder="Create password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="number"
                    className="form-control form-control-custom"
                    required
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    className="form-control form-control-custom"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    className="form-control form-control-custom"
                    required
                    placeholder="Street, City, Pincode"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-cyan w-100 py-2 fw-bold mt-4" disabled={submitting}>
                {submitting ? 'Registering...' : 'Create Account'}
              </button>
            </form>

            <div className="text-center mt-4">
              <span className="text-secondary">Already registered? </span>
              <a href="#" className="text-info fw-bold" onClick={(e) => { e.preventDefault(); onSwitchToLogin(); }}>
                Sign In
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------- ADMIN VIEW -----------------
function AdminView({ metrics, orders, customers, products, categories, tab, setTab, loading, refreshData, showAlert }) {
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    stock: '',
    details: '',
    category_id: categories[0]?.category_id || 1
  });

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await axios.patch(`/api/admin/orders/${orderId}/status`, { status: newStatus });
      showAlert(`Order #${orderId} marked as ${newStatus}`);
      refreshData();
    } catch (err) {
      showAlert(err.response?.data?.error || 'Failed to update order status', 'danger');
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await axios.put(`/api/admin/products/${editingProduct.product_id}`, editingProduct);
        showAlert(`Product #${editingProduct.product_id} updated successfully!`);
        setEditingProduct(null);
      } else {
        await axios.post('/api/admin/products', newProduct);
        showAlert('New product added to MySQL!');
        setNewProduct({ name: '', price: '', stock: '', details: '', category_id: categories[0]?.category_id || 1 });
      }
      refreshData();
    } catch (err) {
      showAlert(err.response?.data?.error || 'Failed to save product', 'danger');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!confirm(`Are you sure you want to delete Product #${productId}?`)) return;
    try {
      await axios.delete(`/api/admin/products/${productId}`);
      showAlert(`Product #${productId} deleted.`);
      refreshData();
    } catch (err) {
      showAlert(err.response?.data?.error || 'Failed to delete product', 'danger');
    }
  };

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-1">⚡ E-Bucket Administration</h2>
          <small className="text-muted">Direct management of your 7 MySQL tables</small>
        </div>
        <button className="btn btn-outline-info btn-sm" onClick={refreshData}>
          🔄 Refresh Data
        </button>
      </div>

      {/* Tabs */}
      <ul className="nav nav-pills mb-4 border-bottom border-secondary pb-3 gap-2">
        <li className="nav-item">
          <button className={`nav-link ${tab === 'overview' ? 'active btn-cyan' : 'text-light'}`} onClick={() => setTab('overview')}>
            Metrics Overview
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === 'products' ? 'active btn-cyan' : 'text-light'}`} onClick={() => setTab('products')}>
            Manage Products ({products.length})
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === 'orders' ? 'active btn-cyan' : 'text-light'}`} onClick={() => setTab('orders')}>
            Orders & Shipments ({orders.length})
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === 'customers' ? 'active btn-cyan' : 'text-light'}`} onClick={() => setTab('customers')}>
            Customers ({customers.length})
          </button>
        </li>
      </ul>

      {/* Overview Tab */}
      {tab === 'overview' && metrics && (
        <div>
          <div className="row g-4 mb-4">
            <div className="col-md-3">
              <div className="card card-custom card-metric p-3">
                <span className="metric-title">Total Customers</span>
                <div className="fs-2 metric-val mt-1">{metrics.total_customers}</div>
                <span className="metric-sub">Table: userr</span>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card card-custom card-metric p-3">
                <span className="metric-title">Total Products</span>
                <div className="fs-2 metric-val mt-1">{metrics.total_products}</div>
                <span className="metric-sub">Table: product</span>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card card-custom card-metric p-3">
                <span className="metric-title">Total Orders</span>
                <div className="fs-2 metric-val mt-1">{metrics.total_orders}</div>
                <span className="metric-sub">Table: orders</span>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card card-custom card-metric p-3">
                <span className="metric-title">Total Revenue</span>
                <div className="fs-2 metric-val mt-1" style={{ color: '#00f2fe' }}>₹{metrics.total_revenue.toLocaleString('en-IN')}</div>
                <span className="metric-sub">SUM(orders.TOTAL)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products Tab */}
      {tab === 'products' && (
        <div>
          <div className="card card-custom p-4 mb-4">
            <h5>{editingProduct ? `Edit Product #${editingProduct.product_id}` : 'Add New Product'}</h5>
            <form onSubmit={handleSaveProduct} className="row g-3 mt-1">
              <div className="col-md-4">
                <label className="form-label small">Product Name</label>
                <input
                  type="text"
                  className="form-control form-control-custom"
                  required
                  value={editingProduct ? editingProduct.name : newProduct.name}
                  onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, name: e.target.value }) : setNewProduct({ ...newProduct, name: e.target.value })}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label small">Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control form-control-custom"
                  required
                  value={editingProduct ? editingProduct.price : newProduct.price}
                  onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) }) : setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label small">Stock Quantity</label>
                <input
                  type="number"
                  className="form-control form-control-custom"
                  required
                  value={editingProduct ? editingProduct.stock : newProduct.stock}
                  onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) }) : setNewProduct({ ...newProduct, stock: parseInt(e.target.value) })}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label small">Category</label>
                <select
                  className="form-select form-select-custom"
                  value={editingProduct ? editingProduct.category_id : newProduct.category_id}
                  onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, category_id: parseInt(e.target.value) }) : setNewProduct({ ...newProduct, category_id: parseInt(e.target.value) })}
                >
                  {categories.map(c => (
                    <option key={c.category_id} value={c.category_id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label small">Details & Specs</label>
                <input
                  type="text"
                  className="form-control form-control-custom"
                  value={editingProduct ? editingProduct.details : newProduct.details}
                  onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, details: e.target.value }) : setNewProduct({ ...newProduct, details: e.target.value })}
                />
              </div>
              <div className="col-12 d-flex gap-2">
                <button type="submit" className="btn btn-cyan btn-sm">
                  {editingProduct ? 'Save Changes' : '+ Add to Database'}
                </button>
                {editingProduct && (
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setEditingProduct(null)}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card card-custom p-3">
            <div className="table-responsive">
              <table className="table table-custom">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.product_id}>
                      <td>#{p.product_id}</td>
                      <td>{p.name}</td>
                      <td>{p.category_name}</td>
                      <td>₹{p.price.toLocaleString('en-IN')}</td>
                      <td>
                        <span className={`badge ${p.stock > 5 ? 'bg-success' : p.stock > 0 ? 'bg-warning text-dark' : 'bg-danger'}`}>
                          {p.stock} units
                        </span>
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-info" onClick={() => setEditingProduct(p)}>Edit</button>
                          <button className="btn btn-outline-danger" onClick={() => handleDeleteProduct(p.product_id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div className="card card-custom p-3">
          <div className="table-responsive">
            <table className="table table-custom">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Courier & Shipment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.order_id}>
                    <td>#{o.order_id}</td>
                    <td>{o.user_name || `User #${o.user_id}`}</td>
                    <td>{o.order_date}</td>
                    <td className="fw-bold text-info">₹{o.total.toLocaleString('en-IN')}</td>
                    <td>
                      <span className={`badge ${o.status === 'Paid' ? 'bg-success' : o.status === 'Delivered' ? 'bg-primary' : 'bg-warning text-dark'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td>{o.shipment_name} (#{o.shipment_id})</td>
                    <td>
                      <select
                        className="form-select form-select-custom form-select-sm"
                        style={{ width: '130px' }}
                        value={o.status}
                        onChange={(e) => handleUpdateStatus(o.order_id, e.target.value)}
                      >
                        <option value="Paid">Paid</option>
                        <option value="Processing">Processing</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {tab === 'customers' && (
        <div className="card card-custom p-3">
          <div className="table-responsive">
            <table className="table table-custom">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Date of Birth</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.user_id}>
                    <td>#{c.user_id}</td>
                    <td>{c.name}</td>
                    <td>{c.email}</td>
                    <td>{c.phone}</td>
                    <td>{c.dob}</td>
                    <td>{c.address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Mount the App
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

