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
  // Each stop is either on the town map or inside the store's customer service
  // centre. Between scenes the map dives into the entrance while the room fades in.
  const tour = document.querySelector(".tour");
  const town = tour && tour.querySelector(".town");
  const room = tour && tour.querySelector(".room");
  const FOCUS = window.TOUR_FOCUS || {}, ROOM = window.ROOM_FOCUS || {};
  const stops = tour ? [...tour.querySelectorAll(".stop")] : [];
  const pins = town ? [...town.querySelectorAll(".pin")] : [];
  const screens = room ? [...room.querySelectorAll(".screen")] : [];
  const route = town && town.querySelector(".route");
  const dots = tour ? [...tour.querySelectorAll(".dots button")] : [];
  let active = -1;

  // Where a focus box should sit on screen, and at what zoom (units per pixel).
  function camera(box, kind, W, H) {
    const [x0, y0, x1, y1] = box;
    const narrow = W < 760;
    const pad = kind.startsWith("overview") ? 0 : 24;
    const fw = x1 - x0 + pad * 2, fh = y1 - y0 + pad * 2;
    let aw, ah, ax, ay;
    if (kind === "overview-first") {
      aw = W * (narrow ? 0.96 : 0.8); ah = H * (narrow ? 0.42 : 0.44); ax = W / 2; ay = H * 0.74;
    } else if (narrow) {
      aw = W * 0.9; ah = H * 0.44; ax = W / 2; ay = H * 0.28;
    } else {
      const cardRight = Math.min(W * 0.4, 420) + Math.max(40, (W - 1200) / 2 + 40);
      aw = (W - cardRight) * 0.84; ah = H * 0.7; ax = cardRight + (W - cardRight) / 2; ay = H * 0.52;
    }
    const cap = { "overview-first": 0, overview: 0, map: 0.42, entrance: 0.05, room: 0 }[kind] ?? 0;
    const upp = Math.max(fw / aw, fh / ah, cap);
    return { upp, cx: (x0 + x1) / 2 + (W / 2 - ax) * upp, cy: (y0 + y1) / 2 + (H / 2 - ay) * upp };
  }

  function plan(i, W, H) {
    const st = stops[i], key = st.dataset.key, inRoom = st.dataset.scene === "room";
    const mapKind = inRoom ? "entrance" : key === "all" ? (i === 0 ? "overview-first" : "overview") : "map";
    return {
      map: camera(FOCUS[inRoom ? "entrance" : key], mapKind, W, H),
      room: camera(ROOM[inRoom ? (W < 760 ? "screen" : "monitor") : "room"], "room", W, H),
      inRoom: inRoom ? 1 : 0,
    };
  }

  function view(svg, a, b, t, W, H) {
    const upp = Math.exp(lerp(Math.log(a.upp), Math.log(b.upp), t));
    const cx = lerp(a.cx, b.cx, t), cy = lerp(a.cy, b.cy, t);
    svg.setAttribute("viewBox", `${(cx - W / 2 * upp).toFixed(2)} ${(cy - H / 2 * upp).toFixed(2)} ${(W * upp).toFixed(2)} ${(H * upp).toFixed(2)}`);
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
    const st = stops[i], key = st.dataset.key;
    pins.forEach(p => p.classList.toggle("is-active", p.dataset.stop === key));
    if (st.dataset.scene === "room") screens.forEach(sc => sc.classList.toggle("on", sc.dataset.key === key));
    dots.forEach((d, j) => {
      d.classList.toggle("is-active", j === i);
      j === i ? d.setAttribute("aria-current", "step") : d.removeAttribute("aria-current");
    });
  }

  function updateTour() {
    if (!tour || !town || reduce) return;
    const W = town.clientWidth, H = town.clientHeight;
    const total = tour.offsetHeight - H;
    const p = clamp(-tour.getBoundingClientRect().top / Math.max(total, 1), 0, 1);
    const s = p * (stops.length - 1);
    const i = Math.min(Math.floor(s), stops.length - 2);
    const t = smooth(0.28, 0.82, s - i);
    const a = plan(i, W, H), b = plan(i + 1, W, H);
    view(town, a.map, b.map, t, W, H);
    if (room) {
      view(room, a.room, b.room, t, W, H);
      // The room appears late on the way in and leaves early on the way out,
      // so the dive into the entrance reads before the cut.
      const k = a.inRoom === b.inRoom ? a.inRoom : (b.inRoom ? smooth(0.55, 0.9, t) : 1 - smooth(0.1, 0.45, t));
      room.style.opacity = k.toFixed(3);
      town.style.opacity = (1 - k).toFixed(3);
      room.style.visibility = k < 0.01 ? "hidden" : "visible";
    }
    const firstRoute = stops.findIndex(x => x.dataset.key === "cisco") - 1;
    if (route) route.style.strokeDasharray = `${clamp((s - firstRoute) / 2, 0, 1).toFixed(3)} 1`;
    setActive(Math.round(s));
  }

  if (tour && !reduce) {
    tour.style.height = `${stops.length * 90 + 10}vh`;
    dots.forEach((d, j) => d.addEventListener("click", () => {
      const total = tour.offsetHeight - town.clientHeight;
      const top = tour.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + total * (j / (stops.length - 1)), behavior: "smooth" });
    }));
  } else if (tour) {
    stops.forEach(s => { s.classList.add("is-active"); s.removeAttribute("inert"); });
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
