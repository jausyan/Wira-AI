import { supabase, type Customer } from "@wira/db";

interface CustomerData {
  nama?: string;
  alamat?: string;
  catatan?: string;
}

export async function simpanDataCustomer(
  tenantId: string,
  waNumber: string,
  data: CustomerData
) {
  // Cek apakah customer sudah ada
  const { data: existing } = await supabase
    .from("customers")
    .select("id, name")
    .eq("tenantId", tenantId)
    .eq("waNumber", waNumber)
    .maybeSingle();

  if (existing) {
    // Update
    const { error } = await supabase
      .from("customers")
      .update({
        ...(data.nama && { name: data.nama }),
        ...(data.alamat && { address: data.alamat }),
        ...(data.catatan && { notes: data.catatan }),
      })
      .eq("id", existing.id);

    if (error) return { success: false, message: error.message };
    return { success: true, customerId: existing.id, message: `Data diperbarui untuk ${data.nama ?? existing.name}` };
  }

  // Insert baru
  const { data: created, error } = await supabase
    .from("customers")
    .insert({ tenantId, waNumber, name: data.nama, address: data.alamat, notes: data.catatan })
    .select("id, name")
    .single();

  if (error || !created) return { success: false, message: error?.message ?? "Gagal simpan customer" };
  return { success: true, customerId: created.id, message: `Data tersimpan untuk ${data.nama ?? waNumber}` };
}

export async function getOrCreateCustomer(
  tenantId: string,
  waNumber: string,
  name?: string
): Promise<Customer> {
  const { data: existing } = await supabase
    .from("customers")
    .select("*")
    .eq("tenantId", tenantId)
    .eq("waNumber", waNumber)
    .maybeSingle();

  if (existing) return existing as Customer;

  const { data: created, error } = await supabase
    .from("customers")
    .insert({ tenantId, waNumber, name: name ?? null })
    .select("*")
    .single();

  if (error || !created) throw new Error(`Gagal buat customer: ${error?.message}`);
  return created as Customer;
}
