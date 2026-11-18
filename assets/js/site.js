// Eric Chi — portfolio interactions. No dependencies.
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = t => t * t * (3 - 2 * t);

  /* ---------- Chapter indicator ---------- */
  const links = [...document.querySelectorAll(".chapters a")];
  const chapters = links.map(a => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  function updateChapters() {
    let current = chapters[0];
    for (const c of chapters) if (c.getBoundingClientRect().top <= innerHeight * 0.4) current = c;
    links.forEach(a => {
      const on = current && a.getAttribute("href") === "#" + current.id;
      a.classList.toggle("is-active", on);
      on ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current");
    });
  }

  /* ---------- The platform ----------
     Five product screens in a spiral, turning slowly on their own. Scrolling pulls the
     spiral apart and steps a spotlight from layer to layer; the text beside it follows. */
  const section = document.querySelector(".platform");
  const spiral = section && section.querySelector(".spiral");
  const layers = spiral ? [...spiral.querySelectorAll(".layer")] : [];
  const steps = section ? [...section.querySelectorAll(".step")] : [];
  const N = layers.length;
  const ORDER = steps.filter(s => s.dataset.sl).map(s => layers.findIndex(l => l.dataset.sl === s.dataset.sl));
  const RX = 58, RZ = -36, TURN = 30, SPIN = 4, SWAY = 2.5, TWIST = 40, REACH = .5;

  let curStep = null;
  function frame(now) {
    if (!section) return;
    const r = section.getBoundingClientRect();
    const p = clamp(-r.top / Math.max(1, section.offsetHeight - innerHeight), 0, 1);
    // a little apart even at rest, so the first view already reads as a spiral
    const open = .3 + .7 * smooth(clamp(p / .1, 0, 1)) * (1 - smooth(clamp((p - .93) / .07, 0, 1)));
    const span = (p - .1) / .83 * ORDER.length;
    const step = p < .1 ? -1 : p >= .93 ? ORDER.length : clamp(Math.floor(span), 0, ORDER.length - 1);
    const focus = step >= 0 && step < ORDER.length ? ORDER[step] : -1;

    // The camera: a gentle turn with the scroll, and a slow spin and sway of its own.
    const q = clamp((p - .04) / .92, 0, 1);
    let rz = RZ + q * TURN, rx = RX - 3 * Math.sin(q * Math.PI);
    if (!still) { const t = (now || performance.now()) / 1000; rz += t * SPIN; rx += Math.sin(t * .35) * SWAY; }
    spiral.style.transform = `rotateX(${rx}deg) rotateZ(${rz}deg)`;

    const W = spiral.offsetWidth, gap = Math.min(innerHeight * .1, 72) * open + 6, mid = (N - 1) / 2;
    layers.forEach((el, i) => {
      const on = i === focus, k = i - mid;
      const z = (N - 1 - i) * gap + (on ? 50 * open : 0);
      el.style.transform = `rotateZ(${k * TWIST * open}deg) translateX(${REACH * W * open}px) translateZ(${z}px) scale(${on ? 1 + .08 * open : 1})`;
      el.classList.toggle("on", on);
      el.classList.toggle("dim", focus >= 0 && !on);
    });
    if (step !== curStep) {
      curStep = step;
      steps.forEach(s => { const on = +s.dataset.s === step; s.classList.toggle("on", on); s.toggleAttribute("inert", !on); });
    }
  }
  if (section) {
    section.style.height = `${(ORDER.length + 2) * 100 + 40}vh`;
    if (still) {
      addEventListener("scroll", () => requestAnimationFrame(frame), { passive: true });
    } else {
      // keep drawing while the spiral is on screen, so the slow spin never stops
      const loop = now => { const r = section.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) frame(now); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
    addEventListener("resize", () => frame());
    frame();
  }

  /* ---------- Loop ---------- */
  let ticking = false;
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { updateChapters(); ticking = false; }); } };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
  updateChapters();
})();
