-- ============================================================
-- Prenaya — Product Variants / Options Migration
-- ============================================================
-- Adds flexible per-product options (like "Type", "Keychain", "Magnet")
-- and variant combinations with individual pricing.
--
-- Run this in the Supabase SQL Editor AFTER setup.sql.
-- ============================================================

-- --------------------
-- 1. Product Options Table
-- --------------------
-- Each row is an option GROUP for a product (e.g. "Type", "Colour").
-- display_order controls the order options appear on the product page.

CREATE TABLE product_options (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,              -- e.g. "Type", "Keychain", "Colour"
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_product_options_product_id ON product_options(product_id);

-- --------------------
-- 2. Product Option Values Table
-- --------------------
-- Each row is one selectable value within an option group.
-- e.g. option "Type" → values "Normal", "Special"

CREATE TABLE product_option_values (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  option_id uuid NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
  value text NOT NULL,             -- e.g. "Normal", "Special", "With Keychain"
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_product_option_values_option_id ON product_option_values(option_id);

-- --------------------
-- 3. Product Variants Table
-- --------------------
-- Each row is one specific combination of option values with its own price.
-- combination is a JSONB object like: {"Type": "Special", "Keychain": "With Keychain"}
-- This makes it flexible — any number of option dimensions.

CREATE TABLE product_variants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  combination jsonb NOT NULL DEFAULT '{}',  -- e.g. {"Type":"Special","Keychain":"With"}
  price integer NOT NULL CHECK (price >= 0),
  is_available boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);

-- --------------------
-- 4. Add has_variants flag to products
-- --------------------
-- Quick check so product cards/listing can show "From ₹X" without querying variants.

ALTER TABLE products ADD COLUMN has_variants boolean DEFAULT false;

-- --------------------
-- 5. Table Grants
-- --------------------

GRANT SELECT ON product_options TO anon;
GRANT SELECT ON product_option_values TO anon;
GRANT SELECT ON product_variants TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON product_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_option_values TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_variants TO authenticated;

-- --------------------
-- 6. Enable RLS
-- --------------------

ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- --------------------
-- 7. RLS Policies — product_options
-- --------------------

CREATE POLICY "Anyone can read product_options"
  ON product_options FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert product_options"
  ON product_options FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admin can update product_options"
  ON product_options FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admin can delete product_options"
  ON product_options FOR DELETE
  USING (is_admin());

-- --------------------
-- 8. RLS Policies — product_option_values
-- --------------------

CREATE POLICY "Anyone can read product_option_values"
  ON product_option_values FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert product_option_values"
  ON product_option_values FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admin can update product_option_values"
  ON product_option_values FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admin can delete product_option_values"
  ON product_option_values FOR DELETE
  USING (is_admin());

-- --------------------
-- 9. RLS Policies — product_variants
-- --------------------

CREATE POLICY "Anyone can read product_variants"
  ON product_variants FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert product_variants"
  ON product_variants FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admin can update product_variants"
  ON product_variants FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admin can delete product_variants"
  ON product_variants FOR DELETE
  USING (is_admin());
