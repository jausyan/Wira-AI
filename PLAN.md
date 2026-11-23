# PLAN.md — Wira AI

> **Ekosistem Bisnis SaaS B2B berbasis AI Agent untuk UMKM Indonesia**
> Bukan sekadar chatbot — AI yang menjual, menutup transaksi, menulis ke database, dan menjalankan operasional bisnis.

---

## Daftar Isi
1. [Nama & Filosofi Sistem](#1-nama--filosofi-sistem)
2. [Visi Produk](#2-visi-produk)
3. [Arsitektur Ekosistem](#3-arsitektur-ekosistem)
4. [Flow Sistem Lengkap](#4-flow-sistem-lengkap)
5. [Tech Stack per Flow](#5-tech-stack-per-flow)
6. [Cara Kerja Sistem (Deep Dive)](#6-cara-kerja-sistem-deep-dive)
7. [Model Pembayaran & Subscription](#7-model-pembayaran--subscription)
8. [Database Schema](#8-database-schema)
9. [Contoh Penggunaan End-to-End](#9-contoh-penggunaan-end-to-end)
10. [Dashboard & Manajemen Karyawan](#10-dashboard--manajemen-karyawan)
11. [Roadmap Pembangunan](#11-roadmap-pembangunan)

---

## 1. Nama & Filosofi Sistem

### Nama Produk: **Wira AI**
> *Wira* = pahlawan/pejuang (dari "wirausaha"). Memposisikan AI sebagai "panglima operasional" UMKM.

**Alternatif nama:** Niaga AI, Dagang.ai, Juragan AI, Lapaku AI

### Tagline
> **"AI Agent yang menjalankan bisnismu — dari sapaan pertama sampai uang masuk."**

### Filosofi Inti
```
Chatbot biasa  : Menjawab pertanyaan.
Wira AI        : Menjawab → Menjual → Transaksi → Tulis DB → Picu operasional.

Chatbot biasa  : Satu bot, satu fungsi.
Wira AI        : Satu ekosistem — AI Agent + Dashboard + Keuangan + Tim.
```

Wira AI adalah **Autonomous Business Operations Platform**: AI Agent yang
bertindak (bukan hanya merespons), terintegrasi penuh dengan database,
pembayaran, inventori, dan manajemen tim.

---

## 2. Visi Produk

### Tiga Pilar Ekosistem

| Pilar | Komponen | Fungsi |
|-------|----------|--------|
| **🤖 AI Layer** | Wira Agent | Percakapan, penjualan, tool-calling, CRUD otomatis |
| **📊 Ops Layer** | Dashboard Owner | Pantau order, stok, keuangan, tim karyawan |
| **💰 Money Layer** | Payment Engine | QRIS, marketplace redirect, web checkout, payout |

### Diferensiasi dari Kompetitor
```
✅ AI yang menutup transaksi sendiri (bukan cuma jawab FAQ)
✅ Multi-channel checkout: QRIS langsung / marketplace / web form
✅ Tiered pricing berdasar metode checkout (web checkout = premium)
✅ Manajemen tim karyawan dengan pembagian tugas order
✅ Laporan keuangan otomatis (bukan hanya log chat)
✅ Latency <1 detik via Groq (Llama 3.3-70B)
```

---

## 3. Arsitektur Ekosistem

```
                          ┌──────────────────────────┐
                          │   CUSTOMER (WhatsApp/IG)  │
                          └─────────────┬────────────┘
                                        │
                          ┌─────────────▼────────────┐
                          │   CHANNEL GATEWAY         │
                          │   (Webhook Ingress)       │
                          └─────────────┬────────────┘
                                        │
                          ┌─────────────▼────────────┐
                          │   MESSAGE QUEUE (BullMQ)  │
                          └─────────────┬────────────┘
                                        │
          ┌─────────────────────────────▼─────────────────────────────┐
          │                  WIRA AI AGENT ENGINE                       │
          │   Groq (Llama 3.3-70B) + Tool Calling + Memory Manager     │
          │                                                             │
          │   Decision Loop:  Greet → Qualify → Recommend →            │
          │                   Close → Collect Data → Payment → Confirm  │
          └──┬──────────┬──────────┬──────────┬──────────┬────────────┘
             │          │          │          │          │
        ┌────▼───┐ ┌───▼────┐ ┌──▼─────┐ ┌──▼─────┐ ┌──▼────────┐
        │ Stock  │ │ Order  │ │Customer│ │Payment │ │ Escalate  │
        │ Tool   │ │ Tool   │ │ Form   │ │ Tool   │ │ to Human  │
        └────┬───┘ └───┬────┘ └──┬─────┘ └──┬─────┘ └──┬────────┘
             │         │         │          │          │
             └─────────┴─────────┴────┬─────┴──────────┘
                                      │
                          ┌───────────▼──────────────┐
                          │   PostgreSQL (Supabase)   │
                          │   Multi-tenant Core DB    │
                          └───────────┬──────────────┘
                                      │ Realtime (WebSocket)
                          ┌───────────▼──────────────┐
                          │   OWNER + STAFF DASHBOARD │
                          │   (Next.js Web App)       │
                          └──────────────────────────┘
```

---

## 4. Flow Sistem Lengkap

### Flow Utama: Dari Sapaan ke Uang Masuk

```
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 1 — KONTAK AWAL                                                    │
│ Customer kirim pesan ke nomor WA bisnis UMKM                            │
│ → Webhook Gateway terima → masuk antrian → AI Agent aktif              │
└──────────────────────────────────────────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 2 — PERCAKAPAN & QUALIFY                                           │
│ AI Agent: sapa, pahami kebutuhan, cek stok (READ DB), rekomendasi      │
│ → Tool: cekStok(), cariProduk()                                        │
└──────────────────────────────────────────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 3 — DEAL / CLOSING                                                 │
│ Customer setuju beli → AI konfirmasi item, qty, total harga           │
│ → AI minta konfirmasi final: "Konfirmasi pesanan ya kak?"             │
└──────────────────────────────────────────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 4 — KIRIM FORM DATA DIRI (via chat)                               │
│ AI kirim form interaktif: Nama, Alamat, No HP, Catatan                 │
│ → Tool: kirimFormData() → simpan ke customers table                   │
│ → Bisa berupa: chat sequential, WA Flow form, atau link web form      │
└──────────────────────────────────────────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 5 — PILIH METODE PEMBAYARAN (sesuai plan UMKM)                     │
│   Opsi A: QRIS langsung di chat       (plan dasar)                     │
│   Opsi B: Redirect ke marketplace     (Tokopedia/Shopee link)         │
│   Opsi C: Web checkout form           (plan premium — lebih mahal)     │
│ → Tool: generatePayment(method)                                       │
└──────────────────────────────────────────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 6 — TULIS PESANAN KE DATABASE                                      │
│ AI Agent: INSERT order + order_items + payment record                  │
│ → status: PENDING_PAYMENT                                              │
│ → Socket.io emit → notif real-time ke dashboard owner                 │
└──────────────────────────────────────────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 7 — KONFIRMASI PEMBAYARAN                                          │
│ Customer bayar → Payment webhook → UPDATE status = PAID               │
│ → AI auto-kirim konfirmasi → kurangi stok → notif owner               │
└──────────────────────────────────────────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 8 — OWNER/STAFF PROSES ORDER                                       │
│ Order muncul di dashboard → owner/staff assign → proses → kirim        │
│ → status: PROCESSING → SHIPPED → DONE                                  │
│ → AI auto-update customer tiap perubahan status                        │
└──────────────────────────────────────────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 9 — LAPORAN & ANALITIK                                             │
│ Semua transaksi → agregasi → dashboard stats + laporan keuangan       │
│ → revenue, profit, top produk, performa karyawan, conversion rate     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Tech Stack per Flow

| Flow / Step | Komponen | Teknologi | Alasan |
|-------------|----------|-----------|--------|
| **1. Kontak Awal** | Channel Gateway | **Fonnte** (WA lokal) / **Meta Cloud API** | Murah, lokal, latency rendah |
| | Webhook receiver | **Fastify** (Node.js + TS) | Throughput tinggi, ringan |
| **2. Antrian** | Message Queue | **BullMQ + Redis (Upstash)** | Anti-drop saat spike pesan |
| **3. AI Agent** | LLM Provider | **Groq API** | Latency <1 dtk, murah |
| | Model | **llama-3.3-70b-versatile** (complex)<br>**llama-3.1-8b-instant** (FAQ) | Model routing hemat biaya |
| | Tool Calling | **groq-sdk** function calling | AI eksekusi aksi otomatis |
| | Memory | **Redis** (history, TTL 24 jam) | Konteks percakapan cepat |
| **4. Form Data** | Form delivery | **WA Interactive (WA Flows)** / **web form (Next.js)** | Sesuai plan UMKM |
| | Validasi | **Zod** | Type-safe validation |
| **5. Pembayaran** | QRIS / e-wallet | **Midtrans Snap API** | QRIS, GoPay, OVO, Dana, transfer |
| | Marketplace | **Deep link** Tokopedia/Shopee | Redirect ke listing toko |
| | Web checkout | **Next.js checkout page** + Midtrans | Plan premium |
| **6. CRUD DB** | ORM | **Prisma** | Schema-first, migrasi mudah |
| | Database | **PostgreSQL (Supabase)** | Multi-tenant, gratis tier |
| **7. Konfirmasi** | Payment webhook | **Fastify endpoint** + signature verify | Validasi keamanan |
| | Realtime push | **Socket.io** | Notif instan ke dashboard |
| **8. Proses Order** | Dashboard | **Next.js 14 (App Router)** | SSR + realtime |
| | UI Kit | **Tailwind + shadcn/ui** | Cepat, profesional |
| | State | **Zustand + TanStack Query** | Server state efisien |
| **9. Laporan** | Charts | **Recharts** | Visualisasi revenue/order |
| | Export | **React-PDF / ExcelJS** | Laporan keuangan PDF/Excel |
| **Lintas-flow** | Auth | **NextAuth.js + JWT** | Multi-role (owner/staff) |
| | File storage | **Cloudflare R2** | Gambar produk, invoice |
| | Monitoring | **Sentry + Better Uptime** | Error & uptime tracking |
| | Hosting BE | **Railway** | Auto-scale, DB included |
| | Hosting FE | **Vercel** | Optimal untuk Next.js |
| | CI/CD | **GitHub Actions** | Auto-deploy |

---

## 6. Cara Kerja Sistem (Deep Dive)

### 6.1 AI Agent Decision Loop

Wira Agent bukan bot rule-based. Setiap pesan masuk melewati loop:

```
1. RETRIEVE   → Ambil history percakapan dari Redis + profil tenant
2. AUGMENT    → Inject system prompt: persona toko, katalog, jam buka, aturan
3. REASON     → Llama 3.3-70B putuskan: jawab / panggil tool / eskalasi
4. ACT        → Jika perlu data/aksi → panggil tool (function calling)
5. OBSERVE    → Terima hasil tool (mis. stok tersedia / order dibuat)
6. RESPOND    → Generate balasan natural bahasa Indonesia
7. PERSIST    → Simpan pesan + tool_calls ke DB + update Redis
```

### 6.2 Tools yang Tersedia untuk AI Agent

```typescript
// Tool definitions yang di-expose ke Llama via Groq function calling
const tools = [
  cariProduk(query),                  // READ  — cari produk by nama/kategori
  cekStok(productId),                 // READ  — cek ketersediaan & harga
  buatOrder(items[], customerId),     // CREATE— buat pesanan baru
  updateOrder(orderId, changes),      // UPDATE— ubah qty / batal item
  kirimFormData(customerId),          // ACTION— kirim form data diri
  simpanDataCustomer(data),           // CREATE/UPDATE — simpan profil
  generatePayment(orderId, method),   // ACTION— buat QRIS/link/redirect
  cekStatusOrder(orderId),            // READ  — status pesanan
  eskalasiKeHuman(reason),            // ACTION— alihkan ke owner/staff
]
```

> AI **memutuskan sendiri** kapan memanggil tool berdasarkan konteks percakapan.
> Inilah yang membuatnya *agentic*, bukan chatbot biasa.

### 6.3 Multi-Tenancy

Setiap UMKM = 1 **tenant** dengan isolasi data via `tenant_id`. Satu instance
melayani ribuan UMKM. Setiap tenant punya: konfigurasi AI persona, katalog,
plan subscription, tim karyawan, dan nomor WA sendiri.

### 6.4 Model Routing (Hemat Biaya)

```
Pesan masuk → Classifier ringan (8B):
  ├─ FAQ / sapaan sederhana  → llama-3.1-8b-instant   (murah, cepat)
  └─ Order / negosiasi / tool → llama-3.3-70b-versatile (pintar)
```

---

## 7. Model Pembayaran & Subscription

### 7.1 Subscription Tiers (untuk UMKM yang berlangganan)

| Fitur | **Mula** | **Tumbuh** | **Juara** |
|-------|----------|------------|-----------|
| Harga/bulan | **Rp 99.000** | **Rp 249.000** | **Rp 599.000** |
| Pesan AI/bulan | 1.500 | 7.000 | Unlimited |
| Checkout QRIS langsung | ✅ | ✅ | ✅ |
| Redirect marketplace | ✅ | ✅ | ✅ |
| **Web checkout custom** | ❌ | ✅ | ✅ |
| Akun karyawan | 1 | 5 | Unlimited |
| Laporan keuangan | Basic | Lengkap | Lengkap + Export |
| Kustomisasi website | ❌ | Terbatas | Penuh |
| Multi-channel (IG/FB) | ❌ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ |

### 7.2 Logika "Web Checkout = Lebih Mahal"

```
Metode checkout menentukan tier:

QRIS langsung di chat    → tersedia semua plan (biaya infra rendah)
Redirect marketplace     → tersedia semua plan (tanpa biaya gateway)
Web checkout form custom → MULAI plan "Tumbuh" ke atas
  Alasan: butuh hosting halaman checkout, domain, SSL, maintenance,
          branding kustom, integrasi gateway lebih dalam.
```

### 7.3 Revenue Streams

```
1. Subscription bulanan (recurring)         — pemasukan utama
2. Setup fee onboarding (Rp 300-500rb)      — training AI ke katalog
3. Transaction fee opsional (0.5-1%)        — untuk web checkout
4. Add-on: nomor WA tambahan, kuota pesan ekstra
5. White-label untuk koperasi/asosiasi UMKM — bundle anggota
6. Marketplace template (halaman web custom per industri)
```

### 7.4 Cara UMKM Bayar Subscription
```
Midtrans Recurring / Subscription API → auto-charge tiap bulan
Metode: QRIS, Transfer VA, GoPay, kartu kredit
Reminder via WA H-3 sebelum jatuh tempo
```

---

## 8. Database Schema

```sql
-- ══════════════ TENANCY & USERS ══════════════
tenants (
  id, name, wa_number, plan, status,
  ai_persona_config JSONB,        -- nama AI, greeting, jam buka, gaya bahasa
  checkout_methods JSONB,         -- [qris, marketplace, web]
  created_at
)

users (                          -- owner & karyawan
  id, tenant_id, name, email, password_hash,
  role,                          -- 'owner' | 'admin' | 'staff'
  permissions JSONB,             -- granular: bisa proses order? lihat keuangan?
  created_at
)

-- ══════════════ KATALOG ══════════════
products (
  id, tenant_id, name, sku, price, cost_price,  -- cost_price utk hitung profit
  stock, category, description, image_url, is_active
)

-- ══════════════ CUSTOMER & PERCAKAPAN ══════════════
customers (
  id, tenant_id, wa_number, name, address, notes,
  total_orders, total_spent, created_at
)

conversations (
  id, tenant_id, customer_id, channel,           -- wa | ig | fb
  status,                                         -- active | closed | escalated
  assigned_to,                                    -- user_id jika di-takeover staff
  created_at
)

messages (
  id, conversation_id, role,                      -- customer | ai | staff
  content, tool_calls JSONB, created_at
)

-- ══════════════ ORDER & PEMBAYARAN ══════════════
orders (
  id, tenant_id, customer_id,
  status,                  -- pending_payment | paid | processing | shipped | done | cancelled
  total_amount, checkout_method,                  -- qris | marketplace | web
  assigned_to,                                    -- karyawan yang proses
  created_at, updated_at
)

order_items (
  id, order_id, product_id, qty, unit_price, subtotal
)

payments (
  id, order_id, method, midtrans_token,
  amount, status,                                 -- pending | paid | failed | expired
  paid_at
)

-- ══════════════ OPERASIONAL & LAPORAN ══════════════
activity_logs (
  id, tenant_id, user_id, action, entity, metadata JSONB, created_at
)

financial_records (                              -- untuk laporan keuangan
  id, tenant_id, order_id, type,                  -- income | expense
  amount, category, recorded_at
)

subscriptions (
  id, tenant_id, plan, status,
  current_period_end, midtrans_subscription_id
)
```

---

## 9. Contoh Penggunaan End-to-End

### Skenario: Toko "Sepatu Berkah" (plan **Tumbuh**)

```
─────────────────────────────────────────────────────────────
[STEP 1-2: KONTAK & QUALIFY]
─────────────────────────────────────────────────────────────
Customer : "Halo, ada sepatu running pria gak?"

Wira AI  : [tool: cariProduk("sepatu running pria")]
           [DB READ: 3 produk ditemukan]
           "Halo kak! 👟 Ada beberapa pilihan running pria:
            1. Adidas Runfalcon - Rp 420.000 (stok 5)
            2. Nike Revolution - Rp 550.000 (stok 2)
            3. Ortuseight Hyperblast - Rp 380.000 (stok 8)
            Mau yang mana kak? Atau ada budget tertentu?"

Customer : "Yang Ortuseight size 42 ada?"

Wira AI  : [tool: cekStok(product="Ortuseight Hyperblast", size=42)]
           [DB READ: tersedia, stok 3]
           "Ada kak! Ortuseight Hyperblast size 42, harga Rp 380.000 ✅
            Mau langsung order?"

─────────────────────────────────────────────────────────────
[STEP 3: DEAL / CLOSING]
─────────────────────────────────────────────────────────────
Customer : "Oke deh ambil 1"

Wira AI  : "Siap! Aku rangkum pesanannya ya kak:
            🛒 Ortuseight Hyperblast - Size 42
            📦 Qty: 1
            💰 Total: Rp 380.000
            Konfirmasi pesanan ini ya kak? (ketik YA)"

Customer : "YA"

─────────────────────────────────────────────────────────────
[STEP 4: FORM DATA DIRI]
─────────────────────────────────────────────────────────────
Wira AI  : [tool: kirimFormData(customerId)]
           "Mantap! Isi data pengiriman ya kak 📝
            ┌─────────────────────────────┐
            │ Nama lengkap : ___          │
            │ No. HP       : ___          │
            │ Alamat       : ___          │
            │ Catatan      : (opsional)   │
            └─────────────────────────────┘"

Customer : "Budi Santoso, 0812xxxx, Jl. Melati No.5 Surabaya"

Wira AI  : [tool: simpanDataCustomer(...)]  [DB UPSERT customers]
           "Data tersimpan ✅"

─────────────────────────────────────────────────────────────
[STEP 5-6: PEMBAYARAN + TULIS DB]
─────────────────────────────────────────────────────────────
Wira AI  : "Pilih metode pembayaran kak:
            1️⃣ QRIS (bayar langsung di sini)
            2️⃣ Checkout web (ada ongkir otomatis & tracking)"
            [Plan Tumbuh → web checkout aktif]

Customer : "QRIS aja"

Wira AI  : [tool: buatOrder(...)]      [DB INSERT orders + order_items]
           [tool: generatePayment(orderId, method="qris")]
           [Midtrans Snap → QRIS image + payment_url]
           [DB INSERT payments status=pending]
           [Socket.io → notif "Order baru!" ke dashboard owner]
           "Ini QRIS-nya kak 👇 (berlaku 1 jam)
            [QR CODE IMAGE]
            Total: Rp 380.000
            Scan & bayar ya, nanti aku kabari kalau sudah masuk 🙏"

─────────────────────────────────────────────────────────────
[STEP 7: KONFIRMASI PEMBAYARAN]
─────────────────────────────────────────────────────────────
[Customer scan & bayar]
Midtrans webhook → Backend:
   [DB UPDATE payments status=paid]
   [DB UPDATE orders status=paid]
   [DB UPDATE products stock = stock - 1]
   [DB INSERT financial_records type=income]
   [Socket.io → dashboard: notif "Pembayaran masuk Rp 380.000"]

Wira AI  : "Pembayaran diterima! ✅🎉
            Pesananmu segera kami proses. Nomor order: #1042
            Terima kasih kak Budi! 📦"

─────────────────────────────────────────────────────────────
[STEP 8: OWNER/STAFF PROSES ORDER]
─────────────────────────────────────────────────────────────
[Di Dashboard]
- Order #1042 muncul realtime dengan status PAID 🔔
- Owner assign ke staff "Rina" (bagian packing)
   [DB UPDATE orders assigned_to=Rina, status=processing]
- Rina packing → klik "Sudah Dikirim" + input resi
   [DB UPDATE orders status=shipped]

Wira AI  : [auto-trigger saat status berubah]
           "Kabar baik kak Budi! Pesanan #1042 sudah dikirim 🚚
            No. resi: JNE123456789. Estimasi 2-3 hari ya 🙏"

─────────────────────────────────────────────────────────────
[STEP 9: LAPORAN OTOMATIS]
─────────────────────────────────────────────────────────────
[Dashboard ter-update otomatis]
- Revenue hari ini   : +Rp 380.000
- Profit             : Rp 380.000 - Rp 300.000 (cost) = Rp 80.000
- Order selesai      : staff Rina (+1)
- Stok Ortuseight    : 3 → 2 (alert jika < 2)
```

---

## 10. Dashboard & Manajemen Karyawan

### 10.1 Modul Dashboard

```
📊 OVERVIEW
   Revenue hari ini/bulan, jumlah order, customer baru, conversion rate

💬 LIVE CHAT MONITOR
   Lihat semua percakapan AI realtime, takeover manual kapan saja

📦 MANAJEMEN ORDER
   List order, filter status/tanggal, assign ke staff, update status

🏪 KATALOG PRODUK
   CRUD produk, harga, stok, foto, alert stok menipis

👥 CUSTOMER (CRM)
   Daftar pelanggan, history order, total belanja, segmentasi

💰 LAPORAN KEUANGAN
   Income vs expense, profit margin, cash flow, export PDF/Excel

📈 ANALITIK PENJUALAN
   Top produk, jam ramai, performa per channel, tren mingguan

🤖 PENGATURAN AI
   Persona AI, greeting, jam operasional, aturan eskalasi, training katalog

⚙️ KUSTOMISASI WEBSITE (plan premium)
   Branding checkout, domain custom, tema, pembagian tugas karyawan

👤 MANAJEMEN TIM
   Tambah akun karyawan, set role & permission, lihat performa
```

### 10.2 Sistem Role & Pembagian Tugas

| Role | Hak Akses |
|------|-----------|
| **Owner** | Akses penuh: keuangan, tim, AI config, semua order |
| **Admin** | Kelola order, produk, customer; tanpa akses keuangan sensitif |
| **Staff (Packing)** | Hanya lihat & proses order yang di-assign |
| **Staff (CS)** | Takeover chat, balas manual; tanpa akses order finansial |

```
Pembagian tugas order (fitur kustomisasi, plan Tumbuh+):
  Owner → assign order ke staff tertentu
  Staff → terima notif → proses → update status
  System → log aktivitas tiap staff → tampil di laporan performa
```

### 10.3 Laporan yang Dihasilkan

```
📄 Laporan Transaksi    : detail tiap order, metode bayar, status
📄 Laporan Keuangan     : income, expense, profit, margin per periode
📄 Laporan Produk       : produk terlaris, stok mati, perputaran inventori
📄 Laporan Karyawan     : order diproses per staff, kecepatan proses
📄 Laporan AI           : jumlah chat, conversion chat→order, eskalasi
```

---

## 11. Roadmap Pembangunan

### Fase 1 — MVP Core (Minggu 1-6)
```
✓ Setup monorepo (Turborepo): apps/api, apps/web, packages/db
✓ DB schema + Prisma + multi-tenant auth (NextAuth)
✓ WA webhook (Fonnte) + BullMQ queue
✓ Wira Agent: Groq + Llama 3.3-70B + tool calling dasar
✓ Tools: cariProduk, cekStok, buatOrder, simpanDataCustomer
✓ Midtrans QRIS integration
```

### Fase 2 — Dashboard & Realtime (Minggu 7-10)
```
✓ Dashboard Next.js: overview, order, produk, customer
✓ Socket.io realtime notif
✓ Live chat monitor + takeover manual
✓ Payment webhook + auto stock update
```

### Fase 3 — Ekosistem Lengkap (Minggu 11-16)
```
✓ Manajemen tim + role & permission
✓ Laporan keuangan + export PDF/Excel
✓ Web checkout custom (plan premium)
✓ Marketplace redirect
✓ Model routing (8B/70B) untuk hemat biaya
✓ Subscription billing (Midtrans Recurring)
```

### Fase 4 — Skala & Polish (Minggu 17+)
```
✓ Multi-channel (Instagram, Facebook)
✓ Analitik lanjutan
✓ Onboarding self-service
✓ Beta test 10 UMKM → iterasi → launch publik
```

---

## Ringkasan Eksekutif

> **Wira AI** adalah ekosistem SaaS B2B di mana **AI Agent canggih** (Groq +
> Llama 3.3-70B dengan tool calling) tidak sekadar menjawab, tapi **menjalankan
> bisnis**: melayani customer, menutup transaksi, mengumpulkan data, memproses
> pembayaran (QRIS/marketplace/web), menulis ke database, dan memicu operasional
> — semua terpantau owner lewat **dashboard realtime** dengan **laporan keuangan**,
> **manajemen tim**, dan **kustomisasi website** sesuai tier subscription.
>
> **Diferensiasi:** full lifecycle automation, latency <1 detik, harga
> UMKM-friendly, dan tiered pricing berdasar metode checkout.

---

*Dokumen ini adalah blueprint perencanaan. Tahap selanjutnya: setup repo & mulai Fase 1.*
