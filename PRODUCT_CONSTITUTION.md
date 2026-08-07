---
id: product-constitution
title: "PRODUCT CONSTITUTION — FYI Studio Product Architecture"
owner: "Founder + CTO"
status: "accepted"
version: "1.0.0"
last_updated: "2026-08-07"
review_cycle: "per-milestone"
tags: [product, constitution, business-domain, capability-map, roadmap, product-architecture]
related_documents:
  - "FOUNDER_MANIFEST.md"
  - "SYSTEM.md"
  - ".ai/state/rc1-baseline.md"
  - ".ai/architecture/roadmap.md"
---

# PRODUCT CONSTITUTION — FYI Studio

> **Status:** ACCEPTED (Founder approval 2026-08-07). Dokumen ini adalah konstitusi
> resmi produk FYI Studio — acuan bisnis untuk semua milestone berikutnya.
>
> **Constraint:** RC1 Foundation tidak diubah. ADR tidak diubah. Tidak ada
> Worker baru yang ditambahkan tanpa melalui konstitusi ini. Ini pekerjaan
> Product Architecture, bukan dokumentasi teknis.

---

## 1. Product Vision

### Pertanyaan: FYI Studio sebenarnya membangun produk apa?

**FYI Studio adalah Content Operating System (COS)** — sistem operasi untuk
produksi konten yang mengubah *keputusan* menjadi *pengetahuan yang tervalidasi*.

Bukan sekadar "alat yang menghasilkan video". Value bisnisnya adalah:

> **Membantu kreator dan channel memproduksi konten yang TERBUKTI bekerja,
> bukan sekadar menghasilkan banyak konten.**

Dua lapisan value:

1. **Lapisan Eksekusi (Execution)** — memproduksi konten dari ide sampai
   publish (research → script → media → publish). Ini yang sudah ada di RC1.
2. **Lapisan Intelejen (Intelligence)** — menangkap setiap keputusan dan
   hasilnya, lalu membangun knowledge graph: *"keputusan X pada format Y
   menghasilkan retention Z"*. Ini aset jangka panjang yang tidak bisa
   digantikan oleh model AI mana pun.

**North Star (dari FOUNDER_MANIFEST):** FYI Studio adalah **media intelligence
platform**, bukan automation tool. Aset paling berharga = knowledge graph
tentang perilaku audience, eksperimen konten, economics per format, dan pola
keberhasilan yang tervalidasi.

**Unit pembelajaran:** *content experiment* = {keputusan} × {hasil}.

---

### Evolution Statement (WAJIB)

FYI Studio berevolusi melalui **tiga fase**:

| Fase | Nama | Fokus | Status |
|------|------|-------|--------|
| **Phase 1** | **Platform** | Membangun AI Operating System yang vendor-agnostic. | ✅ **RC1 — SELESAI** |
| **Phase 2** | **Product** | Membangun Content Operating System yang mampu menghasilkan konten end-to-end. | 🟡 **SEDANG BERJALAN** |
| **Phase 3** | **Intelligence** | Membangun Media Intelligence Platform yang belajar dari setiap eksperimen konten. | 🔴 **BELUM** |

**Aturan evolusi:** Setiap milestone hanya boleh fokus pada **satu fase**.
Ini mencegah tim melompati fase dan mulai membangun Learning (Phase 3) sebelum
Product (Phase 2) benar-benar terbukti.

---

## 2. Model Mental — Diagram Utama

> Diagram ini adalah **model mental FYI Studio**. Inilah cara seluruh tim
> memahami hubungan antara Business Function, Worker, Capability, dan AI.

```
Business Domain
        │
        ▼
      Worker
        │
        ▼
      Tasks
        │
        ▼
   Capabilities
        │
        ▼
 AI Agent / Service
        │
        ▼
 Provider / Engine
```

**Bacaan diagram:**
- **Business Domain** = fungsi bisnis (mis. Research, Publishing).
- **Worker** = Business Function yang berdiri sendiri (bukan AI model).
- **Tasks** = pekerjaan spesifik dalam sebuah Worker.
- **Capabilities** = kemampuan yang bisa di-resolve oleh ModelGate.
- **AI Agent / Service** = lapisan eksekusi yang memakai capability.
- **Provider / Engine** = implementasi teknis (adapter, engine, API).

Setiap lapisan hanya boleh bicara ke lapisan di bawahnya. Worker tidak pernah
bicara langsung ke Provider — ia bicara ke Capability (ADR-0011).

---

## 3. Business Domains

### Hipotesis Founder (dari brief)

| # | Domain | Catatan |
|---|--------|---------|
| 1 | Content Planning | |
| 2 | Research | |
| 3 | Content Strategy | |
| 4 | Script Production | |
| 5 | Media Production | |
| 6 | Publishing | |
| 7 | Analytics / Learning | |

### Validasi & Usulan

Hipotesis Founder **sebagian besar valid**. Aku mengusulkan **penyesuaian kecil**
yang membuat batas antar-domain lebih tajam dan lebih mudah dievolusi:

| # | Domain (usulan) | Alasan |
|---|-----------------|--------|
| 1 | **Content Planning** | ✅ Valid. Menentukan *apa* yang akan diproduksi (ide, kalender, prioritas). |
| 2 | **Research** | ✅ Valid. Mengumpulkan fakta, tren, dan bahan mentah. |
| 3 | **Content Strategy** | ⚠️ **Usulan: gabung ke Content Planning** sebagai *fase*, bukan domain terpisah. Strategy (angle, hook, format, positioning) adalah *keputusan* yang dibuat saat planning, bukan fungsi produksi yang berdiri sendiri. Memisahkannya berisiko menciptakan Worker yang tumpang tindih dengan Planner. *(Lihat ADP-001.)* |
| 4 | **Script Production** | ✅ Valid. Mengubah strategi/riset menjadi naskah. |
| 5 | **Media Production** | ✅ Valid. Mengubah naskah menjadi aset (voice, subtitle, video). |
| 6 | **Publishing** | ✅ Valid. Mendistribusikan ke platform. |
| 7 | **Analytics** | ✅ Valid. Mengamati hasil (views, retention, revenue). |
| 8 | **Learning** | ✅ **Usulan: pisah dari Analytics.** Analytics = *observasi* (apa yang terjadi). Learning = *aksi* (apa yang kita pelajari, dan bagaimana mengubah keputusan berikutnya). Ini dua fungsi bisnis berbeda: satu pasif, satu aktif. |

**Ringkasan usulan:** 7 domain Founder → **8 domain** dengan (a) Content
Strategy digabung ke Content Planning, (b) Analytics dan Learning dipisah.

> Ini **usulan untuk diskusi**, bukan keputusan final. Jika Founder ingin
> mempertahankan 7 domain asli, struktur tetap bisa dipakai — hanya batas
> Learning vs Analytics yang perlu diperjelas.

---

## 4. Worker Evolution Roadmap

> **Prinsip:** Worker = Business Function. Setiap domain dievolusi berdasarkan
> **Business Domain** (fondasi produk), bukan berdasarkan RC. Milestone bisa
> berubah, tetapi Business Domain tetap menjadi fondasi.

### 4.1 Content Planning
| Aspek | Detail |
|-------|--------|
| **Current State** | 🔴 Belum ada. |
| **Next Evolution** | Planner Worker — ideation, kalender konten, prioritas, brief produksi. |
| **Long-term Vision** | Planner yang dipandu knowledge graph (rekomendasi topik dari Learning). |
| **Dependency** | Knowledge graph, tenant context. |

### 4.2 Research
| Aspek | Detail |
|-------|--------|
| **Current State** | 🟢 **SUDAH ADA** (research-real). |
| **Next Evolution** | Validasi fakta yang lebih kuat, scoring sumber, summarization multi-sumber. |
| **Long-term Vision** | Research yang otomatis memetakan topik ke knowledge graph. |
| **Dependency** | ModelGate (reasoning, search), knowledge base. |

### 4.3 Script Production
| Aspek | Detail |
|-------|--------|
| **Current State** | 🟢 **SUDAH ADA** (script-real). |
| **Next Evolution** | Editing, tone/voice adaptation, format adaptation per platform. |
| **Long-term Vision** | Script yang menyesuaikan diri dengan pola retention dari Learning. |
| **Dependency** | Research output, tenant brand voice. |

### 4.4 Media Production
| Aspek | Detail |
|-------|--------|
| **Current State** | 🟢 **SUDAH ADA** (voice/subtitle/video-real). |
| **Next Evolution** | Engine tambahan (image, music, avatar) via MediaEngine. |
| **Long-term Vision** | Media yang dioptimasi per format berdasarkan data retention. |
| **Dependency** | MediaEngine (ADR-0012), script output. |

### 4.5 Publishing
| Aspek | Detail |
|-------|--------|
| **Current State** | 🟢 **SUDAH ADA** (publish). |
| **Next Evolution** | Multi-platform (TikTok, Instagram, dll), scheduling lanjutan. |
| **Long-term Vision** | Publishing yang otomatis memilih platform berdasarkan data. |
| **Dependency** | OAuth (YouTube), platform adapters. |

### 4.6 Analytics
| Aspek | Detail |
|-------|--------|
| **Current State** | 🟢 **SUDAH ADA** (analytics-ingest). |
| **Next Evolution** | Retention curve, engagement metrics, per-format economics. |
| **Long-term Vision** | Analytics yang menjadi input utama Learning. |
| **Dependency** | OAuth, platform APIs. |

### 4.7 Learning
| Aspek | Detail |
|-------|--------|
| **Current State** | 🔴 Belum ada. |
| **Next Evolution** | Membangun knowledge graph, deteksi pola, rekomendasi. |
| **Long-term Vision** | Learning yang memandu seluruh keputusan produksi. |
| **Dependency** | Analytics output, knowledge graph. *(Lihat ADP-003.)* |

### 4.8 Content Strategy (jika dipertahankan sebagai domain)
| Aspek | Detail |
|-------|--------|
| **Current State** | 🟡 Ditunda (fase Planning atau Worker terpisah). |
| **Next Evolution** | Menentukan angle, hook, format, positioning. |
| **Long-term Vision** | Strategy yang dipandu data Learning. |
| **Dependency** | Research, Learning. *(Lihat ADP-001.)* |

---

## 5. Product Capability Map

> **Prinsip:** Worker = Business Function, BUKAN AI Model. Setiap Worker
> memetakan ke Tasks → Capabilities → Possible AI Services.

### 5.1 Research Worker
```
Research Worker
  ↓ Tasks
    Search
    Validation
    Summarization
    Scoring
  ↓ Capabilities
    search:web
    reasoning
    summarization
    classification
  ↓ Possible AI Services
    Google / Perplexity
    GPT / Claude / DeepSeek
    GPT / Claude
    Rule Engine / LLM
```

### 5.2 Script Worker
```
Script Worker
  ↓ Tasks
    Drafting
    Editing
    Tone Adaptation
    Format Adaptation
  ↓ Capabilities
    text-synthesis:script
    reasoning
    style-transfer
    structured-output
  ↓ Possible AI Services
    GPT / Claude / DeepSeek
    GPT / Claude
    GPT / Claude
    Rule Engine / LLM
```

### 5.3 Media Worker (Voice / Subtitle / Video)
```
Media Worker
  ↓ Tasks
    Voice Synthesis
    Subtitle Generation
    Video Composition
  ↓ Capabilities
    voice:tts
    subtitle:generate
    video:compose
  ↓ Possible AI Services
    Replicate Kokoro / espeak-ng
    Whisper / heuristic
    FFmpeg / Sora / Veo
```

### 5.4 Publishing Worker
```
Publishing Worker
  ↓ Tasks
    Schedule
    Upload
    Status Tracking
  ↓ Capabilities
    publish:youtube
    publish:schedule
    publish:status
  ↓ Possible AI Services
    YouTube Data API (OAuth)
    Scheduler
    YouTube Data API
```

### 5.5 Analytics Worker
```
Analytics Worker
  ↓ Tasks
    Metrics Ingestion
    Revenue Ingestion
    Retention Analysis
  ↓ Capabilities
    analytics:metrics
    analytics:revenue
    analytics:retention
  ↓ Possible AI Services
    YouTube Analytics API
    YouTube Analytics API
    YouTube Analytics API
```

### 5.6 Learning Worker (Phase 3)
```
Learning Worker
  ↓ Tasks
    Pattern Detection
    Knowledge Graph Update
    Recommendation
  ↓ Capabilities
    learning:pattern
    learning:graph
    learning:recommend
  ↓ Possible AI Services
    Statistical Engine / LLM
    Graph DB / LLM
    LLM / Rule Engine
```

---

## 6. Worker vs Task Guideline

Aturan evolusi produk — kapan sesuatu layak menjadi Worker, Task, Capability,
atau Service.

| Level | Definisi | Kapan layak |
|-------|----------|-------------|
| **Worker** | Business Function yang berdiri sendiri, punya lifecycle, output yang bisa dikonsumsi Worker lain. | Punya **tujuan bisnis jelas**, **dependency terdefinisi**, dan **output yang dipakai** oleh fungsi lain. |
| **Task** | Pekerjaan spesifik dalam sebuah Worker. | Masih dalam **domain yang sama** dengan Worker yang ada; tidak punya lifecycle sendiri. |
| **Capability** | Kemampuan yang bisa di-resolve oleh ModelGate. | Bisa dijalankan oleh **berbagai provider**; reusable lintas Worker. |
| **Service** | Implementasi teknis (adapter, engine, API). | Detail implementasi; tidak punya makna bisnis sendiri. |

### Aturan Emas
1. **Jangan buat Worker baru jika Task masih masuk dalam domain Worker yang ada.**
2. **Worker = Business Function, bukan AI Model.** Satu Worker bisa memakai
   banyak model; satu model bisa dipakai banyak Worker.
3. **Naik level hanya jika ada bukti** (Rule of Three): jangan jadikan Task
   menjadi Worker sebelum ada 2–3 implementasi nyata yang membutuhkannya.
4. **Capability dipisah dari Provider** — menambah provider = menambah adapter,
   bukan Worker baru.

---

## 7. Ultimate Product Workflow

Blueprint jangka panjang:

```
Planner
  ↓
Research
  ↓
Research Review
  ↓
Content Strategy
  ↓
Script
  ↓
Media
  ↓
Publishing
  ↓
Analytics
  ↓
Learning
```

### Status per tahap

| Tahap | Status | Catatan |
|-------|--------|---------|
| **Planner** | 🔴 Belum ada | Phase 2/3 — butuh Learning data dulu. *(Lihat ADP-002.)* |
| **Research** | 🟢 Sudah ada | research-real (RC1). |
| **Research Review** | 🟡 Ditunda | HITL review bisa jadi fase; belum Worker terpisah. *(Lihat ADP-004.)* |
| **Content Strategy** | 🟡 Ditunda | Fase Planning atau Worker terpisah. *(Lihat ADP-001.)* |
| **Script** | 🟢 Sudah ada | script-real (RC1). |
| **Media** | 🟢 Sudah ada | voice/subtitle/video-real (RC1). |
| **Publishing** | 🟢 Sudah ada | publish (RC1). |
| **Analytics** | 🟢 Sudah ada | analytics-ingest (RC1). |
| **Learning** | 🔴 Belum ada | Phase 3 — fondasi knowledge graph. *(Lihat ADP-003.)* |

---

## 8. Evolution Principles

Prinsip yang mengatur evolusi produk:

1. **Worker merepresentasikan Business Function.**
2. **Task merepresentasikan pekerjaan.**
3. **Capability merepresentasikan kemampuan.**
4. **Provider hanyalah implementasi.**
5. **Produk berkembang berdasarkan Business Function, bukan jumlah AI model.**
6. **Jangan membuat Worker baru jika Task masih masuk dalam domain Worker yang ada.**
7. **Setiap milestone hanya fokus pada satu fase evolusi** (Platform → Product → Intelligence).

---

## 9. Success Criteria

Setelah membaca dokumen ini, Founder harus mampu menjawab:

1. **Mengapa FYI Studio membutuhkan Worker tertentu?** → Karena ia adalah
   Business Function dengan tujuan, dependency, dan output yang dipakai fungsi lain.
2. **Mengapa tidak setiap output menjadi Worker?** → Karena Worker = Business
   Function; output kecil yang masih dalam domain yang sama cukup menjadi Task.
3. **Bagaimana Worker akan berevolusi selama beberapa tahun ke depan?** → Lihat
   roadmap Business Domain → Current State → Next Evolution → Long-term Vision (Bagian 4).
4. **Bagaimana hubungan Worker → Task → Capability → AI Service?** → Lihat
   Model Mental (Bagian 2) dan Capability Map (Bagian 5).
5. **Bagaimana roadmap produk berkembang tanpa kehilangan arah?** → Dengan
   berpegang pada Product Vision + Evolution Statement (Bagian 1) dan Evolution
   Principles (Bagian 8).

---

## 10. Architecture Decisions Pending (ADP)

Setiap perubahan besar memiliki keputusan yang terdokumentasi. Keputusan yang
belum diambil dicatat sebagai **Architecture Decisions Pending (ADP)**. Ketika
sebuah ADP diputuskan, ia menjadi ADR (atau dicatat sebagai keputusan produk).

| ID | Pertanyaan | Status |
|----|-----------|--------|
| **ADP-001** | Apakah Content Strategy menjadi Worker atau fase (dalam Content Planning)? | 🔴 Pending |
| **ADP-002** | Kapan Planner diperkenalkan? | 🔴 Pending |
| **ADP-003** | Kapan Learning mulai aktif? | 🔴 Pending |
| **ADP-004** | Apakah Research Review tetap HITL atau menjadi Worker? | 🔴 Pending |

---

*Dokumen ini adalah konstitusi resmi produk FYI Studio. Perubahan besar harus
melalui ADP/ADR dan disetujui Founder.*
