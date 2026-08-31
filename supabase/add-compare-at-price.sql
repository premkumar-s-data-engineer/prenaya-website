-- ============================================================
-- Prenaya — Compare-At Price (MRP / Strikethrough) Migration
-- ============================================================
-- Adds compare_at_price to both products and product_variants.
-- When set, the product displays the compare_at_price with a
-- strikethrough and the actual price as the discounted price.
--
-- Run this in the Supabase SQL Editor AFTER setup.sql and
-- add-product-variants.sql.
-- ============================================================

-- Add compare_at_price to products (for non-variant products)
-- NULL means no discount / no strikethrough shown.
ALTER TABLE products ADD COLUMN compare_at_price integer DEFAULT NULL CHECK (compare_at_price IS NULL OR compare_at_price >= 0);

-- Add compare_at_price to product_variants (for variant products)
-- NULL means no discount for that specific variant.
ALTER TABLE product_variants ADD COLUMN compare_at_price integer DEFAULT NULL CHECK (compare_at_price IS NULL OR compare_at_price >= 0);
