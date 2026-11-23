/**
 * Seed: buat tenant + produk sample untuk testing Phase 1
 * Jalankan: npx tsx packages/db/prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Ganti waNumber dengan nomor WA bisnis kamu yang terdaftar di Fonnte
  const tenant = await prisma.tenant.upsert({
    where: { waNumber: "6281234567890" },
    update: {},
    create: {
      name: "Toko Sepatu Berkah",
      waNumber: "6281234567890", // ← GANTI dengan nomor WA device di Fonnte
      plan: "MULA",
      status: "ACTIVE",
      aiPersonaConfig: {
        aiName: "Wira",
        greeting: "Halo kak! Selamat datang di Toko Sepatu Berkah 👟",
        style: "ramah dan sopan",
        operatingHours: "Senin-Sabtu 08.00-21.00 WIB",
        escalationRule: "Jika customer komplain atau minta refund, alihkan ke owner",
      },
      checkoutMethods: ["qris", "marketplace"],
    },
  });

  console.log(`✅ Tenant: ${tenant.name} (ID: ${tenant.id})`);

  // Produk sample
  const products = await Promise.all([
    prisma.product.upsert({
      where: { id: "prod_001" },
      update: {},
      create: {
        id: "prod_001",
        tenantId: tenant.id,
        name: "Nike Air Max 90",
        sku: "NIK-AM90-42",
        price: 850000,
        costPrice: 600000,
        stock: 10,
        category: "Sneakers",
        description: "Nike Air Max 90, size 37-45, tersedia berbagai warna",
        isActive: true,
      },
    }),
    prisma.product.upsert({
      where: { id: "prod_002" },
      update: {},
      create: {
        id: "prod_002",
        tenantId: tenant.id,
        name: "Adidas Ultraboost 22",
        sku: "ADI-UB22-43",
        price: 1200000,
        costPrice: 850000,
        stock: 5,
        category: "Running",
        description: "Adidas Ultraboost 22, cocok untuk lari jarak jauh",
        isActive: true,
      },
    }),
    prisma.product.upsert({
      where: { id: "prod_003" },
      update: {},
      create: {
        id: "prod_003",
        tenantId: tenant.id,
        name: "Ortuseight Hyperblast",
        sku: "ORT-HB-42",
        price: 380000,
        costPrice: 250000,
        stock: 15,
        category: "Running",
        description: "Sepatu lari lokal berkualitas, size 38-45",
        isActive: true,
      },
    }),
    prisma.product.upsert({
      where: { id: "prod_004" },
      update: {},
      create: {
        id: "prod_004",
        tenantId: tenant.id,
        name: "Converse All Star Classic",
        sku: "CON-AS-41",
        price: 650000,
        costPrice: 450000,
        stock: 8,
        category: "Casual",
        description: "Converse All Star klasik, cocok untuk sehari-hari",
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ ${products.length} produk dibuat`);

  console.log(`
📋 INFO PENTING:
   Tenant ID : ${tenant.id}
   WA Number : ${tenant.waNumber}

🧪 Test AI Agent:
   curl -X POST http://localhost:3001/webhook/test \\
     -H "Content-Type: application/json" \\
     -d '{"tenantId":"${tenant.id}","waNumber":"628999888777","message":"Halo ada sepatu running?"}'
  `);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
