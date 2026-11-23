import { supabase, type Product } from "@wira/db";

interface OrderItem {
  productId: string;
  qty: number;
}

export async function buatOrder(
  tenantId: string,
  customerId: string,
  items: OrderItem[],
  checkoutMethod: string = "qris"
) {
  const productIds = items.map((i) => i.productId);

  // Ambil data produk
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, price, stock")
    .in("id", productIds)
    .eq("tenantId", tenantId)
    .eq("isActive", true);

  if (prodErr || !products || products.length !== items.length) {
    return { success: false, message: "Satu atau lebih produk tidak ditemukan" };
  }

  // Validasi stok
  type ProdRow = Pick<Product, "id" | "name" | "price" | "stock">;
  const itemsWithPrice: Array<OrderItem & { price: number; name: string }> = [];
  for (const item of items) {
    const product = (products as ProdRow[]).find((p) => p.id === item.productId)!;
    if (product.stock < item.qty) {
      return { success: false, message: `Stok ${product.name} tidak cukup (tersedia: ${product.stock})` };
    }
    itemsWithPrice.push({ ...item, price: product.price, name: product.name });
  }

  const totalAmount = itemsWithPrice.reduce((sum, i) => sum + i.price * i.qty, 0);

  // Insert order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({ tenantId, customerId, totalAmount, checkoutMethod, status: "PENDING_PAYMENT" })
    .select("id")
    .single();

  if (orderErr || !order) return { success: false, message: orderErr?.message ?? "Gagal buat order" };

  // Insert order items
  const { error: itemsErr } = await supabase.from("order_items").insert(
    itemsWithPrice.map((i) => ({
      orderId: order.id,
      productId: i.productId,
      qty: i.qty,
      unitPrice: i.price,
      subtotal: i.price * i.qty,
    }))
  );

  if (itemsErr) {
    // Rollback order jika gagal insert items
    await supabase.from("orders").delete().eq("id", order.id);
    return { success: false, message: `Gagal simpan item: ${itemsErr.message}` };
  }

  // Kurangi stok tiap produk
  for (const item of itemsWithPrice) {
    await supabase.rpc("decrement_stock", { p_id: item.productId, p_qty: item.qty });
  }

  return {
    success: true,
    orderId: order.id,
    totalAmount,
    totalFormatted: `Rp ${totalAmount.toLocaleString("id-ID")}`,
    items: itemsWithPrice.map((i) => `${i.name} x${i.qty}`).join(", "),
    message: `Order #${order.id.slice(-6).toUpperCase()} berhasil dibuat`,
  };
}

const ORDER_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "menunggu pembayaran",
  PAID: "sudah dibayar, menunggu diproses",
  PROCESSING: "sedang diproses",
  SHIPPED: "sudah dikirim",
  DONE: "selesai",
  CANCELLED: "dibatalkan",
};
const PAID_ORDER_STATES = ["PAID", "PROCESSING", "SHIPPED", "DONE"];

type PaymentRow = { orderId: string; status: string; method: string; paidAt: string | null; createdAt: string };

/** Status pembayaran gabungan dari tabel payments + orders. Sumber kebenaran = database. */
function derivePayment(orderStatus: string, payments: PaymentRow[]) {
  const latest = [...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const paidRow = payments.find((p) => p.status === "PAID");
  if (paidRow || PAID_ORDER_STATES.includes(orderStatus)) {
    return { code: "SUDAH_BAYAR", label: "sudah dibayar", paidAt: paidRow?.paidAt ?? null, method: paidRow?.method ?? latest?.method ?? null };
  }
  if (orderStatus === "CANCELLED") return { code: "DIBATALKAN", label: "order dibatalkan", paidAt: null, method: latest?.method ?? null };
  if (latest?.status === "FAILED") return { code: "GAGAL", label: "pembayaran gagal", paidAt: null, method: latest.method };
  if (latest?.status === "EXPIRED") return { code: "KEDALUWARSA", label: "pembayaran kedaluwarsa", paidAt: null, method: latest.method };
  return { code: "BELUM_BAYAR", label: "belum terkonfirmasi / belum dibayar", paidAt: null, method: latest?.method ?? null };
}

/**
 * Cek status order + pembayaran milik customer yang sedang chat.
 * - Hanya order milik customer ini (tidak bisa mengintip order orang lain).
 * - orderId opsional: boleh ID penuh, atau 6 karakter terakhir (#ABC123). Tanpa orderId → order terbaru.
 */
export async function cekStatusOrder(tenantId: string, customerId: string, orderId?: string) {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, status, totalAmount, checkoutMethod, createdAt, order_items ( qty, products ( name ) )")
    .eq("tenantId", tenantId)
    .eq("customerId", customerId)
    .order("createdAt", { ascending: false })
    .limit(10);

  if (error) return { found: false, message: `Gagal membaca order: ${error.message}` };
  if (!orders || orders.length === 0) return { found: false, message: "Pelanggan ini belum punya order." };

  type OrderRow = {
    id: string; status: string; totalAmount: number; checkoutMethod: string | null; createdAt: string;
    order_items: Array<{ qty: number; products: { name: string } | null }>;
  };
  let list = orders as unknown as OrderRow[];

  if (orderId && orderId.trim()) {
    const q = orderId.trim().replace(/^#/, "").toLowerCase();
    const hit = list.filter((o) => o.id.toLowerCase() === q || o.id.toLowerCase().endsWith(q) || o.id.toLowerCase().startsWith(q));
    if (hit.length === 0) return { found: false, message: `Order "${orderId}" tidak ditemukan untuk pelanggan ini.` };
    list = hit;
  } else {
    list = list.slice(0, 3); // tanpa ID: tampilkan 3 order terbaru
  }

  const { data: pays } = await supabase
    .from("payments")
    .select("orderId, status, method, paidAt, createdAt")
    .in("orderId", list.map((o) => o.id));
  const payRows = (pays ?? []) as PaymentRow[];

  const result = list.map((o) => {
    const pay = derivePayment(o.status, payRows.filter((p) => p.orderId === o.id));
    const kode = o.id.slice(-6).toUpperCase();
    return {
      orderId: o.id,
      kodeOrder: `#${kode}`,
      statusOrder: o.status,
      statusPembayaran: pay.code,
      metodeBayar: pay.method ?? o.checkoutMethod ?? "-",
      dibayarPada: pay.paidAt,
      total: `Rp ${o.totalAmount.toLocaleString("id-ID")}`,
      items: o.order_items.map((i) => `${i.products?.name} x${i.qty}`).join(", "),
      ringkasan: `Order #${kode}: pembayaran ${pay.label}; status pesanan ${ORDER_LABEL[o.status] ?? o.status}.`,
    };
  });

  return { found: true, jumlah: result.length, orders: result };
}
