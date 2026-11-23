import { supabase } from "@wira/db";

export async function generatePayment(
  tenantId: string,
  orderId: string,
  method: "qris" | "marketplace" | "web" = "qris"
) {
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, totalAmount, status")
    .eq("id", orderId)
    .eq("tenantId", tenantId)
    .single();

  if (error || !order) return { success: false, message: "Order tidak ditemukan" };
  if (order.status !== "PENDING_PAYMENT") {
    return { success: false, message: "Order sudah diproses sebelumnya" };
  }

  if (method === "qris") {
    const midtransServerKey = process.env.MIDTRANS_SERVER_KEY;

    if (!midtransServerKey) {
      // Tanpa Midtrans: sistem otomatis mengirim gambar QRIS statis (payment/qris.jpeg)
      await supabase.from("payments").insert({
        orderId,
        method: "qris",
        amount: order.totalAmount,
        status: "PENDING",
      });
      return {
        success: true,
        method: "qris",
        amount: `Rp ${order.totalAmount.toLocaleString("id-ID")}`,
        message:
          "Gambar QRIS otomatis dikirim sistem sebagai pesan terpisah. Cukup beri tahu pelanggan total bayar dan minta mereka scan QRIS lalu konfirmasi setelah membayar. JANGAN membuat link apa pun.",
      };
    }

    // TODO: Midtrans Snap API (Phase 2)
    return { success: false, message: "Midtrans belum dikonfigurasi" };
  }

  if (method === "marketplace") {
    return {
      success: true,
      method: "marketplace",
      message: "Silakan lanjutkan pembelian via link marketplace toko kami.",
    };
  }

  return { success: false, message: "Metode tidak didukung" };
}
