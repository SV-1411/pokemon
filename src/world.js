// The open world: a stylized 3D map of India with a physical sky + day/night
// sun, soft shadows, animated water, a road network with houses and villages,
// biome-specific vegetation (palms, pines, broadleaf, cacti), street lamps,
// and tall-grass encounter patches.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

// ---------- geography ----------
export const SCALE = 60; // world units per degree
const CLON = 82.75, CLAT = 21.75;
export const lonLatToWorld = (lon, lat) => [(lon - CLON) * SCALE, (CLAT - lat) * SCALE];
export const worldToLonLat = (x, z) => [x / SCALE + CLON, CLAT - z / SCALE];

// Stylized India coastline + land border, clockwise from the Rann of Kutch.
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
function distToCoast(lon, lat) {
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

// ---------- cities / landmarks ----------
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
export const CITY_R = 24;
for (const c of CITIES) {
  const [x, z] = lonLatToWorld(c.lon, c.lat);
  c.x = x; c.z = z;
}

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
  if (coastD < 0.55) h = 0.8 + (coastD / 0.55) * 1.6;
  if (lat >= 27.4) {
    const t = Math.min(1, (lat - 27.4) / 2);
    h += t * t * 26 + (lat > 29 ? (lat - 29) * 16 : 0) + fbm(x * 0.03, z * 0.03) * t * 22;
  }
  if (lon > 88.5 && lat > 25.5) h += (lat - 25.5) * 6 + fbm(x * 0.04, z * 0.04) * 8;
  if (lat > 8.5 && lat < 20.5) {
    const d = lon - ghatsLon(lat);
    h += 11 * Math.exp(-d * d / 0.22) * (0.7 + fbm(x * 0.05, z * 0.05) * 0.6);
  }
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
  coast: [0.87, 0.8, 0.58], desert: [0.89, 0.76, 0.46], plains: [0.5, 0.69, 0.36],
  forest: [0.28, 0.56, 0.3], jungle: [0.21, 0.49, 0.27], hills: [0.46, 0.56, 0.36],
  himalaya: [0.54, 0.52, 0.5], ocean: [0.07, 0.16, 0.3],
};

// ---------- road network ----------
export const ROADS = []; // [{points: [[x,z],...]}]
(function buildRoadGraph() {
  const edges = new Set();
  for (const a of CITIES) {
    const near = CITIES.filter((b) => b !== a)
      .sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))
      .slice(0, 2);
    for (const b of near) {
      const key = [a.name, b.name].sort().join('|');
      if (edges.has(key)) continue;
      edges.add(key);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.max(2, Math.ceil(len / 10));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        // gentle bend so roads don't look laser-straight
        const bend = Math.sin(t * Math.PI) * len * 0.04;
        const px = a.x + (b.x - a.x) * t - (b.z - a.z) / len * bend;
        const pz = a.z + (b.z - a.z) * t + (b.x - a.x) / len * bend;
        if (isLand(px, pz)) pts.push([px, pz]);
      }
      if (pts.length > 2) ROADS.push({ points: pts, from: a.name, to: b.name });
    }
  }
})();
export function nearRoad(x, z, r = 6) {
  for (const road of ROADS) {
    for (const [px, pz] of road.points) {
      if (Math.abs(px - x) < r + 10 && Math.abs(pz - z) < r + 10
        && Math.hypot(px - x, pz - z) < r) return true;
    }
  }
  return false;
}

export const nearCity = (x, z, r) => CITIES.find((c) => Math.hypot(x - c.x, z - c.z) < r);

// ---------- tall grass (encounter patches) ----------
export const TALL_GRASS = []; // {x, z, r}
(function placeGrass() {
  let placed = 0;
  for (let i = 0; placed < 520 && i < 30000; i++) {
    const x = (hash(i, 1234) - 0.5) * 1800, z = (hash(i, 5678) - 0.5) * 1900;
    const b = biomeAt(x, z);
    if (!['plains', 'forest', 'jungle', 'coast', 'hills'].includes(b)) continue;
    if (nearCity(x, z, CITY_R + 12)) continue;
    TALL_GRASS.push({ x, z, r: 7 + hash(i, 9) * 8 });
    placed++;
  }
})();
export function inTallGrass(x, z) {
  for (const g of TALL_GRASS) {
    if (Math.abs(g.x - x) < g.r && Math.abs(g.z - z) < g.r
      && Math.hypot(g.x - x, g.z - z) < g.r) return g;
  }
  return null;
}

// ---------- canvas textures ----------
function grassBladeTexture(dark) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 4 + Math.random() * 56, h = 26 + Math.random() * 34;
    const lean = (Math.random() - 0.5) * 14;
    const grad = g.createLinearGradient(x, 64, x + lean, 64 - h);
    grad.addColorStop(0, dark ? '#2e7a2c' : '#46953c');
    grad.addColorStop(1, dark ? '#6cc456' : '#8ed468');
    g.strokeStyle = grad; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(x, 64); g.quadraticCurveTo(x + lean * 0.4, 64 - h * 0.6, x + lean, 64 - h); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function groundDetailTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) {
    const v = 225 + Math.floor(Math.random() * 30);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(260, 270);
  return t;
}
// two crossed quads, 1x1, pivot at bottom center
function crossQuadGeometry() {
  const geo = new THREE.BufferGeometry();
  const verts = [], uvs = [], idx = [];
  for (const rot of [0, Math.PI / 2]) {
    const c = Math.cos(rot) * 0.5, s = Math.sin(rot) * 0.5;
    const base = verts.length / 3;
    verts.push(-c, 0, -s, c, 0, s, c, 1, s, -c, 1, -s);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals(); // Lambert renders black without normals
  return geo;
}

// ---------- world construction ----------
export function buildWorld(scene, opts = {}) {
  const lowSpec = !!opts.lowSpec;

  // sky + sun
  const sky = new Sky();
  sky.scale.setScalar(4500);
  scene.add(sky);
  const su = sky.material.uniforms;
  su.turbidity.value = 6; su.rayleigh.value = 1.6;
  su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.7;

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a6a40, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(150, 300, 100);
  if (!lowSpec) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110;
    sc.near = 50; sc.far = 700;
    sun.shadow.bias = -0.0008;
  }
  scene.add(sun, sun.target);
  scene.fog = new THREE.Fog(0x9fc3e8, 260, 760);

  // terrain
  const W = 1840, H = 1960, SEG = 250;
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
    if (biome === 'himalaya' && h > 60) c = [0.93, 0.94, 0.97];
    else if (biome === 'himalaya' && h > 40) c = [0.7, 0.7, 0.72];
    const shade = 0.9 + fbm(x * 0.05, z * 0.05) * 0.2;
    colors[i * 3] = c[0] * shade; colors[i * 3 + 1] = c[1] * shade; colors[i * 3 + 2] = c[2] * shade;
  }
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    vertexColors: true, map: groundDetailTexture(),
  }));
  terrain.receiveShadow = !lowSpec;
  scene.add(terrain);

  // animated water
  const waterUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.2) },
  };
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(4200, 4200, 48, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      uniforms: waterUniforms,
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorld;
        void main(){
          vec3 p = position;
          p.z += sin(p.x*0.05 + uTime*1.1)*0.35 + cos(p.y*0.04 + uTime*0.8)*0.3;
          vec4 wp = modelMatrix * vec4(p,1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSunDir;
        varying vec3 vWorld;
        void main(){
          vec3 deep = vec3(0.05,0.22,0.38);
          vec3 shallow = vec3(0.16,0.5,0.62);
          float n = sin(vWorld.x*0.22 + uTime*1.6)*0.5 + cos(vWorld.z*0.19 - uTime*1.2)*0.5;
          vec3 nrm = normalize(vec3(n*0.12, 1.0, n*0.1));
          vec3 view = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(dot(view, nrm), 0.0), 2.0);
          vec3 col = mix(deep, shallow, 0.35 + 0.35*n) + fres*vec3(0.25,0.3,0.32);
          float glint = pow(max(dot(reflect(-normalize(uSunDir), nrm), view), 0.0), 90.0);
          col += glint * vec3(1.0,0.95,0.8) * 0.9;
          gl_FragColor = vec4(col, 0.93);
        }`,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.45;
  scene.add(water);

  // roads
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x6e6a62 });
  for (const road of ROADS) {
    const pts = road.points;
    const verts = [], idx = [];
    const HW = 2.6;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      const [nx, nz] = pts[Math.min(i + 1, pts.length - 1)];
      const [px2, pz2] = pts[Math.max(i - 1, 0)];
      let dx = nx - px2, dz = nz - pz2;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const y = heightAt(x, z) + 0.22;
      verts.push(x - dz * HW, y, z + dx * HW, x + dz * HW, y, z - dx * HW);
      if (i > 0) {
        const b = i * 2;
        idx.push(b - 2, b - 1, b, b - 1, b + 1, b);
      }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    rg.setIndex(idx);
    rg.computeVertexNormals();
    scene.add(new THREE.Mesh(rg, roadMat));
  }

  plantVegetation(scene, lowSpec);
  plantTallGrass(scene);
  const lampMats = [], windowMats = [];
  for (const c of CITIES) buildCity(scene, c, lampMats, windowMats, lowSpec);
  buildVillages(scene, lowSpec);
  for (const l of LANDMARKS) buildLandmark(scene, l);

  // drifting clouds
  const cloudCv = document.createElement('canvas');
  cloudCv.width = 128; cloudCv.height = 64;
  const cg = cloudCv.getContext('2d');
  for (const [cx, cy, r] of [[40, 38, 22], [66, 30, 26], [94, 38, 20], [60, 44, 24]]) {
    const grad = cg.createRadialGradient(cx, cy, 2, cx, cy, r);
    grad.addColorStop(0, 'rgba(255,255,255,.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    cg.fillStyle = grad;
    cg.fillRect(0, 0, 128, 64);
  }
  const cloudMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cloudCv), transparent: true, opacity: 0.7, depthWrite: false,
  });
  const clouds = [];
  for (let i = 0; i < 34; i++) {
    const s = new THREE.Sprite(cloudMat);
    const sc = 60 + hash(i, 301) * 90;
    s.scale.set(sc, sc * 0.42, 1);
    s.position.set((hash(i, 302) - 0.5) * 2600, 130 + hash(i, 303) * 70, (hash(i, 304) - 0.5) * 2600);
    scene.add(s);
    clouds.push(s);
  }

  // ---------- runtime API (driven by weather.js / main.js) ----------
  const sunDir = new THREE.Vector3();
  return {
    sun, hemi, sky, water,
    // elevation in degrees above horizon; t handles colors via the Sky shader
    setSun(elevDeg, azimDeg) {
      const phi = THREE.MathUtils.degToRad(90 - elevDeg);
      const theta = THREE.MathUtils.degToRad(azimDeg);
      sunDir.setFromSphericalCoords(1, phi, theta);
      su.sunPosition.value.copy(sunDir);
      waterUniforms.uSunDir.value.copy(sunDir);
      const day = Math.max(0, Math.min(1, (elevDeg + 4) / 18));
      sun.intensity = 2.4 * day;
      hemi.intensity = 0.25 + 0.75 * day;
      for (const m of lampMats) m.emissiveIntensity = day < 0.35 ? 2.2 : 0;
      for (const m of windowMats) m.emissiveIntensity = day < 0.35 ? 1.1 : 0;
      cloudMat.opacity = 0.18 + day * 0.55;
      return day; // 0 = night, 1 = full day
    },
    placeSunShadow(px, pz) {
      sun.position.set(px + sunDir.x * 400, Math.max(120, sunDir.y * 400), pz + sunDir.z * 400);
      sun.target.position.set(px, 0, pz);
    },
    tick(dt) {
      waterUniforms.uTime.value += dt;
      for (const s of clouds) {
        s.position.x += dt * 2.4;
        if (s.position.x > 1300) s.position.x = -1300;
      }
    },
    setFog(color, near, far) {
      scene.fog.color.set(color);
      scene.fog.near = near; scene.fog.far = far;
      scene.background = null; // sky dome shows through
    },
  };
}

// ---------- vegetation ----------
// Multi-part instanced "prefabs": each part is an InstancedMesh sharing the
// same per-instance transform list.
function instancedPrefab(scene, parts, matrices, shadows, colors) {
  for (const { geo, mat, local, tint } of parts) {
    const im = new THREE.InstancedMesh(geo, mat, matrices.length);
    const m = new THREE.Matrix4();
    matrices.forEach((world, i) => {
      m.copy(world);
      if (local) m.multiply(local);
      im.setMatrixAt(i, m);
      if (tint && colors) im.setColorAt(i, colors[i]); // per-instance hue variety
    });
    im.castShadow = shadows;
    scene.add(im);
  }
}
const M4 = (x, y, z, s = 1, ry = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
    new THREE.Vector3(s, s, s),
  );
const local = (x, y, z, sx = 1, sy = 1, sz = 1, rz = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)),
    new THREE.Vector3(sx, sy, sz),
  );

function plantVegetation(scene, lowSpec) {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const palmTrunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  // foliage materials are white — per-instance colors carry the actual green
  const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const jungleLeafMat = leafMat, pineMat = leafMat, snowPineMat = leafMat,
    palmLeafMat = leafMat, cactusMat = leafMat, rockMat = leafMat;

  const BASE_TINT = {
    broadleaf: 0x2e7a30, jungleTree: 0x1f6028, pine: 0x2a5a38,
    snowPine: 0x8fae9a, palm: 0x3a8a3a, cactus: 0x4a8a4a, rock: 0x8a8278,
  };
  const sets = {}, tints = {};
  for (const k of Object.keys(BASE_TINT)) { sets[k] = []; tints[k] = []; }
  const cap = lowSpec ? 0.5 : 1;
  const want = {
    broadleaf: 1400 * cap, jungleTree: 700 * cap, pine: 900 * cap, snowPine: 400 * cap,
    palm: 500 * cap, cactus: 350 * cap, rock: 600 * cap,
  };
  let guard = 0;
  const put = (k, mat) => {
    if (sets[k].length >= want[k]) return false;
    sets[k].push(mat);
    tints[k].push(new THREE.Color(BASE_TINT[k])
      .offsetHSL((hash(guard, 23) - 0.5) * 0.07, 0, (hash(guard, 29) - 0.5) * 0.14));
    return true;
  };
  const need = () => Object.keys(want).some((k) => sets[k].length < want[k]);
  while (need() && guard++ < 90000) {
    const x = (hash(guard, 17) - 0.5) * 1800, z = (hash(guard, 91) - 0.5) * 1900;
    const b = biomeAt(x, z);
    if (b === 'ocean' || nearCity(x, z, CITY_R + 8) || nearRoad(x, z, 5)) continue;
    const h = heightAt(x, z);
    const s = 0.75 + hash(guard, 7) * 0.8;
    const ry = hash(guard, 19) * 6.28;
    const mat = M4(x, h, z, s, ry);
    if (b === 'forest' || (b === 'plains' && hash(guard, 3) < 0.3)) put('broadleaf', mat);
    else if (b === 'jungle') put('jungleTree', mat);
    else if (b === 'hills') put('pine', mat);
    else if (b === 'himalaya' && h < 70) {
      if (h < 45) put('snowPine', mat) || put('rock', mat);
      else put('rock', mat);
    } else if (b === 'coast') {
      if (hash(guard, 5) < 0.7) put('palm', mat);
    } else if (b === 'desert') {
      if (hash(guard, 5) < 0.5) put('cactus', mat);
      else put('rock', mat);
    }
  }

  const cyl = (r1, r2, h) => new THREE.CylinderGeometry(r1, r2, h, 6);
  const blob = (r) => new THREE.IcosahedronGeometry(r, 1);
  const cone = (r, h) => new THREE.ConeGeometry(r, h, 7);
  const sh = !lowSpec;

  instancedPrefab(scene, [
    { geo: cyl(0.3, 0.45, 3.2), mat: trunkMat, local: local(0, 1.6, 0) },
    { geo: blob(2.3), mat: leafMat, local: local(0, 4.6, 0, 1, 0.92, 1), tint: true },
    { geo: blob(1.5), mat: leafMat, local: local(1.2, 3.8, 0.7, 1, 0.85, 1), tint: true },
  ], sets.broadleaf, sh, tints.broadleaf);
  instancedPrefab(scene, [
    { geo: cyl(0.35, 0.5, 4.2), mat: trunkMat, local: local(0, 2.1, 0) },
    { geo: blob(2.8), mat: jungleLeafMat, local: local(0, 5.6, 0, 1.15, 0.8, 1.15), tint: true },
    { geo: blob(1.8), mat: jungleLeafMat, local: local(-1.5, 4.4, 0.9, 1, 0.8, 1), tint: true },
  ], sets.jungleTree, sh, tints.jungleTree);
  instancedPrefab(scene, [
    { geo: cyl(0.25, 0.35, 2.4), mat: trunkMat, local: local(0, 1.2, 0) },
    { geo: cone(2.1, 3.2), mat: pineMat, local: local(0, 3.6, 0), tint: true },
    { geo: cone(1.6, 2.6), mat: pineMat, local: local(0, 5.3, 0), tint: true },
    { geo: cone(1.1, 2.1), mat: pineMat, local: local(0, 6.8, 0), tint: true },
  ], sets.pine, sh, tints.pine);
  instancedPrefab(scene, [
    { geo: cyl(0.25, 0.35, 2.4), mat: trunkMat, local: local(0, 1.2, 0) },
    { geo: cone(2.0, 3.0), mat: snowPineMat, local: local(0, 3.5, 0), tint: true },
    { geo: cone(1.4, 2.4), mat: snowPineMat, local: local(0, 5.1, 0), tint: true },
  ], sets.snowPine, sh, tints.snowPine);
  instancedPrefab(scene, [
    { geo: cyl(0.22, 0.3, 5.2), mat: palmTrunkMat, local: local(0.35, 2.6, 0, 1, 1, 1, 0.16) },
    { geo: blob(1.6), mat: palmLeafMat, local: local(1.1, 5.4, 0, 1.6, 0.45, 1.6), tint: true },
  ], sets.palm, sh, tints.palm);
  instancedPrefab(scene, [
    { geo: cyl(0.5, 0.55, 3.4), mat: cactusMat, local: local(0, 1.7, 0), tint: true },
    { geo: cyl(0.28, 0.3, 1.6), mat: cactusMat, local: local(0.85, 2.4, 0, 1, 1, 1, 1.1), tint: true },
    { geo: cyl(0.28, 0.3, 1.3), mat: cactusMat, local: local(-0.8, 1.9, 0, 1, 1, 1, -1.2), tint: true },
  ], sets.cactus, sh, tints.cactus);
  instancedPrefab(scene, [
    { geo: new THREE.DodecahedronGeometry(1.4), mat: rockMat, local: local(0, 0.6, 0, 1, 0.75, 1), tint: true },
  ], sets.rock, sh, tints.rock);
}

function plantTallGrass(scene) {
  const tallTex = grassBladeTexture(true);
  const tallMat = new THREE.MeshLambertMaterial({
    map: tallTex, alphaTest: 0.35, side: THREE.DoubleSide,
  });
  const geo = crossQuadGeometry();
  const mats = [];
  for (const g of TALL_GRASS) {
    const tufts = Math.floor(g.r * g.r * 0.45);
    for (let i = 0; i < tufts; i++) {
      const a = hash(g.x * 7 + i, 3) * 6.28, d = Math.sqrt(hash(i, g.z)) * g.r;
      const x = g.x + Math.sin(a) * d, z = g.z + Math.cos(a) * d;
      const s = 1.5 + hash(i, 77) * 0.9;
      mats.push(new THREE.Matrix4().compose(
        new THREE.Vector3(x, heightAt(x, z), z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, hash(i, 13) * 3.14, 0)),
        new THREE.Vector3(s * 1.4, s * 1.5, s * 1.4),
      ));
    }
  }
  const im = new THREE.InstancedMesh(geo, tallMat, mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  scene.add(im);

  // short decorative grass sprinkled through green biomes
  const shortMat = new THREE.MeshLambertMaterial({
    map: grassBladeTexture(false), alphaTest: 0.35, side: THREE.DoubleSide,
  });
  const sm = [];
  for (let i = 0; sm.length < 5000 && i < 40000; i++) {
    const x = (hash(i, 401) - 0.5) * 1800, z = (hash(i, 402) - 0.5) * 1900;
    const b = biomeAt(x, z);
    if (!['plains', 'forest', 'jungle', 'coast'].includes(b)) continue;
    if (nearCity(x, z, CITY_R + 6)) continue;
    const s = 1.1 + hash(i, 403) * 0.9;
    sm.push(new THREE.Matrix4().compose(
      new THREE.Vector3(x, heightAt(x, z), z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, hash(i, 404) * 3.14, 0)),
      new THREE.Vector3(s, s, s),
    ));
  }
  const im2 = new THREE.InstancedMesh(crossQuadGeometry(), shortMat, sm.length);
  sm.forEach((m, i) => im2.setMatrixAt(i, m));
  scene.add(im2);
}

// ---------- buildings ----------
const PLASTER = [0xf2e8d8, 0xf8d8b8, 0xd8e8f0, 0xe8e0c8, 0xf0d8d0];
function buildHouse(parent, x, y, z, ry, seed, shadows) {
  const g = new THREE.Group();
  const w = 4 + hash(seed, 2) * 2.2, d = 3.4 + hash(seed, 3) * 1.6, hh = 2.8 + hash(seed, 4);
  const wall = new THREE.MeshLambertMaterial({ color: PLASTER[seed % PLASTER.length] });
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), wall);
  base.position.y = hh / 2;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) * 0.62, 1.8, 4),
    new THREE.MeshLambertMaterial({ color: 0xb5532f }));
  roof.position.y = hh + 0.9;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w / Math.hypot(w, d) * 1.42, 1, d / Math.hypot(w, d) * 1.42);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.12),
    new THREE.MeshLambertMaterial({ color: 0x5a3a22 }));
  door.position.set(0, 0.85, d / 2 + 0.06);
  const winMat = new THREE.MeshLambertMaterial({ color: 0x2a3a55 });
  for (const wx of [-w / 4 - 0.3, w / 4 + 0.3]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.1), winMat);
    win.position.set(wx, hh * 0.6, d / 2 + 0.05);
    g.add(win);
  }
  base.castShadow = shadows; roof.castShadow = shadows;
  g.add(base, roof, door);
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
}
function buildLamp(parent, x, y, z, lampMats, shadows) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 6),
    new THREE.MeshLambertMaterial({ color: 0x3a3a44 }));
  pole.position.set(x, y + 2.5, z);
  pole.castShadow = shadows;
  const mat = new THREE.MeshLambertMaterial({
    color: 0xfff2c8, emissive: 0xffd34d, emissiveIntensity: 0,
  });
  lampMats.push(mat);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), mat);
  bulb.position.set(x, y + 5.1, z);
  parent.add(pole, bulb);
}

export function makeLabel(text, color = '#ffffff', size = 26) {
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

// ---------- realistic city blocks ----------
// Procedural building facades: plaster base, storefront strip, a window grid —
// plus a matching emissive map so the windows glow warm at night.
const FACADE_BASES = ['#e8dcc8', '#d8c8b0', '#c8d2dc', '#e2cfc2', '#cfd8c8', '#dcd0e0'];
let FACADES = null;
function makeFacades() {
  FACADES = [];
  for (let v = 0; v < 6; v++) {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 256;
    const g = cv.getContext('2d');
    const ev = document.createElement('canvas');
    ev.width = 128; ev.height = 256;
    const eg = ev.getContext('2d');
    eg.fillStyle = '#000'; eg.fillRect(0, 0, 128, 256);
    g.fillStyle = FACADE_BASES[v]; g.fillRect(0, 0, 128, 256);
    // grime + floor lines
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(60,50,40,${Math.random() * 0.06})`;
      g.fillRect(Math.random() * 128, Math.random() * 256, 3, 3);
    }
    // storefront at street level: dark strip, door, shop window
    g.fillStyle = '#5a4a3c'; g.fillRect(0, 214, 128, 42);
    g.fillStyle = '#3a2e24'; g.fillRect(14, 222, 24, 34);
    g.fillStyle = '#79a8b8'; g.fillRect(52, 222, 60, 26);
    // window grid above
    const cols = 3, rows = 5;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = 12 + col * 38, y = 14 + r * 39;
        g.fillStyle = '#8a8276'; g.fillRect(x - 2, y - 2, 28, 32); // frame
        g.fillStyle = '#2c3a52'; g.fillRect(x, y, 24, 28);         // glass
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, 24, 9);
        if ((v * 7 + r * 3 + col * 5) % 5 < 3) {                  // ~60% lit at night
          eg.fillStyle = '#ffd07a'; eg.fillRect(x, y, 24, 28);
        }
      }
    }
    const map = new THREE.CanvasTexture(cv);
    map.colorSpace = THREE.SRGBColorSpace;
    FACADES.push({ map, emissive: new THREE.CanvasTexture(ev) });
  }
}
const SHOPS = ['POKé MART', 'CHAI POINT', 'DOSA CORNER', 'CYCLE WORKS', 'JUICE WALA', 'SWEET HOUSE'];

function buildApartment(parent, x, z, ry, seed, windowMats, shadows) {
  const f = FACADES[seed % FACADES.length];
  const w = 5 + hash(seed, 41) * 1.5, d = 4.6 + hash(seed, 42) * 1.4;
  const floors = 2 + Math.floor(hash(seed, 43) * 4);
  const hgt = floors * 3.4;
  const side = new THREE.MeshLambertMaterial({
    map: f.map, emissiveMap: f.emissive, emissive: 0xffc878, emissiveIntensity: 0,
  });
  windowMats.push(side);
  const roof = new THREE.MeshLambertMaterial({ color: 0x7a7268 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), [side, side, roof, roof, side, side]);
  b.position.set(x, hgt / 2, z);
  b.rotation.y = ry;
  b.castShadow = shadows;
  parent.add(b);
  // rooftop water tank — the most Indian skyline detail there is
  if (hash(seed, 44) < 0.6) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 8),
      new THREE.MeshLambertMaterial({ color: 0x222932 }));
    tank.position.set(x + Math.cos(ry) * 1.2, hgt + 0.6, z + Math.sin(ry) * 1.2);
    parent.add(tank);
  }
}

function signTexture(text, bg) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 56;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 56);
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(3, 3, 250, 50);
  g.fillStyle = '#fff'; g.font = 'bold 30px Courier New';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 30);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function buildShop(parent, x, z, ry, seed, shadows) {
  const g = new THREE.Group();
  const wall = new THREE.MeshLambertMaterial({ color: PLASTER[seed % PLASTER.length] });
  const base = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.4, 4.4), wall);
  base.position.y = 1.7; base.castShadow = shadows;
  g.add(base);
  // striped awning
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 16;
  const ag = cv.getContext('2d');
  const colA = seed % 2 ? '#d8483c' : '#3a7a4a';
  for (let i = 0; i < 8; i++) { ag.fillStyle = i % 2 ? '#f5f0e5' : colA; ag.fillRect(i * 8, 0, 8, 16); }
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.6),
    new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide }));
  awn.position.set(0, 2.8, 2.75); awn.rotation.x = 0.5;
  g.add(awn);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1),
    new THREE.MeshLambertMaterial({ map: signTexture(SHOPS[seed % SHOPS.length], seed % 2 ? '#b03a30' : '#2a5a8a') }));
  sign.position.set(0, 3.95, 2.26);
  g.add(sign);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2, 0.1),
    new THREE.MeshLambertMaterial({ color: 0x4a3526 }));
  door.position.set(-1.4, 1, 2.21);
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.3, 0.1),
    new THREE.MeshLambertMaterial({ color: 0x79a8b8 }));
  win.position.set(1.1, 1.5, 2.21);
  g.add(door, win);
  g.position.set(x, 0, z); g.rotation.y = ry;
  parent.add(g);
}

function buildRickshaw(parent, x, z, ry) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 2.3),
    new THREE.MeshLambertMaterial({ color: 0xf5c518 }));
  body.position.y = 0.85;
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.75, 1.5),
    new THREE.MeshLambertMaterial({ color: 0x1f4a2a }));
  canopy.position.set(0, 1.72, -0.3);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 0.06),
    new THREE.MeshLambertMaterial({ color: 0xbfd8e8 }));
  shield.position.set(0, 1.5, 1.1);
  const wheelG = new THREE.CylinderGeometry(0.34, 0.34, 0.16, 10);
  const wheelM = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  for (const [wx, wz] of [[0, 1.0], [-0.7, -0.8], [0.7, -0.8]]) {
    const wm = new THREE.Mesh(wheelG, wheelM);
    wm.rotation.z = Math.PI / 2;
    wm.position.set(wx, 0.34, wz);
    g.add(wm);
  }
  g.add(body, canopy, shield);
  g.position.set(x, 0, z); g.rotation.y = ry;
  parent.add(g);
}

function buildCity(scene, c, lampMats, windowMats, lowSpec) {
  if (!FACADES) makeFacades();
  const h = heightAt(c.x, c.z);
  const g = new THREE.Group();
  g.position.set(c.x, h, c.z);
  const sh = !lowSpec;
  const seed0 = Math.floor(Math.abs(c.x * 7 + c.z * 13));

  // paved plaza + four radiating streets with sidewalks
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(10, 30),
    new THREE.MeshLambertMaterial({ color: 0xb3ac9e }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.18;
  plaza.receiveShadow = sh;
  g.add(plaza);
  const asphalt = new THREE.MeshLambertMaterial({ color: 0x55524c });
  const walkway = new THREE.MeshLambertMaterial({ color: 0xa8a294 });
  for (let dir = 0; dir < 4; dir++) {
    const a = (dir * Math.PI) / 2;
    const len = CITY_R - 4;
    const mid = 8 + len / 2;
    const street = new THREE.Mesh(new THREE.BoxGeometry(5, 0.14, len), asphalt);
    street.position.set(Math.sin(a) * mid, 0.14, Math.cos(a) * mid);
    street.rotation.y = a;
    street.receiveShadow = sh;
    g.add(street);
    for (const off of [-3.4, 3.4]) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, len), walkway);
      sw.position.set(Math.sin(a) * mid + Math.cos(a) * off, 0.14, Math.cos(a) * mid - Math.sin(a) * off);
      sw.rotation.y = a;
      g.add(sw);
    }
    buildLamp(g, Math.sin(a) * (CITY_R - 4), 0, Math.cos(a) * (CITY_R - 4), lampMats, sh);
  }
  // textured apartment blocks lining the streets
  let bi = 0;
  for (let dir = 0; dir < 4; dir++) {
    const a = (dir * Math.PI) / 2;
    for (const along of [14, 20.5]) {
      for (const sideOff of [-7.2, 7.2]) {
        if (hash(seed0, bi) < 0.22) { bi++; continue; } // gaps keep skylines uneven
        const bx = Math.sin(a) * along + Math.cos(a) * sideOff;
        const bz = Math.cos(a) * along - Math.sin(a) * sideOff;
        buildApartment(g, bx, bz, a + (sideOff > 0 ? -Math.PI / 2 : Math.PI / 2),
          seed0 + bi, windowMats, sh);
        bi++;
      }
    }
  }
  // shops at the plaza diagonals, facing the centre
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    buildShop(g, Math.cos(a) * 13.5, Math.sin(a) * 13.5, -a - Math.PI / 2, seed0 + i, sh);
  }
  // parked autorickshaws + plaza lamps + hedges
  for (let i = 0; i < 3; i++) {
    const a = hash(seed0, 60 + i) * 6.28;
    buildRickshaw(g, Math.cos(a) * 10.8, Math.sin(a) * 10.8, hash(seed0, 70 + i) * 6.28);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    buildLamp(g, Math.cos(a) * 8, 0, Math.sin(a) * 8, lampMats, sh);
  }
  const hedgeMat = new THREE.MeshLambertMaterial({ color: 0x3a7a3a });
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 4 + (Math.floor(i / 3) * Math.PI) / 2 + (i % 3 - 1) * 0.22;
    const hd = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 1), hedgeMat);
    hd.position.set(Math.cos(a) * 17.5, 0.5, Math.sin(a) * 17.5);
    hd.rotation.y = -a;
    g.add(hd);
  }
  // Pokécenter on the plaza
  const pc = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(7, 4.6, 7),
    new THREE.MeshLambertMaterial({ color: 0xf2f0ea }));
  base.position.y = 2.3; base.castShadow = sh;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 3.4, 4),
    new THREE.MeshLambertMaterial({ color: 0xe84848 }));
  roof.position.y = 6.3; roof.rotation.y = Math.PI / 4; roof.castShadow = sh;
  const pcSign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.8),
    new THREE.MeshLambertMaterial({ map: signTexture('POKéCENTER', '#c4392f') }));
  pcSign.position.set(0, 3.6, 3.56);
  pc.add(base, roof, pcSign);
  g.add(pc);
  const lbl = makeLabel(c.name, '#ffd34d');
  lbl.position.y = 26;
  g.add(lbl);
  scene.add(g);
  c.worldY = h;
}

function buildVillages(scene, lowSpec) {
  // hamlets at road midpoints
  ROADS.forEach((road, ri) => {
    if (road.points.length < 20) return;
    const mid = road.points[Math.floor(road.points.length / 2)];
    for (let i = 0; i < 3; i++) {
      const a = hash(ri, i) * 6.28, d = 9 + hash(i, ri) * 8;
      const x = mid[0] + Math.sin(a) * d, z = mid[1] + Math.cos(a) * d;
      if (!isLand(x, z) || biomeAt(x, z) === 'himalaya') continue;
      buildHouse(scene, x, heightAt(x, z), z, hash(i, 99) * 6.28, ri * 7 + i, !lowSpec);
    }
  });
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

// ---------- maps ----------
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
  if (detailed) {
    ctx.strokeStyle = 'rgba(220,210,180,.5)'; ctx.lineWidth = 1;
    for (const road of ROADS) {
      ctx.beginPath();
      road.points.forEach(([rx, rz], i) => {
        const [lon, lat] = worldToLonLat(rx, rz);
        const [X, Y] = toXY(lon, lat);
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      });
      ctx.stroke();
    }
  }
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
