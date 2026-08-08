---
id: phase2-6-content-package-design
title: "Phase 2.6 — Content Package Completeness (Design from Evidence)"
status: "design"
created: "2026-08-08"
tags: [phase2, content-package, design, ownership, capability, evidence-first]
---

# Phase 2.6 — Content Package Completeness

Tujuan: mengubah output produksi dari `Script + Voice + Subtitle + Video` menjadi
**content package siap distribusi**. Tahap ini adalah **DESIGN FROM EVIDENCE** —
belum implementasi penuh. Semua keputusan berbasis evidence Phase 2.4 + 2.5.

---

## 1. VALIDASI TITLE (dua fungsi)

Evidence dari investigasi kode:

- **A. Creative/content usage** — title dipakai sebagai overlay video. ✅ Terbukti
  (Phase 2.5: video worker menerima `title` via `input_mapping`, di-render sebagai
  drawtext overlay).
- **B. Publishing metadata** — title dipakai sebagai judul upload platform.
  `buildUploadMetadata` (packages/publish/src/publish.ts:41-49) **sudah** membaca
  `artifacts.script.title` → title tersedia sebagai metadata platform. ✅ Sebagian.

**Gap yang ditemukan (evidence):**
1. `buildPublishIntent` (packages/publish/src/channel-target.ts:81-100) **tidak**
   menyertakan `title`/`hook` dalam Publish Intent — intent hanya punya
   `channel_id, content_brief_id, video_artifact, platform, social_account_id, intent`.
2. `buildUploadMetadata.description` = `research.summary` — bukan caption/description
   yang proper, dan tidak Channel-aware.
3. `hook` tidak diteruskan ke Publishing sama sekali.

**Keputusan:** Title sudah benar secara alur (Script → Video → Publishing). Yang
kurang adalah **meneruskan title + hook ke Publish Intent** dan **mengganti
description generik** — ini perbaikan alur, **bukan Title Worker baru**.

---

## 2. PETAKAN CONTENT PACKAGE

```
CONTENT PACKAGE
├── Video          (ada — video-real)
├── Title          (ada — script-real, Phase 2.5)
├── Hook           (ada — script-real, Phase 2.5)
├── Thumbnail      (MISSING — belum ada producer)
├── Caption        (MISSING — belum ada producer)
├── Description    (MISSING — belum ada producer)
└── Platform-specific metadata (sebagian — publish.ts buildUploadMetadata)
```

Tidak ada Business Artifact baru, tidak ada state machine baru. Content Package
adalah **konsep** (kumpulan artifacts yang sudah ada + yang akan lahir), bukan
entitas DB baru.

---

## 3. ANALISIS OWNERSHIP (Rule of Three)

| Komponen | Natural owner | Kategori | Alasan (evidence) |
|----------|---------------|----------|-------------------|
| **Title** | Script worker | A. output existing Worker | Sudah dihasilkan script-real (Phase 2.5). |
| **Hook** | Script worker | A. output existing Worker | Sudah dihasilkan script-real (Phase 2.5). |
| **Caption** | Script worker | A. output existing Worker | Text generation, satu capability dengan script. |
| **Description** | Script worker | A. output existing Worker | Text generation, satu capability dengan script. |
| **Thumbnail** | — | B. capability baru | Image generation/compositing — BUKAN text. |

**Keputusan kunci:** Caption + Description adalah **dua output dari capability
text generation yang SAMA** (Script worker), bukan dua worker terpisah. Memecahnya
menjadi worker terpisah tidak punya alasan bisnis — keduanya diturunkan dari
Channel DNA + Brief + Script/Research + Publishing target.

**Thumbnail** adalah satu-satunya yang butuh capability baru (image), karena
jenis produksinya berbeda (visual, bukan teks).

---

## 4. CHANNEL DNA PROPAGATION

Distribution components harus diturunkan dari Channel DNA + Brief + Script/Research
+ Publishing target. Evidence Channel DNA sudah ada di `tenant_context.constraints`
(identity, brand_voice, visual_identity, production_preferences, publishing_strategy,
success_metrics, guardrails).

**Propagation map:**
```
Channel DNA (tenant_context.constraints)
   │
   ├──→ Script worker (sudah: brand_voice, visual_identity, production_preferences,
   │        success_metrics, guardrails di-inject ke prompt)
   │        → menghasilkan title, hook, script, narration
   │
   ├──→ Caption/Description (BARU, di Script worker)
   │        → diturunkan dari brand_voice + content_pillars + publishing target
   │
   └──→ Thumbnail (BARU, capability image)
            → diturunkan dari visual_identity (style, palette) + title + topic
```

Facts vs Sports harus menghasilkan caption/description/thumbnail yang BERBEDA
(educational/measured vs fast/hype) — sama seperti Research/Script/Video sudah
terbukti berbeda (Phase 2.3).

---

## 5. PLATFORM DIFFERENCE (Content Truth vs Platform Presentation)

**Keputusan:** Jangan duplikasi konten bisnis. Bedakan dua lapis:

- **CONTENT TRUTH** (satu, tidak berubah per platform): "What happened?" — fakta,
  angle, hook, narasi. Ini milik Content Brief + Script.
- **PLATFORM PRESENTATION** (bervariasi per platform): YouTube title, TikTok
  caption, Instagram caption, YouTube description, thumbnail, hashtags.

**Implikasi arsitektur:** Script worker menghasilkan **satu Content Truth** (title,
hook, script, narration) + **satu set presentation primitives** (caption, description)
yang kemudian **di-render per platform** di lapisan Publishing (adapter), bukan
di worker. Publishing adapter (YouTube/TikTok/Instagram) memilih presentasi yang
tepat dari primitives yang sama.

Ini menghindari duplikasi: satu content, banyak presentasi.

---

## 6. THUMBNAIL — capability investigation

**Input yang diperlukan:**
- Channel visual_identity (style, palette) — dari tenant_context
- Title (dari script)
- Topic / angle (dari brief)
- Resolution (dari production_preferences — horizontal/vertical)

**Output yang dihasilkan:** satu image asset (file:// pointer), mis. `thumbnail.png`.

**Hubungan dengan Video:** thumbnail adalah representasi statis dari video —
harus konsisten dengan visual identity + title yang sama.

**Hubungan dengan Channel Visual Identity:** thumbnail harus mengikuti
`visual_identity.style` + `palette` (Facts: clean/minimal/muted; Sports:
bold/high-contrast/dynamic).

**Hubungan dengan Content Brief:** thumbnail harus mencerminkan topic + angle.

**Jenis capability:** **image generation/editing** (bukan compositing video).
Ini capability baru `image:thumbnail`, via MediaEngine adapter (ADR-0011/0012),
bukan worker baru yang tahu vendor.

**Keputusan:** Dokumentasikan sebagai **proposal capability** — belum implementasi.
Rule of Three: belum ada 2-3 implementasi image yang memaksa abstraksi.

---

## 7. CAPTION + DESCRIPTION — satu capability

**Keputusan:** Caption dan description adalah **dua output dari capability text
generation yang sama** (Script worker), bukan dua capability/worker terpisah.

Alasan bisnis:
- Keduanya diturunkan dari sumber yang sama (Channel DNA + Brief + Script/Research).
- Perbedaannya hanya **panjang + platform presentation** (caption pendek untuk
  TikTok/Instagram, description panjang untuk YouTube).
- Memecahnya menjadi worker terpisah menambah worker tanpa menambah business
  responsibility.

**Rekomendasi:** Extend Script worker untuk menghasilkan `caption` + `description`
sebagai output tambahan (satu capability `text-synthesis:script:real`), lalu
Publishing adapter memilih presentasi per platform.

---

## 8. ACCEPTANCE CRITERIA (design output)

1. **Content Package map** — ✅ (Section 2)
2. **Ownership recommendation** — ✅ (Section 3)
3. **Capability recommendation** — ✅ (Section 3, 6, 7)
4. **Worker recommendation** — ✅ (Section 3, 6, 7)
5. **Platform presentation boundary** — ✅ (Section 5)
6. **Channel DNA propagation map** — ✅ (Section 4)
7. **Evidence untuk setiap keputusan** — ✅ (Section 1-7)
8. **Hal yang belum cukup evidence** — ⬇️ (Section 9)

---

## 9. HAL YANG BELUM CUKUP EVIDENCE

1. **Thumbnail engine** — belum ada image engine di @fyi/media. Perlu spike untuk
   menentukan apakah image generation (Replicate/Stable Diffusion) atau compositing
   (ffmpeg dari visual_identity) yang paling natural. **Belum diputuskan.**
2. **Caption/description format per platform** — belum ada contoh nyata output
   caption/description dari pipeline. Perlu 1-2 fresh run untuk melihat kualitas
   sebelum menetapkan format.
3. **Hashtags / platform-specific metadata** — belum ada evidence kebutuhan nyata.
   Ditunda sampai caption/description terbukti.
4. **Apakah caption/description perlu HITL approval** — belum ada evidence. Ditunda.

---

## 10. REKOMENDASI MILESTONE BERIKUTNYA

**Phase 2.7 (proposed): Content Package — Text Layer**
- Extend Script worker: tambah `caption` + `description` (satu capability text).
- Perbaiki alur: `buildPublishIntent` sertakan `title` + `hook`; `buildUploadMetadata`
  pakai caption/description Channel-aware (bukan research.summary).
- Fresh run Facts + Sports untuk memvalidasi caption/description berbeda per Channel.
- **Thumbnail ditunda** sampai text layer terbukti (Rule of Three: satu image
  capability belum cukup untuk abstraksi).

**Prinsip:** CORRECTNESS → CONSISTENCY → COMPLETENESS → SCALE.
Phase 2.5 selesai CORRECTNESS (duration) + CONSISTENCY (title/hook).
Phase 2.7 menuju COMPLETENESS (caption/description). Thumbnail = COMPLETENESS lanjut.
