# Google Cloud OAuth Provisioning — YouTube Connect (FYI Studio)

> **Tujuan:** menyiapkan kredensial OAuth 2.0 Google Cloud agar tombol
> **"Connect YouTube (OAuth)"** di dashboard bisa menyelesaikan skenario
> end-to-end: *klik Connect → login Google → channel terhubung → FYI Studio
> menarik data analytics nyata.*
>
> Dokumen ini langkah-demi-langkah. Ikuti urutannya. Tidak ada kredensial yang
> di-hardcode ke repo — semuanya lewat env (`GOOGLE_CLIENT_ID`,
> `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`).

---

## 0. Prasyarat

- Akun Google (bisa akun pribadi; untuk produksi sebaiknya akun organisasi).
- Akses ke [Google Cloud Console](https://console.cloud.google.com).
- (Opsional) Kartu kredit untuk billing — **tidak wajib** untuk OAuth + YouTube
  Data API v3 + YouTube Analytics API (semua gratis dengan kuota harian).

---

## 1. Buat Project Google Cloud

1. Buka <https://console.cloud.google.com>.
2. Klik dropdown **project** (di kiri atas) → **New Project**.
3. Nama project: `fyi-studio` (atau bebas).
4. Klik **Create**. Tunggu sampai project aktif (muncul di dropdown).

---

## 2. Aktifkan API yang dibutuhkan

Kita butuh **3 API**:

| API | Dipakai untuk |
|-----|----------------|
| **YouTube Data API v3** | membaca statistik video (views, likes, comments) + upload |
| **YouTube Analytics API** | membaca revenue / estimatedRevenue |
| **Google+ API** (opsional) | tidak wajib; lewati jika tidak muncul |

Langkah:
1. Di project, buka **APIs & Services → Library**.
2. Cari **"YouTube Data API v3"** → klik → **Enable**.
3. Cari **"YouTube Analytics API"** → klik → **Enable**.
4. (Jika diminta) **Enable** juga **Google+ API**.

> Catatan: tanpa mengaktifkan kedua API ini, OAuth akan sukses tapi
> `fetchVideoStats` / `fetchVideoRevenue` akan gagal dengan 403/404.

---

## 3. Buat OAuth Consent Screen

1. Buka **APIs & Services → OAuth consent screen**.
2. Pilih **User Type**:
   - **External** (default, bisa untuk testing + produksi; butuh verifikasi hanya
     jika dipakai publik luas).
   - **Internal** (hanya jika akun organisasi Google Workspace).
3. Klik **Create**.
4. Isi:
   - **App name:** `FYI Studio`
   - **User support email:** email kamu.
   - **Developer contact email:** email kamu.
5. Klik **Save and Continue**.
6. Di **Scopes**, klik **Add or remove scopes**, lalu tambahkan (manual):
   - `https://www.googleapis.com/auth/youtube.readonly`
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/yt-analytics.readonly`
   - `https://www.googleapis.com/auth/userinfo.email` (opsional)
   Klik **Update** → **Save and Continue**.
7. Di **Test users**, tambahkan email Google kamu (wajib untuk mode **External**
   sebelum app diverifikasi). Klik **Save and Continue**.
8. Review → **Back to Dashboard**.

> **Penting:** selama app masih berstatus **"Testing"**, hanya akun yang
> terdaftar di **Test users** yang bisa login. Untuk produksi, submit untuk
> verifikasi (butuh waktu) atau set **Publishing status → In production**.

---

## 4. Buat OAuth Client ID

1. Buka **APIs & Services → Credentials**.
2. Klik **+ Create Credentials → OAuth client ID**.
3. **Application type:** **Web application**.
4. **Name:** `FYI Studio Dashboard`.
5. Di **Authorized redirect URIs**, klik **+ Add URI** dan tambahkan:
   ```
   http://localhost:3001/api/social/youtube/callback
   ```
   > Ini harus PERSIS sama dengan `GOOGLE_REDIRECT_URI` di `.env`. Kalau
   > dashboard jalan di port lain, sesuaikan.
6. Klik **Create**.
7. Akan muncul dialog berisi **Client ID** dan **Client Secret**.
   - **Salin keduanya** (Client Secret hanya tampil sekali).
   - Klik **Download JSON** untuk cadangan (opsional).

---

## 5. Isi `.env` (jangan commit)

Buka `.env` di root repo (sudah git-ignored) dan tambahkan:

```bash
# --- YouTube OAuth (Google Cloud) ---
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3001/api/social/youtube/callback
```

> **Jangan pernah commit `.env`.** Nilai `GOOGLE_CLIENT_SECRET` adalah rahasia.
> `.env` sudah ada di `.gitignore`.

---

## 6. Restart Dashboard

Karena `loadEnv()` membaca `.env` saat startup, restart dashboard agar
kredensial terbaca:

```bash
# hentikan dashboard (Ctrl+C atau kill), lalu:
pnpm run dashboard
```

Verifikasi kredensial terbaca:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/social/youtube/connect?tenant_id=demo"
```

- **Sebelum** diisi: `503` (OAuth not configured).
- **Setelah** diisi: `302` (redirect ke Google consent).

---

## 7. Uji Skenario End-to-End

1. Buka <http://localhost:3001/settings>.
2. Scroll ke **Social Accounts & Publishing**.
3. Klik **🔗 Connect YouTube (OAuth)**.
4. Kamu diarahkan ke halaman login Google → pilih akun → **Allow**.
5. Browser kembali ke `/settings?oauth=success&channel=<nama channel>`.
   - Muncul badge **"✅ YouTube terhubung: <channel>"**.
6. Buka <http://localhost:3001/analytics>.
   - Muncul **✅ YouTube Connected** + nama channel.
7. Jalankan ingestion sekali (untuk menarik data nyata):
   ```bash
   cd services/analytics-ingest && npx tsx src/index.ts --once
   ```
   (atau tunggu scheduler harian). Data views/revenue nyata masuk ke
   `platform_metrics` / `video_revenue`.

---

## 8. Troubleshooting

| Gejala | Kemungkinan Penyebab | Solusi |
|--------|----------------------|--------|
| `503 OAuth is not configured` | `.env` belum diisi / belum restart | Isi 3 var + restart dashboard |
| `redirect_uri_mismatch` | URI di Google Cloud ≠ `GOOGLE_REDIRECT_URI` | Samakan persis (termasuk port) |
| `access_denied` | Akun bukan Test user | Tambah email ke **Test users** |
| Login sukses tapi analytics kosong | YouTube Analytics API belum di-enable | Enable di **APIs & Services → Library** |
| `403` saat fetch stats | Scope `youtube.readonly` belum ditambahkan | Tambah scope di consent screen |
| Token hilang setelah restart | — | Token disimpan terenkripsi di DB (`social_account.token_ref`), seharusnya persist |

---

## 9. Catatan Keamanan

- **Client Secret** hanya di `.env` (git-ignored), tidak pernah di repo.
- **Access/refresh token** disimpan **terenkripsi AES-256-GCM** di
  `social_account.token_ref` (via `@fyi/platform encryptSecret`), bukan
  plaintext.
- Dashboard **tidak pernah** memanggil API platform saat halaman dibuka
  (ADR-0009) — semua ingestion lewat scheduler.
- Untuk produksi: set `FYI_SECRET_KEY` (master key enkripsi) yang kuat, dan
  pertimbangkan memindahkan kredensial ke secret manager (Vault/AWS).

---

## 10. Ringkasan Env Vars

| Variabel | Contoh | Wajib |
|----------|--------|-------|
| `GOOGLE_CLIENT_ID` | `1234.apps.googleusercontent.com` | ✅ |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | ✅ |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3001/api/social/youtube/callback` | ✅ |
| `FYI_SECRET_KEY` | (master key enkripsi) | untuk produksi |
| `YOUTUBE_ACCESS_TOKEN` | (fallback token) | opsional |
