---
id: lanjutkan-proposal
title: "LANJUTKAN_PROPOSAL — Channel-aware Production Pipeline v1"
status: "proposed"
created: "2026-08-07"
review_cycle: "per-milestone"
tags: [phase2, channel, business-unit, pipeline, build-validate-learn, lanjutkan]
---

# LANJUTKAN_PROPOSAL

> **Cara pakai:** Besok buka file ini, beri arahan lanjut (setuju / ubah / mulai
> eksekusi). Proposal ini **belum dieksekusi** — hanya didokumentasikan.

---

## 1. Konteks & Tujuan

Fokus Phase 2 bergeser dari **Design → Design → Design** menjadi
**Build → Validate → Learn**. Konstitusi (Product + Channel) dianggap **cukup**;
setiap fitur baru harus **memvalidasi** konstitusi, bukan memperluasnya.

**Tujuan milestone ini:** membuktikan bahwa **Business Unit (Channel) benar-benar
dapat menggerakkan seluruh pipeline produksi** — bukan sekadar dokumen.

**Objective:** bangun **Channel-aware Production Pipeline v1** — seluruh pipeline
bekerja berdasarkan sebuah Channel (Business Unit), bukan hanya Content
Initiative atau Content Brief.

**Hipotesis yang dibuktikan:**
> Business Unit bukan sekadar dokumen. Business Unit benar-benar mampu mengubah
> perilaku seluruh pipeline. Jika terbukti, kita tidak lagi punya "video
> generator", melainkan **Brand-aware Content Operating System**.

---

## 2. Temuan Investigasi (dasar desain)

1. **`assembleContext(tenant_id)`** (`packages/knowledge/src/context-assembly.ts`)
   sudah menyuntikkan DNA ke TaskEnvelope: `brand_voice`, `language`,
   `style_guide`, `forbidden_terms`, `constraints`, `verified_facts`, `memory`.
   Ini **sudah** membuat Research & Script peka Channel.
2. **Tapi hanya sebagian DNA yang mengalir.** CHANNEL_CONSTITUTION punya 9
   dimensi; yang benar-benar diekspos eksplisit baru sebagian. `content_pillars`,
   `visual_identity`, `production_preferences`, `publishing_strategy`,
   `success_metrics` belum di-resolve secara eksplisit ke `AssembledContext`.
3. **Video worker sudah membaca `payload.resolution`**
   (`workers/video-real/src/index.ts:71`). Jadi AC-6 tinggal menghubungkan
   `production_preferences.resolution` dari Business Unit ke payload — bukan
   fitur baru, hanya alur konteks.
4. **Schema tidak perlu diubah** — `TenantContext.constraints` adalah `Json?`
   fleksibel (`packages/database/prisma/schema.prisma:141`). Business Unit =
   satu baris `tenant_context` (per brief, file JSON/manual object pun boleh).

---

## 3. Acceptance Criteria (dari brief)

| AC | Deskripsi |
|----|-----------|
| AC-1 | Founder dapat membuat satu Business Unit sederhana (file JSON/YAML/manual object boleh) |
| AC-2 | Content Initiative mengetahui Business Unit asalnya |
| AC-3 | Planner menghasilkan Brief dengan konteks Business Unit |
| AC-4 | Research menghasilkan hasil BERBEDA jika Business Unit BERBEDA (topik sama) |
| AC-5 | Script ikut berubah mengikuti Business Unit |
| AC-6 | Video Worker menerima Production Preference dari Business Unit (mis. 9:16 / 16:9; cukup log/metadata, belum perlu rendering sempurna) |

Contoh alur AC-4:
- Business Unit A `Just FYI Facts` → Research: netral, edukatif
- Business Unit B `Just FYI Sports` → Research: cepat, hype, momentum
- Walaupun topiknya SAMA.

---

## 4. Pekerjaan yang Diusulkan (6 langkah, urut paling grounded)

**1. Definisi Business Unit (AC-1) — file konfigurasi kecil**
Buat representasi Business Unit minimal (object/JSON di seed) berisi 9 dimensi
DNA. Dua contoh untuk AC-4: `Just FYI Facts` (netral-edukatif) dan
`Just FYI Sports` (cepat-hype). Ditulis ke `tenant_context` yang sudah ada.

**2. Perluas `assembleContext()` untuk me-resolve DNA penuh (AC-3,4,5)**
Tambah dimensi yang belum diekspos eksplisit (`content_pillars`,
`visual_identity`, `production_preferences`, `publishing_strategy`,
`success_metrics`, `guardrails`) dari `constraints` JSON — **tanpa schema baru,
tanpa JSON.stringify** (Prisma Json → raw object). Ini inti: membuat
`AssembledContext` memuat seluruh DNA yang konstitusi klaim.

**3. Research worker: suntikkan DNA penuh ke prompt (AC-4)**
Perpanjang `buildResearchSystemPrompt` agar memuat dimensi baru (voice, pillars,
tone/angle). Bukti AC-4: Business Unit berbeda → Research berbeda, topik sama.

**4. Script worker: sama, DNA penuh (AC-5)**
Perpanjang `buildScriptSystemPrompt` agar script mengikuti DNA (voice + pillars +
angle + production pref).

**5. Video worker: terima `production_preferences` dari Business Unit (AC-6)**
Resolve `production_preferences` (vertical 9:16 / horizontal 16:9) dari Business
Unit → map ke `payload.resolution` yang sudah dibaca video worker. Awalnya cukup
log/metadata.

**6. Seed + bukti end-to-end**
Seed `Just FYI Facts` & `Just FYI Sports` dengan topik yang SAMA; jalankan
pipeline untuk keduanya; verifikasi Research & Script berbeda (AC-4, AC-5) dan
Video menerima `production_preferences` (AC-6). Catat observasi bila konstitusi
kurang vocabulary (tanpa mengubahnya).

---

## 5. Yang TIDAK Boleh Disentuh (dari brief)

- ❌ Jangan redesign Product Constitution.
- ❌ Jangan redesign Channel Constitution.
- ❌ Jangan membuat ADR baru.
- ❌ Jangan membuat abstraksi baru.
- ❌ Jangan membuat Worker baru.
- ❌ Tanpa UI / database baru / dashboard / multi-user / multi-channel.
- ✅ Gunakan fondasi yang sudah ada.

**Instruksi Founder (observasi, bukan perubahan):**
> "Jika selama implementasi kamu menemukan bahwa Product Constitution atau
> Channel Constitution masih kurang, jangan langsung mengubahnya. Catat sebagai
> observasi. Kita hanya akan mengubah konstitusi jika implementasi nyata
> membuktikan ada vocabulary yang benar-benar kurang."

---

## 6. Status Eksekusi

| Langkah | Status |
|---------|--------|
| 1. Definisi Business Unit (AC-1) | ✅ Selesai |
| 2. Perluas assembleContext (AC-3,4,5) | ✅ Selesai |
| 3. Research worker DNA penuh (AC-4) | ✅ Selesai |
| 4. Script worker DNA penuh (AC-5) | ✅ Selesai |
| 5. Video worker production_preferences (AC-6) | ✅ Selesai |
| 6. Seed + bukti end-to-end | ✅ Selesai |

**Semua 6 AC terverifikasi live (commit `577fc3f`).** Konstitusi: tidak ada
perubahan. ADR: tidak ada perubahan. Worker baru: tidak ada.

### Observasi Konstitusi (dicatat, TIDAK diubah — per instruksi Founder)
- **Tidak ada vocabulary yang terbukti kurang.** 9 dimensi DNA Channel cukup
  untuk menggerakkan Research, Script, dan Video. Business Unit terbukti
  mengubah perilaku pipeline tanpa perlu menambah konstitusi.
- **Economics tetap ditunda** — tidak muncul sebagai kebutuhan selama
  implementasi ini.

---

*Catatan: Proposal ini menggantikan file `brief-hermes-selanjutnya.md` sebagai
acuan task berikutnya. File tersebut masih berisi task CHANNEL_CONSTITUTION lama
yang sudah selesai (commit `cfcf0f6`).*
