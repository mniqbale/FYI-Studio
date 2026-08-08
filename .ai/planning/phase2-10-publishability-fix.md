---
id: phase2-10-publishability-fix
title: "Phase 2.10 — Publishability Fix (Natural Voice + Thumbnail Integration)"
status: "evidence"
created: "2026-08-08"
tags: [phase2, publishability, voice, thumbnail, mediaengine, evidence-first]
---

# Phase 2.10 — Publishability Fix

## Tujuan
Memperbaiki dua blocker yang terbukti di Batch 2 (Phase 2.9):
1. espeak-ng audio robot (10/10).
2. Thumbnail capability terbukti tapi belum masuk recipe (10/10).

Tidak ada worker baru, Business Artifact baru, atau perubahan Constitution/ADR.

---

## A. Activate Natural Voice (Replicate Kokoro-82M)

### Perubahan
- **model_policy.yaml:** tambah default `voice:tts` → `{ provider: replicate, model: kokoro-82m }`.
- **Worker tetap vendor-agnostic:** voice worker sudah resolve `voice:tts` via ModelGate
  (`gate.resolve('voice:tts', { scope })`), lalu `getVoiceEngine(provider, model)`.
  Tidak ada bypass ModelGate, tidak ada jalur khusus vendor.
- **Fallback eksplisit:** jika replicate tidak terhubung, `resolved.model` undefined →
  `getVoiceEngine(undefined, undefined)` → espeak-ng (fallback default).
- **Cost tercatat:** engine replicate melaporkan `cost_estimate` (~$0.0023/run) via
  MediaEngine outcome.
- **Duration correctness (Phase 2.5):** voice engine melaporkan durasi AKTUAL via
  ffprobe (shared `probeDuration`) — tetap konsisten dengan video.

### Evidence — Fresh run
- **Voice engine:** `espeak-ng / espeak-ng` (fallback) — **replicate TIDAK terhubung**
  karena `REPLICATE_API_TOKEN` tidak ada di `.env`/env.
- **Duration:** voice 271s == video 271s (Facts), voice 65s == video 65s (Sports) ✅.

**Blocker natural voice BELUM hilang** — integrasi arsitektur selesai, tapi butuh
`REPLICATE_API_TOKEN` + connect replicate provider untuk mengaktifkan Kokoro.

---

## B. Integrate Thumbnail

### Perubahan
- **Video worker** (existing, bukan worker baru) kini memproduksi thumbnail via
  thumbnail MediaEngine (`getThumbnailEngine('local','ffmpeg')` + `runMediaEngine`).
  Input: title + hook (dari script) + Channel `visual_identity` + resolution.
- **input_mapping:** video step kini menerima `hook` (selain title).
- **Output:** `video.thumbnail_path` + `new_references.thumbnail`.
- **buildPublishIntent:** kini membawa `thumbnail_artifact`.

### Evidence — Fresh run
- **Facts:** thumbnail `/tmp/fyi-studio/.../thumbnail.png`, center pixel `1d3888` (soft blue) ✅.
- **Sports:** thumbnail `/tmp/fyi-studio/.../thumbnail.png`, center pixel `0a0a0a` (black) ✅.
- **Visual direction berbeda** (Facts soft-blue vs Sports black) — sesuai Channel DNA.
- **Publish Intent:** `thumbnail_artifact` hadir ✅.

**Blocker thumbnail HILANG** — thumbnail sekarang tersedia di Content Package dan
Publishing Intent.

---

## C. Fresh Validation (1 Facts + 1 Sports)

| Check | Facts | Sports |
|-------|-------|--------|
| Natural voice | ❌ espeak-ng (replicate not connected) | ❌ espeak-ng |
| voice duration == video duration | ✅ 271==271 | ✅ 65==65 |
| Thumbnail tersedia | ✅ | ✅ |
| Thumbnail sesuai Channel | ✅ soft blue | ✅ black |
| title/hook/caption/description | ✅ | ✅ |
| ratio/resolution | ✅ 1920x1080 | ✅ 1080x1920 |
| Publish Intent bawa content package | ✅ (title/caption/desc/video/thumbnail) | ✅ |

---

## D. Regression

- **Tests:** 158 pass (platform 29, ai 7, media 23, publish 40, knowledge 9, dashboard 36, analytics 14).
- **typecheck:** exit 0.
- **build:** exit 0.
- **ADR-0011:** worker tetap capability-only, resolve via ModelGate, tidak ada vendor name leak.
- **ADR-0012:** thumbnail memakai MediaEngine abstraction yang sama (runMediaEngine).

---

## E. Laporan (STOP — jangan Batch 3)

### Apakah kedua blocker benar-benar hilang?
- **Thumbnail:** ✅ HILANG — terintegrasi, tersedia, sesuai Channel, dibawa ke Publish Intent.
- **Natural voice:** ❌ BELUM — integrasi arsitektur selesai (ModelGate default →
  replicate/kokoro), tapi `REPLICATE_API_TOKEN` tidak tersedia → fallback espeak-ng.

### Evidence output nyata
- Thumbnail: 2 PNG dihasilkan, warna sesuai Channel (Facts soft-blue, Sports black).
- Voice: espeak-ng (fallback), duration correctness terjaga.

### Blocker baru?
- **Tidak ada blocker baru.** Satu-satunya blocker tersisa adalah natural voice
  (butuh REPLICATE_API_TOKEN).

### Cost per content package
- **Voice (espeak-ng):** $0 (offline).
- **Voice (Kokoro, saat aktif):** ~$0.0023/run.
- **Thumbnail (ffmpeg):** $0 (offline).
- **LLM (planner/research/script):** ~$0.00001/token (Ollama Cloud, gratis).
- **Total per package:** ~$0.0023 (saat Kokoro aktif) — sangat rendah.

### Apakah output sekarang secara teknis layak masuk Batch 3?
- **BELUM sepenuhnya.** Thumbnail sudah layak, tapi **audio masih robot (espeak-ng)**.
  Batch 3 (produksi massal) sebaiknya ditunda sampai natural voice aktif, karena
  audio robot membuat output tidak layak publish (temuan Batch 2).

---

## Kesimpulan
Phase 2.10 memperbaiki **1 dari 2 blocker** (thumbnail). Natural voice terintegrasi
secara arsitektur tapi belum aktif karena `REPLICATE_API_TOKEN` tidak tersedia.

**Langkah berikutnya (bukan scope Phase 2.10):**
1. Sediakan `REPLICATE_API_TOKEN` + connect replicate provider.
2. Re-run fresh validation untuk verifikasi natural voice.
3. Baru pertimbangkan Batch 3.

**Prinsip:** Fix the proven blockers → fresh validate → stop → review.
Phase 2.10: thumbnail fixed + validated; voice integrated but blocked on credential.
