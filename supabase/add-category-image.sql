-- ============================================================
-- Prenaya — Add image_path column to categories table
-- ============================================================
-- Run this in the Supabase SQL Editor.
-- Adds an optional image_path column to store the path of
-- a category image in the product-images storage bucket.
-- ============================================================

ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_path text DEFAULT '';

-- Update the products_with_category view to include category image
DROP VIEW IF EXISTS products_with_category;

CREATE VIEW products_with_category AS
SELECT
  p.*,
  c.name AS category_name,
  c.slug AS category_slug,
  c.image_path AS category_image_path
FROM products p
LEFT JOIN categories c ON p.category_id = c.id;

-- Grant access on the recreated view
GRANT SELECT ON products_with_category TO anon;
GRANT SELECT ON products_with_category TO authenticated;
