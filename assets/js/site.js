// Eric Chi — portfolio interactions. No dependencies.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

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

  /* ---------- Map tour ---------- */
  const tour = document.querySelector(".tour");
  const svg = tour && tour.querySelector(".town");
  const FOCUS = window.TOUR_FOCUS || {};
  const stops = tour ? [...tour.querySelectorAll(".stop")] : [];
  const pins = svg ? [...svg.querySelectorAll(".pin")] : [];
  const route = svg && svg.querySelector(".route");
  const dots = tour ? [...tour.querySelectorAll(".dots button")] : [];
  let active = -1;

  // Camera for one stop: where its focus box should sit on screen, at what zoom.
  function camera(i, W, H) {
    const key = stops[i].dataset.key;
    const [x0, y0, x1, y1] = FOCUS[key];
    const narrow = W < 760, overview = key === "all";
    const pad = overview ? 0 : 24;
    const fw = x1 - x0 + pad * 2, fh = y1 - y0 + pad * 2;
    let aw, ah, ax, ay; // available area (px) and its centre
    if (overview) {
      const first = i === 0; // leave room for the headline above the map
      aw = W * (narrow ? 0.96 : 0.8); ah = H * (first ? (narrow ? 0.42 : 0.44) : 0.62);
      ax = first || narrow ? W / 2 : W * 0.62; ay = H * (first ? 0.74 : 0.55);
    } else if (narrow) {
      aw = W * 0.86; ah = H * 0.42; ax = W / 2; ay = H * 0.27;
    } else {
      const cardRight = Math.min(W * 0.4, 420) + Math.max(40, (W - 1200) / 2 + 40);
      aw = (W - cardRight) * 0.8; ah = H * 0.62; ax = cardRight + (W - cardRight) / 2; ay = H * 0.52;
    }
    const upp = Math.max(fw / aw, fh / ah, overview ? 0 : 0.42); // units per pixel; cap zoom-in
    return { upp, x: (x0 + x1) / 2 - ax * upp, y: (y0 + y1) / 2 - ay * upp };
  }

  function setActive(i) {
    if (i === active) return;
    active = i;
    stops.forEach((s, j) => {
      const on = j === i;
      s.classList.toggle("is-active", on);
      s.toggleAttribute("inert", !on);
      s.setAttribute("aria-hidden", on ? "false" : "true");
    });
    const key = stops[i].dataset.key;
    pins.forEach(p => p.classList.toggle("is-active", p.dataset.stop === key));
    dots.forEach((d, j) => {
      d.classList.toggle("is-active", j === i);
      j === i ? d.setAttribute("aria-current", "step") : d.removeAttribute("aria-current");
    });
  }

  function updateTour() {
    if (!tour || !svg || reduce) return;
    const W = svg.clientWidth, H = svg.clientHeight;
    const total = tour.offsetHeight - H;
    const p = clamp(-tour.getBoundingClientRect().top / Math.max(total, 1), 0, 1);
    const s = p * (stops.length - 1);
    const i = Math.min(Math.floor(s), stops.length - 2);
    const t = smooth(0.28, 0.82, s - i); // hold on each stop, travel in between
    const a = camera(i, W, H), b = camera(i + 1, W, H);
    const upp = Math.exp(lerp(Math.log(a.upp), Math.log(b.upp), t));
    // Interpolate the screen-centre point, then rebuild the box from the zoom.
    const ca = { x: a.x + W / 2 * a.upp, y: a.y + H / 2 * a.upp };
    const cb = { x: b.x + W / 2 * b.upp, y: b.y + H / 2 * b.upp };
    const cx = lerp(ca.x, cb.x, t), cy = lerp(ca.y, cb.y, t);
    svg.setAttribute("viewBox", `${(cx - W / 2 * upp).toFixed(2)} ${(cy - H / 2 * upp).toFixed(2)} ${(W * upp).toFixed(2)} ${(H * upp).toFixed(2)}`);
    if (route) route.style.strokeDasharray = `${clamp((s - 0.6) / 2.2, 0, 1).toFixed(3)} 1`;
    setActive(Math.round(s));
  }

  if (tour && !reduce) {
    tour.style.height = `${stops.length * 90 + 10}vh`;
    dots.forEach((d, j) => d.addEventListener("click", () => {
      const total = tour.offsetHeight - svg.clientHeight;
      const top = tour.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + total * (j / (stops.length - 1)), behavior: "smooth" });
    }));
  } else if (tour) {
    stops.forEach(s => { s.classList.add("is-active"); s.removeAttribute("inert"); });
    if (route) route.style.strokeDasharray = "1 0";
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
      setTimeout(() => { say.textContent = items[idx].dataset.say; say.classList.remove("swap"); }, reduce ? 0 : 260);
      items.forEach((li, j) => li.classList.toggle("on", j === idx));
      lens.setAttribute("aria-label", `Showing the ${items[idx].textContent.trim().toLowerCase()} view. Activate to switch.`);
    };
    const start = e => {
      if (e.button !== 0) return;
      lens.classList.add("held"); clearInterval(timer);
      show(idx + 1); timer = setInterval(() => show(idx + 1), 1400);
    };
    const stop = () => { lens.classList.remove("held"); clearInterval(timer); };
    lens.addEventListener("pointerdown", start);
    ["pointerup", "pointerleave", "pointercancel"].forEach(t => lens.addEventListener(t, stop));
    lens.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(idx + 1); } });
    lens.addEventListener("contextmenu", e => e.preventDefault());
  }

  /* ---------- Loop ---------- */
  let ticking = false;
  const frame = () => { updateTour(); updateChapters(); ticking = false; };
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
  frame();
})();
