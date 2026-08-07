---
id: phase2-2-planner-acceptance
title: "Phase 2.2 — Planner v1 Acceptance Criteria"
owner: "Founder + CTO"
status: "verified"
version: "1.0.0"
last_updated: "2026-08-07"
review_cycle: "per-milestone"
tags: [phase2, planner, content-brief, content-initiative, acceptance-criteria]
related_documents:
  - "PRODUCT_CONSTITUTION.md"
  - "FOUNDER_MANIFEST.md"
---

# Phase 2.2 — Planner v1 Acceptance Criteria

> **Status:** VERIFIED (2026-08-07). Semua 3 acceptance criteria terpenuhi dan
> dibuktikan live pada pipeline. Planner lahir dari kebutuhan produk yang
> terbukti, bukan keputusan arsitektur.

---

## 1. Konteks

Phase 2.1 membuktikan bahwa **Content Brief (Business Artifact) mampu menggerakkan
pipeline** (Research → Script → Media → Publishing). Pertanyaan kini berubah
menjadi: **"Siapa yang menghasilkan Brief?"**

Planner lahir dari **kebutuhan implementasi yang terbukti**, bukan dari desain.
Ini pertama kalinya Planner benar-benar lahir dari kebutuhan nyata, sesuai prinsip
RC1.

---

## 2. Scope (apa yang HARUS dikerjakan)

Planner v1 melakukan **persis satu hal**:

```
Content Initiative
        │
        ▼
Content Brief
```

Planner v1 **TIDAK** melakukan:
- memilih model terbaik
- scheduling
- membuat kalender
- A/B testing
- membuat beberapa Brief sekaligus
- mengoptimasi biaya
- belajar / mengambil keputusan otonom

Semua itu **belum**. Ini hanya membuktikan: Business Actor → Business Artifact.

---

## 3. Acceptance Criteria (Definition of Done)

Planner dinyatakan **selesai** hanya jika **ketiga** kondisi berikut terpenuhi:

| # | Kriteria | Verifikasi |
|---|----------|-----------|
| **AC-1** | Founder hanya memberikan **Content Initiative**. | Input ke job = Content Initiative (bukan Brief yang sudah jadi). |
| **AC-2** | Planner menghasilkan **Content Brief yang valid** sesuai bahasa bisnis Product Constitution §5. | `parseContentBrief` menerima output Planner (7 field terpenuhi). |
| **AC-3** | Pipeline **Research → Script → Media → Publishing** berjalan **tanpa perubahan berarti** dibanding Phase 2.1. | Jalur yang sama seperti seed-brief-job, hanya sumber Brief berubah dari manual → Planner. |

> **Penegasan:** Planner dianggap selesai bukan ketika Worker berhasil dibuat,
> tetapi ketika ketiga syarat ini terpenuhi. Planner lahir karena kebutuhan
> produk, bukan keputusan arsitektur.

---

## 4. Alur yang Dibuktikan

```
Founder
        │
        ▼
Content Initiative
        │
        ▼
Planner
        │
        ▼
Content Brief
        │
        ▼
Research
        ▼
Script
        ▼
Media
        ▼
Publishing
```

Inilah **end-to-end pertama FYI Studio** yang benar-benar mengikuti
Product Constitution.

---

## 5. Catatan

- Tidak ada perubahan kontrak (v1.1 frozen).
- Tidak ada perubahan RC1 foundation.
- Planner = System Actor `Planner` (bukan `Planner AI`) — implementasi saat ini
  boleh memakai AI via ModelGate, tetapi identitasnya adalah fungsi bisnis Planner.
