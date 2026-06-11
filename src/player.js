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
      const strafe = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0);
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
    // walk bob on the legs
    const t = this.walkT ?? 0;
    this.mesh.userData.legL.rotation.x = Math.sin(t) * 0.7;
    this.mesh.userData.legR.rotation.x = -Math.sin(t) * 0.7;

    // camera orbit
    const cx = this.pos.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cz = this.pos.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    let cy = this.pos.y + Math.sin(this.camPitch) * this.camDist + 4;
    cy = Math.max(cy, heightAt(cx, cz) + 3);   // don't clip into hills
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.pos.x, this.pos.y + 5, this.pos.z);
  }
}

function buildTrainer() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc89878 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xe84848 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x3858a8 });
  const capM = new THREE.MeshLambertMaterial({ color: 0xe84848 });

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), pants);
  legL.position.set(-0.55, 1.2, 0); legL.geometry.translate(0, -1.2, 0); legL.position.y = 2.4;
  const legR = legL.clone(); legR.position.x = 0.55;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 1.2), shirt);
  torso.position.y = 3.7;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.2, 0.6), shirt);
  armL.position.set(-1.45, 3.8, 0);
  const armR = armL.clone(); armR.position.x = 1.45;
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), skin);
  head.position.y = 5.8;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.7), capM);
  cap.position.y = 6.6;
  const brim = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.9), capM);
  brim.position.set(0, 6.45, 1.05);
  g.add(legL, legR, torso, armL, armR, head, cap, brim);
  g.userData = { legL, legR };
  return g;
}
