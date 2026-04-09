// ============================================================
// scanner.js - Barcode Scanning & Quick Stock Update
// ============================================================

import { fetchByBarcode, createProduct, adjustQuantity } from './inventory.js';

let html5QrCode = null;
let isScanning = false;
let onScanCallback = null;

// ── Initialize scanner ────────────────────────────────────────
export function initScanner(elementId, callback) {
  onScanCallback = callback;

  // Dynamically load html5-qrcode if not present
  if (!window.Html5Qrcode) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
    script.onload = () => _setupScanner(elementId);
    document.head.appendChild(script);
  } else {
    _setupScanner(elementId);
  }
}

function _setupScanner(elementId) {
  html5QrCode = new Html5Qrcode(elementId);
}

// ── Start camera scanning ─────────────────────────────────────
export async function startScan(elementId) {
  if (isScanning) return;

  if (!html5QrCode) {
    _setupScanner(elementId);
    await new Promise(r => setTimeout(r, 300));
  }

  const config = {
    fps: 10,
    qrbox: { width: 250, height: 150 },
    aspectRatio: 1.5,
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.QR_CODE,
    ]
  };

  try {
    await html5QrCode.start(
      { facingMode: 'environment' },
      config,
      (decodedText) => {
        // Pause scanning briefly after successful scan
        if (onScanCallback) onScanCallback(decodedText);
        // Brief pause to avoid duplicate scans
        html5QrCode.pause();
        setTimeout(() => {
          if (isScanning && html5QrCode) html5QrCode.resume();
        }, 2000);
      },
      () => {} // ignore ongoing errors
    );
    isScanning = true;
  } catch (err) {
    console.error('Scanner start error:', err);
    throw err;
  }
}

// ── Stop scanner ──────────────────────────────────────────────
export async function stopScan() {
  if (!isScanning || !html5QrCode) return;
  try {
    await html5QrCode.stop();
    isScanning = false;
  } catch (e) {
    console.warn('Scanner stop error:', e);
  }
}

// ── Handle a scanned barcode ──────────────────────────────────
export async function handleScannedBarcode(barcode, showToast) {
  try {
    const product = await fetchByBarcode(barcode);

    if (product) {
      // Product found → open quick-update modal
      showQuickUpdateModal(product, showToast);
    } else {
      // Product not found → offer to create new
      showNewProductModal(barcode, showToast);
    }
  } catch (err) {
    showToast(`❌ เกิดข้อผิดพลาด: ${err.message}`, 'error');
  }
}

// ── Quick update modal (existing product) ────────────────────
function showQuickUpdateModal(product, showToast) {
  const modal = document.getElementById('quick-update-modal');
  if (!modal) return;

  const isLow = product.quantity <= product.min_stock;

  modal.innerHTML = `
    <div class="modal-backdrop" onclick="window.closeQuickModal()"></div>
    <div class="modal-card scanner-modal">
      <button class="modal-close" onclick="window.closeQuickModal()">✕</button>
      <div class="scan-success-indicator">
        <span class="scan-ping"></span>
        <span class="scan-icon">✅</span>
      </div>
      <h2>พบสินค้า!</h2>
      <div class="scanned-product-info">
        ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}" class="scanned-img">` : '<div class="scanned-img-placeholder">🛍️</div>'}
        <div>
          <p class="scanned-name">${product.name}</p>
          <p class="scanned-qty ${isLow ? 'low' : ''}">คงเหลือ: <strong>${product.quantity} ${product.unit}</strong></p>
          <p class="scanned-barcode">🔲 ${product.barcode}</p>
        </div>
      </div>
      <div class="quick-adjust-section">
        <p class="section-label">ปรับปริมาณ:</p>
        <div class="big-qty-row">
          <button class="big-qty-btn minus" id="scan-minus">−</button>
          <input type="number" id="scan-qty-input" value="1" min="1" max="9999" class="big-qty-input">
          <button class="big-qty-btn plus" id="scan-plus">+</button>
        </div>
        <div class="adjust-actions">
          <button class="btn-scan-action receive" onclick="window.scanAdjust('${product.id}', 1)">
            📥 รับเข้า
          </button>
          <button class="btn-scan-action remove" onclick="window.scanAdjust('${product.id}', -1)">
            📤 เบิกออก
          </button>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('visible');

  // Wire up +/- buttons for qty input
  document.getElementById('scan-minus').onclick = () => {
    const input = document.getElementById('scan-qty-input');
    input.value = Math.max(1, parseInt(input.value) - 1);
  };
  document.getElementById('scan-plus').onclick = () => {
    const input = document.getElementById('scan-qty-input');
    input.value = parseInt(input.value) + 1;
  };

  window.scanAdjust = async (id, direction) => {
    const qty = parseInt(document.getElementById('scan-qty-input').value) || 1;
    try {
      const updated = await adjustQuantity(id, direction * qty);
      showToast(`✅ ${direction > 0 ? 'รับเข้า' : 'เบิกออก'} ${qty} ${updated.unit} → คงเหลือ: ${updated.quantity} ${updated.unit}`, 'success');
      window.closeQuickModal();
      window.refreshInventory?.();
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    }
  };
}

// ── New product modal (barcode not found) ─────────────────────
function showNewProductModal(barcode, showToast) {
  const modal = document.getElementById('quick-update-modal');
  if (!modal) return;

  modal.innerHTML = `
    <div class="modal-backdrop" onclick="window.closeQuickModal()"></div>
    <div class="modal-card scanner-modal">
      <button class="modal-close" onclick="window.closeQuickModal()">✕</button>
      <div class="scan-new-indicator">🔍</div>
      <h2>ไม่พบสินค้า</h2>
      <p class="barcode-display">บาร์โค้ด: <code>${barcode}</code></p>
      <p class="hint-text">ต้องการเพิ่มสินค้าใหม่ด้วยบาร์โค้ดนี้?</p>
      <div class="new-product-form">
        <input type="text" id="new-scan-name" placeholder="ชื่อสินค้า *" class="form-input">
        <div class="form-row">
          <input type="number" id="new-scan-qty" placeholder="จำนวน" value="0" class="form-input half">
          <input type="text" id="new-scan-unit" placeholder="หน่วย" value="pcs" class="form-input half">
        </div>
        <button class="btn-primary full" onclick="window.createScannedProduct('${barcode}')">
          ➕ เพิ่มสินค้า
        </button>
      </div>
    </div>
  `;

  modal.classList.add('visible');
  document.getElementById('new-scan-name').focus();

  window.createScannedProduct = async (bc) => {
    const name = document.getElementById('new-scan-name').value.trim();
    if (!name) { showToast('กรุณากรอกชื่อสินค้า', 'warning'); return; }

    try {
      await createProduct({
        name,
        quantity: document.getElementById('new-scan-qty').value,
        barcode: bc,
        unit: document.getElementById('new-scan-unit').value || 'pcs',
      });
      showToast(`✅ เพิ่ม "${name}" สำเร็จ`, 'success');
      window.closeQuickModal();
      window.refreshInventory?.();
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    }
  };
}

export { isScanning };
