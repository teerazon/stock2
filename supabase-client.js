import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ดึงค่าจาก window ที่ตั้งไว้ใน index.html
const supabaseUrl = window.ENV_SUPABASE_URL;
const supabaseAnonKey = window.ENV_SUPABASE_ANON_KEY;

export const STORAGE_BUCKET = 'product-images';

// ตรวจสอบค่า
if (!supabaseUrl) {
  console.error('⚠️ ไม่พบ SUPABASE_URL ใน window.ENV_SUPABASE_URL');
}
if (!supabaseAnonKey) {
  console.error('⚠️ ไม่พบ SUPABASE_ANON_KEY ใน window.ENV_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── อัปโหลดรูปภาพสินค้า ──────────────────────────────────────
export async function uploadProductImage(file, productId) {
  const ext = file.name.split('.').pop();
  const path = `products/${productId}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ── ลบรูปภาพสินค้า ───────────────────────────────────────────
export async function deleteProductImage(imageUrl) {
  if (!imageUrl) return;
  const path = imageUrl.split(`${STORAGE_BUCKET}/`)[1];
  if (!path) return;
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}

// ── ทดสอบการเชื่อมต่อ ─────────────────────────────────────────
export async function testConnection() {
  try {
    const { error } = await supabase.from('inventory').select('id').limit(1);
    return !error;
  } catch (e) {
    return false;
  }
}
