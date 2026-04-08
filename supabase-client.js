// supabase-client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ค่าเหล่านี้ถูก inject โดย build.js จาก Vercel Environment Variables
const supabaseUrl = window.ENV_SUPABASE_URL;
const supabaseAnonKey = window.ENV_SUPABASE_ANON_KEY;

// ชื่อ Storage bucket (ต้องตรงกับที่สร้างใน Supabase Storage)
export const STORAGE_BUCKET = 'product-images';

// ตรวจสอบว่า env vars ถูกตั้งค่าแล้ว
if (!supabaseUrl || supabaseUrl.startsWith('%%')) {
  console.error('⚠️ ไม่พบ SUPABASE_URL — ตรวจสอบ Vercel Environment Variables');
}
if (!supabaseAnonKey || supabaseAnonKey.startsWith('%%')) {
  console.error('⚠️ ไม่พบ SUPABASE_ANON_KEY — ตรวจสอบ Vercel Environment Variables');
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
