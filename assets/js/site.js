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
  // The tour is a list of keyframes (window.TOUR_KEYS). Each names a scene
  // (map, facade, aisle, room), a focus box in that scene and, optionally, the
  // card to show. Keyframes without a card are the walk-in: map -> storefront
  // (doors open) -> main aisle -> customer service desk.
  const tour = document.querySelector(".tour");
  const KEYS = window.TOUR_KEYS || [], FOCUS = window.TOUR_FOCUS || {};
  const scenes = {};
  if (tour) tour.querySelectorAll(".scene").forEach(el => scenes[el.dataset.scene] = el);
  const town = scenes.map;
  const cards = tour ? [...tour.querySelectorAll(".stop")] : [];
  const pins = town ? [...town.querySelectorAll(".pin")] : [];
  const screens = scenes.room ? [...scenes.room.querySelectorAll(".screen")] : [];
  const doors = scenes.facade ? [...scenes.facade.querySelectorAll(".door")] : [];
  const route = town && town.querySelector(".route");
  const dots = tour ? [...tour.querySelectorAll(".dots button")] : [];
  const weights = KEYS.slice(1).map((k, i) => (KEYS[i].card < 0 && k.card < 0) ? 0.55 : (KEYS[i].card < 0 || k.card < 0) ? 0.8 : 1);
  const totalW = weights.reduce((a, b) => a + b, 0);
  let activeCard = -2, activeScreen = "";

  function camera(box, kind, card, W, H) {
    const [x0, y0, x1, y1] = box;
    const narrow = W < 760;
    const pad = kind === "overview" || kind === "overview-first" ? 0 : 20;
    const fw = x1 - x0 + pad * 2, fh = y1 - y0 + pad * 2;
    let aw, ah, ax, ay;
    if (kind === "overview-first") { aw = W * (narrow ? 0.96 : 0.7); ah = H * (narrow ? 0.34 : 0.34); ax = W / 2; ay = H * (narrow ? 0.8 : 0.81); }
    else if (!card) {
      // Walk-in shots: on a portrait screen, fill the height and crop the sides.
      aw = W * (narrow ? 2.2 : 0.92); ah = H * (narrow ? 0.8 : 0.86); ax = W / 2; ay = H / 2;
    }
    else if (narrow) { aw = W * 0.9; ah = H * 0.44; ax = W / 2; ay = H * 0.28; }
    else {
      const cardRight = Math.min(W * 0.4, 420) + Math.max(40, (W - 1200) / 2 + 40);
      aw = (W - cardRight) * 0.84; ah = H * 0.7; ax = cardRight + (W - cardRight) / 2; ay = H * 0.52;
    }
    const cap = kind === "map" ? 0.42 : 0;
    const upp = Math.max(fw / aw, fh / ah, cap);
    return { upp, cx: (x0 + x1) / 2 + (W / 2 - ax) * upp, cy: (y0 + y1) / 2 + (H / 2 - ay) * upp };
  }

  function camFor(i, W, H) {
    const k = KEYS[i];
    let focus = k.focus;
    if (k.scene === "room" && W < 760 && focus === "monitor") focus = "screen";
    const kind = k.scene !== "map" ? "free" : k.focus === "all" ? (i === 0 ? "overview-first" : "overview") : k.focus === "entrance" ? "entrance" : "map";
    return camera(FOCUS[k.scene][focus], kind, k.card >= 0, W, H);
  }
  const push = (c, f) => ({ upp: c.upp * f, cx: c.cx, cy: c.cy });

  function setView(svg, a, b, t, W, H) {
    const upp = Math.exp(lerp(Math.log(a.upp), Math.log(b.upp), t));
    const cx = lerp(a.cx, b.cx, t), cy = lerp(a.cy, b.cy, t);
    svg.setAttribute("viewBox", `${(cx - W / 2 * upp).toFixed(2)} ${(cy - H / 2 * upp).toFixed(2)} ${(W * upp).toFixed(2)} ${(H * upp).toFixed(2)}`);
  }

  function setCard(c, kf) {
    if (c !== activeCard) {
      activeCard = c;
      cards.forEach((el, j) => {
        const on = j === c;
        el.classList.toggle("is-active", on);
        el.toggleAttribute("inert", !on);
        el.setAttribute("aria-hidden", on ? "false" : "true");
      });
      dots.forEach((d, j) => {
        d.classList.toggle("is-active", j === c);
        j === c ? d.setAttribute("aria-current", "step") : d.removeAttribute("aria-current");
      });
    }
    const pinKey = KEYS[kf].scene === "map" ? KEYS[kf].focus : "walmart";
    pins.forEach(p => p.classList.toggle("is-active", p.dataset.stop === pinKey));
    // In the room, show the screen of this keyframe, or of the next card if we're arriving.
    let scr = "";
    for (let j = kf; j < KEYS.length && KEYS[j].scene === "room"; j++) if (KEYS[j].screen) { scr = KEYS[j].screen; break; }
    if (scr && scr !== activeScreen) {
      activeScreen = scr;
      screens.forEach(s => s.classList.toggle("on", s.dataset.key === scr));
    }
  }

  // Eric's avatar walks the route in step with the scroll.
  const me = town && town.querySelector(".me");
  const flip = me && me.querySelector(".me-flip");
  const track = town && town.querySelector(".route-track");
  const trackLen = track ? track.getTotalLength() : 0;
  let lastRp = -1, walkTimer = null, facing = -1;
  function moveAvatar(rp) {
    if (!me || !trackLen) return;
    const at = track.getPointAtLength(rp * trackLen);
    const ahead = track.getPointAtLength(Math.min(trackLen, rp * trackLen + 2));
    me.setAttribute("transform", `translate(${at.x.toFixed(1)},${at.y.toFixed(1)})`);
    if (Math.abs(ahead.x - at.x) > 0.2) facing = ahead.x < at.x ? -1 : 1;
    flip.setAttribute("transform", `scale(${facing},1)`);
    if (Math.abs(rp - lastRp) > 0.0004 && lastRp >= 0) {
      me.classList.add("walking");
      clearTimeout(walkTimer);
      walkTimer = setTimeout(() => me.classList.remove("walking"), 180);
    }
    lastRp = rp;
  }

  function updateTour() {
    if (!tour || !town || reduce || !KEYS.length) return;
    const W = town.clientWidth, H = town.clientHeight;
    const total = tour.offsetHeight - H;
    const p = clamp(-tour.getBoundingClientRect().top / Math.max(total, 1), 0, 1);
    // Position along the weighted keyframe track.
    let acc = 0, i = 0, f = 0;
    const target = p * totalW;
    for (; i < weights.length; i++) {
      if (acc + weights[i] >= target || i === weights.length - 1) { f = clamp((target - acc) / weights[i], 0, 1); break; }
      acc += weights[i];
    }
    const A = KEYS[i], B = KEYS[i + 1];
    const walking = A.card < 0 && B.card < 0;
    const t = walking ? smooth(0, 1, f) : smooth(0.22, 0.85, f);
    const ca = camFor(i, W, H), cb = camFor(i + 1, W, H);

    for (const [name, svg] of Object.entries(scenes)) {
      let op = 0;
      if (A.scene === name && B.scene === name) { setView(svg, ca, cb, t, W, H); op = 1; }
      else if (A.scene === name) { setView(svg, ca, push(ca, 0.45), t, W, H); op = 1 - smooth(0.35, 0.85, t); }
      else if (B.scene === name) { setView(svg, push(cb, 1.6), cb, t, W, H); op = smooth(0.35, 0.85, t); }
      if (name === "map") op = Math.max(op, 0) ; // map is the base layer when nothing else shows
      svg.style.opacity = op.toFixed(3);
      svg.style.visibility = op < 0.01 ? "hidden" : "visible";
    }
    // Sliding doors
    if (doors.length) {
      const da = A.doors ?? (A.scene === "facade" ? 0 : 1), db = B.doors ?? (B.scene === "facade" ? 0 : 1);
      const open = A.scene === "facade" || B.scene === "facade" ? lerp(da, db, t) : 0;
      doors.forEach(d => d.setAttribute("transform", `translate(${(d.classList.contains("door-l") ? -1 : 1) * open * 120},0)`));
    }
    const nearest = f < 0.5 ? i : i + 1;
    setCard(KEYS[nearest].card, nearest);
    const firstRoute = KEYS.findIndex(k => k.focus === "cisco");
    const at = i + f;
    const rp = clamp((at - (firstRoute - 1)) / 2, 0, 1);
    if (route) route.style.strokeDasharray = `${rp.toFixed(3)} 1`;
    moveAvatar(rp);
  }

  if (tour && !reduce && KEYS.length) {
    tour.style.height = `${totalW * 64 + 100}vh`;
    const cardKF = cards.map((_, c) => KEYS.findIndex(k => k.card === c));
    dots.forEach((d, j) => d.addEventListener("click", () => {
      const totalPx = tour.offsetHeight - town.clientHeight;
      const top = tour.getBoundingClientRect().top + scrollY;
      const w = weights.slice(0, cardKF[j]).reduce((a, b) => a + b, 0);
      scrollTo({ top: top + totalPx * (w / totalW), behavior: "smooth" });
    }));
  } else if (tour) {
    cards.forEach(s => { s.classList.add("is-active"); s.removeAttribute("inert"); });
    if (route) route.style.strokeDasharray = "1 0";
    if (screens[0]) screens[0].classList.add("on");
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
