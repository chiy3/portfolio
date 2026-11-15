// Eric Chi — portfolio interactions. No dependencies.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Chapter indicator ---------- */
  const bar = document.querySelector(".topbar");
  const links = [...document.querySelectorAll(".chapters a")];
  const chapters = links.map(a => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  const darks = [...document.querySelectorAll(".panel, .next a")];

  function updateBar() {
    const probe = 60; // px from top, where the bar sits
    let current = chapters[0];
    for (const c of chapters) if (c.getBoundingClientRect().top <= window.innerHeight * 0.45) current = c;
    links.forEach(a => {
      const on = current && a.getAttribute("href") === "#" + current.id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
    if (bar) bar.classList.toggle("on-dark", darks.some(d => {
      const r = d.getBoundingClientRect();
      return r.top <= probe && r.bottom >= probe;
    }));
  }

  /* ---------- Ring of project cards ---------- */
  const scroller = document.querySelector(".ring-scroll");
  const cards = [...document.querySelectorAll(".ring .card")];
  const intro = document.querySelector(".intro");
  const hint = document.querySelector(".scroll-hint");
  const caption = document.querySelector(".caption");
  const capLink = caption && caption.querySelector("a");
  const capMetric = caption && caption.querySelector(".metric");
  let lastFront = -1;

  function updateRing() {
    if (!scroller || reduce || !cards.length) return;
    const rect = scroller.getBoundingClientRect();
    const total = scroller.offsetHeight - window.innerHeight;
    const p = clamp(-rect.top / total, 0, 1);
    const vw = window.innerWidth, vh = window.innerHeight;
    const n = cards.length, step = 360 / n;

    // Phase A (0–0.3): cards fan out of a stack into a circle around the intro.
    // Phase B (0.3–1): the circle grows past the screen so its top arc sweeps
    // each project through the front, one at a time.
    // On narrow screens there's no room for a circle around the headline,
    // so the stack goes straight to the arc.
    const narrow = vw < 760;
    const a = narrow ? 0 : ease(clamp(p / 0.3, 0, 1));
    const b = ease(clamp((p - (narrow ? 0.06 : 0.3)) / 0.12, 0, 1));
    const sweep = clamp((p - (narrow ? 0.14 : 0.36)) / (narrow ? 0.84 : 0.62), 0, 1);

    const small = Math.min(vh * 0.42, vw * (vw < 760 ? 0.46 : 0.4));
    const big = Math.max(vw * 1.1, 900);
    const cardW = cards[0].offsetWidth;
    const stepB = ((cardW * 1.35) / big) * 180 / Math.PI;  // arc spacing in degrees
    const stepNow = lerp(step, stepB, b);
    const r = lerp(lerp(0, small, a), big, b);
    const cy = lerp(lerp(vh * 0.3, 0, a), big - vh * 0.04, b);   // stack starts below the headline
    const spin = lerp(-20 + 20 * a, 0, b) - sweep * stepB * (n - 1);

    let front = 0, best = 1e9;
    cards.forEach((card, i) => {
      const theta = i * stepNow + spin;
      const rad = theta * Math.PI / 180;
      const x = r * Math.sin(rad);
      const y = cy - r * Math.cos(rad);
      const norm = ((theta % 360) + 540) % 360 - 180; // -180..180, 0 = top
      if (Math.abs(norm) < best) { best = Math.abs(norm); front = i; }
      const lift = b * Math.max(0, 1 - Math.abs(norm) / (stepB * 0.9));
      const scale = lerp(lerp(0.5, 0.72, a), 0.95, b) * (1 + 0.16 * lift);
      // In the circle, cards only lean a little so their text stays readable;
      // on the arc they follow the curve.
      const tilt = lerp(lerp((i - n / 2) * 5, norm * 0.12, a), norm, b);
      const jitter = (1 - a) * (i - n / 2) * 5;
      card.style.transform = `translate3d(${x + jitter}px, ${y}px, 0) rotate(${tilt}deg) scale(${scale})`;
      card.style.opacity = (b < 0.5 || Math.abs(norm) < 75) ? 1 : 0;
      card.style.zIndex = Math.round(100 - Math.abs(norm));
      card.tabIndex = (b > 0.5 && i !== front) ? -1 : 0;
    });

    if (intro) intro.style.opacity = clamp(1 - b * 1.6, 0, 1);
    if (hint) hint.style.opacity = clamp(1 - p * 12, 0, 1);
    if (caption) {
      caption.style.opacity = clamp((b - 0.4) * 2, 0, 1);
      caption.style.pointerEvents = b > 0.6 ? "auto" : "none";
      if (front !== lastFront && capLink) {
        const c = cards[front];
        capLink.textContent = c.dataset.title;
        capLink.href = c.getAttribute("href");
        if (capMetric) capMetric.textContent = c.dataset.metric;
        lastFront = front;
      }
    }
  }

  /* ---------- Press-and-hold lens ---------- */
  const lens = document.querySelector(".lens");
  if (lens) {
    const say = document.querySelector(".panel .say");
    const items = [...document.querySelectorAll(".views li")];
    let idx = 0, timer = null;
    const show = i => {
      idx = (i + items.length) % items.length;
      say.classList.add("swap");
      setTimeout(() => {
        say.textContent = items[idx].dataset.say;
        say.classList.remove("swap");
      }, reduce ? 0 : 260);
      items.forEach((li, j) => li.classList.toggle("on", j === idx));
      lens.setAttribute("aria-label", `Showing the ${items[idx].textContent.trim().toLowerCase()} view. Activate to switch.`);
    };
    const start = e => {
      if (e.type === "pointerdown" && e.button !== 0) return;
      lens.classList.add("held");
      clearInterval(timer);
      show(idx + 1);
      timer = setInterval(() => show(idx + 1), 1400);
    };
    const stop = () => { lens.classList.remove("held"); clearInterval(timer); };
    lens.addEventListener("pointerdown", start);
    ["pointerup", "pointerleave", "pointercancel"].forEach(t => lens.addEventListener(t, stop));
    lens.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(idx + 1); }
    });
    lens.addEventListener("contextmenu", e => e.preventDefault());
  }

  /* ---------- Loop ---------- */
  let ticking = false;
  const frame = () => { updateRing(); updateBar(); ticking = false; };
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
  frame();
})();
