// ============================================================
// Prenaya — Supabase Client Configuration
// ============================================================
// This file is loaded by EVERY page (customer + admin).
// It creates a single shared Supabase client instance.
//
// HOW TO SET UP:
// 1. Go to your Supabase Dashboard → Settings → API
// 2. Copy "Project URL" and "anon public" key
// 3. Paste them below
//
// The anon key is safe to expose in client-side code.
// RLS policies control what this key can actually do.
// ============================================================

const SUPABASE_URL = 'https://jfusamjgdlierkorlqxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdXNhbWpnZGxpZXJrb3JscXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNjc2MDYsImV4cCI6MjEwMzc0MzYwNn0.o-QJ2O0NgRXeaEWawW4UGlTpZqiq0MvE5_51CS13lhA';

// The Supabase JS library is loaded via CDN <script> tag in each HTML file.
// We use "supabaseClient" (not "supabase") to avoid shadowing the global
// window.supabase namespace created by the CDN script.
var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// Prenaya — Site Configuration
// ============================================================
// Business settings used across the site.

const PRENAYA_CONFIG = {
  // Your WhatsApp business number WITH country code, no spaces or dashes.
  // Example: '919876543210' for Indian number 9876543210
  whatsappNumber: '916383306378',

  // Currency symbol used in display
  currency: '₹',

  // Site name
  siteName: 'Prenaya',

  // Supabase storage bucket name for product images
  storageBucket: 'product-images',

  // Max images per product (enforced in admin upload)
  maxImagesPerProduct: 8,

  // Max file size in bytes (5 MB)
  maxImageSize: 5 * 1024 * 1024,

  // Allowed image MIME types
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],

  // Allowed file extensions (checked alongside MIME type)
  allowedImageExtensions: ['jpg', 'jpeg', 'png', 'webp'],
};

// ============================================================
// Helper: Get public URL for a product image stored in Supabase
// ============================================================
function getImageUrl(imagePath) {
  const { data } = supabaseClient.storage
    .from(PRENAYA_CONFIG.storageBucket)
    .getPublicUrl(imagePath);
  return data.publicUrl;
}

// ============================================================
// Helper: Format price for display
// ============================================================
function formatPrice(price) {
  return PRENAYA_CONFIG.currency + price.toLocaleString('en-IN');
}
