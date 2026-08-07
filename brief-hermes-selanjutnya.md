Brief berikutnya untuk Hermes
Phase 2 berubah fokus

Sampai titik ini kita sudah membangun:

AI Platform Foundation (RC1)
Product Constitution
Channel Constitution

Mulai sekarang aku ingin kita mengubah mode kerja.

Dari:

Design → Design → Design

menjadi

Build → Validate → Learn

Setiap task berikutnya harus menghasilkan peningkatan nyata pada produk.

Tujuan milestone berikutnya

Aku tidak ingin menambah dokumen konstitusi.

Aku ingin membuktikan bahwa Business Unit (Channel) benar-benar dapat menggerakkan seluruh pipeline produksi.

Objective

Bangun Channel-aware Production Pipeline v1.

Artinya seluruh pipeline mulai bekerja berdasarkan sebuah Channel, bukan lagi hanya Content Initiative atau Content Brief.

Contoh alur yang ingin kubuktikan

Founder membuat:

Business Unit

Name:
Just FYI Facts

kemudian membuat

Content Initiative

Planner membuat

Content Brief

Research membaca:

Channel DNA
+
Content Brief

Script membaca:

Channel DNA
+
Research
+
Brief

Media membaca:

Channel DNA
+
Script

Publishing membaca:

Channel DNA
+
Video

Seluruh pipeline sekarang sadar bahwa mereka bekerja untuk sebuah Business Unit tertentu.

Scope

Aku ingin implementasi sekecil mungkin.

Tidak perlu UI.

Tidak perlu database baru.

Tidak perlu dashboard.

Tidak perlu multi-user.

Tidak perlu multi-channel.

Yang kubutuhkan hanya bukti bahwa architecture baru memang bekerja.

Acceptance Criteria
AC-1

Founder dapat membuat satu Business Unit sederhana.

(Misal file JSON/YAML/manual object juga boleh.)

AC-2

Content Initiative mengetahui Business Unit asalnya.

AC-3

Planner menghasilkan Brief dengan konteks Business Unit.

AC-4

Research menghasilkan hasil berbeda jika Business Unit berbeda.

Contoh:

Business Unit A

Just FYI Facts

Research:

netral
edukatif

Business Unit B

Just FYI Sports

Research:

cepat
hype
momentum

Walaupun topiknya sama.

AC-5

Script ikut berubah mengikuti Business Unit.

AC-6

Video Worker menerima Production Preference dari Business Unit.

Misalnya

Vertical
9:16
1080x1920

atau

Horizontal
16:9

Walaupun implementasinya sementara hanya berupa log atau metadata.

Aku belum membutuhkan rendering yang sempurna.

Aku hanya ingin membuktikan bahwa konteks berhasil mengalir.

Yang TIDAK boleh dilakukan
Jangan redesign Product Constitution.
Jangan redesign Channel Constitution.
Jangan membuat ADR baru.
Jangan membuat abstraksi baru.
Jangan membuat Worker baru.

Gunakan fondasi yang sudah ada.

Prinsip

Aku ingin kita membuktikan satu hipotesis sederhana:

Business Unit bukan sekadar dokumen. Business Unit benar-benar mampu mengubah perilaku seluruh pipeline.

Kalau hipotesis ini terbukti, maka kita tidak lagi memiliki "video generator".

Kita sudah memiliki Brand-aware Content Operating System.

Satu catatan tambahan dariku

Aku bahkan akan menambahkan satu instruksi terakhir untuk Hermes:

"Jika selama implementasi kamu menemukan bahwa Product Constitution atau Channel Constitution masih kurang, jangan langsung mengubahnya. Catat sebagai observasi. Kita hanya akan mengubah konstitusi jika implementasi nyata membuktikan ada vocabulary yang benar-benar kurang."