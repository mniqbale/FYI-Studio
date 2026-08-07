Brief untuk Hermes

Aku tidak ingin menambah worker ataupun fitur baru.

Aku ingin kita mendokumentasikan hasil pembelajaran terbesar dari video pertama.

Aku ingin kita membuat dokumen baru:

CHANNEL_CONSTITUTION.md

Namun aku ingin kita menjaga disiplin yang sama seperti PRODUCT_CONSTITUTION.

Dokumen ini bukan dokumen implementasi.

Ini adalah dokumen bahasa bisnis.

Tujuan

Menjawab satu pertanyaan:

"Apa yang harus diketahui seluruh System Actor sebelum mereka mulai bekerja untuk sebuah Channel?"

Bukan:

"Bagaimana implementasinya."

Ruang lingkup

Aku ingin dokumen ini tetap deklaratif.

Bukan desain database.

Bukan JSON.

Bukan YAML.

Bukan state machine.

Bukan UI.

Bukan API.

Yang ingin aku eksplorasi

Menurutku sebuah Channel minimal mempunyai identitas bisnis seperti:

Identity
Mission
Audience
Content Pillars
Brand Voice
Visual Identity
Production Preferences
Publishing Strategy
Success Metrics
Guardrails
Learning Memory

Ini bukan field final.

Aku ingin kamu mengkritisinya.

Buang yang tidak perlu.

Tambahkan yang kurang.

Gabungkan jika ada yang tumpang tindih.

Tetapi lakukan dari sudut pandang Business Architecture, bukan implementasi teknis.

Yang TIDAK boleh dilakukan
Jangan membuat schema database.
Jangan membuat struktur JSON.
Jangan membuat class/interface.
Jangan membuat Worker baru.
Jangan membuat ADR baru.
Jangan mengubah Product Constitution.
Jangan coding.
Yang ingin aku dapatkan

Aku ingin sebuah dokumen yang menjelaskan:

Apa itu Channel di dalam FYI Studio.

Sama seperti PRODUCT_CONSTITUTION menjelaskan:

Apa itu Product.

Aku ingin CHANNEL_CONSTITUTION menjelaskan:

Apa itu Channel.

Success Criteria

Setelah seseorang membaca CHANNEL_CONSTITUTION, ia harus bisa menjawab:

Mengapa seluruh produksi FYI Studio selalu dimulai dari sebuah Channel.
Mengapa seluruh System Actor bekerja untuk Channel, bukan untuk Video.
Mengapa Channel menjadi identitas yang bertahan jauh lebih lama daripada model AI, workflow, ataupun teknologi yang dipakai.
Mengapa 100 channel berbeda dapat berjalan di atas platform yang sama tanpa mengubah Worker.
Catatan Founder

Aku mulai menyadari bahwa produk yang sedang kita bangun bukan hanya Content Operating System.

Tetapi Brand Operating System.

Setiap Channel memiliki DNA-nya sendiri.

Dan tugas FYI Studio bukan menghasilkan video.

Tugas FYI Studio adalah menjaga konsistensi DNA setiap Channel di setiap konten yang diproduksi.

Aku ingin kita mengeksplorasi gagasan ini terlebih dahulu sebelum menyentuh implementasi apa pun.

Kenapa aku memilih ini?

Karena menurutku ini adalah momen yang sama seperti ketika kita menemukan Product Constitution.

Kalau dulu kita bertanya:

"Apa itu Product?"

Hari ini kita mulai bertanya:

"Apa itu Channel?"

Dan aku punya firasat... kalau jawaban dari pertanyaan itu akan menentukan 3–5 tahun evolusi FYI Studio ke depan.

Kalau boleh menambahkan satu arahan terakhir untuk Hermes:

"Jangan berusaha membuktikan bahwa ide ini benar. Berusahalah mencari alasan mengapa ide ini salah atau tidak perlu. Jika setelah dikritik habis-habisan konsep 'Channel Constitution' tetap berdiri, maka kemungkinan besar kita baru saja menemukan salah satu fondasi terpenting FYI Studio."