# Wira AI — Cara Menjalankan Sistem

Setiap kali ingin menggunakan sistem, jalankan **2 service** berikut secara berurutan.

---

## 1. Jalankan OpenWA (WhatsApp Gateway)

```bash
cd /home/el-system/Documents/project/OpenWA
npm run start
```

Tunggu hingga muncul:
```
🚀 OpenWA is running on: http://localhost:2785
```

> **Session sudah tersimpan** — tidak perlu scan QR ulang selama tidak logout dari WhatsApp.
> Jika perlu scan ulang QR, lihat bagian bawah.

---

## 2. Jalankan Wira AI API

Buka terminal baru:

```bash
cd /home/el-system/Documents/project/AI_STARTUP
npm run dev --workspace=apps/api
```

Tunggu hingga muncul:
```
🚀 Wira AI API berjalan di http://localhost:3001
📡 Webhook URL: http://localhost:3001/webhook/openwa
```

---

## Cek Status Sistem

```bash
# Cek OpenWA session (harus READY/CONNECTED)
curl -s http://localhost:2785/api/sessions/$OPENWA_SESSION_ID \
  -H "X-API-Key: $OPENWA_API_KEY" | python3 -c "import json,sys; d=json.load(sys.stdin); print('Status:', d.get('status'), '| Phone:', d.get('phone'))"

# Cek Wira AI API
curl -s http://localhost:3001/health
```

---

## Jika Perlu Scan QR Ulang

Jalankan perintah ini setelah OpenWA berjalan:

```bash
SESSION_ID="$OPENWA_SESSION_ID"

# Start session
curl -s -X POST http://localhost:2785/api/sessions/$SESSION_ID/start \
  -H "X-API-Key: $OPENWA_API_KEY" > /dev/null

# Ambil QR dan simpan ke file
sleep 4 && curl -s http://localhost:2785/api/sessions/$SESSION_ID/qr \
  -H "X-API-Key: $OPENWA_API_KEY" | python3 -c "
import json,sys,base64
d=json.load(sys.stdin)
img=d.get('qrCode','').split(',')[1]
open('/tmp/qr.png','wb').write(base64.b64decode(img))
print('QR disimpan → /tmp/qr.png')
" && xdg-open /tmp/qr.png
```

Scan QR via WhatsApp → **Perangkat Tertaut** → **Tautkan Perangkat**

---

## Info Penting

| Item | Value |
|---|---|
| OpenWA URL | http://localhost:2785 |
| OpenWA API Key | di `.env` (`OPENWA_API_KEY`) & `OpenWA/.env` (`API_MASTER_KEY`) |
| OpenWA Session ID | di `.env` (`OPENWA_SESSION_ID`) |
| Nomor WA Bisnis | `6285183795695` |
| Wira AI API | http://localhost:3001 |
| Webhook | `http://localhost:3001/webhook/openwa` |
| Model AI | `GROQ_MODEL` di `.env` (default `openai/gpt-oss-120b`) |

---

## Troubleshooting

| Gejala | Solusi |
|---|---|
| `model_not_found` di log | Model Groq dipensiunkan. Cek daftar: `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API"` lalu ubah `GROQ_MODEL` di `.env` |
| OpenWA status `failed` / `logged out` | Sesi WA dilepas dari HP. Stop sesi, pindahkan `OpenWA/data/baileys/marekting`, start ulang, scan QR |
| `Could not resolve host ...supabase.co` | Project Supabase ter-pause — Restore di dashboard Supabase |
| Pertama kali / setelah clone | `npm install` di `AI_STARTUP` dan di `OpenWA` |

---

## Setup ulang OpenWA (jika folder OpenWA hilang)

```bash
cd ~/Documents/project
git clone https://github.com/rmyndharis/OpenWA.git && cd OpenWA && npm install
cat > .env <<EOF
NODE_ENV=development
API_PORT=2785
ENGINE_TYPE=baileys
API_MASTER_KEY=owa_k1_$(openssl rand -hex 24)
AUTO_START_SESSIONS=true
WEBHOOK_SSRF_PROTECT=false
EOF
npm run start
```
Lalu buat sesi (`POST /api/sessions {"name":"marekting"}`), tambah webhook
`http://localhost:3001/webhook/openwa` (event `message.received`), salin id sesi & API key ke `AI_STARTUP/.env`,
start sesi dan scan QR. Atau ganti nomor/scan ulang cukup dengan `./change_number.sh`.
