-- Jalankan di Supabase → SQL Editor
-- Menambah nomor WhatsApp pelanggan di setiap order, dipakai untuk cek status pesanan.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone_number TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_tenant_phone ON orders ("tenantId", phone_number);

-- (Opsional) isi order lama dari nomor WhatsApp customer, hanya yang formatnya nomor asli (62xxxxxxxxxx)
UPDATE orders o
SET    phone_number = c."waNumber"
FROM   customers c
WHERE  o."customerId" = c.id
  AND  o.phone_number IS NULL
  AND  c."waNumber" ~ '^62[0-9]{8,13}$';

-- Refresh cache API Supabase supaya kolom baru langsung terbaca
NOTIFY pgrst, 'reload schema';
