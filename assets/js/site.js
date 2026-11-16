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
  const routeGlow = town && town.querySelector(".route-glow");
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
    if (kind === "overview-first") { aw = W * (narrow ? 1.05 : 0.86); ah = H * (narrow ? 0.38 : 0.45); ax = W / 2; ay = H * (narrow ? 0.78 : 0.765); }
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

  // Eric's avatar walks the route in step with the scroll. When the scroll
  // rests, he wanders a few steps around that spot and stops now and then to
  // say hi, design something, or play with a cat.
  const me = town && town.querySelector(".me");
  const flip = me && me.querySelector(".me-flip");
  const track = town && town.querySelector(".route-track");
  const trackLen = track ? track.getTotalLength() : 0;
  const ISO = [[0.866, 0.5], [-0.866, 0.5], [0.866, -0.5], [-0.866, -0.5]];
  const ACTS = ["hi", "design", "cat"];
  const idle = { ax: 0, ay: 0, ox: 0, oy: 0, tx: 0, ty: 0, state: "rest", until: 0, lastAct: null, scrolledAt: 0, cooldown: 1 };
  let lastRp = -1, facing = -1, walkTimer = null;

  function moveAvatar(rp) {
    if (!me || !trackLen) return;
    const at = track.getPointAtLength(rp * trackLen);
    const ahead = track.getPointAtLength(Math.min(trackLen, rp * trackLen + 2));
    idle.ax = at.x; idle.ay = at.y;
    if (Math.abs(rp - lastRp) > 0.0004 && lastRp >= 0) {
      if (Math.abs(ahead.x - at.x) > 0.2) facing = ahead.x < at.x ? -1 : 1;
      idle.scrolledAt = performance.now();
      me.classList.add("walking");
      clearTimeout(walkTimer);
      walkTimer = setTimeout(() => { if (idle.state !== "walk") me.classList.remove("walking"); }, 180);
    }
    lastRp = rp;
    renderAvatar();
  }

  function renderAvatar() {
    me.setAttribute("transform", `translate(${(idle.ax + idle.ox).toFixed(2)},${(idle.ay + idle.oy).toFixed(2)})`);
    flip.setAttribute("transform", `scale(${facing},1)`);
  }

  function setAct(act) {
    if (act) me.dataset.act = act; else delete me.dataset.act;
  }

  let lastT = 0;
  function idleLoop(t) {
    requestAnimationFrame(idleLoop);
    if (!me || document.hidden || town.style.visibility === "hidden") { lastT = t; return; }
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
    if (t - idle.scrolledAt < 450) {                  // scrolling: drop everything, follow the route
      idle.ox *= 0.8; idle.oy *= 0.8;
      if (idle.state !== "rest") { idle.state = "rest"; idle.until = t + 900; setAct(null); }
      renderAvatar(); return;
    }
    if (idle.state === "walk") {
      const dx = idle.tx - idle.ox, dy = idle.ty - idle.oy, dist = Math.hypot(dx, dy);
      const step = 7 * dt;                             // slow stroll, in map units per second
      if (dist <= step) {
        idle.ox = idle.tx; idle.oy = idle.ty;
        me.classList.remove("walking");
        // After an act, take one or two plain strolls before the next one.
        let act = null;
        if (idle.cooldown > 0) idle.cooldown--;
        else {
          act = ACTS[Math.floor(Math.random() * 3)];
          if (act === idle.lastAct) act = ACTS[(ACTS.indexOf(act) + 1) % 3];
          idle.lastAct = act;
          idle.cooldown = 1 + Math.floor(Math.random() * 2);
        }
        setAct(act);
        idle.state = act ? "act" : "rest";
        idle.until = t + (act ? 3000 + Math.random() * 1500 : 2500 + Math.random() * 2500);
      } else {
        idle.ox += dx / dist * step; idle.oy += dy / dist * step;
        if (Math.abs(dx) > 0.05) facing = dx < 0 ? -1 : 1;
        me.classList.add("walking");
      }
      renderAvatar();
    } else if (t > idle.until) {                       // pick a nearby spot, along the iso grid
      setAct(null);
      const [ux, uy] = ISO[Math.floor(Math.random() * 4)];
      const len = 4 + Math.random() * 7;
      let tx = idle.ox + ux * len, ty = idle.oy + uy * len;
      const r = Math.hypot(tx, ty);
      if (r > 11) { tx *= 11 / r; ty *= 11 / r; }      // stay close to where the tour left him
      idle.tx = tx; idle.ty = ty; idle.state = "walk";
    }
  }
  if (me && !reduce) requestAnimationFrame(idleLoop);
  // Traffic and cloud shadows are SVG animations; hold them still for reduced motion.
  if (town && reduce && town.pauseAnimations) town.pauseAnimations();

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
    if (routeGlow) routeGlow.style.strokeDasharray = `${rp.toFixed(3)} 1`;
    moveAvatar(rp);
    // Light up the stop the tour is on (spotlights are CSS, keyed on data-focus).
    const fk = KEYS[nearest];
    town.dataset.focus = fk.scene !== "map" ? "" : nearest === KEYS.length - 1 ? "end" : nearest === 0 ? "" : fk.focus;
    atHero = i === 0 && f < 0.35;
    if (atHero) startDrift();
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
    if (routeGlow) routeGlow.style.strokeDasharray = "1 0";
    if (town) town.dataset.focus = "end";
    if (screens[0]) screens[0].classList.add("on");
  }

  /* ---------- Hero drift ----------
     While the first view is on screen, the town drifts slowly so it feels alive before
     anyone scrolls; the drift eases out as the tour starts. */
  const stageEl = document.querySelector(".stage");
  let atHero = false, drifting = false, amp = 0;
  function startDrift() {
    if (drifting || reduce || !stageEl) return;
    drifting = true;
    const t0 = performance.now();
    const tick = now => {
      amp += ((atHero && !document.hidden ? 1 : 0) - amp) * 0.04;
      const t = (now - t0) / 1000;
      stageEl.style.setProperty("--dx", (Math.sin(t / 5.5) * 18 * amp).toFixed(2));
      stageEl.style.setProperty("--dy", (Math.sin(t / 7.3 + 1) * 9 * amp).toFixed(2));
      if (atHero || amp > 0.01) requestAnimationFrame(tick);
      else { drifting = false; stageEl.style.setProperty("--dx", 0); stageEl.style.setProperty("--dy", 0); }
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Cursor parallax ----------
     The scene drifts a few pixels toward the cursor, the stars drift the other way and
     the info card floats a little, so the tour reads as a space with depth. Mouse and
     trackpad only; never on touch or with reduced motion. */
  const stage = document.querySelector(".stage");
  if (stage && !reduce && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    stage.classList.add("parallax");
    let tx = 0, ty = 0, x = 0, y = 0, running = false;
    const step = () => {
      x += (tx - x) * 0.07; y += (ty - y) * 0.07;
      stage.style.setProperty("--px", x.toFixed(4));
      stage.style.setProperty("--py", y.toFixed(4));
      if (Math.abs(tx - x) + Math.abs(ty - y) > 0.0005) requestAnimationFrame(step); else running = false;
    };
    const kick = () => { if (!running) { running = true; requestAnimationFrame(step); } };
    addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return;
      const r = stage.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;   // tour off screen: nothing to move
      tx = clamp(e.clientX / innerWidth * 2 - 1, -1, 1);
      ty = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
      kick();
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => { tx = 0; ty = 0; kick(); });
  }

  /* ---------- Loop ---------- */
  let ticking = false;
  const frame = () => { updateTour(); updateChapters(); ticking = false; };
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
  frame();
})();
