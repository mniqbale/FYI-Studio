---
id: channel-constitution
title: "CHANNEL CONSTITUTION — Apa itu Channel di FYI Studio"
owner: "Founder + CTO"
status: "draft"
version: "0.1.0"
last_updated: "2026-08-07"
review_cycle: "per-milestone"
tags: [channel, brand, constitution, business-language, identity, dna]
related_documents:
  - "PRODUCT_CONSTITUTION.md"
  - "FOUNDER_MANIFEST.md"
  - "SYSTEM.md"
---

# CHANNEL CONSTITUTION — Apa itu Channel

> **Status:** DRAFT (untuk diskusi Founder). Dokumen ini mendefinisikan **apa itu
> Channel** di dalam FYI Studio — bahasa bisnis, bukan implementasi.
> Sama seperti PRODUCT_CONSTITUTION menjawab *"Apa itu Product?"*, dokumen ini
> menjawab *"Apa itu Channel?"*.
>
> **Constraint:** bukan desain database, bukan JSON/YAML, bukan state machine,
> bukan UI, bukan API. Tidak ada Worker baru. Tidak ada ADR baru. Tidak
> mengubah Product Constitution. Tidak ada coding.

---

## 1. Pertanyaan Fundamental

> **"Apa yang harus diketahui seluruh System Actor sebelum mereka mulai bekerja
> untuk sebuah Channel?"**

Bukan *"Bagaimana implementasinya"*, tetapi: apa esensi bisnis yang melekat
pada sebuah Channel sehingga setiap konten yang diproduksinya konsisten dengan
identitasnya.

---

## 2. Kritik Konsep (Mencari Alasan Mengapa Ini Salah)

Sebelum menyimpulkan, konsep ini dikritik dari beberapa arah. Tujuannya bukan
membuktikan konsep benar, tetapi mencari alasan ia salah atau tidak perlu.

### 2.1 Apakah ini duplikat dari `tenant_context`?
**Kritik:** RC1 sudah punya `tenant_context` (brand_voice, language,
forbidden_terms, constraints). Bukankah ini hanya mendefinisikan ulang yang ada?
**Kesimpulan — bertahan:** `tenant_context` adalah **implementasi teknis**
(tabel, field). "Channel" adalah **bahasa bisnis** yang sama. Seperti Product
Constitution menaikkan konsep produk ke bahasa, Channel Constitution
mengangkat apa yang implisit (tenant) menjadi eksplisit sebagai entitas bisnis
bernama "Channel". Bukan duplikat — ini penyempurnaan bahasa.

### 2.2 Apakah "Channel" atau "Brand" yang paling stabil?
**Kritik:** satu brand nyata punya banyak channel (YouTube, TikTok, podcast).
Menjadikan Channel sebagai akar identitas bisa menyebar DNA dan membuat
inkonsisten.
**Kesimpulan — bertahan dengan reframe:** Channel **membawa** sebuah identitas.
Secara bisnis, identitas itulah brand. Sebuah identitas dapat bermanifestasi di
banyak channel/platform tanpa kehilangan DNA-nya. Dokumen ini mendefinisikan
Channel sebagai **identitas + cara hadir**, sehingga konsistensi DNA terjaga
lintas platform.

### 2.3 Apakah ini cukup jadi data/konfigurasi, bukan konstitusi?
**Kritik (terkuat):** apa bedanya dengan tabel data channel?
**Kesimpulan — bertahan:** Product Constitution tidak berisi data produk
spesifik, melainkan mendefinisikan *apa itu produk*. Demikian pula Channel
Constitution mendefinisikan **tipe identitas** yang konsisten lintas channel,
bukan data satu channel tertentu. Konstitusi = kosakata; data = instance.

### 2.4 Apakah "Learning Memory" termasuk identitas?
**Kritik:** Learning Memory adalah **state yang berubah** (hasil belajar), bukan
**identitas yang stabil** (DNA).
**Kesimpulan — dibuang:** Memasukkannya ke konstitusi melanggar prinsip bahwa
konstitusi mendefinisikan kosakata stabil, bukan state dinamis. Learning Memory
adalah *konsekuensi* aktivitas channel, bukan bagian dari identitasnya.

### 2.5 Apakah "Mission" terpisah dari "Identity"?
**Kritik:** Mission adalah bagian dari Identity, bukan dimensi berdiri sendiri.
**Kesimpulan — digabung:** Mission menjadi komponen Identity, bukan dimensi
terpisah.

### 2.6 Hasil Kritik
11 field hipotesis Founder → **9 dimensi**, dengan:
- Learning Memory dikeluarkan (state, bukan identitas).
- Identity + Mission digabung.
- Beberapa field dipisahkan ke dimensi yang lebih tajam.

**Konsep "Channel Constitution" bertahan setelah dikritik habis-habisan.**

---

## 3. Definisi Channel

> **Channel adalah satu identitas bisnis yang konsisten, yang menjadi titik
> awal seluruh produksi FYI Studio.**

Sebuah Channel bukan "satu video" dan bukan "satu platform". Ia adalah **DNA
yang bertahan**: nilai, audience, cara berbicara, cara tampil, dan cara
menang — yang mewarnai setiap konten yang diproduksi untuknya.

Sebuah identitas (brand) dapat hadir di banyak Channel/platform, tetapi setiap
Channel membawa DNA yang sama. Konsistensi DNA adalah tanggung jawab utama
FYI Studio.

---

## 4. Identitas Channel (DNA)

Berikut dimensi identitas yang harus diketahui System Actor sebelum bekerja
untuk sebuah Channel. Ini **kosakata**, bukan spesifikasi data.

| Dimensi | Pertanyaan yang Dijawab |
|---------|-------------------------|
| **Identity** | Siapa channel ini? Apa positioning dan misinya? |
| **Audience** | Untuk siapa konten ini dibuat? |
| **Content Pillars** | Topik inti apa yang selalu menjadi fokus? |
| **Brand Voice** | Bagaimana channel ini berbicara? (tone, gaya, bahasa) |
| **Visual Identity** | Bagaimana channel ini terlihat? (ciri visual konsisten) |
| **Production Preferences** | Bagaimana channel ini ingin diproduksi? (durasi, format, ritme) |
| **Publishing Strategy** | Kapan, ke mana, dan dengan ritme apa konten dirilis? |
| **Success Metrics** | Apa yang channel anggap menang? |
| **Guardrails** | Apa yang tidak boleh dilanggar? (batas, larangan, nilai) |

> Catatan: **Learning Memory tidak termasuk di sini.** Ia adalah hasil dinamis
> dari aktivitas channel, bukan identitas yang stabil.

---

## 5. Mengapa Produksi Selalu Dimulai dari Channel

Setiap pekerjaan FYI Studio — dari perencanaan sampai publikasi — selalu
berawal dari satu pertanyaan: **"Untuk Channel yang mana?"**

Karena tanpa identitas Channel, tidak ada yang menetapkan:
- topik apa yang layak,
- cara bicara yang benar,
- audience yang dituju,
- metrik yang dianggap sukses,
- dan batas yang tidak boleh dilanggar.

Konten hanyalah **manifestasi** dari identitas Channel. Produksi yang tidak
berawal dari Channel adalah produksi yang kehilangan arah.

---

## 6. Mengapa System Actor Bekerja untuk Channel, Bukan untuk Video

System Actor (Planner, Research, Script, Media, Publishing, Analytics) bekerja
untuk **Channel**, bukan untuk **Video**.

Alasan:
- Video adalah hasil sesaat; Channel adalah konteks yang bertahan.
- Keputusan yang benar untuk sebuah video hanya bisa diambil dalam konteks
  identitas Channel.
- **Learning** (Phase 3) harus mereferensikan Channel, bukan video — karena
  pola keberhasilan melekat pada channel, bukan pada satu konten.

System Actor adalah **pelaksana yang menjaga DNA Channel**, bukan generator
video otonom.

---

## 7. Mengapa Channel Bertahan Lebih Lama daripada Teknologi

Model AI, workflow, worker, dan platform bisa berubah atau hilang. Namun
**identitas sebuah Channel** (siapa, untuk siapa, bagaimana berbicara, apa yang
dianggap menang) jauh lebih stabil.

Sama seperti FOUNDER_MANIFEST: model AI adalah alat eksekusi; yang bertahan
adalah bahasa, nilai, dan pola. Channel adalah bentuk bisnis dari prinsip itu —
identitas yang terus hidup melewati pergantian teknologi.

---

## 8. Mengapa 100 Channel Berbeda Berjalan di Platform yang Sama

Seratus Channel dapat berjalan di atas platform yang sama **tanpa mengubah
Worker**, karena:

- Worker hanya bicara ke **Capability** (ADR-0011), bukan ke channel.
- Perbedaan antar channel hidup di **identitas Channel** (dimensi DNA), bukan
  di kode Worker.
- Setiap Channel menyuntikkan DNA-nya sebagai konteks yang sama bagi semua
  Worker.

Jadi menambah channel = menambah identitas, **bukan** menambah Worker.

---

## 9. Apa yang BUKAN Bagian dari Channel Constitution

Channel Constitution mendefinisikan **bahasa**. Yang TIDAK termasuk:

- Desain database / schema.
- Struktur JSON / YAML.
- Class / interface.
- State machine / lifecycle.
- UI / API.
- Learning Memory (state dinamis) — ditangani sebagai hasil, bukan identitas.
- Detail implementasi produksi.

Hal-hal itu lahir kemudian melalui ADR / desain ketika implementasi benar-benar
membutuhkannya.

---

## 10. Success Criteria

Setelah membaca dokumen ini, pembaca harus mampu menjawab:

1. **Mengapa seluruh produksi FYI Studio selalu dimulai dari sebuah Channel?**
   → Karena Channel adalah identitas bisnis yang menetapkan arah, audience,
   cara bicara, dan ukuran sukses; konten hanyalah manifestasinya.
2. **Mengapa System Actor bekerja untuk Channel, bukan untuk Video?**
   → Karena video adalah hasil sesaat, sedangkan Channel adalah konteks yang
   bertahan; keputusan benar hanya lahir dari identitas Channel.
3. **Mengapa Channel menjadi identitas yang bertahan lebih lama daripada
   model AI, workflow, atau teknologi?**
   → Karena Channel adalah DNA bisnis (nilai, audience, voice, metrik) yang
   independen dari alat eksekusi.
4. **Mengapa 100 channel berbeda dapat berjalan di platform yang sama tanpa
   mengubah Worker?**
   → Karena Worker hanya bicara ke Capability; perbedaan channel hidup di
   identitas (DNA), bukan di kode Worker.

---

## 11. Catatan Founder — Brand Operating System

FYI Studio bukan hanya Content Operating System, tetapi **Brand Operating
System**. Setiap Channel memiliki DNA-nya sendiri. Tugas FYI Studio bukan
menghasilkan video, tetapi **menjaga konsistensi DNA setiap Channel di setiap
konten yang diproduksi**.

*Konsep ini bertahan setelah dikritik. Ia berpotensi menjadi salah satu fondasi
terpenting FYI Studio.*
