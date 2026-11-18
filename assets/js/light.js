// Light, shadow and depth for the homepage spiral.
// A fixed key light from the top left: a sheen and edge highlight on each screen, soft shadows cast onto the
// layer below, blue spill from the lit screen. A glossy floor under the lowest screen with a reflection and a
// contact shadow. On mouse devices the spiral tilts a few degrees toward the cursor.
(() => {
  const B = document.body.classList;
  const spiral = document.querySelector(".spiral");
  if (!spiral) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = spiral.parentElement;
  const layers = [...spiral.querySelectorAll(".layer")];
  const KEY = true, CUR = false, FLOOR = true;

  if (KEY) layers.forEach(l => {
    l.insertAdjacentHTML("afterbegin", '<div class="cast"></div>');
    l.insertAdjacentHTML("beforeend", '<div class="sheen"></div>');
  });

  // Direction the light travels, in screen space (default: from the top left).
  let lx = .7071, ly = .7071, tlx = lx, tly = ly;
  if (CUR && !still && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    addEventListener("pointermove", e => {
      const r = spiral.getBoundingClientRect();
      // the light sits up and away from the cursor side, so the scene is never lit from below
      const dx = (r.left + r.width / 2) - e.clientX, dy = (r.top + r.height / 2) - e.clientY + 260;
      const m = Math.hypot(dx, dy) || 1; tlx = dx / m; tly = dy / m;
    }, { passive: true });
  }

  let clone, cloneLayers, floor, contact;
  if (FLOOR) {
    scene.classList.add("has-floor");
    const refl = document.createElement("div"); refl.className = "reflect"; refl.setAttribute("aria-hidden", "true");
    clone = spiral.cloneNode(true); refl.appendChild(clone); scene.appendChild(refl);
    cloneLayers = [...clone.querySelectorAll(".layer")];
    floor = document.createElement("div"); floor.className = "floor"; scene.appendChild(floor);
    contact = document.createElement("div"); contact.className = "floor-shadow"; scene.appendChild(contact);
  }

  let fy = null, cx = null;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1]) : 0; };
  function frame() {
    requestAnimationFrame(frame);
    const r = scene.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    lx += (tlx - lx) * .06; ly += (tly - ly) * .06;
    const st = spiral.style.transform;
    const rx = num(st, /rotateX\(([-\d.e]+)deg\)/), rz = num(st, /rotateZ\(([-\d.e]+)deg\)/);
    const zs = layers.map(l => num(l.style.transform, /translateZ\(([-\d.e]+)px\)/));
    if (KEY) layers.forEach((l, i) => {
      const rot = (rz + num(l.style.transform, /^rotateZ\(([-\d.e]+)deg\)/)) * Math.PI / 180;
      // screen direction -> the layer's own plane (undo the tilt, then the turn)
      const sy = ly / Math.max(.3, Math.cos(rx * Math.PI / 180));
      const ux = lx * Math.cos(-rot) - sy * Math.sin(-rot), uy = lx * Math.sin(-rot) + sy * Math.cos(-rot);
      const m = Math.hypot(ux, uy) || 1;
      l.style.setProperty("--la", `${Math.atan2(ux / m, -uy / m) * 180 / Math.PI}deg`);
      l.style.setProperty("--sx", `${ux / m * 22}px`);
      l.style.setProperty("--sy", `${uy / m * 22}px`);
      const below = i < layers.length - 1 ? zs[i] - zs[i + 1] : 40;
      l.style.setProperty("--cz", `${-Math.max(8, below * .6)}px`);
    });
    if (FLOOR) {
      clone.style.transform = st;
      cloneLayers.forEach((c, i) => { c.style.transform = layers[i].style.transform; c.className = layers[i].className; });
      const spread = Math.max(...zs) - Math.min(...zs);
      // the floor sits just under the lowest screen, eased so it settles rather than jumps
      let low = null;
      layers.forEach(l => { const q = l.querySelector(".face").getBoundingClientRect(); if (!low || q.bottom > low.bottom) low = q; });
      const want = clamp((low.bottom - r.top + 14) / r.height, .55, .96);
      fy = fy == null ? want : fy + (want - fy) * .05;
      scene.style.setProperty("--fy", `${(fy * 100).toFixed(2)}%`);
      cx = cx == null ? low.left + low.width / 2 - r.left : cx + ((low.left + low.width / 2 - r.left) - cx) * .05;
      contact.style.left = `${cx}px`;
      contact.style.setProperty("--cs", (1 + spread / 500).toFixed(3));
      contact.style.opacity = (.9 - Math.min(.45, spread / 700)).toFixed(3);
    }
  }
  requestAnimationFrame(frame);
})();

// ---------------- Tilt toward the cursor ----------------
(() => {
  const B = document.body.classList;
  const spiral = document.querySelector(".spiral");
  if (!spiral) return;
  const pin = spiral.closest(".pin"), scene = spiral.parentElement;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const layers = [...spiral.querySelectorAll(".layer")];
  let mx = -1, my = -1, vx = 0, vy = 0, lastMove = 0;
  addEventListener("pointermove", e => { if (mx >= 0) { vx = e.clientX - mx; vy = e.clientY - my; } mx = e.clientX; my = e.clientY; lastMove = performance.now(); }, { passive: true });

  if (fine) {
    // wrap the spiral (and its reflection, if any) in a tilting holder
    const wrap = el => { const w = document.createElement("div"); w.className = "tilt"; el.parentElement.insertBefore(w, el); w.appendChild(el); return w; };
    const ws = [wrap(spiral)];
    let tx = 0, ty = 0, ax = 0, ay = 0, refl = null;
    const tick = () => {
      if (!refl) { const c = document.querySelector(".reflect .spiral"); if (c) { refl = c; ws.push(wrap(c)); } }
      const r = scene.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) { requestAnimationFrame(tick); return; }
      if (mx >= 0) { tx = ((mx - (r.left + r.width / 2)) / r.width) * 2; ty = ((my - (r.top + r.height / 2)) / r.height) * 2; }
      ax += (Math.max(-1, Math.min(1, tx)) - ax) * .05; ay += (Math.max(-1, Math.min(1, ty)) - ay) * .05;
      ws.forEach(w => w.style.transform = `rotateY(${ax * 9}deg) rotateX(${-ay * 7}deg)`);
      requestAnimationFrame(tick);
    };
    tick();
  }

})();
