// ============================================================
// inventory.js - CRUD Operations for Stock Management
// ============================================================

import { supabase, uploadProductImage, deleteProductImage } from './supabase-client.js';

// ── Fetch all inventory items ────────────────────────────────
export async function fetchInventory(search = '') {
  let query = supabase
    .from('inventory')
    .select('*')
    .order('name', { ascending: true });

  if (search) {
    query = query.or(`name.ilike.%${search}%,barcode.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ── Fetch single item by barcode ─────────────────────────────
export async function fetchByBarcode(barcode) {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('barcode', barcode)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ── Fetch single item by ID ──────────────────────────────────
export async function fetchById(id) {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// ── Create new product ───────────────────────────────────────
export async function createProduct(productData, imageFile = null) {
  // Insert product first to get the ID
  const { data, error } = await supabase
    .from('inventory')
    .insert({
      name: productData.name,
      quantity: parseInt(productData.quantity) || 0,
      barcode: productData.barcode || null,
      unit: productData.unit || 'pcs',
      min_stock: parseInt(productData.min_stock) || 5,
    })
    .select()
    .single();

  if (error) throw error;

  // Upload image if provided
  if (imageFile) {
    const imageUrl = await uploadProductImage(imageFile, data.id);
    const { error: imgError } = await supabase
      .from('inventory')
      .update({ image_url: imageUrl })
      .eq('id', data.id);
    if (imgError) throw imgError;
    data.image_url = imageUrl;
  }

  return data;
}

// ── Update product ───────────────────────────────────────────
export async function updateProduct(id, updates, imageFile = null) {
  if (imageFile) {
    const existing = await fetchById(id);
    if (existing?.image_url) await deleteProductImage(existing.image_url);
    updates.image_url = await uploadProductImage(imageFile, id);
  }

  const { data, error } = await supabase
    .from('inventory')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Update quantity only (quick stock update) ────────────────
export async function updateQuantity(id, newQuantity) {
  const { data, error } = await supabase
    .from('inventory')
    .update({ quantity: Math.max(0, parseInt(newQuantity)) })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Adjust quantity by delta (+/-) ──────────────────────────
export async function adjustQuantity(id, delta) {
  const item = await fetchById(id);
  if (!item) throw new Error('Product not found');
  const newQty = Math.max(0, item.quantity + delta);
  return updateQuantity(id, newQty);
}

// ── Delete product ───────────────────────────────────────────
export async function deleteProduct(id) {
  const item = await fetchById(id);
  if (item?.image_url) await deleteProductImage(item.image_url);

  const { error } = await supabase
    .from('inventory')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ── Get low stock items ──────────────────────────────────────
export async function fetchLowStock() {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .filter('quantity', 'lte', 'min_stock');

  if (error) throw error;
  return data;
}

// ── Render inventory grid ─────────────────────────────────────
export function renderInventory(items, container) {
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📦</span>
        <p>ยังไม่มีสินค้า</p>
        <p class="sub">กดปุ่ม "เพิ่มสินค้า" เพื่อเริ่มต้น</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map(item => {
    const isLow = item.quantity <= item.min_stock;
    const stockClass = item.quantity === 0 ? 'out-of-stock' : isLow ? 'low-stock' : 'in-stock';
    const stockLabel = item.quantity === 0 ? 'หมด' : isLow ? 'ใกล้หมด' : 'ปกติ';

    return `
    <div class="product-card" data-id="${item.id}">
      <div class="product-image-wrap">
        ${item.image_url
          ? `<img src="${item.image_url}" alt="${item.name}" loading="lazy">`
          : `<div class="no-image">🛍️</div>`}
        <span class="stock-badge ${stockClass}">${stockLabel}</span>
      </div>
      <div class="product-info">
        <h3 class="product-name">${item.name}</h3>
        ${item.barcode ? `<p class="product-barcode">🔲 ${item.barcode}</p>` : ''}
        <div class="quantity-row">
          <button class="qty-btn minus" onclick="window.quickAdjust('${item.id}', -1)">−</button>
          <span class="qty-display">${item.quantity} <small>${item.unit}</small></span>
          <button class="qty-btn plus" onclick="window.quickAdjust('${item.id}', 1)">+</button>
        </div>
      </div>
      <div class="product-actions">
        <button class="btn-action edit" onclick="window.openEditModal('${item.id}')">✏️</button>
        <button class="btn-action add-list" onclick="window.addToShoppingList('${item.id}')">🛒</button>
        <button class="btn-action delete" onclick="window.confirmDelete('${item.id}', '${item.name}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}
