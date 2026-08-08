---
id: phase2-5-root-cause-report
title: "Phase 2.5 — Root Cause Report (P-1 Title, P-2 Duration, P-3 Distribution)"
status: "evidence"
created: "2026-08-08"
tags: [phase2, content-quality, root-cause, duration, title, evidence-first]
---

# Phase 2.5 — Root Cause Report

## P-1 TITLE

**Observed:** Script output tidak pernah menyertakan `title`. Batch 1 (Phase 2.4) menemukan title missing 9/9. Script worker hanya menghasilkan `script`, `scenes`, `hook`, `narration`.

**Root Cause:** Script worker meminta LLM mengembalikan JSON dengan keys `script/scenes/hook/narration` — `title` tidak pernah diminta, tidak di-parse, tidak di-output. Title bukan bagian dari output Script/Content Specification.

**Fix:** Extend output Script worker agar minimal menghasilkan `title` + `hook` + `script/narration`. Prompt diminta mengembalikan `title` (compelling, non-generic, aligned dengan Channel DNA + Content Brief). `title` di-parse, di-output, dan diteruskan ke Video worker (overlay) via `input_mapping`. Tidak ada Business Artifact baru, tidak ada worker baru.

**Evidence (fresh run):**
- Facts: `title: "Why the Ocean Is Salty: The Hidden Balance That Keeps It That Way"` — sesuai Channel (netral, edukatif).
- Sports: `title: "ENDRIK: The 18-Year-Old Who Owns the Spotlight"` — sesuai Channel (hype, momentum).
- `hook` hadir di kedua output.

## P-2 DURATION

**Observed:** Voice duration dan video duration mismatch 9/9 di Batch 1.

**Root Cause (dua lapis):**
1. **Tidak ada target duration numerik.** Channel `production_preferences.duration` adalah *string range* ('8-12 min'/'1-3 min') yang tidak pernah di-resolve ke angka. Content Initiative/Brief constraints kosong untuk duration. Jadi tidak ada "source of truth" durasi yang mengalir.
2. **Voice melaporkan durasi ESTIMASI (bytes/sample-rate), video melaporkan durasi AKTUAL (ffprobe)** — dua metode berbeda pada file audio yang SAMA → mismatch. Ini artefak pengukuran, bukan video yang benar-benar beda dari audio.

**Fix (bukan hard-code trim):**
- **Source of truth:** `production_preferences.duration_seconds` (angka) di Channel DNA. `assembleContext` me-resolve-nya ke `target_duration_seconds` (prefer `duration_seconds`, fallback parse range midpoint). Mengalir: Channel → Script (guideline) → Video (canvas sizing).
- **Voice:** laporkan durasi AKTUAL via ffprobe (metode sama seperti video) → voice.duration == video.duration secara natural.
- **Video:** laporkan durasi AKTUAL output via ffprobe. Background loop = `max(target, audio)` + `-shortest` → video selalu = durasi audio penuh, **tidak pernah memotong narasi**. Target adalah guideline script, bukan hard-cap video.

**Evidence (fresh run):**
- Facts: voice 261s == video 261s ✅ (target 600s, narasi 261s — video tidak dipaksa 600s).
- Sports: voice 143s == video 143s ✅ (target 120s, narasi 143s — video tidak memotong narasi).

## P-3 DISTRIBUTION COMPONENTS

**Observed:** thumbnail missing 9/9, caption missing 9/9, description missing 9/9 (Phase 2.4).

**Pattern:** Semua komponen distribusi (thumbnail/caption/description) tidak diproduksi oleh pipeline saat ini. Ini bukan bug — ini **missing capability** yang belum ada worker-nya.

**Current decision:** JANGAN membangun worker baru sekarang (sesuai brief Phase 2.5). Title ditangani (P-1). Thumbnail/caption/description didokumentasikan sebagai kandidat, ditentukan setelah production correctness beres.

**Future candidate (untuk milestone berikutnya, setelah correctness):**
- **Thumbnail:** butuh visual generation (image engine) + Channel visual_identity. Kandidat capability `image:thumbnail`.
- **Caption:** butuh teks pendek platform-aware (YouTube/TikTok). Kandidat capability `text:caption`.
- **Description:** butuh teks panjang + metadata (tags, links). Kandidat capability `text:description`.
- Semua harus tunduk ADR-0011 (capability-only, vendor via adapter).

---

## Acceptance Criteria — Status

| AC | Status | Evidence |
|----|--------|----------|
| AC-1 Script output punya title+hook+narration sesuai Channel+Brief | ✅ | Facts + Sports fresh run |
| AC-2 Target duration satu source of truth (Channel→Video) | ✅ | `production_preferences.duration_seconds` → `target_duration_seconds` |
| AC-3 Voice & video duration dalam tolerance eksplisit | ✅ | voice==video (261==261, 143==143) |
| AC-4 Facts & Sports format/orientation sesuai Channel | ✅ | Facts 1920x1080, Sports 1080x1920 |
| AC-5 Fresh run Facts + Sports lewat pipeline | ✅ | 2 fresh run COMPLETED |
| AC-6 No regression Publishing-aware v1 | ✅ | publish 39 tests pass |
| AC-7 Tests + typecheck + build hijau | ✅ | 149 tests, typecheck 0, build 0 |

## Prinsip
CORRECTNESS → CONSISTENCY → COMPLETENESS → SCALE.
Phase 2.5 menyelesaikan CORRECTNESS (duration) + sebagian CONSISTENCY (title/hook). COMPLETENESS (thumbnail/caption/description) ditunda ke milestone berikutnya.
