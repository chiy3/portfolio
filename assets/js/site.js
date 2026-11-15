// Eric Chi — portfolio interactions. No dependencies.
// The map is a live 3D scene (assets/js/town3d.js, exposed as window.Town3D);
// the storefront, aisle and service desk are SVG illustrations.
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

  /* ---------- Tour ---------- */
  // window.TOUR_KEYS lists keyframes: a scene (map, facade, aisle, room), a focus
  // in that scene and, optionally, the card to show. Card-less frames are the walk-in.
  const tour = document.querySelector(".tour");
  const KEYS = window.TOUR_KEYS || [], FOCUS = window.TOUR_FOCUS || {};
  const scenes = {};
  if (tour) tour.querySelectorAll(".scene").forEach(el => scenes[el.dataset.scene] = el);
  const stage = tour && tour.querySelector(".stage");
  const cards = tour ? [...tour.querySelectorAll(".stop")] : [];
  const screens = scenes.room ? [...scenes.room.querySelectorAll(".screen")] : [];
  const doors = scenes.facade ? [...scenes.facade.querySelectorAll(".door")] : [];
  const dots = tour ? [...tour.querySelectorAll(".dots button")] : [];
  const weights = KEYS.slice(1).map((k, i) => (KEYS[i].card < 0 && k.card < 0) ? 0.55 : (KEYS[i].card < 0 || k.card < 0) ? 0.8 : 1);
  const totalW = weights.reduce((a, b) => a + b, 0);
  let activeCard = -2, activeScreen = "";
  const town = () => window.Town3D || null;

  // Camera for the SVG scenes: where a focus box sits on screen, at what zoom.
  function camera(box, card, W, H) {
    const [x0, y0, x1, y1] = box, narrow = W < 760;
    const fw = x1 - x0 + 40, fh = y1 - y0 + 40;
    let aw, ah, ax, ay;
    if (!card) { aw = W * (narrow ? 2.2 : 0.92); ah = H * (narrow ? 0.8 : 0.86); ax = W / 2; ay = H / 2; }
    else if (narrow) { aw = W * 0.9; ah = H * 0.44; ax = W / 2; ay = H * 0.28; }
    else {
      const cardRight = Math.min(W * 0.4, 420) + Math.max(40, (W - 1200) / 2 + 40);
      aw = (W - cardRight) * 0.84; ah = H * 0.7; ax = cardRight + (W - cardRight) / 2; ay = H * 0.52;
    }
    const upp = Math.max(fw / aw, fh / ah);
    return { upp, cx: (x0 + x1) / 2 + (W / 2 - ax) * upp, cy: (y0 + y1) / 2 + (H / 2 - ay) * upp };
  }
  const pushSvg = (c, f) => ({ upp: c.upp * f, cx: c.cx, cy: c.cy });
  function setView(svg, a, b, t, W, H) {
    const upp = Math.exp(lerp(Math.log(a.upp), Math.log(b.upp), t));
    const cx = lerp(a.cx, b.cx, t), cy = lerp(a.cy, b.cy, t);
    svg.setAttribute("viewBox", `${(cx - W / 2 * upp).toFixed(2)} ${(cy - H / 2 * upp).toFixed(2)} ${(W * upp).toFixed(2)} ${(H * upp).toFixed(2)}`);
  }
  function camFor(i, scene, W, H) {
    const k = KEYS[i];
    if (scene === "map") {
      const T = town(); if (!T) return null;
      const focus = k.scene === "map" ? k.focus : "entrance";
      return T.poseFor(focus, { card: k.card >= 0 && k.scene === "map", first: i === 0 });
    }
    let focus = k.scene === scene ? k.focus : Object.keys(FOCUS[scene])[0];
    if (scene === "room" && W < 760 && focus === "monitor") focus = "screen";
    return camera(FOCUS[scene][focus], k.card >= 0 && k.scene === scene, W, H);
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
    const T = town();
    if (T) T.setActivePin(KEYS[kf].scene === "map" ? KEYS[kf].focus : "");
    let scr = "";
    for (let j = kf; j < KEYS.length && KEYS[j].scene === "room"; j++) if (KEYS[j].screen) { scr = KEYS[j].screen; break; }
    if (scr && scr !== activeScreen) { activeScreen = scr; screens.forEach(s => s.classList.toggle("on", s.dataset.key === scr)); }
  }

  function updateTour() {
    if (!tour || !stage || reduce || !KEYS.length) return;
    const W = stage.clientWidth, H = stage.clientHeight;
    const total = tour.offsetHeight - H;
    const p = clamp(-tour.getBoundingClientRect().top / Math.max(total, 1), 0, 1);
    let acc = 0, i = 0, f = 0;
    const target = p * totalW;
    for (; i < weights.length; i++) {
      if (acc + weights[i] >= target || i === weights.length - 1) { f = clamp((target - acc) / weights[i], 0, 1); break; }
      acc += weights[i];
    }
    const A = KEYS[i], B = KEYS[i + 1];
    const t = (A.card < 0 && B.card < 0) ? smooth(0, 1, f) : smooth(0.22, 0.85, f);
    const T = town();

    for (const [name, el] of Object.entries(scenes)) {
      const isMap = name === "map";
      let op = 0;
      if (A.scene === name || B.scene === name) {
        const ca = camFor(i, name, W, H), cb = camFor(i + 1, name, W, H);
        const view = (a, b) => {
          if (isMap) { if (T && a && b) T.applyPose(a, b, t); }
          else setView(el, a, b, t, W, H);
        };
        if (A.scene === name && B.scene === name) { view(ca, cb); op = 1; }
        else if (A.scene === name) { view(ca, isMap ? (ca && T.push(ca, 0.45)) : pushSvg(ca, 0.45)); op = 1 - smooth(0.35, 0.85, t); }
        else { view(isMap ? (cb && T.push(cb, 1.6)) : pushSvg(cb, 1.6), cb); op = smooth(0.35, 0.85, t); }
      }
      el.style.opacity = op.toFixed(3);
      el.style.visibility = op < 0.01 ? "hidden" : "visible";
      if (isMap && T) T.setVisible(op >= 0.01);
    }
    if (doors.length) {
      const da = A.doors ?? (A.scene === "facade" ? 0 : 1), db = B.doors ?? (B.scene === "facade" ? 0 : 1);
      const open = A.scene === "facade" || B.scene === "facade" ? lerp(da, db, t) : 0;
      doors.forEach(d => d.setAttribute("transform", `translate(${(d.classList.contains("door-l") ? -1 : 1) * open * 120},0)`));
    }
    const nearest = f < 0.5 ? i : i + 1;
    setCard(KEYS[nearest].card, nearest);
    const firstRoute = KEYS.findIndex(k => k.focus === "cisco");
    if (T) T.setRoute(clamp((i + f - (firstRoute - 1)) / 2, 0, 1));
  }

  if (tour && !reduce && KEYS.length) {
    tour.style.height = `${totalW * 64 + 100}vh`;
    const cardKF = cards.map((_, c) => KEYS.findIndex(k => k.card === c));
    dots.forEach((d, j) => d.addEventListener("click", () => {
      const totalPx = tour.offsetHeight - stage.clientHeight;
      const top = tour.getBoundingClientRect().top + scrollY;
      const w = weights.slice(0, cardKF[j]).reduce((a, b) => a + b, 0);
      scrollTo({ top: top + totalPx * (w / totalW), behavior: "smooth" });
    }));
  } else if (tour) {
    cards.forEach(s => { s.classList.add("is-active"); s.removeAttribute("inert"); });
    if (screens[0]) screens[0].classList.add("on");
    const showStill = () => {
      const T = town(); if (!T) return;
      const p = T.poseFor("all", {}); T.applyPose(p, p, 0); T.setRoute(1); T.setVisible(true);
    };
    addEventListener("town3d:ready", showStill); showStill();
  }

  /* ---------- Loop ---------- */
  let ticking = false;
  const frame = () => { updateTour(); updateChapters(); ticking = false; };
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
  addEventListener("town3d:ready", request);
  frame();
})();
