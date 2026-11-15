// Eric Chi — the tour's town, rendered in real 3D with three.js.
// World units are metres. Layout coordinates (x, y on the ground) match the
// original illustration so the tour's stops stay in the same places.
import * as THREE from "../vendor/three/three.module.min.js";
import { RoomEnvironment } from "../vendor/three/RoomEnvironment.js";

const root = document.querySelector(".scene.town");
const canvas = root && root.querySelector("canvas");
const overlay = root && root.querySelector(".overlay");
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const OX = 205, OY = 205;                       // layout centre
const V = (x, y, z = 0) => new THREE.Vector3(x - OX, z, y - OY);

function fail(err) {
  console.warn("3D town unavailable:", err);
  if (root) root.classList.add("no-webgl");
  window.Town3D = null;
  window.dispatchEvent(new Event("town3d:ready"));
}

try { if (!root || !canvas) throw new Error("no container"); build(); }
catch (e) { fail(e); }

function build() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;      // widely supported; softened with shadow.radius

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 3000);

  // ---------------- Light: sun from the upper left, sky fill
  scene.add(new THREE.HemisphereLight(0xe3eef8, 0xb4c3a2, 0.42));
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.9);
  sun.position.set(-290, 230, 50);            // afternoon sun from the left: long shadows reach out to the right
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -330, right: 330, top: 330, bottom: -330, near: 20, far: 1000 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.5; sun.shadow.radius = 2;
  scene.add(sun);

  // ---------------- Textures drawn on canvas
  const tex = (w, h, draw, rx = 1, ry = 1) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    t.anisotropy = 4;
    return t;
  };
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const speckle = (base, cols, n) => (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = .5 + rnd() * .5; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.5, 1 + rnd() * 1.5); }
    g.globalAlpha = 1;
  };
  const T = {
    grass: tex(256, 256, (g, w, h) => {
      speckle("#93b37a", ["#86a96d", "#a2c088", "#7f9f66", "#a9c58f"], 2600)(g, w, h);
      g.globalAlpha = .035; for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#ffffff" : "#000000"; g.fillRect(0, i * 32, w, 16); } g.globalAlpha = 1;
    }, 40, 40),
    asphalt: tex(128, 128, speckle("#6f757b", ["#62686e", "#7c8288", "#575d63", "#868c92"], 1400), 30, 30),
    lot: tex(128, 128, speckle("#7a8086", ["#6d7379", "#878d93", "#62686e"], 1200), 30, 30),
    concrete: tex(128, 128, (g, w, h) => {
      speckle("#d3d0c9", ["#c8c5be", "#dcd9d2", "#c2bfb8"], 900)(g, w, h);
      g.strokeStyle = "rgba(0,0,0,.08)"; g.lineWidth = 1; g.strokeRect(0, 0, w, h);
    }, 40, 40),
    gravel: tex(128, 128, speckle("#bdbcb6", ["#aeada7", "#cbcac4", "#a5a49f", "#d4d3cd"], 2200), 18, 18),
    soil: tex(64, 64, speckle("#8c7a63", ["#7d6c57", "#9a8870", "#6f604d"], 500), 20, 1),
    panels: tex(256, 128, (g, w, h) => {
      g.fillStyle = "#d8d6d0"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(0,0,0,.1)"; g.lineWidth = 2;
      for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    }, 8, 1),
    dcPanels: tex(256, 128, (g, w, h) => {
      g.fillStyle = "#c7cacd"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 2;
      for (let x = 0; x < w; x += 42) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      g.beginPath(); g.moveTo(0, h * .5); g.lineTo(w, h * .5); g.stroke();
    }, 6, 1),
    curtain: tex(256, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#8fb0cf"); gr.addColorStop(.5, "#5f7f9f"); gr.addColorStop(1, "#7c9cbc");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.globalAlpha = .18; g.fillStyle = "#ffffff";
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(rnd() * w, 0); g.lineTo(rnd() * w + 60, 0); g.lineTo(rnd() * w - 80, h); g.lineTo(rnd() * w - 140, h); g.fill(); }
      g.globalAlpha = 1; g.strokeStyle = "rgba(225,232,240,.7)"; g.lineWidth = 2;
      for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      g.lineWidth = 3; for (let y = 0; y <= h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    }, 1, 1),
    ribbon: tex(256, 256, (g, w, h) => {
      g.fillStyle = "#e1e0db"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#6f8ead"; for (let y = 20; y < h; y += 42) g.fillRect(0, y, w, 18);
      g.fillStyle = "rgba(255,255,255,.35)"; for (let y = 20; y < h; y += 42) g.fillRect(0, y, w, 4);
    }, 3, 1),
    water: tex(256, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#9bc4d8"); gr.addColorStop(1, "#5e98b6");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 1.2;
      for (let i = 0; i < 40; i++) { const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 3, x + 22, y); g.stroke(); }
    }, 1, 1),
    cloud: tex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }),
  };
  const text = (s, { w = 1024, h = 256, bg = null, fg = "#ffffff", font = 600, size = 0.62 } = {}) => tex(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
    g.fillStyle = fg; g.font = `${font} ${Math.round(h * size)}px -apple-system, "SF Pro Display", Inter, "Helvetica Neue", Arial, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(s, w / 2, h / 2 + h * .03);
  });

  // ---------------- Materials and helpers
  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: 0, ...o });
  const mat = {
    asphalt: M(0xffffff, { map: T.asphalt, roughness: .95 }),
    lot: M(0xffffff, { map: T.lot, roughness: .95 }),
    concrete: M(0xffffff, { map: T.concrete, roughness: .9 }),
    grass: M(0xffffff, { map: T.grass, roughness: 1 }),
    soil: M(0xffffff, { map: T.soil }),
    white: M(0xf4f4f2, { roughness: .6 }),
    yellow: M(0xf0c75e, { roughness: .6 }),
    gravel: M(0xffffff, { map: T.gravel, roughness: 1 }),
    glass: M(0x9fbcd8, { roughness: .08, metalness: .6, envMapIntensity: 1.4 }),
    darkGlass: M(0x3c4b5c, { roughness: .1, metalness: .5 }),
    metal: M(0x9aa3ad, { roughness: .45, metalness: .6 }),
    darkMetal: M(0x5f6a74, { roughness: .5, metalness: .5 }),
    trunk: M(0x7d6652),
    leaf: [M(0x6f9a5e), M(0x7fa86a), M(0x5f8a52), M(0x86ad6f)],
    pine: [M(0x4f7d55), M(0x5c8a5f)],
    blue: M(0x2f6fd0, { roughness: .55 }),
    blueDark: M(0x255aa8, { roughness: .55 }),
    red: M(0xd93a3a, { roughness: .6 }),
  };
  const add = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; scene.add(m); return m; };
  // Axis-aligned box from layout corner (x, y), size w×d on the ground, h tall, starting at height z.
  const box = (x, y, w, d, h, material, z = 0, cast = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.copy(V(x + w / 2, y + d / 2, z + h / 2)); return add(m, cast);
  };
  // Flat ground patch: a very thin box, layered by height to avoid flicker.
  const flat = (x, y, w, d, material, lift = 0.05, th = 0.1) => box(x, y, w, d, th, material, lift, false);
  const repeatTex = (t, rx, ry) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); return c; };
  // Box with different materials per face (+x, -x, top, bottom, +z(front, +y layout), -z)
  const boxFaces = (x, y, w, d, h, faces, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), faces);
    m.position.copy(V(x + w / 2, y + d / 2, z + h / 2)); return add(m);
  };
  // A vertical sign/panel on the +y (front) face at layout y, centred on x.
  const frontPlane = (cx, y, z, w, h, material) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    m.position.copy(V(cx, y + 0.06, z)); scene.add(m); return m;
  };
  const sidePlane = (x, cy, z, d, h, material) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(d, h), material);
    m.position.copy(V(x + 0.06, cy, z)); m.rotation.y = Math.PI / 2; scene.add(m); return m;
  };

  // ---------------- Ground slab (a diorama block: grass on top, soil on the sides)
  const slab = new THREE.Mesh(new THREE.BoxGeometry(470, 14, 470),
    [mat.soil, mat.soil, mat.grass, mat.soil, mat.soil, mat.soil]);
  slab.position.copy(V(205, 205, -7)); slab.receiveShadow = true; scene.add(slab);

  // ---------------- Roads, sidewalks, markings
  flat(-30, 118, 470, 6, mat.concrete, .05, .3); flat(-30, 150, 470, 6, mat.concrete, .05, .3);
  flat(140, -30, 6, 148, mat.concrete, .05, .3); flat(172, -30, 6, 148, mat.concrete, .05, .3);
  flat(-30, 124, 470, 26, mat.asphalt, .02, .1); flat(146, -30, 26, 154, mat.asphalt, .02, .1);
  for (let x = -30; x < 440; x += 12) {
    if (x > 136 && x < 180) continue;
    flat(x, 130.4, 6, .3, mat.white, .12, .02); flat(x, 143.3, 6, .3, mat.white, .12, .02);
  }
  flat(-30, 136.6, 170, .3, mat.yellow, .12, .02); flat(-30, 137.2, 170, .3, mat.yellow, .12, .02);
  flat(178, 136.6, 262, .3, mat.yellow, .12, .02); flat(178, 137.2, 262, .3, mat.yellow, .12, .02);
  flat(158.6, -30, .3, 146, mat.yellow, .12, .02); flat(159.2, -30, .3, 146, mat.yellow, .12, .02);
  for (let k = 0; k < 7; k++) {
    flat(147.5 + k * 3.5, 151, 1.6, 6, mat.white, .36, .02); flat(147.5 + k * 3.5, 111, 1.6, 6, mat.white, .36, .02);
    flat(133, 125.5 + k * 3.5, 6, 1.6, mat.white, .36, .02); flat(179, 125.5 + k * 3.5, 6, 1.6, mat.white, .36, .02);
  }
  // residential street
  flat(-30, 252, 170, 14, mat.asphalt, .02, .1); flat(-30, 248, 170, 4, mat.concrete, .05, .3); flat(-30, 266, 170, 4, mat.concrete, .05, .3);
  for (let x = -26; x < 140; x += 10) flat(x, 258.85, 5, .3, mat.yellow, .12, .02);

  // ---------------- Instanced helpers for many small things
  const inst = (geo, material, list, cast = true) => {
    const im = new THREE.InstancedMesh(geo, material, list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
    list.forEach((it, i) => {
      e.set(0, it.ry || 0, 0); q.setFromEuler(e); s3.set(it.sx || 1, it.sy || 1, it.sz || 1); p3.copy(it.p);
      im.setMatrixAt(i, m4.compose(p3, q, s3));
      if (it.c !== undefined) im.setColorAt(i, new THREE.Color(it.c));
    });
    im.castShadow = cast; im.receiveShadow = true; scene.add(im); return im;
  };

  // Cars (parked): body + cabin, oriented along layout y (stalls) or x
  const CAR_COLORS = [0xd7463d, 0xf2f2f0, 0x30353c, 0x8fa7bd, 0xe0b54e, 0x7f9a7f, 0xbfc3c8, 0x2b5aa3, 0x9b9b98, 0x1f2328];
  const carBodies = [], carCabins = [], carWheels = [];
  const parkCar = (x, y, alongY = true, color) => {
    const c = color ?? CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)];
    const ry = alongY ? 0 : Math.PI / 2;
    carBodies.push({ p: V(x, y, .78), ry, c });
    carCabins.push({ p: alongY ? V(x, y + .25, 1.48) : V(x + .25, y, 1.48), ry });
    for (const [dx, dy] of [[-.9, -1.4], [.9, -1.4], [-.9, 1.4], [.9, 1.4]])
      carWheels.push({ p: alongY ? V(x + dx, y + dy, .34) : V(x + dy, y + dx, .34), ry: ry + Math.PI / 2 });
  };

  // ---------------- Rackspace data center (back left)
  flat(14, 26, 120, 90, mat.lot, .03, .1);
  for (let x = 16; x < 130; x += 2.8) flat(x, 28, .15, 5.5, mat.white, .14, .02);
  [[17.4, 1], [20.2, 0], [28.6, 1], [37, 1], [45.4, 0], [56.6, 1], [70.6, 1], [79, 1], [96, 1], [104.4, 1]].forEach(([x, on]) => on && parkCar(x, 30.8, true));
  const rx = 25, ry = 48, rw = 95, rd = 62, rh = 14;
  const dcTex = repeatTex(T.dcPanels, 6, 1), dcTexS = repeatTex(T.dcPanels, 4, 1);
  boxFaces(rx, ry, rw, rd, rh, [M(0xffffff, { map: dcTexS }), M(0xffffff, { map: dcTexS }), mat.gravel, mat.concrete, M(0xffffff, { map: dcTex }), M(0xffffff, { map: dcTex })]);
  box(rx - .4, ry - .4, rw + .8, rd + .8, .8, M(0xb9bdc1), rh);                     // parapet cap
  frontPlane(rx + 30, ry + rd, rh - 2.2, 40, 2.2, mat.red);
  frontPlane(rx + 30, ry + rd + .02, rh - 2.2, 34, 2, new THREE.MeshBasicMaterial({ map: text("Rackspace", { fg: "#ffffff", font: 700 }), transparent: true }));
  frontPlane(rx + 70, ry + rd, 2.5, 3.5, 5, mat.darkMetal);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const ux = rx + 8 + i * 21, uy = ry + 10 + j * 24;
    box(ux, uy, 15, 16, 2.6, M(0xe9ebec, { roughness: .6 }), rh + .8);
    for (let f = 0; f < 2; f++) {
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, .5, 24), mat.darkMetal);
      fan.position.copy(V(ux + 4 + f * 7, uy + 8, rh + 3.6)); add(fan, false);
      const grille = new THREE.Mesh(new THREE.TorusGeometry(3, .25, 6, 24), mat.metal);
      grille.rotation.x = Math.PI / 2; grille.position.copy(V(ux + 4 + f * 7, uy + 8, rh + 3.9)); add(grille, false);
    }
  }
  for (let i = 0; i < 2; i++) box(rx + rw + 5, ry + 6 + i * 16, 10, 12, 4, M(0xd5d9dd), 0);
  // fence posts with a light mesh
  const fenceMat = M(0x9aa3ad, { transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false });
  const fence = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.6), fenceMat);
    m.position.copy(V((x0 + x1) / 2, (y0 + y1) / 2, 1.3)); m.rotation.y = -Math.atan2(y1 - y0, x1 - x0); scene.add(m);
    const posts = [];
    for (let t = 0; t <= len; t += 5) posts.push({ p: V(x0 + (x1 - x0) * t / len, y0 + (y1 - y0) * t / len, 1.3) });
    inst(new THREE.CylinderGeometry(.08, .08, 2.6, 6), mat.metal, posts, false);
  };
  fence(10, 22, 138, 22); fence(138, 22, 138, 116);

  // ---------------- Cisco tower (back right)
  flat(184, 10, 100, 100, mat.concrete, .03, .25);
  const cx = 205, cy = 30, cw = 58, podH = 8, towH = 110;
  box(cx - 8, cy - 8, cw + 16, cw + 16, podH, M(0xe2e4e6, { roughness: .7 }));
  frontPlane(cx + cw / 2, cy + cw + 8, 3.2, 40, 5, mat.darkGlass);
  const curt = repeatTex(T.curtain, 2, 4);
  const towerMat = new THREE.MeshStandardMaterial({ map: curt, roughness: .12, metalness: .55, envMapIntensity: 1.6 });
  boxFaces(cx, cy, cw, cw, towH, [towerMat, towerMat, M(0xc9d0d7), M(0xc9d0d7), towerMat, towerMat], podH);
  box(cx + 6, cy + 6, 22, 20, 5, M(0xc5ccd3), podH + towH);
  box(cx + 32, cy + 30, 16, 16, 4, M(0xc5ccd3), podH + towH);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(.35, .5, 22, 8), mat.darkMetal);
  ant.position.copy(V(cx + 29, cy + 29, podH + towH + 11)); add(ant);
  frontPlane(cx + cw / 2, cy + cw + .05, podH + towH - 5, 26, 6.5, new THREE.MeshBasicMaterial({ map: text("Cisco", { fg: "#ffffff", font: 600 }), transparent: true }));

  // ---------------- Office block with parking (far right)
  flat(300, 6, 120, 96, mat.lot, .03, .1);
  for (let x = 302; x < 418; x += 2.8) flat(x, 82, .15, 5.5, mat.white, .14, .02);
  for (let x = 303.4; x < 416; x += 2.8) if (rnd() < .5) parkCar(x, 84.8, true);
  const rib = repeatTex(T.ribbon, 3, 1), ribS = repeatTex(T.ribbon, 2, 1);
  boxFaces(318, 14, 74, 50, 30, [M(0xffffff, { map: ribS }), M(0xffffff, { map: ribS }), mat.gravel, mat.concrete, M(0xffffff, { map: rib }), M(0xffffff, { map: rib })]);
  box(322, 20, 14, 10, 3, M(0xcfd4d9), 30);

  // ---------------- Walmart supercenter (front)
  const sx = 180, sy = 190, sw = 160, sd = 100, sh = 10;
  flat(166, 176, 240, 128, mat.concrete, .03, .2);
  const lotY = sy + sd + 12;
  flat(sx - 20, lotY, sw + 70, 80, mat.lot, .02, .1);
  const wallTex = repeatTex(T.panels, 20, 1), wallTexS = repeatTex(T.panels, 12, 1);
  boxFaces(sx, sy, sw, sd, sh, [M(0xffffff, { map: wallTexS }), M(0xffffff, { map: wallTexS }), mat.gravel, mat.concrete, M(0xffffff, { map: wallTex }), M(0xffffff, { map: wallTex })]);
  box(sx - .3, sy - .3, sw + .6, sd + .6, .9, M(0xbfc3c6), sh);                     // parapet cap
  box(sx, sy + sd - .2, sw, .5, 2.4, mat.blue, sh - 2.4);                            // blue band on the facade
  // entrance portals, glass vestibules and canopies
  const portals = [[sx + 14, "Entrance"], [sx + 112, "Pickup"]];
  portals.forEach(([px, label]) => {
    box(px, sy + sd - 1, 44, 6, sh + 5, M(0xeceae5, { roughness: .7 }));
    box(px, sy + sd + 4.6, 44, .6, 3, mat.blue, sh + 2);
    frontPlane(px + 22, sy + sd + 5, 3.6, 30, 7, mat.glass);
    frontPlane(px + 22, sy + sd + 5.02, 3.6, .4, 7, mat.darkMetal);
    box(px + 4, sy + sd + 5, 36, 4, .5, M(0xf2f2f0), 7.6);
    frontPlane(px + 22, sy + sd + 5.25, sh + 3.5, 26, 2.4, new THREE.MeshBasicMaterial({ map: text(label, { fg: "#ffffff", font: 600 }), transparent: true }));
  });
  frontPlane(sx + 82, sy + sd + .12, sh - 1.2, 44, 8, new THREE.MeshBasicMaterial({ map: text("Walmart", { fg: "#ffffff", font: 700, size: .7 }), transparent: true }));
  // roof: HVAC units, skylights, the AI module
  for (let i = 0; i < 4; i++) box(sx + 12 + i * 34, sy + 12, 10, 7, 2.2, M(0xdfe2e5, { roughness: .6 }), sh + .9);
  const sky = M(0xbfd6ea, { roughness: .15, metalness: .3 });
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) box(sx + 20 + i * 26, sy + 48 + j * 22, 9, 6, .4, sky, sh + .9, false);
  box(sx + 98, sy + 30, 22, 22, 2.4, M(0xf5f6f7, { roughness: .4 }), sh + .9);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(4.2, 32, 24), new THREE.MeshStandardMaterial({ color: 0xa8c8e8, emissive: 0x6f9fdc, emissiveIntensity: .7, roughness: .25, metalness: .1 }));
  orb.position.copy(V(sx + 109, sy + 41, sh + 8)); add(orb);
  // back-office annex with loading docks and a truck
  const nx = sx + sw, ny = sy + 18;
  boxFaces(nx, ny, 52, 64, 8, [M(0xffffff, { map: repeatTex(T.panels, 6, 1) }), M(0xffffff, { map: repeatTex(T.panels, 6, 1) }), mat.gravel, mat.concrete, M(0xffffff, { map: repeatTex(T.panels, 5, 1) }), M(0xffffff, { map: repeatTex(T.panels, 5, 1) })]);
  for (let i = 0; i < 3; i++) sidePlane(nx + 52, ny + 12 + i * 18, 2.6, 8, 5, M(0x8f99a3, { roughness: .5 }));
  box(nx + 54, ny + 26, 30, 10, 3.8, M(0xf4f5f6, { roughness: .5 }), 1.2);            // trailer
  box(nx + 84.5, ny + 27, 6, 8, 3.6, M(0xd7463d, { roughness: .4, metalness: .2 }), .8);  // cab
  // garden centre (fenced) and its plants
  flat(148, 250, 30, 40, M(0x9fb88f), .04, .2);
  fence(148, 250, 148, 290); fence(148, 290, 178, 290);
  // parking: stalls, islands, lamps, cars, cart corrals
  const stallRows = [lotY + 4, lotY + 19, lotY + 44, lotY + 59];
  stallRows.forEach((y0, r) => {
    for (let x = sx - 16; x < sx + sw + 48; x += 2.8) flat(x, y0, .15, 5.5, mat.white, .12, .02);
    for (let x = sx - 14.6; x < sx + sw + 46; x += 2.8) if (rnd() < (r < 2 ? .62 : .42)) parkCar(x, y0 + 2.75, true);
  });
  [[sx + 40, lotY + 31], [sx + 130, lotY + 31]].forEach(([ix, iy]) => box(ix, iy, 16, 7, .35, M(0x8fb07a), 0));
  const lamps = [];
  const lamp = (x, y, h = 9) => lamps.push({ x, y, h });
  for (let i = 0; i < 5; i++) lamp(sx - 4 + i * 44, lotY + 35, 10);
  [[sx + 4, lotY + 36], [sx + 112, lotY + 36]].forEach(([x, y]) => box(x, y, 6, 3, 1.4, M(0x8a96a3, { transparent: true, opacity: .55 }), 0, false));
  // content sign at the lot entrance
  box(sx - 18, lotY + 84, 1.4, 1.4, 12, mat.metal);
  box(sx - 18.4, lotY + 78, 2.2, 13, 6.5, M(0xfafafa, { roughness: .5 }), 12);
  [0x3f78cc, 0x8ab7d1, 0xf0b429].forEach((c, i) => sidePlane(sx - 16.15, lotY + 84.5, 16.6 - i * 2, 11, 1.4, M(c)));

  // ---------------- Neighbourhood: pitched-roof houses, driveways
  const roofGeo = (w, d, rh) => {                     // gable prism, ridge along layout x
    const shape = new THREE.Shape(); shape.moveTo(-d / 2 - .6, 0); shape.lineTo(d / 2 + .6, 0); shape.lineTo(0, rh); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: w + 1.2, bevelEnabled: false }); g.translate(0, 0, -(w + 1.2) / 2); return g;
  };
  const houses = [[-20, 206, 0xeee7da, 0x8b5e4b], [12, 210, 0xe5ebee, 0x56606b], [44, 206, 0xf3eee4, 0xa45a45], [76, 210, 0xe8e3ec, 0x56606b],
    [106, 206, 0xedf0e7, 0x7a6555], [-20, 276, 0xe5ebee, 0xa45a45], [12, 280, 0xf3eee4, 0x56606b], [44, 276, 0xeee7da, 0x7a6555], [76, 280, 0xedf0e7, 0x8b5e4b]];
  houses.forEach(([hx, hy, wall, roof], k) => {
    const w = 14, d = 11, h = 5.5, front = hy < 250;
    const yy = front ? hy + 4 : hy + 3;
    box(hx + 4, yy, w, d, h, M(wall, { roughness: .8 }));
    const r = new THREE.Mesh(roofGeo(w, d, 3.8), M(roof, { roughness: .75 }));
    r.rotation.y = Math.PI / 2; r.position.copy(V(hx + 4 + w / 2, yy + d / 2, h)); add(r);
    const fy = front ? yy + d : yy;                  // facade toward the street
    const win = M(0x9fbad3, { roughness: .2, metalness: .3 });
    if (front) { frontPlane(hx + 8, fy, 1.4, 1.4, 2.6, M(0x6d4f3c)); frontPlane(hx + 12.5, fy, 2.6, 2.2, 1.6, win); frontPlane(hx + 15.8, fy, 2.6, 2.2, 1.6, win); }
    sidePlane(hx + 4 + w, yy + d / 2, 2.8, 2.4, 1.6, win);
    flat(hx + 6, front ? yy + d : hy - 4, 4, front ? 252 - (yy + d) : 7, mat.concrete, .04, .15);
    if (k % 3 === 0) parkCar(hx + 8, front ? yy + d + 5 : hy - 1, true);
  });
  // pond with reeds
  const pondShape = new THREE.Shape();
  [[6, 352], [52, 340], [96, 352], [104, 384], [72, 410], [22, 404], [0, 380]].forEach(([x, y], i) => {
    const p = V(x, y); i ? pondShape.lineTo(p.x, -p.z) : pondShape.moveTo(p.x, -p.z);
  });
  const pond = new THREE.Mesh(new THREE.ShapeGeometry(pondShape, 24), new THREE.MeshStandardMaterial({ map: T.water, color: 0xffffff, roughness: .08, metalness: .2, envMapIntensity: 1.4 }));
  pond.rotation.x = -Math.PI / 2; pond.position.y = .16; pond.receiveShadow = true; scene.add(pond);
  const reeds = [];
  for (let k = 0; k < 26; k++) reeds.push({ p: V(8 + rnd() * 90, 348 + rnd() * 8 + (k % 3) * 20, .9), sy: .8 + rnd() * .6 });
  inst(new THREE.ConeGeometry(.35, 1.8, 5), M(0x6f9a5e), reeds, false);

  // ---------------- Trees and lamps
  const treesL = [[0, 0, "pine"], [12, 18, "round"], [-10, 70, "pine"], [0, 98, "round"], [128, 6, "pine"], [430, 14, "round"], [432, 60, "pine"],
    [288, 104, "round"], [430, 104, "round"], [20, 172, "round"], [60, 176, "pine"], [100, 170, "round"], [-24, 236, "pine"], [40, 238, "round"],
    [128, 238, "round"], [-26, 306, "round"], [130, 306, "pine"], [-24, 340, "pine"], [124, 350, "round"], [120, 404, "round"], [90, 424, "pine"],
    [420, 200, "round"], [418, 260, "pine"], [420, 330, "round"], [400, 404, "round"], [200, 405, "pine"], [300, 410, "round"], [40, 424, "round"],
    [-20, 420, "pine"], [190, 98, "round"], [270, 98, "round"], [270, 18, "round"], [sx + 48, lotY + 34.5, "round"], [sx + 138, lotY + 34.5, "round"],
    [156, 262, "round"], [168, 278, "round"], [156, 282, "round"]];
  const trunks = [], crowns = [[], [], [], []], pines = [[], []];
  treesL.forEach(([x, y, kind], k) => {
    const s = .85 + (k % 4) * .12;
    trunks.push({ p: V(x, y, 1.8 * s), sy: s, sx: s, sz: s });
    if (kind === "pine") {
      pines[k % 2].push({ p: V(x, y, 5.5 * s), sx: s, sy: s, sz: s });
      pines[(k + 1) % 2].push({ p: V(x, y, 8.2 * s), sx: s * .72, sy: s * .8, sz: s * .72 });
    } else {
      crowns[k % 4].push({ p: V(x, y, 6.2 * s), sx: s * 1.05, sy: s * .95, sz: s * 1.05 });
      crowns[(k + 1) % 4].push({ p: V(x - 1.2 * s, y + .8 * s, 7.6 * s), sx: s * .7, sy: s * .7, sz: s * .7 });
      crowns[(k + 2) % 4].push({ p: V(x + 1.4 * s, y - .6 * s, 7 * s), sx: s * .62, sy: s * .62, sz: s * .62 });
    }
  });
  inst(new THREE.CylinderGeometry(.35, .5, 3.6, 7), mat.trunk, trunks);
  const crownGeo = new THREE.IcosahedronGeometry(3.4, 2);
  crowns.forEach((list, i) => list.length && inst(crownGeo, mat.leaf[i], list));
  const pineGeo = new THREE.ConeGeometry(3.4, 7, 9);
  pines.forEach((list, i) => list.length && inst(pineGeo, mat.pine[i], list));
  for (let x = -10; x < 440; x += 40) if (x < 120 || x > 190) lamp(x, 117.2, 8);
  for (let y = -10; y < 110; y += 40) lamp(139.2, y, 8);
  inst(new THREE.CylinderGeometry(.15, .2, 1, 6), mat.darkMetal, lamps.map(l => ({ p: V(l.x, l.y, l.h / 2), sy: l.h })), true);
  inst(new THREE.BoxGeometry(1.6, .35, .7), mat.darkMetal, lamps.map(l => ({ p: V(l.x + .5, l.y, l.h) })), true);

  // ---------------- People (shoppers, plaza)
  const ppl = [[sx + 88, sy + sd + 9, 0xf0b429], [sx + 128, sy + sd + 8, 0x3f78cc], [sx + 70, lotY + 30, 0xe2574c], [sx + 150, sy + sd + 7, 0x30353c],
    [232, 104, 0xe2574c], [246, 100, 0x30353c], [60, 268, 0x8fa98f]];
  inst(new THREE.CapsuleGeometry(.28, 1, 3, 8), M(0x3b4250), ppl.map(([x, y]) => ({ p: V(x, y, .8), sx: 1.5, sy: 1.5, sz: 1.5 })));
  inst(new THREE.BoxGeometry(.62, .7, .38), M(0xffffff), ppl.map(([x, y, c]) => ({ p: V(x, y, 1.85), c, sx: 1.5, sy: 1.5, sz: 1.5 })));
  inst(new THREE.SphereGeometry(.2, 12, 8), M(0xd8aa86), ppl.map(([x, y]) => ({ p: V(x, y, 2.75), sx: 1.5, sy: 1.5, sz: 1.5 })));

  // Parked cars, all at once
  inst(new THREE.BoxGeometry(1.85, .8, 4.5), M(0xffffff, { roughness: .32, metalness: .35 }), carBodies);
  inst(new THREE.BoxGeometry(1.6, .62, 2.3), M(0x5b6a7a, { roughness: .08, metalness: .55, envMapIntensity: 1.5 }), carCabins);
  inst(new THREE.CylinderGeometry(.34, .34, .26, 12).rotateZ(Math.PI / 2), M(0x1f2328, { roughness: .8 }), carWheels, false);

  // ---------------- Traffic: cars driving both roads
  const traffic = [];
  const lanes = [{ a: [-26, 133.5], b: [436, 133.5], v: 13 }, { a: [436, 140.5], b: [-26, 140.5], v: 11 },
                 { a: [155.5, -26], b: [155.5, 152], v: 9 }, { a: [162.5, 152], b: [162.5, -26], v: 10 }];
  lanes.forEach((ln, k) => {
    for (let j = 0; j < 3; j++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, .8, 4.5), M(CAR_COLORS[(k * 3 + j) % CAR_COLORS.length], { roughness: .32, metalness: .35 }));
      body.position.y = .78; body.castShadow = true;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, .62, 2.3), M(0x5b6a7a, { roughness: .08, metalness: .55 }));
      cab.position.set(0, 1.48, -.25); cab.castShadow = true;
      g.add(body, cab); scene.add(g);
      const len = Math.hypot(ln.b[0] - ln.a[0], ln.b[1] - ln.a[1]);
      g.rotation.y = ln.a[1] === ln.b[1] ? Math.PI / 2 : 0;
      traffic.push({ g, ln, len, t: (j / 3 + k * .13) % 1 });
    }
  });

  // ---------------- Cloud shadows: soft, faint patches drifting over the ground
  const clouds = [];
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0x1d2a22, alphaMap: T.cloud, transparent: true, opacity: .1, depthWrite: false });
  for (let k = 0; k < 3; k++) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(110, 70), cloudMat.clone());
    c.rotation.x = -Math.PI / 2; c.position.set(-260 + k * 190, .45, -120 + k * 110); c.renderOrder = 1;
    scene.add(c); clouds.push({ c, v: 3 + k * 1.2 });
  }

  // ---------------- Route ribbon (Walmart entrance -> Cisco -> Rackspace)
  const ROUTE = [[214, 300], [159, 300], [159, 60], [159, 137], [80, 137], [80, 112]];
  const pts3 = ROUTE.map(([x, y]) => V(x, y, .5));
  const samples = []; let total = 0;
  for (let i = 0; i < pts3.length - 1; i++) {
    const a = pts3[i], b = pts3[i + 1], L = a.distanceTo(b), n = Math.ceil(L / 1.2);
    for (let k = 0; k < n; k++) samples.push({ p: a.clone().lerp(b, k / n), d: total + L * k / n, dir: b.clone().sub(a).normalize() });
    total += L;
  }
  samples.push({ p: pts3[pts3.length - 1].clone(), d: total, dir: pts3[pts3.length - 1].clone().sub(pts3[pts3.length - 2]).normalize() });
  const ribbonGeo = (width) => {
    const pos = [], idx = [];
    samples.forEach((s, i) => {
      const side = new THREE.Vector3(-s.dir.z, 0, s.dir.x).multiplyScalar(width / 2);
      pos.push(s.p.x + side.x, s.p.y, s.p.z + side.z, s.p.x - side.x, s.p.y, s.p.z - side.z);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
  };
  const routeBase = new THREE.Mesh(ribbonGeo(1.4), new THREE.MeshBasicMaterial({ color: 0x1d1d1f, transparent: true, opacity: .22, depthWrite: false }));
  const routeLine = new THREE.Mesh(ribbonGeo(2.2), new THREE.MeshBasicMaterial({ color: 0x0071e3 }));
  routeBase.renderOrder = 2; routeLine.renderOrder = 3; scene.add(routeBase, routeLine);
  const routeIdx = routeLine.geometry.index.count;
  const pointAt = (u) => {                               // u in 0..1 along the route
    const d = u * total;
    let i = samples.findIndex(s => s.d > d); if (i < 1) i = i === 0 ? 1 : samples.length - 1;
    const a = samples[i - 1], b = samples[i], f = (d - a.d) / Math.max(b.d - a.d, 1e-6);
    return { p: a.p.clone().lerp(b.p, f), dir: a.dir.clone() };
  };

  // ---------------- Eric
  const skin = M(0xe8c2a0, { roughness: .7 }), hair = M(0x2a2421, { roughness: .8 }), shirt = M(0x3f78cc, { roughness: .7 }), pants = M(0x2a3346);
  const me = new THREE.Group(); me.scale.setScalar(2.2); scene.add(me);
  const part = (geo, m, x, y, z, parent = me) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const pivot = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); me.add(g); return g; };
  const legL = pivot(-.1, .85, 0), legR = pivot(.1, .85, 0);
  part(new THREE.BoxGeometry(.15, .85, .17), pants, 0, -.42, 0, legL); part(new THREE.BoxGeometry(.15, .85, .17), pants, 0, -.42, 0, legR);
  part(new THREE.BoxGeometry(.44, .62, .26), shirt, 0, 1.16, 0);
  const armL = pivot(-.28, 1.42, 0), armR = pivot(.28, 1.42, 0);
  part(new THREE.BoxGeometry(.11, .6, .12), shirt, 0, -.3, 0, armL); part(new THREE.BoxGeometry(.11, .6, .12), shirt, 0, -.3, 0, armR);
  part(new THREE.SphereGeometry(.18, 20, 14), skin, 0, 1.68, 0);
  const back = part(new THREE.SphereGeometry(.2, 20, 14), hair, 0, 1.64, -.04); back.scale.set(1.05, 1.25, .95);
  const fringeL = part(new THREE.BoxGeometry(.17, .07, .06), hair, -.08, 1.8, .15); fringeL.rotation.z = .5;
  const fringeR = part(new THREE.BoxGeometry(.17, .07, .06), hair, .08, 1.8, .15); fringeR.rotation.z = -.5;
  part(new THREE.SphereGeometry(.022, 8, 6), M(0x1d1d1f), -.06, 1.69, .17); part(new THREE.SphereGeometry(.022, 8, 6), M(0x1d1d1f), .06, 1.69, .17);
  // laptop (designing)
  const laptop = new THREE.Group(); laptop.position.set(0, 1.0, .3); me.add(laptop);
  part(new THREE.BoxGeometry(.36, .02, .24), M(0xc9ccd1, { metalness: .5, roughness: .3 }), 0, 0, 0, laptop);
  const scr = part(new THREE.BoxGeometry(.36, .24, .015), new THREE.MeshStandardMaterial({ color: 0x8ab7d1, emissive: 0x8ab7d1, emissiveIntensity: .8 }), 0, .12, -.12, laptop);
  scr.rotation.x = -.25;
  // cat
  const cat = new THREE.Group(); cat.position.set(.45, 0, .35); me.add(cat);
  const fur = M(0xe8a25c, { roughness: .9 });
  const cb = part(new THREE.SphereGeometry(.13, 14, 10), fur, 0, .12, 0, cat); cb.scale.set(1, .8, 1.5);
  part(new THREE.SphereGeometry(.085, 12, 10), fur, 0, .24, .16, cat);
  part(new THREE.ConeGeometry(.03, .07, 6), fur, -.045, .33, .16, cat); part(new THREE.ConeGeometry(.03, .07, 6), fur, .045, .33, .16, cat);
  const tail = new THREE.Group(); tail.position.set(0, .14, -.18); cat.add(tail);
  part(new THREE.CylinderGeometry(.02, .025, .26, 6), fur, 0, .12, -.03, tail).rotation.x = -.4;
  laptop.visible = false; cat.visible = false;

  // ---------------- HTML overlays: pins, name tag, speech bubbles, survey stars
  const el = (cls, html) => { const d = document.createElement("div"); d.className = cls; d.innerHTML = html; overlay.appendChild(d); return d; };
  const PIN = '<svg viewBox="-12 -36 24 38" width="30" height="46"><circle class="pulse" r="10" cy="-24"/><path class="drop" d="M0 0 C -2 -6 -10 -12 -10 -24 A10 10 0 1 1 10 -24 C 10 -12 2 -6 0 0Z"/><circle cy="-24" r="3.6" fill="#fff"/></svg>';
  const pins = {
    walmart: { at: V(sx + 60, sy + 40, sh + 14), el: el("pin3d", PIN) },
    cisco: { at: V(cx + 29, cy + 29, podH + towH + 26), el: el("pin3d", PIN) },
    rackspace: { at: V(72, 79, rh + 9), el: el("pin3d", PIN) },
  };
  const tag = el("me-tag3d", "Eric");
  const bubbles = {
    hi: el("bubble3d", "<b>Hi!</b>"),
    design: el("bubble3d", '<svg width="34" height="20" viewBox="0 0 34 20"><rect x="1" y="2" width="11" height="16" rx="2" fill="#dbe7f5"/><rect x="15" y="2" width="18" height="5" rx="2" fill="#3f78cc"/><rect x="15" y="9" width="15" height="3" rx="1.5" fill="#d2d2d7"/><rect x="15" y="14" width="10" height="3" rx="1.5" fill="#d2d2d7"/></svg>'),
    cat: el("bubble3d", '<svg width="18" height="16" viewBox="-9 -9 18 16"><path d="M0 6 C -8 0 -6 -8 -1.5 -6.5 C -.5 -6.2 0 -5.4 0 -4.8 C 0 -5.4 .5 -6.2 1.5 -6.5 C 6 -8 8 0 0 6Z" fill="#e2574c"/></svg>'),
  };
  const stars = el("bubble3d stars", "★★★★<span>★</span>");
  const starsAt = V(sx + 150, sy + sd + 7, 7);

  // ---------------- State, camera poses
  let W = 1, H = 1, visible = true, pose = null, activePin = "";
  const FOCUS = {
    all: { c: V(205, 205, 0), r: 270, elev: 33 },
    walmart: { c: V(262, 268, 4), r: 120, elev: 31 },
    entrance: { c: V(214, 299, 3), r: 13, elev: 17 },
    cisco: { c: V(234, 59, 52), r: 72, elev: 26 },
    rackspace: { c: V(72, 79, 8), r: 66, elev: 32 },
  };
  const AZ = Math.PI / 4;
  function poseFor(key, { card = false, first = false } = {}) {
    const f = FOCUS[key] || FOCUS.all;
    const narrow = W < 760, aspect = W / H;
    const vfov = camera.fov * Math.PI / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    let fitW = W, fitH = H, offX = 0, offY = 0;
    if (first) { fitH = H * (narrow ? .42 : .4); offY = -H * (narrow ? .29 : .3); }
    else if (card && narrow) { fitH = H * .5; offY = H * .24; }
    else if (card) { const cardRight = Math.min(W * .4, 420) + Math.max(40, (W - 1200) / 2 + 40); fitW = W - cardRight; offX = -cardRight / 2; }
    const half = Math.min(vfov * fitH / H, hfov * fitW / W) / 2;
    const dist = f.r / Math.sin(half) * (key === "all" ? .78 : .9);
    return { c: f.c.clone(), dist, elev: f.elev, offX, offY };
  }
  const push = (p, k) => ({ ...p, c: p.c.clone(), dist: p.dist * k });
  function applyPose(a, b, t) {
    const c = a.c.clone().lerp(b.c, t);
    const dist = Math.exp(THREE.MathUtils.lerp(Math.log(a.dist), Math.log(b.dist), t));
    const el_ = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(a.elev, b.elev, t));
    camera.position.set(c.x + dist * Math.cos(el_) * Math.sin(AZ), c.y + dist * Math.sin(el_), c.z + dist * Math.cos(el_) * Math.cos(AZ));
    camera.lookAt(c);
    camera.setViewOffset(W, H, THREE.MathUtils.lerp(a.offX, b.offX, t), THREE.MathUtils.lerp(a.offY, b.offY, t), W, H);
    camera.near = Math.max(.5, dist * .02); camera.far = dist * 8 + 1200; camera.updateProjectionMatrix();
    pose = true; needs = true;
  }

  // Avatar along the route, plus idle wandering
  const idle = { base: new THREE.Vector3(), off: new THREE.Vector3(), target: new THREE.Vector3(), state: "rest", until: 0, act: null, lastAct: null, cooldown: 1, scrolledAt: 0, heading: Math.PI };
  let routeU = -1;
  function setRoute(u) {
    const changed = Math.abs(u - routeU) > 1e-4 && routeU >= 0;
    routeU = u;
    const { p, dir } = pointAt(u);
    idle.base.copy(p).setY(0);
    if (changed) { idle.scrolledAt = performance.now(); idle.heading = Math.atan2(dir.x, dir.z); walkPhase += .35; }
    routeLine.geometry.setDrawRange(0, Math.floor(routeIdx * u / 6) * 6);
    needs = true;
  }
  function setAct(a) {
    idle.act = a;
    laptop.visible = a === "design"; cat.visible = a === "cat";
    for (const [k, b] of Object.entries(bubbles)) b.classList.toggle("on", k === a);
    tag.classList.toggle("off", !!a);
  }
  setAct(null);

  let walkPhase = 0, walking = false;
  function stepIdle(t, dt) {
    if (REDUCE) return;
    if (t - idle.scrolledAt < 450) {
      walking = true; idle.off.multiplyScalar(.8);
      if (idle.state !== "rest") { idle.state = "rest"; idle.until = t + 900; setAct(null); }
      return;
    }
    walking = false;
    if (idle.state === "walk") {
      const d = idle.target.clone().sub(idle.off), dist = d.length(), step = 2.4 * dt;
      if (dist <= step) {
        idle.off.copy(idle.target);
        let act = null;
        if (idle.cooldown > 0) idle.cooldown--;
        else { const A = ["hi", "design", "cat"]; act = A[Math.floor(Math.random() * 3)]; if (act === idle.lastAct) act = A[(A.indexOf(act) + 1) % 3]; idle.lastAct = act; idle.cooldown = 1 + Math.floor(Math.random() * 2); }
        setAct(act); idle.state = act ? "act" : "rest";
        idle.until = t + (act ? 3000 + Math.random() * 1500 : 2500 + Math.random() * 2500);
        if (act === "hi") idle.heading = AZ;          // turn to face the camera to wave
      } else {
        idle.off.addScaledVector(d.normalize(), step); idle.heading = Math.atan2(d.x, d.z); walking = true;
      }
    } else if (t > idle.until) {
      setAct(null);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]], [ux, uz] = dirs[Math.floor(Math.random() * 4)], len = 3 + Math.random() * 6;
      idle.target.set(idle.off.x + ux * len, 0, idle.off.z + uz * len);
      if (idle.target.length() > 9) idle.target.setLength(9);
      idle.state = "walk";
    }
  }
  function poseAvatar(t, dt) {
    me.position.copy(idle.base).add(idle.off);
    me.rotation.y = idle.heading;
    if (walking) walkPhase += dt * 9;
    const sw = walking ? Math.sin(walkPhase) * .55 : 0;
    legL.rotation.x = sw; legR.rotation.x = -sw;
    armL.rotation.set(-sw * .8, 0, 0); armR.rotation.set(sw * .8, 0, 0);
    if (idle.act === "hi") { armR.rotation.set(0, 0, 2.5 + Math.sin(t / 130) * .35); }
    if (idle.act === "design") { armL.rotation.x = armR.rotation.x = -1.1 + Math.sin(t / 80) * .06; }
    if (idle.act === "cat") { armR.rotation.x = -.8 + Math.sin(t / 220) * .25; tail.rotation.z = Math.sin(t / 300) * .5; }
    me.position.y = walking ? Math.abs(Math.sin(walkPhase)) * .06 : 0;
  }

  // Project overlays to the screen
  const pv = new THREE.Vector3();
  function place(elm, world, dy = 0) {
    pv.copy(world).project(camera);
    const x = (pv.x * .5 + .5) * W, y = (-pv.y * .5 + .5) * H + dy;
    const off = pv.z > 1 || x < -60 || x > W + 60 || y < -80 || y > H + 80;
    elm.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    elm.style.visibility = off ? "hidden" : "visible";
  }
  const head = new THREE.Vector3();
  function placeOverlays() {
    for (const [k, p] of Object.entries(pins)) { place(p.el, p.at); p.el.classList.toggle("is-active", k === activePin); }
    head.copy(me.position).add(new THREE.Vector3(0, 2.1 * me.scale.y, 0));
    place(tag, head); for (const b of Object.values(bubbles)) place(b, head);
    place(stars, starsAt);
  }

  // Render loop
  let needs = true, last = performance.now();
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    if (!visible || document.hidden || !pose) return;
    if (!REDUCE) {
      traffic.forEach(c => {
        c.t = (c.t + dt * c.ln.v / c.len) % 1;
        c.g.position.copy(V(c.ln.a[0] + (c.ln.b[0] - c.ln.a[0]) * c.t, c.ln.a[1] + (c.ln.b[1] - c.ln.a[1]) * c.t));
        if (c.ln.a[1] === c.ln.b[1]) c.g.rotation.y = c.ln.b[0] > c.ln.a[0] ? Math.PI / 2 : -Math.PI / 2;
        else c.g.rotation.y = c.ln.b[1] > c.ln.a[1] ? 0 : Math.PI;
      });
      clouds.forEach(k => {
        k.c.position.x += k.v * dt; k.c.position.z += k.v * .35 * dt;
        if (k.c.position.x > 240) { k.c.position.x = -240; k.c.position.z = -180 + Math.random() * 300; }
        const edge = 235 - Math.max(Math.abs(k.c.position.x), Math.abs(k.c.position.z));   // fade out before the plate's edge
        k.c.material.opacity = .1 * Math.min(1, Math.max(0, (edge - 55) / 40));
      });
      orb.material.emissiveIntensity = .55 + Math.sin(t / 700) * .2;
      stepIdle(t, dt); needs = true;
    }
    poseAvatar(t, dt);
    if (needs) { renderer.render(scene, camera); placeOverlays(); needs = false; }
  }

  function resize() {
    W = root.clientWidth || innerWidth; H = root.clientHeight || innerHeight;
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); needs = true;
  }
  new ResizeObserver(resize).observe(root); resize();
  scene.add(camera);
  requestAnimationFrame(frame);

  window.Town3D = {
    poseFor, push, applyPose, setRoute,
    setActivePin(k) { activePin = k; needs = true; },
    setVisible(v) { visible = v; if (v) needs = true; },
    size: () => ({ W, H }),
  };
  root.classList.add("ready");
  window.dispatchEvent(new Event("town3d:ready"));
}
