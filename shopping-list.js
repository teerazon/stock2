// ============================================================
// shopping-list.js - Shopping List, History & PNG Export
// ============================================================

import { supabase } from './supabase-client.js';
import { fetchById } from './inventory.js';

// ── เพิ่มฟังก์ชันสร้างรายการตัวเลือกจากคลังสินค้า ─────────────────────
export function updateInventorySuggestions(inventoryItems) {
  const datalist = document.getElementById('inventory-suggestions');
  if (!datalist) return;
  datalist.innerHTML = inventoryItems
    .map(item => `<option value="${item.name}">${item.barcode ? `บาร์โค้ด: ${item.barcode}` : `หน่วย: ${item.unit}`}</option>`)
    .join('');
}

// ── Fetch shopping list (pending items) ───────────────────────
export async function fetchShoppingList() {
  const { data, error } = await supabase
    .from('shopping_history')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// ── Fetch history (all items) ────────────────────────────────
export async function fetchHistory(limit = 50) {
  const { data, error } = await supabase
    .from('shopping_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// ── Add item to shopping list (แก้ไขให้บันทึกรูปภาพจากคลัง) ──────────
export async function addToList(productId, quantityNeeded = 1) {
  const product = await fetchById(productId);
  if (!product) throw new Error('Product not found');

  const { data: existing } = await supabase
    .from('shopping_history')
    .select('id, quantity_needed')
    .eq('product_id', productId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('shopping_history')
      .update({ quantity_needed: existing.quantity_needed + quantityNeeded })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('shopping_history')
    .insert({
      product_id: productId,
      product_name: product.name,
      product_image_url: product.image_url, // บันทึกรูปภาพจากคลังสินค้า
      quantity_needed: quantityNeeded,
      unit: product.unit,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Add custom item (not in inventory) ───────────────────────
export async function addCustomItem(name, quantity, unit = 'pcs') {
  const { data, error } = await supabase
    .from('shopping_history')
    .insert({
      product_name: name,
      quantity_needed: quantity,
      unit,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Mark item as purchased ────────────────────────────────────
export async function markPurchased(id) {
  const { data, error } = await supabase
    .from('shopping_history')
    .update({ status: 'purchased' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Remove item from list ─────────────────────────────────────
export async function removeFromList(id) {
  const { error } = await supabase
    .from('shopping_history')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) throw error;
}

// ── Clear all pending items ───────────────────────────────────
export async function clearAllPending() {
  const { error } = await supabase
    .from('shopping_history')
    .update({ status: 'cancelled' })
    .eq('status', 'pending');

  if (error) throw error;
}

// ── Render shopping list (แก้ไขให้แสดงรูปภาพจริง) ────────────────────
export function renderShoppingList(items, container) {
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🛒</span>
        <p>รายการซื้อว่างเปล่า</p>
        <p class="sub">เพิ่มสินค้าจากคลังหรือกรอกรายการเอง</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="list-item" data-id="${item.id}">
      <div class="list-item-img">
        ${item.product_image_url
          ? `<img src="${item.product_image_url}" alt="${item.product_name}" style="width:100%; height:100%; object-fit:cover;">`
          : `<div class="list-img-placeholder">🛒</div>`}
      </div>
      <div class="list-item-info">
        <p class="list-item-name">${item.product_name}</p>
        <p class="list-item-qty">${item.quantity_needed} ${item.unit || 'ชิ้น'}</p>
        <p class="list-item-time">${formatDateTime(item.created_at)}</p>
      </div>
      <div class="list-item-actions">
        <button class="check-btn" onclick="window.checkItem('${item.id}')" title="ซื้อแล้ว">✓</button>
        <button class="remove-btn" onclick="window.removeItem('${item.id}')" title="ลบ">✕</button>
      </div>
    </div>
  `).join('');
}

// ── Render history (แก้ไขให้แสดงรูปภาพจริง) ──────────────────────────
export function renderHistory(items, container) {
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">📋</span><p>ยังไม่มีประวัติ</p></div>`;
    return;
  }

  const grouped = {};
  items.forEach(item => {
    const date = new Date(item.created_at).toLocaleDateString('th-TH', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(item);
  });

  container.innerHTML = Object.entries(grouped).map(([date, group]) => `
    <div class="history-group">
      <h4 class="history-date-header">${date}</h4>
      ${group.map(item => {
        const statusMap = { pending: '🕐 รอซื้อ', purchased: '✅ ซื้อแล้ว', cancelled: '❌ ยกเลิก' };
        return `
        <div class="history-row ${item.status}">
          <div class="history-left">
            ${item.product_image_url
              ? `<img src="${item.product_image_url}" class="history-img" alt="" style="width:40px; height:40px; object-fit:cover; border-radius:8px;">`
              : `<div class="history-img-placeholder">📦</div>`}
            <div>
              <p class="history-name">${item.product_name}</p>
              <p class="history-qty">${item.quantity_needed} ${item.unit || 'ชิ้น'}</p>
            </div>
          </div>
          <div class="history-right">
            <span class="history-status">${statusMap[item.status] || item.status}</span>
            <p class="history-time">${formatTime(item.created_at)}</p>
          </div>
        </div>`;
      }).join('')}
    </div>
  `).join('');
}

// ── Export shopping list as PNG ──────────────────────────────
export async function exportAsPNG(items) {
  if (!window.html2canvas) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const el = document.createElement('div');
  el.id = 'export-canvas';
  el.style.cssText = `
    position: fixed; left: -9999px; top: 0;
    width: 420px; background: #fff; padding: 24px;
    font-family: 'Kanit', sans-serif; color: #1a1a2e;
  `;

  const now = new Date().toLocaleString('th-TH', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  el.innerHTML = `
    <div style="text-align:center; margin-bottom:20px; border-bottom:2px solid #e5e7eb; padding-bottom:16px;">
      <div style="font-size:28px; margin-bottom:6px;">🛒</div>
      <h1 style="font-size:22px; font-weight:700; margin:0 0 4px; color:#1a1a2e;">รายการสั่งซื้อ</h1>
      <p style="font-size:13px; color:#6b7280; margin:0;">สร้างเมื่อ: ${now}</p>
    </div>
    <div>
      ${items.map((item, i) => `
        <div style="display:flex; align-items:center; gap:12px; padding:12px 0; ${i < items.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : ''}">
          <div style="width:28px; height:28px; background:#f3f4f6; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:#6b7280; flex-shrink:0;">${i + 1}</div>
          <div style="flex:1;">
            <p style="margin:0; font-size:16px; font-weight:600; color:#1a1a2e;">${item.product_name}</p>
            <p style="margin:2px 0 0; font-size:13px; color:#6b7280;">${formatDateTime(item.created_at)}</p>
          </div>
          <div style="text-align:right; flex-shrink:0;">
            <p style="margin:0; font-size:18px; font-weight:700; color:#16a34a;">${item.quantity_needed}</p>
            <p style="margin:0; font-size:12px; color:#6b7280;">${item.unit || 'ชิ้น'}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  document.body.appendChild(el);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  document.body.removeChild(el);

  const link = document.createElement('a');
  link.download = `shopping-list-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function formatDateTime(isoStr) {
  return new Date(isoStr).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}