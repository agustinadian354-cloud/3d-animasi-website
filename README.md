# DIAN — Cinematic AI Ads Director

Website portfolio animasi 3D dengan gaya sinematik, terinspirasi dari noth.in namun dengan angle *cinematic AI ads director*.

## Fitur

- **3D scene interaktif** (Three.js) — objek "lensa kamera" abstrak dari cincin optik, aperture blades, core bercahaya, dan partikel debu proyektor
- **Camera re-framing per section** — setiap scene di-scroll, kamera 3D pindah angle seperti shot film (wide, 3/4, crane, low angle, push-in)
- **Smooth scroll** (Lenis) + animasi scroll (GSAP ScrollTrigger)
- **Estetika film**: letterbox bars 2.39:1, film grain, timecode REC di header, preloader ala slate
- **Custom cursor** dengan state hover/view
- Responsive & menghormati `prefers-reduced-motion`

## Menjalankan

Cukup serve folder ini dengan web server statis apa pun:

```bash
npx serve .
# atau
python3 -m http.server 8000
```

Lalu buka `http://localhost:8000`.

> Perlu koneksi internet untuk memuat Three.js, GSAP, Lenis, dan Google Fonts dari CDN.

## Struktur

```
index.html      — markup & konten
css/style.css   — styling (dark, orange & teal cinematic grade)
js/main.js      — 3D scene, animasi scroll, cursor, preloader
```

## Kustomisasi

- Ganti email/sosial media di section `#contact` pada `index.html`
- Ganti judul karya di section `#work`
- Warna aksen di `:root` pada `css/style.css` (`--accent`, `--accent-2`)
