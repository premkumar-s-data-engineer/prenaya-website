-- ============================================================
-- Prenaya — New Arrivals Migration
-- ============================================================
-- Adds an admin-controlled flag to mark products as
-- "New Arrivals" on the home page.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- is_new = true  → product appears in the New Arrivals section
--                  on the home page.
-- is_new = false → normal product, not highlighted (default).

ALTER TABLE products
  ADD COLUMN is_new boolean NOT NULL DEFAULT false;
