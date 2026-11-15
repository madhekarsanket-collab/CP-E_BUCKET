import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { api, errorMessage } from '../../api';
import Field from '../../components/Field';
import { ConfirmDialog } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { formatPrice } from '../../lib/format';

const LOW_STOCK = 5;
const blankForm = (categories) => ({ name: '', price: '', stock: '', details: '', image_url: '', category_id: categories[0]?.category_id ?? '' });

export default function ProductsTab({ products, categories, onChanged }) {
  const toast = useToast();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => blankForm(categories));
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const reset = () => { setEditingId(null); setForm(blankForm(categories)); };

  const startEdit = (p) => {
    setEditingId(p.product_id);
    setForm({ name: p.name, price: String(p.price), stock: String(p.stock), details: p.details || '', image_url: p.image_url || '', category_id: p.category_id });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const path = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products';
      await api(path, { method: editingId ? 'PUT' : 'POST', body: form });
      reset();
      await onChanged(editingId ? 'Product updated.' : 'Product added.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    const product = pendingDelete;
    setPendingDelete(null);
    try {
      await api(`/api/admin/products/${product.product_id}`, { method: 'DELETE' });
      await onChanged(`${product.name} deleted.`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <form className="card panel product-form" onSubmit={save}>
        <h2>{editingId ? `Edit product #${editingId}` : 'Add a product'}</h2>
        <div className="field-row field-row-3">
          <Field label="Name" value={form.name} onChange={set('name')} required maxLength={100} />
          <Field label="Price (₹)" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.price} onChange={set('price')} required />
          <Field label="Stock" type="number" min="0" step="1" inputMode="numeric" value={form.stock} onChange={set('stock')} required />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="product-category">Category</label>
            <div className="field-control">
              <select id="product-category" value={form.category_id} onChange={set('category_id')} required>
                {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <Field label="Description" value={form.details} onChange={set('details')} maxLength={200} hint="Up to 200 characters" />
        </div>
        <Field label="Photo (optional)" value={form.image_url} onChange={set('image_url')} maxLength={255} placeholder="/products/12.jpg or https://..." hint="A file under /products/ or an https link. Leave empty to show an icon." />
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {editingId ? <><Save size={18} aria-hidden="true" />Save changes</> : <><Plus size={18} aria-hidden="true" />Add product</>}
          </button>
          {editingId && <button type="button" className="btn btn-ghost" onClick={reset}><X size={18} aria-hidden="true" />Cancel</button>}
        </div>
      </form>

      <div className="card panel">
        <table className="data-table">
          <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.product_id}>
                <td data-label="ID">#{p.product_id}</td>
                <td data-label="Name"><strong>{p.name}</strong></td>
                <td data-label="Category">{p.category_name}</td>
                <td data-label="Price">{formatPrice(p.price)}</td>
                <td data-label="Stock"><span className={`stock-badge ${p.stock === 0 ? 'stock-out' : p.stock <= LOW_STOCK ? 'stock-low' : 'stock-high'}`}>{p.stock} in stock</span></td>
                <td data-label="Actions" className="row-actions">
                  <button type="button" className="icon-btn" aria-label={`Edit ${p.name}`} onClick={() => startEdit(p)}><Pencil size={18} aria-hidden="true" /></button>
                  <button type="button" className="icon-btn icon-btn-danger" aria-label={`Delete ${p.name}`} onClick={() => setPendingDelete(p)}><Trash2 size={18} aria-hidden="true" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog isOpen={Boolean(pendingDelete)} title={`Delete ${pendingDelete?.name}?`} confirmLabel="Delete product"
        onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete}>
        This removes the product from the shop. Products that appear in past orders cannot be deleted. Set their stock to 0 instead.
      </ConfirmDialog>
    </>
  );
}
