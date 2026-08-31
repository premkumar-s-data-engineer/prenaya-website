-- ============================================================
-- Prenaya — Fix Table Permissions
-- ============================================================
-- Run this in the Supabase SQL Editor if you're getting
-- "permission denied for table products" errors.
--
-- This grants the necessary table-level access to the
-- anon (public) and authenticated (logged-in) roles.
-- RLS policies still control exactly which rows each role
-- can see or modify.
-- ============================================================

-- Grant SELECT on all tables to anon (public/customer site)
GRANT SELECT ON categories TO anon;
GRANT SELECT ON products TO anon;
GRANT SELECT ON product_images TO anon;

-- Grant SELECT on the view too
GRANT SELECT ON products_with_category TO anon;

-- Grant full access on data tables to authenticated (admin)
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_images TO authenticated;
GRANT SELECT ON admin_users TO authenticated;
GRANT SELECT ON products_with_category TO authenticated;
