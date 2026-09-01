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

// ============================================================
// Helper: Optimize an image before upload (admin side)
// ============================================================
// Resizes the image so its longest edge is at most maxDimension px,
// and re-encodes it as WebP at the given quality. This dramatically
// reduces file size (faster loading for customers) — all done in the
// browser, no server cost. Falls back to the original file if the
// browser can't process it.
//
// @param {File} file - the original image file
// @param {number} maxDimension - max width/height in px (default 1200)
// @param {number} quality - WebP quality 0..1 (default 0.82)
// @returns {Promise<{blob: Blob, extension: string}>}
function optimizeImage(file, maxDimension, quality) {
  maxDimension = maxDimension || 1200;
  quality = quality || 0.82;

  return new Promise(function (resolve) {
    // If not an image or browser lacks canvas support, return original
    if (!file.type || file.type.indexOf('image/') !== 0) {
      resolve({ blob: file, extension: getExt(file.name) });
      return;
    }

    var img = new Image();
    var objectUrl = URL.createObjectURL(file);

    img.onload = function () {
      URL.revokeObjectURL(objectUrl);

      var width = img.naturalWidth;
      var height = img.naturalHeight;

      // Scale down if larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round(height * (maxDimension / width));
          width = maxDimension;
        } else {
          width = Math.round(width * (maxDimension / height));
          height = maxDimension;
        }
      }

      try {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(function (blob) {
          if (blob && blob.size > 0) {
            resolve({ blob: blob, extension: 'webp' });
          } else {
            // toBlob failed — use original
            resolve({ blob: file, extension: getExt(file.name) });
          }
        }, 'image/webp', quality);
      } catch (e) {
        resolve({ blob: file, extension: getExt(file.name) });
      }
    };

    img.onerror = function () {
      URL.revokeObjectURL(objectUrl);
      resolve({ blob: file, extension: getExt(file.name) });
    };

    img.src = objectUrl;
  });

  function getExt(name) {
    var parts = (name || '').split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : 'jpg';
  }
}
