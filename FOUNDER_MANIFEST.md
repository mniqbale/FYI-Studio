---
id: founder-manifest
title: "FOUNDER MANIFEST — FYI Studio Architecture Philosophy"
owner: "Founder"
status: "active"
version: "1.0.0"
last_updated: "2026-08-07"
review_cycle: "per-milestone"
tags: [manifest, philosophy, architecture, north-star, founder, governance, media-intelligence]
related_documents:
  - "SYSTEM.md"
  - "CLAUDE.md"
  - "README.md"
  - ".ai/context/start-here.md"
  - ".ai/state/rc1-baseline.md"
  - ".ai/adr/ADR-0011-capability-only-worker-invariant.md"
  - ".ai/adr/ADR-0012-media-engine-unified-lifecycle.md"
---

# FOUNDER MANIFEST

> **Filosofi arsitektur dan alasan di balik keputusan-keputusan utama FYI Studio.**
> Dokumen ini adalah kompas untuk setiap keputusan teknik — dibaca sebagai
> prinsip, bukan aturan mekanis. Jika sebuah keputusan bertentangan dengan
> dokumen ini, keputusan itu salah.

---

## 1. North Star: Media Intelligence Platform, Bukan Automation Tool

**Bayangkan FYI Studio sudah berjalan dua tahun.** Sistem sudah menghasilkan
100.000 video. Lalu seluruh model AI di dunia diganti — GPT hilang, Gemini
hilang, Claude hilang, DeepSeek hilang. Yang tersisa hanya database FYI Studio.

**Apa aset paling berharga yang masih dimiliki?**

- Kalau jawabannya *script*, *prompt*, atau *video* → kita sedang membangun
  **automation tool**.
- Kalau jawabannya **knowledge graph tentang perilaku audience, eksperimen
  konten, economics per format, dan pola keberhasilan yang tervalidasi** → kita
  sedang membangun **media intelligence platform**.

**Keputusan: FYI Studio adalah media intelligence platform.** Model AI hanyalah
alat eksekusi; knowledge graph adalah akumulasi keputusan yang sudah terbukti
dan tidak bisa digantikan.

---

## 2. Unit Pembelajaran: Eksperimen Konten, Bukan Video

Unit pembelajaran FYI Studio adalah **EKSPERIMEN KONTEN**:

```
EKSPERIMEN = { KEPUTUSAN } × { HASIL }
```

- **KEPUTUSAN** = seluruh pilihan yang kita kendalikan (topik, angle, format,
  hook, tone, durasi, thumbnail, platform, model, prompt).
- **HASIL** = respons audiens yang terukur (views, retention, CTR, engagement,
  revenue, cost).

Satu video = satu *data point* bukti, bukan aset. Yang dibangun dari 100.000
video adalah **graf keputusan-ke-hasil yang tervalidasi statistik** — jaringan
hubungan yang punya bobot validasi (berapa banyak sampel, seberapa kuat,
seberapa konsisten).

---

## 3. Prinsip Vendor Agnosticism (BYOAI)

**Semua Worker tanpa pengecualian hanya boleh berbicara dengan Capability,
bukan Vendor maupun Engine** (ADR-0011).

- Worker menanyakan *"apa yang bisa menjalankan `voice:tts`?"*, bukan *"panggil
  ElevenLabs"*.
- Menambahkan/mengganti provider atau engine = menambah **adapter** + entri
  **registry**. **Tidak ada perubahan kode Worker.**
- Ini bukan slogan — ini diuji lewat grep: nama vendor/engine tidak boleh muncul
  di logika Worker mana pun.

**Alasan:** vendor lock-in adalah kematian platform media. Setiap engine bisa
mati, naik harga, atau digantikan teknologi baru. Arsitektur harus bertahan
melewati semua itu.

---

## 4. Standardisasi Proses, Bukan Data (Anti-Leaky Abstraction)

**MediaEngine menyatukan lifecycle, bukan memaksa payload/metadata sama**
(ADR-0012).

| Distandarkan (proses) | Tidak dipaksakan (data) |
|-----------------------|-------------------------|
| Resolve capability | Bentuk payload |
| Pilih adapter | Opsi khusus engine |
| Jalankan engine | Metadata spesifik engine |
| Error handling + retry | |
| Telemetry + cost | |
| Artifact publishing | |

**Alasan:** abstraksi yang memaksa semua engine memakai `payload:
Record<string,unknown>` adalah **leaky abstraction** — menghapus type-safety
nyata (video punya multi-asset input, voice hanya teks). Prinsipnya:
**standardisasi proses, bukan data.** Satu lifecycle untuk TTS/Subtitle/Video/
Image/Music/Avatar tanpa kehilangan fleksibilitas masing-masing.

---

## 5. Rule of Three: Jangan Generalisasi dari Satu Contoh

Abstraksi yang baik lahir dari **dua atau tiga implementasi nyata**, bukan dari
satu implementasi yang *diprediksi* akan sama.

- Kita mengimplementasi VoiceEngine → SubtitleEngine → VideoEngine (video =
  stress test multi-asset) **sebelum** mengekstrak MediaEngine.
- Baru setelah tiga implementasi nyata membuktikan kontraknya, kita rekam
  ADR-0012 dan ekstrak.

**Alasan:** premature abstraction adalah sumber refactor yang salah. Biarkan
pola muncul dari realita, bukan dugaan.

---

## 6. Source of Truth Tunggal

Setiap keputusan memiliki **satu sumber kebenaran**:
- **Policy model** → `model_policy.yaml`
- **Provider base URL** → `getProviderBaseUrl()` (provider-registry)
- **Capability → queue** → `CAPABILITY_QUEUE` (supervisor config)
- **Kontrak** → `@fyi/contracts` (frozen v1.1)

Tidak boleh ada dua map base URL, dua CAPABILITY_POLICY, atau dua definisi yang
bisa divergen. Duplikasi adalah akar bug (contoh nyata: Ollama pernah menunjuk
localhost padahal cloud).

---

## 7. Selesaikan Technical Debt Fondasi Sebelum Fitur Baru

Prinsip: **bangun kemampuan dulu, visualisasi terakhir. Selesaikan debt fondasi
sebelum integrasi eksternal.**

- OAuth YouTube (identitas) → real analytics (data) → dashboard wiring
  (visualisasi). Urutan ini tidak boleh dibalik.
- Dashboard adalah permukaan **read-only** — ia memvisualisasikan data yang
  sudah benar, bukan driver implementasi.
- Dashboard **tidak pernah** memanggil API platform saat halaman dibuka
  (ADR-0009).

---

## 8. HITL: Manusia di Loop Adalah First-Class

Produksi konten tidak sepenuhnya otomatis. **Approve/Revise** (ADR-0010) adalah
permukaan write yang disengaja — Supervisor tetap satu-satunya penulis status.
Dashboard boleh menulis *hanya* lewat alur HITL yang di-scope.

---

## 9. Disiplin Roadmap & Governance

- **Documentation First, Code Second.**
- **Setiap perubahan arsitektur butuh ADR** — ADR immutable, buat yang baru.
- **Contracts v1.1 frozen** — perubahan butuh ADR + rebuild semua konsumen.
- **Freeze untuk stabilitas:** RC1 (AI Platform Foundation) dikunci; foundation
  hanya boleh berubah untuk *bug kritis, security, performance regression, atau
  pelanggaran ADR*.

---

## 10. Ringkasan Keputusan Utama

| # | Keputusan | Alasan | Referensi |
|---|-----------|--------|-----------|
| 1 | Media Intelligence Platform (bukan automation tool) | Aset berharga = knowledge graph, bukan script/video | Bagian 1 |
| 2 | Unit pembelajaran = eksperimen konten (keputusan × hasil) | Video = bukti, bukan aset | Bagian 2 |
| 3 | Worker hanya bicara ke Capability (BYOAI) | Bebas dari vendor lock-in | ADR-0011 |
| 4 | MediaEngine: standardisasi proses, bukan data | Anti-leaky-abstraction; type-safety per engine | ADR-0012 |
| 5 | Rule of Three sebelum ekstraksi | Hindari premature abstraction | Bagian 5 |
| 6 | Source of truth tunggal | Cegah duplikasi/divergensi | Bagian 6 |
| 7 | Debt fondasi dulu, fitur belakangan | Fondasi stabil = semua di atasnya stabil | Bagian 7 |
| 8 | HITL first-class | Manusia memegang kontrol kualitas | ADR-0010 |
| 9 | Governance: ADR + docs first + freeze | Disiplin dan traceability | Bagian 9 |

---

## 11. Komitmen

Setiap keputusan teknik di FYI Studio harus lolos uji: **"Apakah ini memperkuat
fondasi media intelligence platform, atau justru memperkenalkan ketergantungan
yang tidak perlu?"** Jika tidak jelas, kembali ke manifest ini sebelum
melanjutkan.

*Bangun fondasi yang bertahan melewati pergantian model AI.*
