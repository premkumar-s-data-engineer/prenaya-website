-- ============================================================
-- Prenaya — Customer Colour Selection Migration
-- ============================================================
-- Adds an admin-managed master colour palette, a per-product subset of
-- offered colours, and a per-product count of how many colours a customer
-- must choose. Colours are a personalisation choice — they do NOT affect price.
--
-- Run this in the Supabase SQL Editor AFTER setup.sql and
-- add-product-variants.sql.
-- ============================================================

-- --------------------
-- 1. Colours Palette Table (master list)
-- --------------------
-- The global list of colours the admin manages once. Each product then
-- offers a subset of these. To change colours in future, the admin just
-- edits/adds/removes rows here via the admin "Colours" screen.

CREATE TABLE colors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,              -- e.g. "Yellow", "Light Blue"
  hex text NOT NULL,               -- e.g. "#F4D03F" (the swatch colour)
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- --------------------
-- 2. Product Colours Link Table
-- --------------------
-- Which palette colours a given product offers to customers.
-- A product with color_choice_count > 0 should have rows here.

CREATE TABLE product_colors (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_id uuid NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
  display_order integer DEFAULT 0,
  PRIMARY KEY (product_id, color_id)
);

CREATE INDEX idx_product_colors_product_id ON product_colors(product_id);

-- --------------------
-- 3. Add color_choice_count to products
-- --------------------
-- 0 (default) = colour selection is OFF for this product.
-- N (> 0)     = customer must choose EXACTLY N distinct colours.

ALTER TABLE products ADD COLUMN color_choice_count integer DEFAULT 0 CHECK (color_choice_count >= 0);

-- --------------------
-- 4. Table Grants
-- --------------------

GRANT SELECT ON colors TO anon;
GRANT SELECT ON product_colors TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON colors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_colors TO authenticated;

-- --------------------
-- 5. Enable RLS
-- --------------------

ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_colors ENABLE ROW LEVEL SECURITY;

-- --------------------
-- 6. RLS Policies — colors
-- --------------------

CREATE POLICY "Anyone can read colors"
  ON colors FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert colors"
  ON colors FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admin can update colors"
  ON colors FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admin can delete colors"
  ON colors FOR DELETE
  USING (is_admin());

-- --------------------
-- 7. RLS Policies — product_colors
-- --------------------

CREATE POLICY "Anyone can read product_colors"
  ON product_colors FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert product_colors"
  ON product_colors FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admin can update product_colors"
  ON product_colors FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admin can delete product_colors"
  ON product_colors FOR DELETE
  USING (is_admin());

-- --------------------
-- 8. Seed the Starting Palette (12 colours)
-- --------------------
-- These hex values approximate the sample palette. Fine-tune any swatch
-- later in the admin "Colours" screen.

INSERT INTO colors (name, hex, display_order) VALUES
  ('Yellow',      '#F4D03F', 1),
  ('Black',       '#1C1C1C', 2),
  ('Brown',       '#8B5A2B', 3),
  ('Light Blue',  '#22CFEF', 4),
  ('Light Green', '#6FE0A6', 5),
  ('Orange',      '#F5900A', 6),
  ('Pink',        '#F8C1D2', 7),
  ('Red',         '#E8261C', 8),
  ('Dark Blue',   '#0B5FD1', 9),
  ('Dark Green',  '#1E7A3D', 10),
  ('Violet',      '#6A19B0', 11),
  ('White',       '#FFFFFF', 12);
