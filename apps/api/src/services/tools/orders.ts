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

export async function cekStatusOrder(tenantId: string, orderId: string) {
  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      id, status, totalAmount, checkoutMethod,
      customers ( name ),
      payments ( status ),
      order_items ( qty, products ( name ) )
    `)
    .eq("id", orderId)
    .eq("tenantId", tenantId)
    .single();

  if (error || !order) return { found: false, message: "Order tidak ditemukan" };

  const o = order as unknown as {
    id: string; status: string; totalAmount: number;
    customers: { name: string | null } | null;
    payments: { status: string } | null;
    order_items: Array<{ qty: number; products: { name: string } | null }>;
  };

  return {
    found: true,
    orderId: o.id,
    status: o.status,
    totalAmount: `Rp ${o.totalAmount.toLocaleString("id-ID")}`,
    paymentStatus: o.payments?.status ?? "belum ada",
    items: o.order_items.map((i) => `${i.products?.name} x${i.qty}`).join(", "),
    customer: o.customers?.name ?? "-",
  };
}
