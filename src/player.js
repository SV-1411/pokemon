// Third-person trainer: low-poly character, WASD + run, drag-orbit camera,
// terrain-following with ocean blocked.
import * as THREE from 'three';
import { heightAt, isLand } from './world.js';
import { buildProtagonist } from './chars.js';

// the anime-proportioned protagonist (chars.js); name kept for callers
export const buildTrainer = buildProtagonist;

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
    // walk cycle: legs stride, arms counter-swing; idle breathing; run lean
    const t = this.walkT ?? 0;
    const ud = this.mesh.userData;
    this.idleT = (this.idleT ?? 0) + dt;
    const moving = t !== this.lastWalkT;
    this.lastWalkT = t;
    const running = moving && (this.keys.ShiftLeft || this.keys.ShiftRight);
    ud.legL.rotation.x = Math.sin(t) * 0.7;
    ud.legR.rotation.x = -Math.sin(t) * 0.7;
    ud.armL.rotation.x = -Math.sin(t) * (running ? 0.8 : 0.55);
    ud.armR.rotation.x = Math.sin(t) * (running ? 0.8 : 0.55);
    ud.torso.scale.y = moving ? 1 : 1 + Math.sin(this.idleT * 2.2) * 0.015;
    this.lean = (this.lean ?? 0) + ((running ? 0.16 : 0) - (this.lean ?? 0)) * Math.min(1, dt * 8);
    this.mesh.rotation.x = this.lean;

    // camera orbit
    const cx = this.pos.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cz = this.pos.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    let cy = this.pos.y + Math.sin(this.camPitch) * this.camDist + 4;
    cy = Math.max(cy, heightAt(cx, cz) + 3);   // don't clip into hills
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.pos.x, this.pos.y + 5, this.pos.z);
  }
}
