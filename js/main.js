/* ============================================================
   Ads by Dian — Cinematic AI Ads
   3D scene: a spiral star galaxy — thousands of glowing
   particles — that re-frames itself per scene like a camera
   changing shots.
   ============================================================ */

import * as THREE from "three";

/* ============================================================
   VIDEO PATHS — edit everything in this one block.
   - hero      : the autoplay showreel in the hero section
   - takes[i]  : video for TAKE 0(i+1) in the Selected Takes grid
                 (order matches the cards top-to-bottom in HTML).
                 Leave "" for a COMING SOON placeholder card.
   ============================================================ */
const VIDEOS = {
  hero: "assets/reel-01.mp4",
  takes: [
    "assets/reel-01.mp4", // TAKE 01 — The Scroll Stopper (placeholder: same as hero)
    "assets/reel-02.mp4", // TAKE 02 — Ten Seconds of Want
    "assets/reel-03.mp4", // TAKE 03 — Feed Cinema
    "",                   // TAKE 04 — coming soon
    "",                   // TAKE 05 — coming soon
  ],
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------
   i18n — texts live in js/translations.js (window.TRANSLATIONS).
   Default language: Indonesian. Choice persists in localStorage.
------------------------------------------------------------ */
const I18N = window.TRANSLATIONS || { id: {}, en: {} };
let lang = localStorage.getItem("adsbydian-lang");
if (lang !== "id" && lang !== "en") lang = "id";
const t = (key) => (I18N[lang] && I18N[lang][key]) || "";

function applyLanguage(next) {
  lang = next;
  try {
    localStorage.setItem("adsbydian-lang", lang);
  } catch (e) {}
  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const v = t(el.dataset.i18n);
    if (v) el.textContent = v;
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const v = t(el.dataset.i18nHtml);
    if (v) el.innerHTML = v;
  });

  // document metadata
  document.title = t("meta.title");
  const setMeta = (sel, val) => {
    const m = document.querySelector(sel);
    if (m && val) m.setAttribute("content", val);
  };
  setMeta('meta[name="description"]', t("meta.desc"));
  setMeta('meta[property="og:title"]', t("meta.title"));
  setMeta('meta[property="og:description"]', t("meta.desc"));
  setMeta('meta[name="twitter:title"]', t("meta.title"));
  setMeta('meta[name="twitter:description"]', t("meta.desc"));

  // image alt text
  const aboutImg = document.querySelector(".about__photo img");
  if (aboutImg) aboutImg.alt = t("about.photoAlt");

  // work-card aria labels
  document.querySelectorAll(".work-card").forEach((card) => {
    const title = card.querySelector(".work-card__title");
    if (card.classList.contains("work-card--soon")) card.setAttribute("aria-label", t("work.soon"));
    else if (title) card.setAttribute("aria-label", t("work.playPrefix") + ": " + title.textContent);
  });

  // reel sound button label follows current mute state
  const sBtn = document.getElementById("reelSound");
  const rVid = document.querySelector(".hero__reel-video");
  if (sBtn && rVid) sBtn.textContent = rVid.muted ? t("reel.unmute") : t("reel.mute");

  // toggle UI state
  document.querySelectorAll(".lang-toggle__btn").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.lang === lang)
  );
}
applyLanguage(lang);

document.querySelectorAll(".lang-toggle__btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.lang === lang) return;
    applyLanguage(btn.dataset.lang);
    buildManifesto(); // re-split the translated manifesto text
    if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
  });
});

/* ------------------------------------------------------------
   Smooth scroll (Lenis)
------------------------------------------------------------ */
let lenis = null;
if (!prefersReducedMotion && typeof Lenis !== "undefined") {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
  lenis.on("scroll", () => ScrollTrigger.update());
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------
   Three.js scene
------------------------------------------------------------ */
const canvas = document.getElementById("webgl");
let scene, camera, renderer, galaxyGroup, dust;
let webglOK = true;

const mouse = { x: 0, y: 0 };
const cameraTarget = { x: 0, y: 0, z: 7, rx: 0, ry: 0 };

try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
} catch (e) {
  webglOK = false;
  canvas.style.display = "none";
}

if (webglOK) {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0c, 0.045);

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 7);

  /* --- Soft round sprite so particles glow like stars --- */
  function makeStarTexture() {
    const size = 64;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.8)");
    g.addColorStop(0.6, "rgba(255,255,255,0.15)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const starTexture = makeStarTexture();

  /* --- The galaxy: a procedural spiral of glowing stars --- */
  galaxyGroup = new THREE.Group();

  const GALAXY = {
    count: 24000,
    radius: 4.2,
    branches: 4,
    spin: 1.35,
    randomness: 0.27,
    randomnessPower: 2.6,
    thickness: 0.4,
    insideColor: new THREE.Color(0xffffff), // bright silver core
    midColor: new THREE.Color(0xb9bac2),    // silver gray
    outsideColor: new THREE.Color(0x5c5e68) // dark smoke gray
  };

  {
    const positions = new Float32Array(GALAXY.count * 3);
    const colors = new Float32Array(GALAXY.count * 3);
    const col = new THREE.Color();

    for (let i = 0; i < GALAXY.count; i++) {
      const i3 = i * 3;
      const r = Math.pow(Math.random(), 1.6) * GALAXY.radius;
      const branch = ((i % GALAXY.branches) / GALAXY.branches) * Math.PI * 2;
      const spin = r * GALAXY.spin;

      const rnd = () =>
        Math.pow(Math.random(), GALAXY.randomnessPower) *
        (Math.random() < 0.5 ? 1 : -1) *
        GALAXY.randomness * r;

      positions[i3 + 0] = Math.cos(branch + spin) * r + rnd();
      positions[i3 + 1] = rnd() * GALAXY.thickness + (Math.random() - 0.5) * 0.08;
      positions[i3 + 2] = Math.sin(branch + spin) * r + rnd();

      const t = r / GALAXY.radius;
      if (t < 0.28) col.copy(GALAXY.insideColor).lerp(GALAXY.midColor, t / 0.28);
      else col.copy(GALAXY.midColor).lerp(GALAXY.outsideColor, (t - 0.28) / 0.72);
      // sprinkle a few near-white stars for sparkle
      if (Math.random() < 0.06) col.lerp(new THREE.Color(0xffffff), 0.7);

      colors[i3 + 0] = col.r;
      colors[i3 + 1] = col.g;
      colors[i3 + 2] = col.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.052,
      map: starTexture,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      transparent: true,
    });

    galaxyGroup.add(new THREE.Points(geo, mat));
  }

  /* --- Bright galactic core glow --- */
  const coreGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: starTexture,
      color: 0xe9eaf0,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  coreGlow.scale.setScalar(2.4);
  galaxyGroup.add(coreGlow);

  // ease the galaxy into a cinematic tilt
  galaxyGroup.rotation.x = 0.62;
  scene.add(galaxyGroup);

  /* --- Distant starfield behind the galaxy --- */
  const dustCount = 1400;
  const positions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 24;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: 0xf2efe9,
      size: 0.02,
      map: starTexture,
      transparent: true,
      opacity: 0.45,
      sizeAttenuation: true,
      depthWrite: false,
    })
  );
  scene.add(dust);

  /* --- Mouse parallax --- */
  window.addEventListener("mousemove", (e) => {
    mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* --- Render loop --- */
  const clock = new THREE.Clock();
  (function tick() {
    const t = clock.getElapsedTime();

    // the galaxy slowly revolves; the core glow breathes
    galaxyGroup.rotation.y = t * 0.055;
    const s = 2.4 + Math.sin(t * 1.6) * 0.12;
    coreGlow.scale.setScalar(s);

    dust.rotation.y = t * 0.008;

    if (!prefersReducedMotion) {
      camera.position.x += (cameraTarget.x + mouse.x * 0.45 - camera.position.x) * 0.05;
      camera.position.y += (cameraTarget.y - mouse.y * 0.35 - camera.position.y) * 0.05;
      camera.position.z += (cameraTarget.z - camera.position.z) * 0.05;
      galaxyGroup.rotation.x += (0.62 + cameraTarget.rx - galaxyGroup.rotation.x) * 0.04;
      galaxyGroup.rotation.z += (cameraTarget.ry * 0.25 - galaxyGroup.rotation.z) * 0.04;
    }
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })();

  /* --- Scene re-framing per section (scroll) --- */
  const shots = [
    { x: 0, y: 0, z: 7, rx: 0, ry: 0 },          // hero: frontal wide
    { x: -2.4, y: 0.6, z: 5.2, rx: 0.3, ry: 0.9 }, // manifesto: 3/4 angle
    { x: 2.6, y: -0.4, z: 5.8, rx: -0.2, ry: -1.1 }, // services: reverse angle
    { x: 0, y: 2.2, z: 4.6, rx: 1.0, ry: 0.2 },    // work: top-down crane
    { x: -1.2, y: -1.6, z: 5.4, rx: -0.6, ry: 0.5 }, // process: low angle
    { x: 0, y: 0, z: 0, rx: 0, ry: 0 },            // (reserved)
    { x: 2.2, y: 1.5, z: 6.2, rx: 0.7, ry: -0.7 }, // pricing: high wide
    { x: -2.8, y: -0.6, z: 5, rx: -0.25, ry: 1.3 }, // about: intimate side angle
    { x: 1.2, y: -2.1, z: 5.6, rx: -0.85, ry: -0.4 }, // faq: low dutch
    { x: 0, y: 0, z: 3.4, rx: 0, ry: Math.PI },    // contact: push-in, flipped
  ];

  document.querySelectorAll("[data-scene]").forEach((sectionEl) => {
    const idx = parseInt(sectionEl.dataset.scene, 10);
    const shot = shots[idx] || shots[0];
    ScrollTrigger.create({
      trigger: sectionEl,
      start: "top 55%",
      end: "bottom 55%",
      onEnter: () => frameShot(shot),
      onEnterBack: () => frameShot(shot),
    });
  });

  function frameShot(shot) {
    if (prefersReducedMotion) return;
    gsap.to(cameraTarget, {
      x: shot.x, y: shot.y, z: shot.z, rx: shot.rx, ry: shot.ry,
      duration: 1.6, ease: "power3.out",
    });
  }
}

/* ------------------------------------------------------------
   Preloader
------------------------------------------------------------ */
const preloader = document.getElementById("preloader");
const countEl = document.getElementById("preloaderCount");
const barEl = document.getElementById("preloaderBar");

const loadState = { p: 0 };
gsap.to(loadState, {
  p: 100,
  duration: prefersReducedMotion ? 0.1 : 2.2,
  ease: "power2.inOut",
  onUpdate() {
    const v = Math.round(loadState.p);
    countEl.textContent = String(v).padStart(2, "0");
    barEl.style.width = v + "%";
  },
  onComplete: introSequence,
});

function introSequence() {
  const tl = gsap.timeline();

  tl.to(preloader, {
    yPercent: -100,
    duration: prefersReducedMotion ? 0 : 0.9,
    ease: "power4.inOut",
    onComplete: () => (preloader.style.display = "none"),
  });

  // Letterbox bars slide in — the film starts
  tl.to(".letterbox", { height: "4vh", duration: 1, ease: "power3.inOut" }, "-=0.4");

  // Hero title rises line by line
  tl.from(".hero__word", {
    yPercent: 120,
    duration: 1.1,
    stagger: 0.12,
    ease: "power4.out",
    onComplete() {
      // unclip and enable hover-grow only after GSAP is done with transforms
      document.querySelectorAll(".hero__line").forEach((l) => (l.style.overflow = "visible"));
      document.body.classList.add("intro-done");
    },
  }, "-=0.7");

  tl.from(".hero__sub, .hero__reel, .hero__meta, .hero__scroll, .hero__frame-info, .header", {
    opacity: 0,
    y: 20,
    duration: 0.8,
    stagger: 0.08,
    ease: "power2.out",
  }, "-=0.6");
}

/* ------------------------------------------------------------
   Scroll animations
------------------------------------------------------------ */

/* Manifesto: word-by-word ink-in.
   Rebuilt on language switch, so it lives in a function. */
let manifestoTween = null;
function buildManifesto() {
  const manifesto = document.querySelector(".manifesto__text");
  if (!manifesto) return;

  if (manifestoTween) {
    if (manifestoTween.scrollTrigger) manifestoTween.scrollTrigger.kill();
    manifestoTween.kill();
    manifestoTween = null;
  }

  const nodes = Array.from(manifesto.childNodes);
  manifesto.innerHTML = "";
  let lastWordSpan = null;

  const addWord = (w, wrapTag) => {
    // Attach leading punctuation to the previous word so "film ," never happens
    if (/^[,.;:!?]/.test(w) && lastWordSpan) {
      lastWordSpan.textContent += w.charAt(0);
      w = w.slice(1);
      if (!w) return;
    }
    const span = document.createElement("span");
    span.className = "word";
    span.textContent = w;
    if (wrapTag) {
      const wrap = document.createElement(wrapTag);
      wrap.appendChild(span);
      manifesto.appendChild(wrap);
    } else {
      manifesto.appendChild(span);
    }
    manifesto.appendChild(document.createTextNode(" "));
    lastWordSpan = span;
  };

  nodes.forEach((node) => {
    const wrapTag = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : null;
    node.textContent.split(/\s+/).filter(Boolean).forEach((w) => addWord(w, wrapTag));
  });

  manifestoTween = gsap.to(".manifesto__text .word", {
    opacity: 1,
    stagger: 0.06,
    ease: "none",
    scrollTrigger: {
      trigger: ".manifesto",
      start: "top 70%",
      end: "center 45%",
      scrub: true,
    },
  });
}
buildManifesto();

/* Stat counters — IntersectionObserver so they fire regardless of
   how the page is scrolled (Lenis, native, anchor jump, iframe) */
document.querySelectorAll(".stat__num").forEach((el) => {
  const target = parseInt(el.dataset.count, 10);
  let started = false;

  const run = () => {
    if (started) return;
    started = true;
    const state = { v: 0 };
    gsap.to(state, {
      v: target,
      duration: 1.6,
      ease: "power2.out",
      onUpdate: () => (el.textContent = Math.round(state.v)),
      onComplete: () => (el.textContent = target),
    });
  };

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            run();
            io.disconnect();
          }
        });
      },
      { threshold: 0.2 }
    );
    io.observe(el);
  } else {
    run();
  }
});

/* Generic rise-in for list items and cards */
gsap.utils.toArray(".service, .work-card, .process__step, .stat, .price-card, .faq__item, .about__photo, .about__body").forEach((el, i) => {
  gsap.from(el, {
    opacity: 0,
    y: 50,
    duration: 0.9,
    ease: "power3.out",
    scrollTrigger: { trigger: el, start: "top 88%", once: true },
    delay: (i % 4) * 0.06,
  });
});

/* Contact title lines */
gsap.from(".contact__line", {
  yPercent: 110,
  duration: 1,
  stagger: 0.12,
  ease: "power4.out",
  scrollTrigger: { trigger: ".contact", start: "top 60%", once: true },
  onComplete() {
    // unclip and enable hover-grow only after GSAP is done with transforms
    document.querySelectorAll(".contact__line").forEach((l) => (l.style.overflow = "visible"));
    document.body.classList.add("contact-revealed");
  },
});

/* Section tags */
gsap.utils.toArray(".section__tag").forEach((el) => {
  gsap.from(el, {
    opacity: 0,
    x: -24,
    duration: 0.7,
    ease: "power2.out",
    scrollTrigger: { trigger: el, start: "top 90%", once: true },
  });
});

/* ------------------------------------------------------------
   Hero showreel: autoplay muted, unmute toggle, placeholder
   state when no video file is present yet
------------------------------------------------------------ */
const reel = document.querySelector(".hero__reel");
if (reel) {
  const video = reel.querySelector(".hero__reel-video");
  const soundBtn = reel.querySelector(".hero__reel-sound");
  const source = video.querySelector("source");

  const markEmpty = () => reel.classList.add("hero__reel--empty");
  source.addEventListener("error", markEmpty);
  video.addEventListener("error", markEmpty);
  video.addEventListener("loadeddata", () => {
    reel.classList.remove("hero__reel--empty");
    // some browsers pause autoplay for offscreen/late loads — nudge it
    video.play().catch(() => {});
  });

  // lazy-load the reel after the page is done with critical work
  const loadReel = () => {
    if (source.src) return;
    source.src = VIDEOS.hero || source.dataset.src;
    video.load();
  };
  if (document.readyState === "complete") loadReel();
  else window.addEventListener("load", loadReel);

  // pause the loop while offscreen to save battery/bandwidth
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!source.src) return;
          if (entry.isIntersecting) video.play().catch(() => {});
          else video.pause();
        }),
      { threshold: 0.1 }
    ).observe(video);
  }

  soundBtn.addEventListener("click", () => {
    video.muted = !video.muted;
    if (!video.muted) video.play().catch(() => {});
    soundBtn.textContent = video.muted ? t("reel.unmute") : t("reel.mute");
    soundBtn.setAttribute("aria-label", video.muted ? "Unmute showreel" : "Mute showreel");
  });
}

/* ------------------------------------------------------------
   FAQ accordion: opening one closes the others
------------------------------------------------------------ */
const faqItems = document.querySelectorAll(".faq__item");
faqItems.forEach((item) => {
  item.addEventListener("toggle", () => {
    if (item.open) faqItems.forEach((other) => other !== item && (other.open = false));
  });
});

/* ------------------------------------------------------------
   Selected Takes grid: lazy-load videos from the VIDEOS config,
   hover to preview, click to open the lightbox
------------------------------------------------------------ */
const lightbox = document.getElementById("lightbox");
const workCards = document.querySelectorAll(".work-card");

workCards.forEach((card) => {
  const idx = parseInt(card.dataset.take, 10);
  const src = VIDEOS.takes[idx] || "";
  const video = card.querySelector("video");

  if (!src) {
    // empty slot: gray placeholder + COMING SOON label
    card.classList.add("work-card--soon");
    card.dataset.cursor = "hover";
    card.removeAttribute("role");
    card.removeAttribute("tabindex");
    return;
  }
  card.classList.remove("work-card--soon");
  card.dataset.video = src;

  // lazy-load: attach src only when the card nears the viewport
  const load = () => {
    if (!video.src) video.src = src;
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            load();
            io.disconnect();
          }
        }),
      { rootMargin: "300px" }
    );
    io.observe(card);
  } else {
    load();
  }

  // muted preview on hover / focus
  const preview = () => {
    load();
    video.play().catch(() => {});
  };
  const stopPreview = () => {
    video.pause();
    video.currentTime = 0;
  };
  card.addEventListener("mouseenter", preview);
  card.addEventListener("mouseleave", stopPreview);
  card.addEventListener("focus", preview);
  card.addEventListener("blur", stopPreview);
});

if (lightbox) {
  const lbVideo = lightbox.querySelector(".lightbox__video");
  const lbCaption = document.getElementById("lightboxCaption");
  const lbClose = document.getElementById("lightboxClose");

  const openLightbox = (card) => {
    lbVideo.src = card.dataset.video;
    lbCaption.textContent =
      card.querySelector(".work-card__badge").textContent +
      " — " +
      card.querySelector(".work-card__title").textContent;
    lightbox.hidden = false;
    document.documentElement.style.overflow = "hidden";
    if (lenis) lenis.stop();
    lbVideo.play().catch(() => {});
  };

  const closeLightbox = () => {
    lbVideo.pause();
    lbVideo.removeAttribute("src");
    lbVideo.load();
    lightbox.hidden = true;
    document.documentElement.style.overflow = "";
    if (lenis) lenis.start();
  };

  workCards.forEach((card) => {
    card.addEventListener("click", () => {
      if (card.dataset.video) openLightbox(card);
    });
    card.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && card.dataset.video) {
        e.preventDefault();
        openLightbox(card);
      }
    });
  });

  lbClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lightbox.hidden) closeLightbox();
  });
}

/* ------------------------------------------------------------
   Custom cursor
------------------------------------------------------------ */
const cursor = document.getElementById("cursor");
const follower = document.getElementById("cursorFollower");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

if (finePointer) {
  const pos = { x: -100, y: -100 };
  const fpos = { x: -100, y: -100 };

  window.addEventListener("mousemove", (e) => {
    pos.x = e.clientX;
    pos.y = e.clientY;
  });

  gsap.ticker.add(() => {
    fpos.x += (pos.x - fpos.x) * 0.16;
    fpos.y += (pos.y - fpos.y) * 0.16;
    cursor.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
    follower.style.transform = `translate(${fpos.x}px, ${fpos.y}px) translate(-50%, -50%)`;
  });

  document.querySelectorAll("[data-cursor]").forEach((el) => {
    el.addEventListener("mouseenter", () => {
      follower.classList.add(el.dataset.cursor === "view" ? "is-view" : "is-hover");
    });
    el.addEventListener("mouseleave", () => {
      follower.classList.remove("is-view", "is-hover");
    });
  });
}

/* ------------------------------------------------------------
   Timecode clock in the header
------------------------------------------------------------ */
const clockEl = document.getElementById("clock");
let frames = 0;
setInterval(() => {
  frames = (frames + 1) % 24;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  clockEl.textContent = `${hh}:${mm}:${ss}:${String(frames).padStart(2, "0")}`;
}, 1000 / 24);

/* ------------------------------------------------------------
   Anchor links work with Lenis
------------------------------------------------------------ */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const target = document.querySelector(a.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6 });
    else target.scrollIntoView({ behavior: "smooth" });
  });
});
