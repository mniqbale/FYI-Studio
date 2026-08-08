---
id: phase2-4-quality-report
title: "Phase 2.4 — Content Quality Validation Report (Batch 1)"
status: "evidence"
created: "2026-08-08"
tags: [phase2, content-quality, batch, evidence-first, findings]
related_documents:
  - ".ai/planning/phase2-4-content-quality-validation.md"
---

# Phase 2.4 — Content Quality Validation Report (Batch 1)

> **Metode:** 10 Content Initiatives (5 Facts + 5 Sports) dijalankan lewat
> pipeline channel-aware-v1 yang SAMA. Variasi output berasal dari Channel DNA +
> Initiative + Brief. Hasil: **9 COMPLETED, 1 FAILED** (planner JSON error).

---

## 1. Ringkasan Batch

| # | Channel | Topic | Status | Video | Durasi Video | Voice Dur |
|---|---------|-------|--------|-------|--------------|-----------|
| 1 | Facts | why the sky is blue | ✅ | 1920x1080 | 187s | 516s |
| 2 | Facts | how the printing press changed the world | ✅ | 1920x1080 | 444s | 1225s |
| 3 | Facts | the science of sleep and dreams | ✅ | 1920x1080 | ~424s | 1168s |
| 4 | Facts | how vaccines actually work | ❌ FAIL | — | — | — |
| 5 | Facts | why the ocean is salty | ✅ | 1920x1080 | 203s | 559s |
| 6 | Sports | the biggest transfer of the summer | ✅ | 1080x1920 | 96s | 266s |
| 7 | Sports | match recap | ✅ | 1080x1920 | 71s | 195s |
| 8 | Sports | a rising star to watch | ✅ | 1080x1920 | 31s | 85s |
| 9 | Sports | the most dramatic comeback | ✅ | 1080x1920 | 135s | 372s |
| 10 | Sports | transfer deadline day chaos | ✅ | 1080x1920 | 128s | 353s |

**AC-2 (batch, bukan demo):** ✅ TERBUKTI — 9 output nyata dari satu pipeline.

---

## 2. Content Package — Komponen yang Tersedia

| Komponen | Status | Catatan |
|----------|--------|---------|
| Content Initiative | ✅ | tersedia |
| Content Brief | ✅ | tersedia (topic, angle, audience, success_metric) |
| Research | ✅ | summary + sources + key_findings |
| Script | ✅ | hook, scenes, script, narration |
| Voice | ✅ | espeak-ng, audio_path, duration |
| Subtitle | ✅ | cues, subtitle_text, srt_path |
| Video | ✅ | mp4, resolution, duration |
| Publishing intent/target | ✅ | dry-run (dari task sebelumnya) |
| **Title** | ❌ | **script TIDAK punya field title** |
| **Hook** | ⚠️ | ada di script.hook, tapi tidak di-extract ke metadata |
| **Thumbnail** | ❌ | **tidak ada** |
| **Caption** | ❌ | **tidak ada** |
| **Description** | ⚠️ | hanya research.summary, tidak ada description khusus |
| **Platform metadata** | ❌ | **tidak ada** (tags, category, etc.) |

---

## 3. Quality Findings (Evidence-First)

### Observed (ditemukan pada output)

**O-1. Script tidak menghasilkan `title`.**
Semua 9 script punya keys `[hook, scenes, script, narration]` — TIDAK ada
`title`. Video worker menerima `title: undefined` → fallback "FYI Studio Video".

**O-2. Durasi Voice vs Video mismatch besar.**
Contoh: printing press voice 1225s vs video 444s; sky voice 516s vs video 187s.
Video jauh lebih pendek dari narasi audio. Ini menunjukkan video composer
memotong/melewatkan sebagian audio, atau durasi dihitung berbeda.

**O-3. Tidak ada Thumbnail, Caption, Description, platform metadata.**
Semua output tidak punya komponen distribusi ini.

**O-4. 1 job FAILED di planner: "Planner model did not return valid JSON".**
Job vaccines (Facts) gagal di step 0 karena LLM tidak mengembalikan JSON valid.

**O-5. Research summary kadang kosong.**
Beberapa output (transfer, rising star) punya `research.summary` kosong,
walaupun research_brief ada.

### Pattern (muncul berulang)

**P-1. `title` hilang di SEMUA 9 output (9/9).**
Ini bukan kebetulan — script worker tidak pernah menghasilkan title.

**P-2. Voice/Video durasi mismatch di SEMUA output (9/9).**
Konsisten: video selalu jauh lebih pendek dari voice.

**P-3. Thumbnail/Caption/Description hilang di SEMUA output (9/9).**
Konsisten — bukan komponen yang diproduksi pipeline.

**P-4. Script cenderung generic untuk beberapa topik.**
Hook Sports sangat formulaik ("THIS IS THE BIGGEST...", "DEADLINE DAY. CHAOS.").
Perlu dicek apakah ini sesuai DNA atau terlalu template.

### Hypothesis (dugaan penyebab)

**H-1 (title):** Script worker diminta return JSON dengan keys
`[script, scenes, hook, narration]` — `title` tidak pernah diminta. Ini
**missing capability** (bukan bug) — prompt/contract script tidak mencakup title.

**H-2 (durasi mismatch):** Video composer (ffmpeg) mungkin menggunakan
`narration_wav` tapi durasi video dihitung dari subtitle/visual, bukan dari
audio penuh. Perlu investigasi apakah audio terpotong atau hanya metadata durasi
yang salah.

**H-3 (thumbnail/caption/description):** Ini **missing capability** — tidak ada
worker/step yang memproduksinya. Bukan bug.

**H-4 (planner JSON error):** LLM kadang tidak mengembalikan JSON valid. Ini
**bug/robustness** — worker tidak retry/repair JSON. Muncul 1 kali di batch ini
(1/10), belum memenuhi Rule of Three.

### Decision Candidate (perubahan yang mungkin diperlukan)

| Kandidat | Jenis | Evidence | Rule of Three? |
|----------|-------|----------|----------------|
| Script worker hasilkan `title` | Missing capability | 9/9 hilang | ✅ (≥3) |
| Video composer perbaiki durasi | Bug/quality | 9/9 mismatch | ✅ (≥3) |
| Thumbnail/Caption/Description worker | Missing capability | 9/9 hilang | ✅ (≥3) |
| Planner JSON repair/retry | Bug/robustness | 1/10 | ❌ (belum) |

---

## 4. Evaluasi 5 Quality Dimensions

| Dimensi | Verdict | Bukti |
|---------|---------|-------|
| **A. Channel Fit** | ✅ Kuat | Facts netral-edukatif vs Sports hype-cepat — DNA jelas membedakan output |
| **B. Content Quality** | ⚠️ Campur | Research + script koheren, tapi title hilang & beberapa summary kosong |
| **C. Production Quality** | ❌ Gagal | Durasi voice/video mismatch 9/9; audio espeak-ng robotik |
| **D. Platform Readiness** | ❌ Gagal | Tidak ada title/thumbnail/caption/description/metadata |
| **E. Human Publishability** | ❌ Belum | Tidak ada output yang siap publish tanpa komponen distribusi |

---

## 5. Human Review Pack (Founder Verdict)

Untuk setiap output, Founder menilai: **Publish / Revise / Reject**.

| # | Channel | Topic | Channel Fit | Content | Production | Platform | **Verdict** |
|---|---------|-------|-------------|---------|------------|----------|-------------|
| 1 | Facts | sky is blue | ✅ | ✅ | ❌ | ❌ | **Revise** |
| 2 | Facts | printing press | ✅ | ✅ | ❌ | ❌ | **Revise** |
| 3 | Facts | sleep & dreams | ✅ | ✅ | ❌ | ❌ | **Revise** |
| 4 | Facts | vaccines | — | — | — | — | **Reject** (failed) |
| 5 | Facts | ocean salty | ✅ | ✅ | ❌ | ❌ | **Revise** |
| 6 | Sports | biggest transfer | ✅ | ✅ | ❌ | ❌ | **Revise** |
| 7 | Sports | match recap | ✅ | ✅ | ❌ | ❌ | **Revise** |
| 8 | Sports | rising star | ✅ | ⚠️ | ❌ | ❌ | **Revise** |
| 9 | Sports | comeback | ✅ | ✅ | ❌ | ❌ | **Revise** |
| 10 | Sports | deadline chaos | ✅ | ✅ | ❌ | ❌ | **Revise** |

> **Catatan:** Verdict di atas adalah **rekomendasi awal** berdasarkan evidence
> otomatis. Founder adalah final evaluator — silakan override per output.

---

## 6. Jawaban Success Criteria

| AC | Jawaban |
|----|---------|
| AC-1 (DNA bedakan output) | ✅ **YA** — Facts vs Sports jelas berbeda (tone, format, durasi) |
| AC-2 (batch) | ✅ **YA** — 9 output dari satu pipeline |
| AC-3 (komponen publishable) | Script + research + video + voice + subtitle; **title/thumbnail/caption/description belum** |
| AC-4 (kualitas gagal) | Durasi mismatch, title hilang, komponen distribusi hilang |
| AC-5 (bug vs capability) | Durasi = bug; title/thumbnail/caption = missing capability; planner JSON = bug robustness |
| AC-6 (pola ≥3 kali) | **YA** — title hilang (9), durasi mismatch (9), komponen distribusi hilang (9) |

---

## 7. Rekomendasi Milestone Berikutnya

Berdasarkan evidence, prioritas (bukan menambah worker dulu):

1. **Perbaiki Script worker** untuk menghasilkan `title` (dan extract hook ke
   metadata) — ini missing capability yang paling berdampak, 9/9.
2. **Investigasi durasi voice/video mismatch** — apakah audio terpotong atau
   metadata salah. Ini bug produksi yang membuat video tidak layak.
3. **Putuskan Thumbnail/Caption/Description** — apakah jadi worker baru atau
   cukup prompt/config. Rule of Three terpenuhi (9/9), jadi layak jadi kandidat
   evolution — TAPI tunggu keputusan Founder.
4. **Planner JSON robustness** — 1/10, belum Rule of Three. Catat, jangan
   bangun dulu.

> **Prinsip:** Jangan mengubah konstitusi/ADR hanya karena batch ini. Evidence
> menunjukkan gap di **produksi** (script/video), bukan di **konstitusi**.
> Channel DNA terbukti bekerja. Yang gagal adalah komponen output, bukan model
> Channel.
