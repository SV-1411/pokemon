// The open world: a stylized 3D map of India. Terrain is generated from a
// hand-traced coastline polygon (lon/lat), with the Himalaya rising in the
// north, the Thar desert in the west, the Western Ghats ridge, forest in the
// south, jungle in the northeast, ocean all around, and 20 real cities.
import * as THREE from 'three';

// ---------- geography ----------
export const SCALE = 60; // world units per degree
const CLON = 82.75, CLAT = 21.75;
export const lonLatToWorld = (lon, lat) => [(lon - CLON) * SCALE, (CLAT - lat) * SCALE];
export const worldToLonLat = (x, z) => [x / SCALE + CLON, CLAT - z / SCALE];

// Stylized India coastline + land border, clockwise from the Rann of Kutch.
// (Bangladesh/Nepal areas are folded into the playable landmass.)
export const COAST = [
  [68.5,23.8],[70.2,22.8],[69.0,22.3],[70.0,20.8],[72.0,20.7],[72.7,19.0],
  [73.5,16.0],[74.5,13.0],[76.0,9.5],[77.4,8.0],[78.3,8.8],[79.4,10.3],
  [79.9,12.0],[80.3,13.5],[80.1,15.5],[81.5,16.3],[82.5,17.0],[84.0,18.3],
  [85.5,19.7],[87.0,21.0],[88.0,21.7],[89.2,22.0],[91.5,22.9],[92.6,23.7],
  [93.3,24.0],[94.7,25.2],[95.6,27.0],[96.6,28.4],[94.5,29.2],[92.0,28.2],
  [89.5,28.2],[85.0,28.8],[81.0,30.2],[79.5,31.0],[78.5,32.5],[77.5,34.0],
  [76.0,35.5],[74.5,36.8],[73.2,36.0],[74.0,33.5],[73.8,32.0],[74.5,30.5],
  [73.5,29.0],[71.5,27.5],[70.0,26.0],[69.5,24.5],
];

export function insidePoly(lon, lat, poly = COAST) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distToCoast(lon, lat) { // degrees, point-to-segment over all edges
  let best = Infinity;
  for (let i = 0, j = COAST.length - 1; i < COAST.length; j = i++) {
    const [x1, y1] = COAST[j], [x2, y2] = COAST[i];
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((lon - x1) * dx + (lat - y1) * dy) / (dx * dx + dy * dy)));
    const ex = lon - (x1 + t * dx), ey = lat - (y1 + t * dy);
    best = Math.min(best, ex * ex + ey * ey);
  }
  return Math.sqrt(best);
}

// ---------- cities ----------
export const CITIES = [
  { name: 'DELHI', lon: 77.2, lat: 28.6 }, { name: 'MUMBAI', lon: 72.9, lat: 19.1 },
  { name: 'KOLKATA', lon: 88.4, lat: 22.6 }, { name: 'CHENNAI', lon: 80.3, lat: 13.1 },
  { name: 'BENGALURU', lon: 77.6, lat: 13.0 }, { name: 'HYDERABAD', lon: 78.5, lat: 17.4 },
  { name: 'JAIPUR', lon: 75.8, lat: 26.9 }, { name: 'AHMEDABAD', lon: 72.6, lat: 23.0 },
  { name: 'LUCKNOW', lon: 80.9, lat: 26.8 }, { name: 'BHOPAL', lon: 77.4, lat: 23.3 },
  { name: 'GUWAHATI', lon: 91.7, lat: 26.1 }, { name: 'KOCHI', lon: 76.3, lat: 10.0 },
  { name: 'GOA', lon: 73.9, lat: 15.4 }, { name: 'VARANASI', lon: 83.0, lat: 25.3 },
  { name: 'SHIMLA', lon: 77.1, lat: 31.1 }, { name: 'LEH', lon: 77.6, lat: 34.2 },
  { name: 'PATNA', lon: 85.1, lat: 25.6 }, { name: 'NAGPUR', lon: 79.1, lat: 21.1 },
  { name: 'VIZAG', lon: 83.2, lat: 17.7 }, { name: 'SRINAGAR', lon: 74.8, lat: 34.1 },
];
export const CITY_R = 24; // world units
for (const c of CITIES) {
  const [x, z] = lonLatToWorld(c.lon, c.lat);
  c.x = x; c.z = z;
}

// Fixed legendary encounter landmarks (species name -> resolved to id at runtime).
export const LANDMARKS = [
  { species: 'articuno', lvl: 70, lon: 77.9, lat: 34.6, label: 'FROZEN SHRINE' },
  { species: 'zapdos', lvl: 70, lon: 79.4, lat: 21.5, label: 'OLD POWER PLANT' },
  { species: 'moltres', lvl: 70, lon: 70.9, lat: 26.9, label: 'EMBER DUNES' },
  { species: 'mewtwo', lvl: 80, lon: 77.0, lat: 31.5, label: 'CERULEAN CAVE' },
  { species: 'mew', lvl: 50, lon: 76.2, lat: 8.9, label: 'HIDDEN GROVE' },
  { species: 'lugia', lvl: 72, lon: 72.4, lat: 18.6, label: 'WHIRL COAST' },
  { species: 'ho-oh', lvl: 72, lon: 83.0, lat: 25.6, label: 'SACRED GHAT' },
  { species: 'kyogre', lvl: 75, lon: 80.5, lat: 12.6, label: 'DEEP HARBOR' },
  { species: 'groudon', lvl: 75, lon: 71.6, lat: 25.4, label: 'SUN-SCORCHED BASIN' },
  { species: 'rayquaza', lvl: 80, lon: 78.8, lat: 35.2, label: 'SKY PILLAR PEAK' },
  { species: 'dialga', lvl: 75, lon: 74.9, lat: 34.6, label: 'TEMPORAL GLACIER' },
  { species: 'palkia', lvl: 75, lon: 74.2, lat: 35.4, label: 'SPATIAL RIFT' },
  { species: 'giratina', lvl: 78, lon: 92.0, lat: 27.4, label: 'DISTORTION VALLEY' },
  { species: 'zekrom', lvl: 74, lon: 77.4, lat: 28.9, label: 'STORM SPIRE' },
  { species: 'reshiram', lvl: 74, lon: 76.9, lat: 28.3, label: 'FLAME SPIRE' },
  { species: 'xerneas', lvl: 74, lon: 95.0, lat: 27.2, label: 'LIFE TREE' },
  { species: 'yveltal', lvl: 74, lon: 94.3, lat: 26.0, label: 'CARRION ROOST' },
  { species: 'solgaleo', lvl: 76, lon: 78.6, lat: 17.7, label: 'SUN ALTAR' },
  { species: 'lunala', lvl: 76, lon: 75.9, lat: 11.8, label: 'MOON ALTAR' },
  { species: 'zacian', lvl: 78, lon: 76.3, lat: 32.3, label: 'RUSTED SHRINE' },
  { species: 'zamazenta', lvl: 78, lon: 76.6, lat: 32.0, label: 'RUSTED KEEP' },
  { species: 'eternatus', lvl: 82, lon: 69.4, lat: 24.1, label: 'WHITE RANN CRATER' },
];
for (const l of LANDMARKS) { const [x, z] = lonLatToWorld(l.lon, l.lat); l.x = x; l.z = z; }

// ---------- noise ----------
function hash(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
const fbm = (x, z) => vnoise(x, z) * 0.6 + vnoise(x * 2.7 + 13, z * 2.7 + 7) * 0.4;

// ---------- biome + height ----------
export function biomeAtLonLat(lon, lat) {
  if (!insidePoly(lon, lat)) return 'ocean';
  if (distToCoast(lon, lat) < 0.55) return 'coast';
  if (lat >= 29 || (lon > 88.5 && lat > 27.2)) return 'himalaya';
  if (lat >= 27.4) return 'hills';
  if (lon < 75.5 && lat > 23.5) return 'desert';
  if (lon > 89.5) return 'jungle';
  if (lat < 16) return 'forest';
  return 'plains';
}
export function biomeAt(x, z) { const [lon, lat] = worldToLonLat(x, z); return biomeAtLonLat(lon, lat); }
export const isLand = (x, z) => { const [lon, lat] = worldToLonLat(x, z); return insidePoly(lon, lat); };

const ghatsLon = (lat) => 73.7 + (20 - lat) * 0.3;
export function heightAt(x, z) {
  const [lon, lat] = worldToLonLat(x, z);
  if (!insidePoly(lon, lat)) return -7;
  const coastD = distToCoast(lon, lat);
  let h = 2 + fbm(x * 0.012, z * 0.012) * 3;
  if (coastD < 0.55) h = 0.8 + (coastD / 0.55) * 1.6; // beaches slope to the sea
  if (lat >= 27.4) {
    const t = Math.min(1, (lat - 27.4) / 2);
    h += t * t * 26 + (lat > 29 ? (lat - 29) * 16 : 0) + fbm(x * 0.03, z * 0.03) * t * 22;
  }
  if (lon > 88.5 && lat > 25.5) h += (lat - 25.5) * 6 + fbm(x * 0.04, z * 0.04) * 8; // NE hills
  if (lat > 8.5 && lat < 20.5) { // Western Ghats ridge
    const d = lon - ghatsLon(lat);
    h += 11 * Math.exp(-d * d / 0.22) * (0.7 + fbm(x * 0.05, z * 0.05) * 0.6);
  }
  // flatten near cities so streets are level
  for (const c of CITIES) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < CITY_R + 14) {
      const t = Math.max(0, Math.min(1, (d - CITY_R) / 14));
      const cityH = c.baseH ?? (c.baseH = Math.max(2.2, 2 + fbm(c.x * 0.012, c.z * 0.012) * 3));
      h = cityH * (1 - t) + h * t;
      break;
    }
  }
  return h;
}

const BIOME_COLORS = {
  coast: [0.86, 0.79, 0.56], desert: [0.87, 0.74, 0.44], plains: [0.49, 0.68, 0.36],
  forest: [0.27, 0.55, 0.29], jungle: [0.21, 0.48, 0.27], hills: [0.45, 0.55, 0.36],
  himalaya: [0.52, 0.5, 0.49], ocean: [0.07, 0.16, 0.3],
};

// ---------- world construction ----------
export function buildWorld(scene) {
  scene.background = new THREE.Color(0x87b8e8);
  scene.fog = new THREE.Fog(0x87b8e8, 250, 700);
  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x3a5a3a, 1.1));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(150, 300, 100);
  scene.add(sun);

  // terrain
  const W = 1840, H = 1960, SEG = 230;
  const geo = new THREE.PlaneGeometry(W, H, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const biome = biomeAt(x, z);
    let c = BIOME_COLORS[biome] ?? BIOME_COLORS.plains;
    if (biome === 'himalaya' && h > 60) c = [0.93, 0.94, 0.97];          // snowcaps
    else if (biome === 'himalaya' && h > 40) c = [0.7, 0.7, 0.72];
    const shade = 0.92 + fbm(x * 0.05, z * 0.05) * 0.16;
    colors[i * 3] = c[0] * shade; colors[i * 3 + 1] = c[1] * shade; colors[i * 3 + 2] = c[2] * shade;
  }
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(terrain);

  // ocean
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(4200, 4200),
    new THREE.MeshLambertMaterial({ color: 0x2a6aa8, transparent: true, opacity: 0.88 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = 0.45;
  scene.add(ocean);

  scatterProps(scene);
  for (const c of CITIES) buildCity(scene, c);
  for (const l of LANDMARKS) buildLandmark(scene, l);
  return { terrain, ocean };
}

function scatterProps(scene) {
  // trees (cone+trunk), denser in forest/jungle
  const treeGeo = new THREE.ConeGeometry(1.6, 4.5, 6);
  const treeMat = new THREE.MeshLambertMaterial({ color: 0x2d6a2d });
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, 2600);
  const rockGeo = new THREE.DodecahedronGeometry(1.4);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a8278 });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 700);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  let ti = 0, ri = 0, guard = 0;
  while ((ti < 2600 || ri < 700) && guard++ < 60000) {
    const x = (hash(guard, 17) - 0.5) * 1800, z = (hash(guard, 91) - 0.5) * 1900;
    const b = biomeAt(x, z);
    if (b === 'ocean' || nearCity(x, z, CITY_R + 6)) continue;
    const h = heightAt(x, z);
    if (ti < 2600 && (b === 'forest' || b === 'jungle' || (b === 'plains' && hash(guard, 3) < 0.35)
        || (b === 'hills' && hash(guard, 5) < 0.3))) {
      const sc = 0.8 + hash(guard, 7) * 1.3;
      m.compose(new THREE.Vector3(x, h + 2.2 * sc, z), q, s.set(sc, sc, sc));
      trees.setMatrixAt(ti++, m);
    } else if (ri < 700 && (b === 'himalaya' || b === 'desert' || b === 'hills')) {
      const sc = 0.7 + hash(guard, 11) * 1.6;
      m.compose(new THREE.Vector3(x, h + 0.5, z), q, s.set(sc, sc * 0.8, sc));
      rocks.setMatrixAt(ri++, m);
    }
  }
  trees.count = ti; rocks.count = ri;
  scene.add(trees, rocks);
}
export const nearCity = (x, z, r) => CITIES.find((c) => Math.hypot(x - c.x, z - c.z) < r);

function makeLabel(text, color = '#ffffff', size = 26) {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = `bold ${size * 2}px Courier New`;
  cv.width = Math.max(2, ctx.measureText(text).width + 24); cv.height = size * 2 + 18;
  const c2 = cv.getContext('2d');
  c2.font = `bold ${size * 2}px Courier New`;
  c2.fillStyle = 'rgba(10,14,30,0.65)';
  c2.fillRect(0, 0, cv.width, cv.height);
  c2.fillStyle = color;
  c2.textAlign = 'center'; c2.textBaseline = 'middle';
  c2.fillText(text, cv.width / 2, cv.height / 2);
  const tex = new THREE.CanvasTexture(cv);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  spr.scale.set(cv.width / 14, cv.height / 14, 1);
  return spr;
}

function buildCity(scene, c) {
  const h = heightAt(c.x, c.z);
  const g = new THREE.Group();
  g.position.set(c.x, h, c.z);
  // plaza
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(CITY_R, 28),
    new THREE.MeshLambertMaterial({ color: 0xb9b2a4 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.15;
  g.add(plaza);
  // buildings ring
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + (c.x % 1);
    const bw = 4 + hash(c.x * 10 + i, 3) * 3, bh = 6 + hash(i, c.z) * 14;
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw),
      new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(0.6, 0.08, 0.55 + hash(i, 9) * 0.25) }));
    b.position.set(Math.cos(a) * (CITY_R - 7), bh / 2, Math.sin(a) * (CITY_R - 7));
    g.add(b);
  }
  // Pokécenter: white box, red roof — the heal/restock interaction point
  const pc = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 8),
    new THREE.MeshLambertMaterial({ color: 0xf2f0ea }));
  base.position.y = 2.5;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 3.6, 4),
    new THREE.MeshLambertMaterial({ color: 0xe84848 }));
  roof.position.y = 6.8; roof.rotation.y = Math.PI / 4;
  pc.add(base, roof);
  pc.position.set(0, 0, 0);
  g.add(pc);
  const lbl = makeLabel(c.name, '#ffd34d');
  lbl.position.y = 22;
  g.add(lbl);
  scene.add(g);
  c.worldY = h;
}

function buildLandmark(scene, l) {
  const h = heightAt(l.x, l.z);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0x9a86c8, emissive: 0x33205a }));
  pillar.position.set(l.x, h + 3.5, l.z);
  const lbl = makeLabel(l.label, '#cfa8ff', 20);
  lbl.position.set(l.x, h + 12, l.z);
  scene.add(pillar, lbl);
  l.y = h;
}

// ---------- HUD location ----------
export function locationName(x, z) {
  const c = nearCity(x, z, CITY_R + 8);
  if (c) return `${c.name} CITY`;
  const biome = biomeAt(x, z);
  const names = {
    ocean: 'OPEN SEA', coast: 'COASTLINE', desert: 'THAR DESERT', plains: 'GREAT PLAINS',
    forest: 'SOUTHERN FORESTS', jungle: 'EASTERN JUNGLE', hills: 'FOOTHILLS', himalaya: 'HIMALAYA',
  };
  let near = null, nd = Infinity;
  for (const c2 of CITIES) {
    const d = Math.hypot(x - c2.x, z - c2.z);
    if (d < nd) { nd = d; near = c2; }
  }
  return `${names[biome]}${near ? ' · NEAR ' + near.name : ''}`;
}

// ---------- maps (minimap + big map share a renderer) ----------
export function drawMap(canvas, px, pz, heading, detailed) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const pad = detailed ? 30 : 12;
  const toXY = (lon, lat) => [
    pad + ((lon - 68) / (97 - 68)) * (w - pad * 2),
    pad + ((37.5 - lat) / (37.5 - 6.5)) * (h - pad * 2),
  ];
  ctx.beginPath();
  COAST.forEach(([lon, lat], i) => {
    const [X, Y] = toXY(lon, lat);
    i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
  });
  ctx.closePath();
  ctx.fillStyle = '#3a6a3a'; ctx.fill();
  ctx.strokeStyle = '#9fd8ef'; ctx.lineWidth = 1.5; ctx.stroke();
  for (const c of CITIES) {
    const [X, Y] = toXY(c.lon, c.lat);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(X - 2, Y - 2, 4, 4);
    if (detailed) {
      ctx.fillStyle = '#fff'; ctx.font = '9px Courier New';
      ctx.fillText(c.name, X + 4, Y + 3);
    }
  }
  if (detailed) {
    for (const l of LANDMARKS) {
      const [X, Y] = toXY(l.lon, l.lat);
      ctx.fillStyle = '#cfa8ff';
      ctx.beginPath(); ctx.arc(X, Y, 2.4, 0, 7); ctx.fill();
    }
  }
  const [lon, lat] = worldToLonLat(px, pz);
  const [X, Y] = toXY(lon, lat);
  ctx.save();
  ctx.translate(X, Y); ctx.rotate(heading);
  ctx.fillStyle = '#ff5050';
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
}
