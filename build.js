// build.js - Vercel Build Script
// Replaces %%SUPABASE_URL%% and %%SUPABASE_ANON_KEY%% in index.html
// with actual values from Vercel Environment Variables at build time

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ ERROR: SUPABASE_URL หรือ SUPABASE_ANON_KEY ยังไม่ได้ตั้งค่าใน Vercel Environment Variables');
  console.error('   ไปที่ Vercel Dashboard → Project → Settings → Environment Variables');
  process.exit(1);
}

// Files and folders to copy to dist/
const filesToProcess = [
  'index.html',
  'style.css',
  'supabase-client.js',
  'inventory.js',
  'scanner.js',
  'shopping-list.js',
];

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Process each file
filesToProcess.forEach(file => {
  const srcPath = path.join(__dirname, file);

  if (!fs.existsSync(srcPath)) {
    console.warn(`⚠️  ไม่พบไฟล์: ${file} — ข้ามไป`);
    return;
  }

  let content = fs.readFileSync(srcPath, 'utf-8');

  // Replace placeholders in index.html only
  if (file === 'index.html') {
    content = content
      .replace(/%%SUPABASE_URL%%/g, SUPABASE_URL)
      .replace(/%%SUPABASE_ANON_KEY%%/g, SUPABASE_ANON_KEY);
    console.log(`✅ inject env vars → ${file}`);
  } else {
    console.log(`📄 copy → ${file}`);
  }

  fs.writeFileSync(path.join(distDir, file), content, 'utf-8');
});

console.log('\n🚀 Build สำเร็จ! ไฟล์อยู่ใน dist/');
