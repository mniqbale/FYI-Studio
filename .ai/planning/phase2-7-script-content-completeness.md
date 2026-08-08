---
id: phase2-7-script-content-completeness
title: "Phase 2.7 — Script Content Completeness (caption + description)"
status: "evidence"
created: "2026-08-08"
tags: [phase2, content-package, caption, description, script, evidence-first]
---

# Phase 2.7 — Script Content Completeness

## Tujuan
Extend Script worker untuk menghasilkan `caption` + `description` sebagai bagian
dari output text capability yang sama. Perbaiki propagation:
`Script → Content Package → Publish Intent → Upload Metadata → Platform`.

Tidak ada worker baru, Business Artifact baru, atau ADR baru.

---

## Perubahan

1. **Script worker** (`workers/script-real/src/index.ts`):
   - Prompt meminta `caption` + `description` (Channel-aware, NOT generic).
   - Output menyertakan `caption` + `description`.
   - **Robustness fix:** retry LLM sekali dengan instruksi lebih ketat saat output
     bukan JSON valid (model kadang mengembalikan prose meta-thinking). Fallback
     terakhir degrade ke raw text + flag `_degraded`.

2. **buildPublishIntent** (`packages/publish/src/channel-target.ts`):
   - Sekarang membawa `title`, `hook`, `caption`, `description` dari artifacts.script.

3. **buildUploadMetadata** (`packages/publish/src/publish.ts`):
   - Description sekarang dari `script.description` (Channel-aware), BUKAN
     `research.summary` generik. Fallback ke research.summary hanya jika script
     description absent.

---

## Evidence — Fresh Run (1 Facts + 1 Sports)

### Facts (bu-just-fyi-facts) — COMPLETED
- **title:** "Why the Sky Is Blue: The Physics of Scattered Light"
- **hook:** "Have you ever looked up on a clear day and wondered why the sky is blue? It's not because of the ocean..."
- **caption:** "Ever wondered why the sky is blue? It's not the ocean—it's Rayleigh scattering. Learn the physics behind the blue sky, red sunsets, and white clouds in this clear, calm explainer."
- **description:** "...Perfect for curious minds who want a clear, accurate, and engaging explanation. No hype, just science. Subscribe for more straightforward explanations of everyday phenomena."
- **Channel fit:** ✅ educational, measured, "No hype, just science" — sesuai DNA Facts.
- **duration:** voice 411s == video 411s ✅ | res 1920x1080 ✅

### Sports (bu-just-fyi-sports) — COMPLETED
- **title:** "HAALAND TO MADRID: THE €250M EARTHQUAKE"
- **hook:** "The biggest transfer in football history just dropped. Haaland. Real Madrid. €250 million..."
- **caption:** "€250M. Haaland to Madrid. The football world is shook. 🔥 #Haaland #RealMadrid #TransferNews"
- **description:** "Erling Haaland just made history with a €250M move to Real Madrid. We break down how this mega-deal reshapes Madrid's attack..."
- **Channel fit:** ✅ fast, hype, hashtags, emoji — sesuai DNA Sports.
- **duration:** voice 138s == video 138s ✅ | res 1080x1920 ✅

### Publish Intent (Sports) — verified
```
channel_id: bu-just-fyi-sports
platform: youtube
title: HAALAND TO MADRID: THE €250M EARTHQUAKE
hook: The biggest transfer in football history just dropped...
caption: €250M. Haaland to Madrid. The football world is shook. 🔥...
description: Erling Haaland just made history with a €250M move...
video_artifact: /tmp/fyi-studio/.../video.mp4
```
Propagation lengkap: Script → Content Package → Publish Intent → Upload Metadata → Platform.

---

## Kualitas Output

- **Facts:** caption/description sangat on-brand (educational, "No hype, just science").
- **Sports:** caption/description sangat on-brand (hype, hashtags, emoji, momentum).
- **Channel fit:** kedua channel menghasilkan caption/description yang BERBEDA dan
  sesuai DNA masing-masing — membuktikan Channel DNA benar-benar menggerakkan
  distribution components.

---

## Regression

- **Tests:** 150 pass (naik dari 149, +1 publish test untuk buildUploadMetadata).
- **typecheck:** exit 0.
- **build:** exit 0.
- **Publishing-aware v1:** tidak ada regression (publish 40 tests pass).
- **Duration correctness (Phase 2.5):** tetap terjaga (voice==video di kedua run).

---

## Apakah satu text capability benar-benar cukup?

**YA.** Caption + description adalah dua output dari capability text generation
yang SAMA (Script worker). Keduanya diturunkan dari Channel DNA + Brief + Research
+ Script. Tidak ada alasan bisnis untuk memecah menjadi worker terpisah.

**Temuan penting (robustness gap):** model (deepseek-v4-flash) kadang mengembalikan
prose meta-thinking alih-alih JSON untuk topik tertentu (terjadi pada Sports).
Fix: retry LLM dengan instruksi lebih ketat. Ini membuktikan bahwa **satu text
capability cukup, tapi butuh retry/validation** — bukan worker baru.

---

## Apa yang masih missing untuk menjadi publishable?

1. **Thumbnail** — masih MISSING (ditunda sesuai brief). Satu-satunya komponen
   content package yang belum ada producer.
2. **Platform-specific presentation** — caption/description sudah ada sebagai
   primitives, tapi rendering per platform (YouTube description vs TikTok caption)
   masih tanggung jawab Publishing layer (belum diimplementasikan penuh).
3. **Hashtags** — Sports sudah menghasilkan hashtags di caption (natural dari LLM),
   tapi belum ada struktur eksplisit.
4. **HITL approval** — belum ada evidence kebutuhan nyata untuk caption/description.

---

## Kesimpulan

Phase 2.7 membuktikan: **satu text capability cukup** untuk title + hook + caption
+ description. Content Package sekarang punya Video, Title, Hook, Caption,
Description — hanya Thumbnail yang missing. Propagation ke Publish Intent +
Upload Metadata lengkap. CORRECTNESS → CONSISTENCY → COMPLETENESS: COMPLETENESS
text layer tercapai; COMPLETENESS visual (thumbnail) ditunda.
