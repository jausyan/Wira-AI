import { supabase, type Product } from "@wira/db";

// Kata umum yang BUKAN nama produk — jangan dipakai sebagai filter pencarian
const STOP_WORDS = new Set([
  "sepatu", "semua", "semuanya", "list", "daftar", "apa", "saja", "aja", "ada", "yang", "tersedia", "produk",
  "barang", "katalog", "tampilkan", "lihat", "mau", "cari", "dong", "ya", "kak", "nya", "untuk", "buat",
  "di", "ke", "dan", "atau", "the", "all", "show", "tolong", "minta", "kasih", "rekomendasi", "saran",
]);

type ProdRow = Pick<Product, "id" | "name" | "price" | "stock" | "category" | "description">;

function formatProducts(rows: ProdRow[]) {
  return rows.map((p) => ({
    id: p.id,
    nama: p.name,
    harga: `Rp ${p.price.toLocaleString("id-ID")}`,
    stok: p.stock,
    status: p.stock > 0 ? "tersedia" : "habis",
    kategori: p.category,
    deskripsi: p.description,
  }));
}

/**
 * Cari produk. Sumber kebenaran = tabel products (isActive = true).
 * - Kata umum ("sepatu", "semua", "list"...) diabaikan
 * - Tanpa kata kunci bermakna → semua produk aktif
 * - Tidak ada yang cocok → kembalikan semua produk aktif + catatan (tidak pernah mengarang)
 */
export async function cariProduk(tenantId: string, query: string) {
  const words = (query ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  const all = supabase
    .from("products")
    .select("id, name, price, stock, category, description")
    .eq("tenantId", tenantId)
    .eq("isActive", true)
    .order("category")
    .order("name")
    .limit(50);

  if (words.length === 0) {
    const { data, error } = await all;
    if (error) return { found: false, message: `Error: ${error.message}` };
    if (!data?.length) return { found: false, message: "Belum ada produk yang tersedia" };
    return { found: true, count: data.length, products: formatProducts(data as ProdRow[]) };
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, stock, category, description")
    .eq("tenantId", tenantId)
    .eq("isActive", true)
    .or(words.flatMap((w) => [`name.ilike.%${w}%`, `category.ilike.%${w}%`, `description.ilike.%${w}%`]).join(","))
    .order("category")
    .order("name")
    .limit(50);

  if (error) return { found: false, message: `Error: ${error.message}` };
  if (data && data.length > 0) {
    return { found: true, count: data.length, products: formatProducts(data as ProdRow[]) };
  }

  // Tidak ada yang cocok → tampilkan katalog lengkap agar AI tidak mengarang
  const { data: everything } = await all;
  if (!everything?.length) return { found: false, message: "Produk tidak ditemukan" };
  return {
    found: true,
    count: everything.length,
    catatan: `Tidak ada produk yang cocok dengan "${query}". Berikut seluruh produk yang kami punya.`,
    products: formatProducts(everything as ProdRow[]),
  };
}

export async function cekStok(tenantId: string, productId: string) {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, stock")
    .eq("id", productId)
    .eq("tenantId", tenantId)
    .eq("isActive", true)
    .single();

  if (error || !data) return { available: false, message: "Produk tidak ditemukan" };

  const product = data as Pick<Product, "id" | "name" | "price" | "stock">;
  return {
    available: product.stock > 0,
    id: product.id,
    nama: product.name,
    harga: `Rp ${product.price.toLocaleString("id-ID")}`,
    hargaRaw: product.price,
    stok: product.stock,
    message: product.stock > 0 ? `Tersedia, stok ${product.stock}` : "Stok habis",
  };
}
