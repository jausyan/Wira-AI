/**
 * Normalisasi nomor telepon Indonesia → format 62xxxxxxxxxx (tanpa +, spasi, strip).
 * 0812-3456-7890 / +62 812 3456 7890 / 812345678 → 6281234567890
 * Return null jika bukan nomor yang masuk akal.
 */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  let n = String(raw).replace(/\D/g, "");
  if (n.startsWith("620")) n = "62" + n.slice(3); // +62 0812... salah ketik
  else if (n.startsWith("0")) n = "62" + n.slice(1);
  else if (n.startsWith("8")) n = "62" + n;
  if (!/^62\d{8,13}$/.test(n)) return null;
  return n;
}
