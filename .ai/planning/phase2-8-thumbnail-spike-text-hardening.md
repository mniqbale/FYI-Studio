---
id: phase2-8-thumbnail-spike-text-hardening
title: "Phase 2.8 — Thumbnail Capability Spike + Text Reliability Hardening"
status: "evidence"
created: "2026-08-08"
tags: [phase2, thumbnail, spike, text-reliability, mediaengine, evidence-first]
---

# Phase 2.8 — Thumbnail Spike + Text Reliability Hardening

## A. Text Reliability Hardening (Script worker)

### Perubahan
- **Schema validation:** `parseScriptJson` kini memvalidasi output terhadap schema
  (title/script/narration wajib non-empty; hook/caption/description harus string).
- **Retry hanya saat invalid:** retry LLM sekali dengan instruksi lebih ketat
  HANYA ketika output tidak valid JSON.
- **Tidak menyembunyikan kegagalan:** fallback `_degraded` (raw text sebagai script)
  DIHAPUS. Jika masih invalid setelah retry, worker **FAIL** (bukan fabricate konten
  palsu) — Supervisor menangani retry/backoff, operator melihat masalah nyata.

### Evidence — Fresh run (1 Facts + 1 Sports)
- **Facts** (bu-just-fyi-facts) COMPLETED:
  - title: "Why the Ocean Is Salty: A Journey from Rivers to the Sea"
  - hook: "You've probably tasted it once—that sharp, salty tang of seawater..."
  - caption: "Ever wondered why the ocean is salty? It's not from table salt..."
  - description: "Why is the ocean salty? In this calm, clear explainer..."
  - ✅ Semua field valid, tanpa meta-thinking/prose di structured output.
- **Sports** (bu-just-fyi-sports) COMPLETED:
  - title: "Inside Lamine Yamal's Training: The Making of a Phenom"
  - hook: "He's 17. He's already a legend. Lamine Yamal is just getting started."
  - caption: "17. A legend. Lamine Yamal is just getting started. 🔥⚽ #LamineYamal..."
  - description: "Lamine Yamal is the 17-year-old phenom taking football by storm..."
  - ✅ Semua field valid, tanpa meta-thinking/prose.

**Catatan:** Satu run Sports gagal di **planner** (step 0, "Planner model did not
return valid JSON") — gap reliability yang sama tapi di worker planner (pre-existing,
bukan scope Part A yang fokus pada script). Re-seed menghasilkan run sukses.

---

## B. Thumbnail Capability Spike

### Investigasi
- **Input minimum:** title (overlay), hook (secondary), Channel `visual_identity`
  (style + palette), resolution (dari production_preferences).
- **Channel visual_identity memengaruhi:** palette → background color; style →
  text color (high-contrast → neon accent).
- **Brief/topic/title/hook → creative direction:** title + hook jadi teks overlay;
  topic/brief mengarahkan konten (via Script worker yang sudah Channel-aware).
- **Output contract:** satu PNG (file:// pointer), `{ thumbnail_path, resolution, format }`.
- **Engine/provider:** spike memakai FFmpeg compositing (offline, free) — bukan
  image-gen API. Ini membuktikan boundary tanpa biaya.
- **MediaEngine capability (ADR-0012):** thumbnail naturalnya adalah MediaEngine
  capability (`image:thumbnail`), worker capability-only, engine = adapter.

### Reference implementation (spike, bukan production)
- `packages/media/src/thumbnail.ts` — `composeThumbnail` (FFmpeg compositing).
- `packages/media/src/thumbnail-engine.ts` — `ThumbnailEngine` (MediaEngine adapter).
- Diexport dari `@fyi/media` index.

### Evidence — Fresh validation (1 Facts + 1 Sports)
Menggunakan Channel DNA + title/hook dari job COMPLETED:

| Channel | visual_identity | Thumbnail | Center pixel | Direction |
|---------|-----------------|-----------|--------------|-----------|
| Facts | clean/minimal/muted, soft blue/white/gray | 1920x1080 png | `1d3888` (soft blue) | tenang, edukatif |
| Sports | bold/high-contrast/dynamic, black/neon green/white | 1080x1920 png | `0a0a0a` (black) | bold, hype |

**Facts vs Sports menghasilkan visual direction yang BERBEDA** — terbukti dari
warna background (soft blue vs black) + resolusi (horizontal vs vertical).

---

## Engine/Adapter Boundary
- Worker (masa depan) = capability-only, resolve `image:thumbnail` via ModelGate.
- Engine = adapter (FFmpeg sekarang; image-gen API nanti) via MediaEngine (ADR-0012).
- Tidak ada worker baru dibuat di spike ini.

## Apakah MediaEngine cukup?
**YA.** `runMediaEngine` + `MediaEngine<Input, Meta>` generic menangani thumbnail
tanpa leaky abstraction — input/meta thumbnail tetap typed per-engine, lifecycle
(timing/cost/refs/error) distandardisasi. Spike membuktikan abstraksi RC1 cukup
untuk membawa image compositing.

## Kualitas dua thumbnail
- **Facts:** soft blue background + white text, horizontal — sesuai DNA (tenang,
  edukatif, muted).
- **Sports:** black background + neon green text, vertical — sesuai DNA (bold,
  high-contrast, hype).
- Keduanya on-brand dan berbeda. (Catatan: spike memakai solid color + text;
  image-gen API akan menghasilkan visual yang lebih kaya.)

## Apakah Thumbnail layak jadi capability production?
**YA, dengan catatan.** Spike membuktikan boundary bisnis (Channel DNA → thumbnail)
dan MediaEngine cukup. Tapi:
- **Belum justified:** image-gen API (Replicate/Stable Diffusion) — spike pakai
  FFmpeg compositing, belum membuktikan image generation.
- **Belum justified:** worker baru — spike belum lewat pipeline (masih standalone).
- **Perlu:** integrasi ke recipe (step thumbnail), ModelGate capability
  `image:thumbnail`, model_policy entry.

## Perubahan yang belum justified
1. Image-gen API engine (belum ada evidence kebutuhan visual kaya).
2. Thumbnail worker production (belum lewat pipeline end-to-end).
3. ModelGate `image:thumbnail` capability (belum ada worker yang resolve).

---

## Regression
- **Tests:** 158 pass (naik dari 150, +8 media: thumbnail engine + visual direction).
- **typecheck:** exit 0.
- **build:** exit 0.
- **Publishing-aware v1, duration correctness, caption/description:** tidak ada regression.

## Kesimpulan
Phase 2.8 membuktikan:
1. **Text reliability:** schema validation + retry-only-on-invalid + fail (bukan
   fabricate) menghasilkan valid title/hook/caption/description tanpa prose.
2. **Thumbnail spike:** MediaEngine abstraction RC1 cukup membawa image compositing;
   Channel DNA + Brief + Title/Hook → Thumbnail dengan visual direction berbeda
   (Facts soft-blue horizontal vs Sports black vertical).

Content Package kini: Title + Hook + Caption + Description + Thumbnail + Video +
Publishing Intent. Siap untuk **Batch 2 — "Would I Actually Publish This?"**.
