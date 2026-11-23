-- ============================================================
-- WIRA AI — Database Schema
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ── ENUMS ────────────────────────────────────────────────────

CREATE TYPE "Plan" AS ENUM ('MULA', 'TUMBUH', 'JUARA');
CREATE TYPE "Status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF');
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'FACEBOOK');
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ESCALATED');
CREATE TYPE "MessageRole" AS ENUM ('CUSTOMER', 'AI', 'STAFF');
CREATE TYPE "OrderStatus" AS ENUM (
  'PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DONE', 'CANCELLED'
);
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'PAST_DUE');

-- ── TENANTS ──────────────────────────────────────────────────

CREATE TABLE tenants (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name              TEXT        NOT NULL,
  "waNumber"        TEXT        NOT NULL UNIQUE,
  plan              "Plan"      NOT NULL DEFAULT 'MULA',
  status            "Status"    NOT NULL DEFAULT 'ACTIVE',
  "aiPersonaConfig" JSONB       NOT NULL DEFAULT '{}',
  "checkoutMethods" TEXT[]      NOT NULL DEFAULT ARRAY['qris'],
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── USERS ────────────────────────────────────────────────────

CREATE TABLE users (
  id             TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"     TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  email          TEXT        NOT NULL,
  "passwordHash" TEXT        NOT NULL,
  role           "UserRole"  NOT NULL DEFAULT 'STAFF',
  permissions    JSONB       NOT NULL DEFAULT '{}',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("tenantId", email)
);

-- ── PRODUCTS ─────────────────────────────────────────────────

CREATE TABLE products (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"  TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  sku         TEXT,
  price       INTEGER     NOT NULL,
  "costPrice" INTEGER     NOT NULL DEFAULT 0,
  stock       INTEGER     NOT NULL DEFAULT 0,
  category    TEXT,
  description TEXT,
  "imageUrl"  TEXT,
  "isActive"  BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CUSTOMERS ────────────────────────────────────────────────

CREATE TABLE customers (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "waNumber"    TEXT        NOT NULL,
  name          TEXT,
  address       TEXT,
  notes         TEXT,
  "totalOrders" INTEGER     NOT NULL DEFAULT 0,
  "totalSpent"  INTEGER     NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("tenantId", "waNumber")
);

-- ── CONVERSATIONS ────────────────────────────────────────────

CREATE TABLE conversations (
  id           TEXT                 PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"   TEXT                 NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "customerId" TEXT                 NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel      "Channel"            NOT NULL DEFAULT 'WHATSAPP',
  status       "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
  "assignedTo" TEXT,
  "createdAt"  TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

-- ── MESSAGES ─────────────────────────────────────────────────

CREATE TABLE messages (
  id               TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "conversationId" TEXT          NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             "MessageRole" NOT NULL,
  content          TEXT          NOT NULL,
  "toolCalls"      JSONB,
  "createdAt"      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── ORDERS ───────────────────────────────────────────────────

CREATE TABLE orders (
  id               TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"       TEXT          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "customerId"     TEXT          NOT NULL REFERENCES customers(id),
  status           "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "totalAmount"    INTEGER       NOT NULL,
  "checkoutMethod" TEXT          NOT NULL DEFAULT 'qris',
  "assignedToId"   TEXT          REFERENCES users(id),
  notes            TEXT,
  "createdAt"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── ORDER ITEMS ───────────────────────────────────────────────

CREATE TABLE order_items (
  id          TEXT    PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId"   TEXT    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  "productId" TEXT    NOT NULL REFERENCES products(id),
  qty         INTEGER NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  subtotal    INTEGER NOT NULL
);

-- ── PAYMENTS ─────────────────────────────────────────────────

CREATE TABLE payments (
  id                TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId"         TEXT            NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  method            TEXT            NOT NULL,
  "midtransToken"   TEXT,
  "midtransOrderId" TEXT,
  amount            INTEGER         NOT NULL,
  status            "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt"          TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ── SUBSCRIPTIONS ─────────────────────────────────────────────

CREATE TABLE subscriptions (
  id                       TEXT                 PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"               TEXT                 NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  plan                     "Plan"               NOT NULL,
  status                   "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "currentPeriodEnd"       TIMESTAMPTZ          NOT NULL,
  "midtransSubscriptionId" TEXT,
  "createdAt"              TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────────

CREATE INDEX idx_products_tenant ON products("tenantId");
CREATE INDEX idx_customers_tenant ON customers("tenantId");
CREATE INDEX idx_conversations_tenant_customer ON conversations("tenantId", "customerId");
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_messages_conversation ON messages("conversationId");
CREATE INDEX idx_orders_tenant ON orders("tenantId");
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer ON orders("customerId");

-- ── TRIGGER: auto-update updatedAt ───────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── SEED: Tenant + Produk Sample ────────────────────────────
-- Ganti waNumber dengan nomor WA device kamu di Fonnte

INSERT INTO tenants (id, name, "waNumber", plan, status, "aiPersonaConfig", "checkoutMethods")
VALUES (
  'tenant_wira_001',
  'Toko Sepatu Berkah',
  '6282138572163',         -- ← GANTI dengan nomor WA device di Fonnte
  'MULA',
  'ACTIVE',
  '{
    "aiName": "Wira",
    "greeting": "Halo kak! Selamat datang di Toko Sepatu Berkah 👟",
    "style": "ramah dan sopan",
    "operatingHours": "Senin-Sabtu 08.00-21.00 WIB",
    "escalationRule": "Jika customer komplain atau minta refund, alihkan ke owner"
  }',
  ARRAY['qris', 'marketplace']
);

INSERT INTO products (id, "tenantId", name, sku, price, "costPrice", stock, category, description)
VALUES
  ('prod_001', 'tenant_wira_001', 'Nike Air Max 90',          'NIK-AM90', 850000,  600000, 10, 'Sneakers', 'Nike Air Max 90, size 37-45, berbagai warna'),
  ('prod_002', 'tenant_wira_001', 'Adidas Ultraboost 22',     'ADI-UB22', 1200000, 850000,  5, 'Running',  'Adidas Ultraboost 22, cocok untuk lari jarak jauh'),
  ('prod_003', 'tenant_wira_001', 'Ortuseight Hyperblast',    'ORT-HB',   380000,  250000, 15, 'Running',  'Sepatu lari lokal berkualitas, size 38-45'),
  ('prod_004', 'tenant_wira_001', 'Converse All Star Classic', 'CON-AS',   650000,  450000,  8, 'Casual',   'Converse All Star klasik, cocok untuk sehari-hari');

-- ── VERIFIKASI ───────────────────────────────────────────────
-- Jalankan ini untuk memastikan semua tabel berhasil dibuat:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
