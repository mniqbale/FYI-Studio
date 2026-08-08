---
id: phase2-4-content-quality-validation
title: "Phase 2.4 — Content Quality Validation"
owner: "Founder + CTO"
status: "proposed"
version: "0.1.0"
last_updated: "2026-08-08"
review_cycle: "per-milestone"
tags: [phase2, content-quality, validation, batch, evidence-first, publishable]
related_documents:
  - "PRODUCT_CONSTITUTION.md"
  - "CHANNEL_CONSTITUTION.md"
  - "LANJUTKAN_PROPOSAL.md"
---

# Phase 2.4 — Content Quality Validation

> **Prinsip:** Build → Produce → Inspect → Validate → Learn. Kita belajar dari
> konten nyata, bukan dari arsitektur. Evidence-first: jangan mengubah
> konstitusi/ADR hanya karena satu contoh buruk.

---

## 1. Tujuan

Menjawab pertanyaan yang berbeda dari sebelumnya:

> **"Apakah FYI Studio mampu menghasilkan konten yang secara nyata layak
> dipublikasikan untuk sebuah Channel tertentu?"**

Bukan lagi: apakah pipeline berjalan / worker selesai / artifact terbentuk /
job COMPLETED. Yang diuji adalah **kualitas output sebagai produk**.

---

## 2. Acceptance Criteria

Milestone dianggap berhasil jika kita bisa menjawab secara nyata:

| # | Pertanyaan |
|---|-----------|
| AC-1 | Apakah Channel DNA benar-benar menghasilkan perbedaan output antara Facts dan Sports? |
| AC-2 | Apakah pipeline mampu menghasilkan **batch** konten (10), bukan hanya satu demo? |
| AC-3 | Apa saja komponen yang membuat sebuah output terasa **publishable**? |
| AC-4 | Apa saja kualitas yang masih **gagal**? |
| AC-5 | Mana gap yang merupakan **bug**, mana **missing capability**, mana hanya butuh **prompt/configuration**? |
| AC-6 | Apakah ada pola masalah yang muncul **minimal 3 kali** sehingga layak jadi kandidat Worker/Task/Capability baru? |

---

## 3. Validation Plan

### 3.1 Batch
- **10 content outputs** (putaran pertama): **5 Facts + 5 Sports**.
- Gunakan **pipeline yang sama** (channel-aware-v1). Variasi output datang dari
  Channel DNA + Content Initiative + Content Brief — bukan workflow berbeda.
- Tidak ada public publishing massal. Gunakan scheduled/dry-run yang sudah ada.

### 3.2 Content Package yang diperiksa per output
| Komponen | Status |
|----------|--------|
| Content Initiative | ✅ tersedia |
| Content Brief | ✅ tersedia |
| Research | ✅ tersedia |
| Script | ✅ tersedia |
| Voice | ✅ tersedia |
| Subtitle | ✅ tersedia |
| Video | ✅ tersedia |
| Publishing intent / target | ✅ tersedia (dry-run) |
| **Title** | ⚠️ perlu dicek (dari script?) |
| **Hook** | ⚠️ perlu dicek (dari script?) |
| **Thumbnail** | ❌ belum tersedia |
| **Caption** | ❌ belum tersedia |
| **Description** | ⚠️ perlu dicek |
| **Platform-specific metadata** | ❌ belum tersedia |

> Item yang belum tersedia dicatat sebagai **gap produk nyata** — bukan otomatis
> dibuatkan worker baru.

### 3.3 Quality Dimensions (evaluation framework)
| Dimensi | Pertanyaan |
|---------|-----------|
| **A. Channel Fit** | Apakah konten benar-benar sesuai DNA Channel? |
| **B. Content Quality** | Apakah topic, research, script, narasi masuk akal dan bernilai? |
| **C. Production Quality** | Apakah audio, subtitle, visual, durasi, format layak? |
| **D. Platform Readiness** | Apakah output punya semua komponen untuk benar-benar dipublikasikan? |
| **E. Human Publishability** | "Would I publish this?" — Founder/Human sebagai final evaluator |

### 3.4 Founder Verdict (per output)
- **Publish** / **Revise** / **Reject**
- Gunakan mekanisme HITL yang sudah ada — jangan bangun approval baru.

---

## 4. Definition of Publishable Content

Sebuah output dianggap **publishable** jika memenuhi SEMUA:

1. **Channel Fit** — selaras DNA Channel (voice, audience, pillars, guardrails).
2. **Content Quality** — research akurat, script koheren, narasi bernilai.
3. **Production Quality** — audio jelas, subtitle terbaca, video layak, durasi
   sesuai production_preferences, format benar.
4. **Platform Readiness** — punya Title, Hook, Thumbnail, Caption, Description,
   metadata platform yang dibutuhkan.
5. **Human Publishability** — Founder menjawab "Ya, aku publish ini tanpa malu."

> Jika salah satu gagal → output **belum publishable** (Revise/Reject).

---

## 5. Evidence-First (pisahkan dengan jelas)

| Kategori | Definisi |
|----------|----------|
| **Observed** | Benar-benar ditemukan pada output. |
| **Pattern** | Muncul berulang (≥2–3 kali). |
| **Hypothesis** | Dugaan penyebab. |
| **Decision Candidate** | Perubahan arsitektur/product yang mungkin diperlukan. |

> Jangan mengubah konstitusi hanya karena satu contoh buruk. Rule of Three
> berlaku: masalah yang sama muncul ≥3 kali + butuh fungsi bisnis tersendiri →
> dokumentasikan sebagai kandidat evolution/ADR.

---

## 6. Yang TIDAK Dilakukan

- ❌ Tidak membuat quality-real worker / AI quality agent dulu.
- ❌ Tidak menambah Worker / Business Artifact / state machine / ADR baru
  hanya untuk membuat framework terlihat lengkap.
- ❌ Tidak mengubah Product/Channel Constitution, ADR frozen.
- ❌ Tidak public publishing massal.
- ✅ Coding hanya jika diperlukan untuk menjalankan validation.

---

## 7. Deliverables

**Sebelum coding:** acceptance criteria (ini), validation plan (ini), definition
of publishable content (ini).

**Setelah validation:**
- Batch evidence.
- Quality findings.
- Missing capability report.
- Recommendation untuk milestone berikutnya.
