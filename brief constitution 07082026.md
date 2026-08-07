BRIEF — PRODUCT CONSTITUTION & PRODUCT CAPABILITY MAP
Context

RC1 telah selesai dan resmi menjadi baseline AI Platform Foundation.

Mulai saat ini fokus proyek berpindah dari Platform Development menjadi Product Development.

Jangan menambah fitur atau worker baru terlebih dahulu.

Fokus pada pendefinisian produk.

Objective

Bangun Product Constitution FYI Studio.

Dokumen ini bukan dokumentasi teknis.

Dokumen ini mendefinisikan bagaimana produk akan berevolusi di atas fondasi RC1.

Dokumen ini akan menjadi acuan semua milestone berikutnya.

Deliverables

Buat dokumen:

PRODUCT_CONSTITUTION.md
Isi minimal
1.

Product Vision

Jawab pertanyaan:

FYI Studio sebenarnya membangun produk apa?

Bukan menjelaskan teknologi.

Tetapi menjelaskan value bisnis.

2.

Business Domains

Kelompokkan seluruh pekerjaan FYI Studio berdasarkan fungsi bisnis.

Contoh:

Content Planning
Research
Content Strategy
Script Production
Media Production
Publishing
Analytics
Learning

Belum tentu final.

Silakan analisis dan tentukan domain terbaik.

3.

Worker Evolution Roadmap

Untuk setiap Business Domain.

Jelaskan:

tujuan
tanggung jawab
dependency
kapan worker tersebut layak dibangun

Pisahkan:

RC1

RC2

RC3

Future
4.

Product Capability Map

Untuk setiap Worker.

Jelaskan:

Worker

↓

Tasks

↓

Capabilities

↓

Possible AI Services

Contoh.

Research Worker

↓

Search

Validation

Summarization

Scoring

↓

search:web

reasoning

summarization

classification

↓

Google

GPT

DeepSeek

Rule Engine

dll

Penting:

Worker adalah Business Function.

Bukan AI Model.

5.

Worker vs Task Guideline

Tentukan aturan.

Kapan sesuatu layak menjadi Worker.

Kapan cukup menjadi Task.

Kapan cukup menjadi Capability.

Kapan cukup menjadi Service.

Ini akan menjadi aturan evolusi produk.

6.

Ultimate Product Workflow

Jelaskan blueprint jangka panjang.

Misalnya.

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

Lalu tandai.

Mana yang sudah ada.

Mana yang belum.

Mana yang sengaja ditunda.

7.

Evolution Principles

Masukkan prinsip-prinsip berikut ke Product Constitution.

Worker merepresentasikan Business Function.
Task merepresentasikan pekerjaan.
Capability merepresentasikan kemampuan.
Provider hanyalah implementasi.
Produk berkembang berdasarkan Business Function, bukan jumlah AI model.
Jangan membuat Worker baru jika Task masih masuk dalam domain Worker yang ada.
Constraints

Jangan mengubah RC1 Foundation.

Jangan mengubah ADR.

Jangan menambah Worker baru.

Jangan coding.

Ini adalah pekerjaan Product Architecture.

Success Criteria

Setelah membaca PRODUCT_CONSTITUTION.md,

Founder harus mampu menjawab:

Mengapa FYI Studio membutuhkan Worker tertentu?
Mengapa tidak setiap output menjadi Worker?
Bagaimana Worker akan berevolusi selama beberapa tahun ke depan?
Bagaimana hubungan Worker → Task → Capability → AI Service?
Bagaimana roadmap produk berkembang tanpa kehilangan arah?
Catatan dari Founder

Kita telah menyelesaikan AI Platform Foundation.

Sekarang kita sedang membangun produk.

Prioritas kita bukan menambah AI, melainkan mendefinisikan bagaimana FYI Studio akan menjadi Content Operating System yang tumbuh secara bertahap, konsisten, dan tetap sederhana.

## Founder Hypothesis

Selama proses brainstorming, ditemukan hipotesis bahwa FYI Studio kemungkinan akan berevolusi menjadi beberapa Business Domain, misalnya:

- Content Planning
- Research
- Content Strategy
- Script Production
- Media Production
- Publishing
- Analytics / Learning

Hipotesis ini bukan keputusan arsitektur.

Tugasmu adalah:

- memvalidasi hipotesis ini,
- mengkritisinya bila perlu,
- mengusulkan struktur yang lebih baik bila ditemukan,
- serta memberikan argumentasi berdasarkan Product Vision, Product Capability Map, dan roadmap FYI Studio.