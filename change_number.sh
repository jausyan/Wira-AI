#!/usr/bin/env bash
# change_number.sh — ganti nomor WhatsApp CS (OpenWA + tenant di Supabase)
#
# Pemakaian:
#   ./change_number.sh                 # nomor diambil otomatis dari HP yang scan QR
#   ./change_number.sh 081234567890    # (opsional) wajib cocok dengan HP yang scan
#
# Alur: stop sesi -> backup auth lama -> start -> tunggu QR -> scan -> update tenant
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENWA_DIR="${OPENWA_DIR:-$ROOT/../OpenWA}"
TENANT_ID="${TENANT_ID:-tenant_wira_001}"
QR_FILE="${QR_FILE:-/tmp/wira_qr.png}"
WAIT_SCAN="${WAIT_SCAN:-180}"   # detik menunggu scan

[ -f "$ROOT/.env" ] || { echo "❌ $ROOT/.env tidak ditemukan"; exit 1; }
set -a; . "$ROOT/.env"; set +a

OPENWA_URL="${OPENWA_URL:-http://localhost:2785/api}"
: "${OPENWA_API_KEY:?OPENWA_API_KEY kosong}" "${OPENWA_SESSION_ID:?OPENWA_SESSION_ID kosong}"
: "${SUPABASE_URL:?SUPABASE_URL kosong}"
SB_KEY="${SUPABASE_SERVICE_KEY:-${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY kosong}}"
S="$OPENWA_URL/sessions/$OPENWA_SESSION_ID"

owa() { curl -s -m 30 -H "X-API-Key: $OPENWA_API_KEY" "$@"; }
jget() { python3 -c "import json,sys
try: d=json.load(sys.stdin)
except Exception: d={}
v=d.get('$1')
print('' if v is None else v)"; }

# Normalisasi nomor: 0812.. / +62812.. / 812.. -> 62812..
normalize() {
  local n="${1//[^0-9]/}"
  case "$n" in
    0*)  n="62${n#0}" ;;
    62*) ;;
    8*)  n="62$n" ;;
  esac
  echo "$n"
}

EXPECTED=""
if [ "${1:-}" != "" ]; then
  EXPECTED="$(normalize "$1")"
  echo "🎯 Nomor tujuan: $EXPECTED"
fi

# 0. OpenWA harus hidup
if ! owa -o /dev/null -f "$S"; then
  echo "❌ OpenWA tidak bisa diakses di $OPENWA_URL"
  echo "   Jalankan dulu: cd $OPENWA_DIR && npm run start"
  exit 1
fi
SESSION_NAME="$(owa "$S" | jget name)"

# 1. Logout sesi lama (hapus kredensial) + backup sisa auth jika ada
echo "⏹  Logout sesi lama..."
owa -X POST "$S/logout" >/dev/null || true
owa -X POST "$S/stop" >/dev/null || true
sleep 2
for D in "$OPENWA_DIR/data/baileys/$SESSION_NAME" "$OPENWA_DIR/data/sessions/$SESSION_NAME"; do
  if [ -d "$D" ]; then
    BK="${D}_backup_$(date +%Y%m%d_%H%M%S)"
    mv "$D" "$BK"
    echo "💾 Auth lama dibackup ke: $BK"
  fi
done

# 2. Start sesi baru
echo "▶️  Memulai sesi baru..."
owa -X POST "$S/start" >/dev/null

# 3. Tunggu QR muncul
echo "⏳ Menunggu QR..."
GOT_QR=0
for _ in $(seq 1 30); do
  RES="$(owa "$S/qr")"
  if echo "$RES" | python3 -c "
import json,sys,base64
d=json.load(sys.stdin); q=d.get('qrCode')
if not q: sys.exit(1)
open('$QR_FILE','wb').write(base64.b64decode(q.split(',')[1]))" 2>/dev/null; then
    GOT_QR=1; break
  fi
  sleep 2
done
[ "$GOT_QR" = 1 ] || { echo "❌ QR tidak muncul. Cek log OpenWA."; exit 1; }

echo "📱 QR tersimpan: $QR_FILE"
(xdg-open "$QR_FILE" >/dev/null 2>&1 || true) &
echo "   Scan: WhatsApp → Perangkat Tertaut → Tautkan Perangkat"
echo "   (jika QR kedaluwarsa, buka http://localhost:2785 atau jalankan script lagi)"

# 4. Tunggu scan -> status ready
echo "⏳ Menunggu scan (maks ${WAIT_SCAN}s)..."
PHONE=""
END=$((SECONDS + WAIT_SCAN))
while [ $SECONDS -lt $END ]; do
  INFO="$(owa "$S")"
  ST="$(echo "$INFO" | jget status)"
  if [ "$ST" = "ready" ] || [ "$ST" = "connected" ]; then
    PHONE="$(echo "$INFO" | jget phone)"
    break
  fi
  # QR berganti tiap ~20 dtk — perbarui file
  owa "$S/qr" | python3 -c "
import json,sys,base64
d=json.load(sys.stdin); q=d.get('qrCode')
if q: open('$QR_FILE','wb').write(base64.b64decode(q.split(',')[1]))" 2>/dev/null || true
  sleep 3
done
[ -n "$PHONE" ] || { echo "❌ Timeout: QR belum discan."; exit 1; }
PHONE="$(normalize "$PHONE")"
echo "✅ Terhubung sebagai: $PHONE"

if [ -n "$EXPECTED" ] && [ "$EXPECTED" != "$PHONE" ]; then
  echo "⚠️  Nomor yang scan ($PHONE) ≠ nomor tujuan ($EXPECTED)."
  echo "   Tenant TIDAK diubah. Jalankan ulang dengan HP yang benar."
  exit 1
fi

# 5. Update tenant di Supabase
echo "📝 Mengubah nomor CS di database..."
OUT="$(curl -s -m 20 -X PATCH "$SUPABASE_URL/rest/v1/tenants?id=eq.$TENANT_ID" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"waNumber\":\"$PHONE\"}")"
if echo "$OUT" | grep -q "\"waNumber\":\"$PHONE\""; then
  echo "✅ Tenant $TENANT_ID → waNumber = $PHONE"
else
  echo "❌ Gagal update tenant: $OUT"
  echo "   (kemungkinan RLS — isi SUPABASE_SERVICE_KEY di .env, atau jalankan SQL manual:)"
  echo "   UPDATE tenants SET \"waNumber\"='$PHONE' WHERE id='$TENANT_ID';"
  exit 1
fi

echo
echo "🎉 Selesai! CS EVA sekarang aktif di nomor $PHONE."
echo "   Pastikan Wira API jalan: npm run dev --workspace=apps/api"
