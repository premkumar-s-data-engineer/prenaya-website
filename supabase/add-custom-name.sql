-- ============================================================
-- Prenaya — Custom Name Personalisation Migration
-- ============================================================
-- Run this in the Supabase SQL Editor.
--
-- If you already ran the previous version of this file
-- (which added allow_custom_name boolean), this script
-- replaces that column with custom_name_max_chars integer.
--
-- If you have NOT run anything yet, it just adds the new column.
-- ============================================================

-- Step 1: Add the new integer column (0 = off, 1-6 = on)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS custom_name_max_chars integer NOT NULL DEFAULT 0
    CHECK (custom_name_max_chars >= 0 AND custom_name_max_chars <= 6);

-- Step 2: Migrate existing data — any product that had allow_custom_name = true
-- gets a default of 6 (the old hard maximum). Products with false stay at 0.
UPDATE products
  SET custom_name_max_chars = 6
  WHERE allow_custom_name = true;

-- Step 3: Drop the old boolean column (safe now that data is migrated)
ALTER TABLE products
  DROP COLUMN IF EXISTS allow_custom_name;
