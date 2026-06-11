// Third-person trainer: low-poly character, WASD + run, drag-orbit camera,
// terrain-following with ocean blocked.
import * as THREE from 'three';
import { heightAt, isLand } from './world.js';

export class Player {
  constructor(scene, camera, canvas) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.heading = 0;          // facing, radians
    this.camYaw = 0;
    this.camPitch = 0.42;
    this.camDist = 26;
    this.keys = {};
    this.frozen = false;       // true while battle/UI is up

    this.mesh = buildTrainer();
    scene.add(this.mesh);

    window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });

    let dragging = false, lx = 0, ly = 0;
    canvas.addEventListener('mousedown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!dragging || this.frozen) return;
      this.camYaw -= (e.clientX - lx) * 0.006;
      this.camPitch = Math.max(0.12, Math.min(1.25, this.camPitch + (e.clientY - ly) * 0.004));
      lx = e.clientX; ly = e.clientY;
    });
    canvas.addEventListener('wheel', (e) => {
      if (this.frozen) return;
      this.camDist = Math.max(10, Math.min(70, this.camDist + e.deltaY * 0.03));
    }, { passive: true });
  }

  setPosition(x, z) {
    this.pos.set(x, heightAt(x, z), z);
  }

  update(dt) {
    if (!this.frozen) {
      const fwd = (this.keys.KeyW ? 1 : 0) - (this.keys.KeyS ? 1 : 0);
      // Screen-right for a camera looking along +yaw is -x, so A is positive.
      const strafe = (this.keys.KeyA ? 1 : 0) - (this.keys.KeyD ? 1 : 0);
      if (fwd || strafe) {
        const speed = (this.keys.ShiftLeft || this.keys.ShiftRight) ? 30 : 13;
        const dir = Math.atan2(strafe, fwd) + this.camYaw;
        const nx = this.pos.x + Math.sin(dir) * speed * dt;
        const nz = this.pos.z + Math.cos(dir) * speed * dt;
        if (isLand(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
        else if (isLand(nx, this.pos.z)) this.pos.x = nx;   // slide along the shore
        else if (isLand(this.pos.x, nz)) this.pos.z = nz;
        this.heading = dir;
        this.walkT = (this.walkT ?? 0) + dt * speed * 0.55;
      }
    }
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    // walk cycle: legs stride, arms counter-swing
    const t = this.walkT ?? 0;
    const ud = this.mesh.userData;
    ud.legL.rotation.x = Math.sin(t) * 0.7;
    ud.legR.rotation.x = -Math.sin(t) * 0.7;
    ud.armL.rotation.x = -Math.sin(t) * 0.55;
    ud.armR.rotation.x = Math.sin(t) * 0.55;

    // camera orbit
    const cx = this.pos.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cz = this.pos.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    let cy = this.pos.y + Math.sin(this.camPitch) * this.camDist + 4;
    cy = Math.max(cy, heightAt(cx, cz) + 3);   // don't clip into hills
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.pos.x, this.pos.y + 5, this.pos.z);
  }
}

// Anime-protagonist trainer: red/white cap over black hair, blue jacket with
// white sleeves, green gloves, jeans, sneakers, backpack — and a drawn face
// with the trademark cheek marks.
function faceTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#e8b88a'; g.fillRect(0, 0, 64, 64);          // skin
  g.fillStyle = '#1a1a1a';                                     // hair fringe spikes
  g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 0); g.lineTo(64, 12);
  for (let x = 64; x >= 0; x -= 10) { g.lineTo(x - 5, 22); g.lineTo(x - 10, 12); }
  g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.fillRect(13, 28, 12, 9); g.fillRect(39, 28, 12, 9);   // eyes
  g.fillStyle = '#3a2a1a'; g.fillRect(17, 30, 6, 7); g.fillRect(43, 30, 6, 7);
  g.strokeStyle = '#1a1a1a'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(12, 26); g.lineTo(26, 24); g.stroke();                // brows
  g.beginPath(); g.moveTo(38, 24); g.lineTo(52, 26); g.stroke();
  g.strokeStyle = '#b06030'; g.lineWidth = 2;                                   // cheek marks
  for (const cx of [8, 50]) {
    g.beginPath(); g.moveTo(cx, 42); g.lineTo(cx + 6, 44); g.moveTo(cx, 46); g.lineTo(cx + 6, 48); g.stroke();
  }
  g.strokeStyle = '#7a4a2a'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(26, 54); g.quadraticCurveTo(32, 58, 38, 54); g.stroke(); // smile
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let FACE_TEX = null;

export function buildTrainer() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2356c8 });
  const sleeve = new THREE.MeshLambertMaterial({ color: 0xf2f2f0 });
  const glove = new THREE.MeshLambertMaterial({ color: 0x2e8a4a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x3a5a9a });
  const shoe = new THREE.MeshLambertMaterial({ color: 0x303038 });
  const capRed = new THREE.MeshLambertMaterial({ color: 0xd83838 });
  const capWhite = new THREE.MeshLambertMaterial({ color: 0xf5f5f0 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

  // legs (pivot at hip) with sneakers
  const legL = new THREE.Group();
  const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.1, 0.85), jeans);
  thigh.position.y = -1.05;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.3), shoe);
  foot.position.set(0, -2.25, 0.2);
  legL.add(thigh, foot);
  legL.position.set(-0.55, 2.5, 0);
  const legR = legL.clone(true);
  legR.position.x = 0.55;

  // torso: jacket with white center zip + collar
  const torso = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.5, 1.2), jacket);
  torso.position.y = 3.75;
  const zip = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.5, 0.08), sleeve);
  zip.position.set(0, 3.75, 0.64);
  const collar = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.35, 1.3), sleeve);
  collar.position.y = 4.95;

  // arms (pivot at shoulder): white sleeves, green gloved hands
  const armL = new THREE.Group();
  const sleeveL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.9, 0.6), sleeve);
  sleeveL.position.y = -0.95;
  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), glove);
  handL.position.y = -2.1;
  armL.add(sleeveL, handL);
  armL.position.set(-1.45, 4.8, 0);
  const armR = armL.clone(true);
  armR.position.x = 1.45;

  // head with drawn face, hair at the back/sides, cap
  if (!FACE_TEX) FACE_TEX = faceTexture();
  const faceMat = new THREE.MeshLambertMaterial({ map: FACE_TEX });
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5),
    [skin, skin, skin, skin, faceMat, hair]); // +z face, -z hair
  head.position.y = 5.85;
  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.5), hair);
  hairBack.position.set(0, 5.7, -0.75);
  const sideburnL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.5), hair);
  sideburnL.position.set(-0.8, 5.7, 0.3);
  const sideburnR = sideburnL.clone();
  sideburnR.position.x = 0.8;
  const capTop = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.55, 1.75), capRed);
  capTop.position.y = 6.75;
  const capFront = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.16), capWhite);
  capFront.position.set(0, 6.72, 0.86);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 1.0), capRed);
  brim.position.set(0, 6.5, 1.2);

  // backpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 0.7), glove);
  pack.position.set(0, 3.9, -0.95);

  g.add(legL, legR, torso, zip, collar, armL, armR, head,
    hairBack, sideburnL, sideburnR, capTop, capFront, brim, pack);
  for (const m of g.children) m.castShadow = true;
  g.userData = { legL, legR, armL, armR, tintParts: [torso, capTop, brim] };
  return g;
}
