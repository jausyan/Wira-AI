-- ============================================================
-- WIRA AI — Database Functions
-- Jalankan di: Supabase SQL Editor SETELAH schema.sql
-- ============================================================

-- Fungsi untuk kurangi stok produk (dipakai saat order dibuat)
CREATE OR REPLACE FUNCTION decrement_stock(p_id TEXT, p_qty INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products SET stock = stock - p_qty WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Fungsi untuk tambah stok (dipakai saat order dibatalkan)
CREATE OR REPLACE FUNCTION increment_stock(p_id TEXT, p_qty INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products SET stock = stock + p_qty WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;
