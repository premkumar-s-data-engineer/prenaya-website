-- ============================================================
-- Prenaya — Supabase Database Setup
-- ============================================================
-- Run this entire file in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- It creates all tables, views, functions, and RLS policies.
--
-- AFTER running this file, you still need to:
-- 1. Create a storage bucket called "product-images" (public) in Dashboard → Storage
-- 2. Create your admin user in Dashboard → Authentication → Add User
-- 3. Copy that user's UUID and INSERT it into the admin_users table (see bottom of file)
-- 4. Disable public sign-up: Dashboard → Authentication → Settings → turn off "Allow new users to sign up"
-- 5. Apply storage policies via the Dashboard (see comments at bottom of this file)
-- ============================================================

-- --------------------
-- 1. Admin Users Table
-- --------------------
-- Stores the UUID(s) of users allowed to manage products.
-- Managed ONLY via the Supabase SQL Editor — never via the API.

CREATE TABLE admin_users (
  user_id uuid PRIMARY KEY
);

-- --------------------
-- 2. Helper Function
-- --------------------
-- Returns true if the currently authenticated user is in the admin_users table.
-- Used by all write-access RLS policies.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- --------------------
-- 3. Categories Table
-- --------------------

CREATE TABLE categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- --------------------
-- 4. Products Table
-- --------------------

CREATE TABLE products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text DEFAULT '',
  price integer NOT NULL CHECK (price >= 0),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  age_range text DEFAULT '',
  whats_included text DEFAULT '',
  is_available boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Auto-update the updated_at timestamp on every row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- --------------------
-- 5. Product Images Table
-- --------------------

CREATE TABLE product_images (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_path text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups by product
CREATE INDEX idx_product_images_product_id ON product_images(product_id);

-- --------------------
-- 6. Convenience View
-- --------------------
-- Joins products with their category name so the customer site can fetch in one call.

CREATE VIEW products_with_category AS
SELECT
  p.*,
  c.name AS category_name,
  c.slug AS category_slug
FROM products p
LEFT JOIN categories c ON p.category_id = c.id;

-- ============================================================
-- 7. Table Grants
-- ============================================================
-- Grant table-level access to anon (public) and authenticated (admin).
-- RLS policies (below) control exactly which rows each role can access.

GRANT SELECT ON categories TO anon;
GRANT SELECT ON products TO anon;
GRANT SELECT ON product_images TO anon;
GRANT SELECT ON products_with_category TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_images TO authenticated;
GRANT SELECT ON admin_users TO authenticated;
GRANT SELECT ON products_with_category TO authenticated;

-- ============================================================
-- 8. Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- --- admin_users ---
-- Only admins can read who is admin. Nobody can modify via API.
CREATE POLICY "Admin can read admin_users"
  ON admin_users FOR SELECT
  USING (is_admin());

CREATE POLICY "No API inserts to admin_users"
  ON admin_users FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No API updates to admin_users"
  ON admin_users FOR UPDATE
  USING (false);

CREATE POLICY "No API deletes from admin_users"
  ON admin_users FOR DELETE
  USING (false);

-- --- categories ---
CREATE POLICY "Anyone can read categories"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert categories"
  ON categories FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admin can update categories"
  ON categories FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admin can delete categories"
  ON categories FOR DELETE
  USING (is_admin());

-- --- products ---
CREATE POLICY "Anyone can read products"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert products"
  ON products FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admin can update products"
  ON products FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admin can delete products"
  ON products FOR DELETE
  USING (is_admin());

-- --- product_images ---
CREATE POLICY "Anyone can read product_images"
  ON product_images FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert product_images"
  ON product_images FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admin can update product_images"
  ON product_images FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admin can delete product_images"
  ON product_images FOR DELETE
  USING (is_admin());

-- ============================================================
-- 8. Storage Bucket Policies (apply manually in Dashboard)
-- ============================================================
-- Go to Dashboard → Storage → Create bucket:
--   Name: product-images
--   Public: ON (so customer site can display images without auth)
--
-- Then go to the bucket → Policies and add these:
--
-- SELECT (view/download):
--   Policy name: "Anyone can view product images"
--   Target roles: (leave blank for all)
--   USING expression: true
--
-- INSERT (upload):
--   Policy name: "Admin can upload product images"
--   Target roles: authenticated
--   WITH CHECK expression: (SELECT is_admin())
--
-- UPDATE (overwrite):
--   Policy name: "Admin can update product images"
--   Target roles: authenticated
--   USING expression: (SELECT is_admin())
--
-- DELETE:
--   Policy name: "Admin can delete product images"
--   Target roles: authenticated
--   USING expression: (SELECT is_admin())
--
-- ============================================================

-- ============================================================
-- 9. Insert Your Admin User
-- ============================================================
-- After creating your admin user in Dashboard → Authentication → Add User,
-- copy the user's UUID and run:
--
-- INSERT INTO admin_users (user_id) VALUES ('paste-your-uuid-here');
--
-- ============================================================
