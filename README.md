[![make.fun competition](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![make.fun rank](https://make.fun/badge/best-flight-game-20261126-0057/muhamadyusufseptian6-lab/makefun-best-flight-game-20261126-0057/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![make.fun reward](https://make.fun/badge/best-flight-game-20261126-0057/muhamadyusufseptian6-lab/makefun-best-flight-game-20261126-0057/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

# PETIR COURIER — 3 Misi, 7 Cincin, 9 Pulau, 1 Tangki Bahan Bakar

Kurir kilat antar pulau. Kamu pilot pesawat kecil berlivery petir yang mengantar
paket-paket paling penting di Kepulauan Petir: resep sambal Bu Lastri, dan surat
cinta Pak RT yang baru berani ditulis setelah 34 tahun menikah. Terbang disiplin —
throttle dan belokanmu menentukan sampai tidaknya paket itu.

## Main

Buka `game/index.html` di desktop Chrome — tanpa server, tanpa internet, tanpa
instalasi apa pun.

| Kontrol | Fungsi |
|---|---|
| W / S | Throttle naik / turun |
| A / D | Belok kiri / kanan |
| I / K | Naik / turun (pitch) |
| V | Peta taktis (satu simulasi, dua tampilan) |
| P | Jeda |
| M | Suara hidup / mati |
| R | Ulangi misi |
| Enter | Mulai / misi berikutnya |
| Mouse / sentuh | Tombol di layar (layar sentuh) & klik untuk mulai |

## Misi

1. **Paket Kilat** — lepas landas dari RWY Petir, lewati Cincin Pemanasan di
   1.200 ft, mendarat manis di RWY Karang.
2. **Tujuh Cincin Petir** — tujuh cincin badai menyala di atas kepulauan, masing-
   masing di ketinggian yang pas. Satu terlewat, paket batal.
3. **Badai Terakhir** — isi bahan bakar dulu di Depot Karang (terbang rendah &
   pelan), lalu terbang menembus angin kencang ke Pulau Badai dan mendarat di
   RWY Badai.

## Yang bikin sortie jadi keputusan

- **Bahan bakar** habis di tengah jalan = meluncur darurat. Depot bahan bakar
  ada di Pulau Petir dan Pulau Karang — tapi harus didatangi rendah dan pelan.
- **Bukit itu nyata**: terbang di bawah ketinggian bukit berarti menabrak bukit.
  Peta taktis menunjukkan ketinggian tiap pulau.
- **Mendarat itu dinilai**: terlalu cepat, terlalu keras, atau miring — pesawat
  jatuh. Mendarat lurus, pelan, dan di tengah garis = sempurna (+250).
- **Stall**: terlalu pelan dan pesawat merosot sendiri. G-meter di HUD
  memperingatkan belokan yang terlalu nekat.

## Cara game ini dibuat

- Canvas 2D murni, tanpa library — semua art digambar dari kode (vektor),
  semua suara disintesis Web Audio API (dengung mesin, angin, bunyi cincin).
- Simulasi fixed-step 60 Hz (accumulator, cap 250 ms), deterministik:
  kepulauan yang sama di setiap run (seed 20261126).
- Terrain di-pre-render sekali ke offscreen canvas; partikel memakai object
  pool; canvas di-scale devicePixelRatio (maks 2x).
- Layar judul punya autopilot demo — pesawatnya terbang sendiri di belakang
  judul sebelum kamu menekan Enter.
- Struktur source per tugas: `config` (dunia + misi), `world` (terrain),
  `plane` (fisika terbang), `input` (keyboard + sentuh + gamepad),
  `audio` (suara sintetis), `particles` (pool), `missions` (alur + skor),
  `render` (chase view + HUD + peta), `shots` (staging screenshot), `main`
  (loop 60 Hz + state).

## Screenshots

`1-cover.png` — chase view di atas laut, cincin di depan, runway Karang di
kejauhan, HUD lengkap menyala. `2-ring.png` — menembus cincin di ketinggian
2.400 ft. `3-landing.png` — final approach ke RWY Karang. `4-complete.png` —
layar misi selesai dengan rincian skor.

---

Dibangun untuk kompetisi make.fun "Make the best flight game". Kode referral: `515temp1`
