import { supabase, type Product } from "@wira/db";

export async function cariProduk(tenantId: string, query: string) {
  const words = (query ?? "").toLowerCase().split(/\s+/).filter((w) => w.length > 1);

  // Query kosong = tampilkan semua produk aktif
  const baseQuery = supabase
    .from("products")
    .select("id, name, price, stock, category, description")
    .eq("tenantId", tenantId)
    .eq("isActive", true)
    .limit(8);

  const { data, error } = words.length > 0
    ? await baseQuery.or(
        words.flatMap((w) => [`name.ilike.%${w}%`, `category.ilike.%${w}%`, `description.ilike.%${w}%`]).join(",")
      )
    : await baseQuery;

  if (error) return { found: false, message: `Error: ${error.message}` };
  if (!data || data.length === 0) return { found: false, message: "Produk tidak ditemukan" };

  return {
    found: true,
    count: data.length,
    products: (data as Pick<Product, "id" | "name" | "price" | "stock" | "category" | "description">[]).map((p) => ({
      id: p.id,
      nama: p.name,
      harga: `Rp ${p.price.toLocaleString("id-ID")}`,
      stok: p.stock,
      kategori: p.category,
      deskripsi: p.description,
    })),
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
