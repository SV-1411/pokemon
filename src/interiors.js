// Walkable interiors: Pokécenter (Nurse heals, PC terminal opens the box),
// Poké Mart (shop counter), and the eight league gyms (junior trainers plus a
// leader with a type-themed team that scales with your badges).
import * as THREE from 'three';
import { GYMS } from './world.js';
import { buildVillager } from './npc.js';
import { DEX, makeMon } from './data.js';
import { SFX } from './audio.js';

const bst = (sp) => sp.bs.hp + sp.bs.atk + sp.bs.def + sp.bs.spa + sp.bs.spd + sp.bs.spe;

export function gymIndex(gym) { return GYMS.indexOf(gym); }
export function gymTeam(gym, badgeCount) {
  const base = 12 + badgeCount * 6;
  const pool = DEX.filter((sp) => sp.types.includes(gym.type) && !sp.leg && !sp.myth)
    .sort((a, b) => bst(a) - bst(b));
  const count = badgeCount >= 4 ? 4 : 3;
  const team = [];
  for (let i = 0; i < count; i++) {
    // climb the power curve: early picks mid-pool, the ace from the top
    const frac = 0.45 + (i / count) * 0.5;
    const sp = pool[Math.min(pool.length - 1, Math.floor(pool.length * frac))];
    team.push(makeMon(sp.id, base + (i === count - 1 ? 3 : i)));
  }
  return team;
}
export function juniorTeam(gym, badgeCount) {
  const pool = DEX.filter((sp) => sp.types.includes(gym.type) && !sp.leg && !sp.myth);
  const lvl = Math.max(3, 9 + badgeCount * 6);
  return [0, 1].map(() => makeMon(pool[Math.floor(Math.random() * pool.length)].id, lvl));
}

function mat(color) { return new THREE.MeshLambertMaterial({ color }); }

export class Interiors {
  // ctx: { save, camera, playerMesh, worldScene, showPrompt, toast, dialog,
  //        openBox, openShop, startTrainerBattle(name, team) -> Promise<{outcome}> }
  constructor(ctx) {
    this.ctx = ctx;
    this.active = null;
    this.busy = false;
  }

  enter(kind, city) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a3a);
    scene.add(new THREE.AmbientLight(0xfff4e0, 1.1));
    const lamp = new THREE.PointLight(0xffe8c0, 60, 60);
    lamp.position.set(0, 9, 0);
    scene.add(lamp);

    const gym = kind === 'gym' ? GYMS.find((g) => g.city === city.name) : null;
    const W = kind === 'gym' ? 22 : 20, D = kind === 'gym' ? 34 : 16;
    this.room = { W, D };
    const floorColor = kind === 'center' ? 0xd8c8b8 : kind === 'mart' ? 0xc8d0d8 : 0xc8b8a0;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(floorColor));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const wallM = mat(kind === 'center' ? 0xf0e0d8 : kind === 'mart' ? 0xdce8f0 : 0xe0d8c8);
    for (const [w, h, x, z, ry] of [
      [W, 7, 0, -D / 2, 0], [W, 7, 0, D / 2, Math.PI],
      [D, 7, -W / 2, 0, Math.PI / 2], [D, 7, W / 2, 0, -Math.PI / 2],
    ]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallM);
      wall.position.set(x, 3.5, z);
      wall.rotation.y = ry;
      scene.add(wall);
    }
    // door mat at +z end
    const matD = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.2), mat(0x8a4a3a));
    matD.rotation.x = -Math.PI / 2;
    matD.position.set(0, 0.02, D / 2 - 1.1);
    scene.add(matD);

    this.interactions = [];
    if (kind === 'center') this.buildCenter(scene);
    if (kind === 'mart') this.buildMart(scene);
    if (kind === 'gym') this.buildGym(scene, gym);

    // move the player's body into the room
    this.ctx.worldScene.remove(this.ctx.playerMesh);
    scene.add(this.ctx.playerMesh);
    this.ctx.playerMesh.position.set(0, 0, D / 2 - 2.5);
    this.ctx.playerMesh.rotation.y = Math.PI; // facing into the room
    this.walkT = 0;
    this.active = { kind, city, scene, gym };
    SFX.menu();
  }

  exit() {
    if (!this.active) return;
    this.active.scene.remove(this.ctx.playerMesh);
    this.ctx.worldScene.add(this.ctx.playerMesh);
    this.active = null;
    this.ctx.showPrompt(null);
  }

  // ---------- rooms ----------
  npcAt(scene, seed, x, z, tint) {
    const v = buildVillager(seed);
    if (tint) {
      const m = v.children[2].material.clone();
      m.color.set(tint);
      v.children[2].material = m;
    }
    v.position.set(x, 0, z);
    v.rotation.y = Math.atan2(0 - x, 6 - z); // face roughly toward the door
    scene.add(v);
    return v;
  }

  buildCenter(scene) {
    const { D } = this.room;
    // counter
    const counter = new THREE.Mesh(new THREE.BoxGeometry(9, 2.2, 1.6), mat(0xe05050));
    counter.position.set(0, 1.1, -D / 2 + 4);
    const top = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.3, 2), mat(0xf5f0e5));
    top.position.set(0, 2.3, -D / 2 + 4);
    scene.add(counter, top);
    // nurse: white kurta + pink hair
    const nurse = this.npcAt(scene, 4, 0, -D / 2 + 2.2, 0xf5f0ea);
    nurse.children[6].material = mat(0xe87aa8); // hair
    nurse.rotation.y = 0;
    // healing machine
    const machine = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.6), mat(0x4a4a58));
    machine.position.set(-4.5, 2.8, -D / 2 + 4);
    scene.add(machine);
    // PC terminal
    const pc = new THREE.Mesh(new THREE.BoxGeometry(2, 2.6, 1.2), mat(0x5868a8));
    pc.position.set(8.4, 1.3, -D / 2 + 3);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1),
      new THREE.MeshLambertMaterial({ color: 0x88e8c8, emissive: 0x224433, emissiveIntensity: 1.2 }));
    screen.position.set(8.4, 2, -D / 2 + 3.62);
    scene.add(pc, screen);
    // benches
    for (const x of [-6, 6]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.9, 1.4), mat(0x8a6a4a));
      bench.position.set(x, 0.45, 3);
      scene.add(bench);
    }
    this.interactions = [
      {
        x: 0, z: -D / 2 + 5.4, r: 3.4, prompt: 'E — Nurse: heal your party',
        action: async () => {
          await this.ctx.dialog('NURSE JOYTI',
            ['Welcome to the Pokécenter!', 'I\'ll heal your Pokémon to full health… here we go!']);
          this.ctx.healParty();
          SFX.heal();
          await this.ctx.dialog('NURSE JOYTI', ['All healed! We hope to see you again!']);
        },
      },
      {
        x: 8.4, z: -D / 2 + 5, r: 3, prompt: 'E — PC: open your Box',
        action: async () => { this.ctx.openBox(); },
      },
    ];
  }

  buildMart(scene) {
    const { D, W } = this.room;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 7), mat(0x3a6ad8));
    counter.position.set(-W / 2 + 3, 1.1, -2);
    scene.add(counter);
    this.npcAt(scene, 7, -W / 2 + 1.6, -2, 0x3a6ad8);
    // shelf rows
    for (const z of [-5, -1, 3]) {
      for (const x of [2, 7]) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.4, 1), mat(0xb8a888));
        shelf.position.set(x, 1.2, z);
        const goods = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 0.8),
          mat([0xe05050, 0x50a0e0, 0xe0c050][(x + z + 9) % 3]));
        goods.position.set(x, 2, z);
        scene.add(shelf, goods);
      }
    }
    this.interactions = [
      {
        x: -W / 2 + 3, z: -2, r: 3.4, prompt: 'E — Shop counter: buy supplies',
        action: async () => { this.ctx.openShop(); },
      },
    ];
  }

  buildGym(scene, gym) {
    const { D, W } = this.room;
    const accent = mat(gym.color);
    // arena markings
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 4, 32), accent);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.03, -D / 2 + 9);
    const mid = new THREE.Mesh(new THREE.PlaneGeometry(W - 4, 0.4), accent);
    mid.rotation.x = -Math.PI / 2;
    mid.position.set(0, 0.03, -D / 2 + 9);
    scene.add(ring, mid);
    for (const x of [-W / 2 + 2, W / 2 - 2]) {
      for (let z = -D / 2 + 4; z < D / 2 - 3; z += 6) {
        const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 3.2, 6), mat(0x4a4438));
        torch.position.set(x, 1.6, z);
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6),
          new THREE.MeshLambertMaterial({ color: gym.color, emissive: gym.color, emissiveIntensity: 1.4 }));
        flame.position.set(x, 3.5, z);
        scene.add(torch, flame);
      }
    }
    // leader platform at the far end
    const plat = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 4), accent);
    plat.position.set(0, 0.3, -D / 2 + 3.4);
    scene.add(plat);
    const idx = gymIndex(gym);
    const leader = this.npcAt(scene, 20 + idx, 0, -D / 2 + 3.2, gym.color);
    leader.position.y = 0.6;
    leader.rotation.y = 0;
    const jr1 = this.npcAt(scene, 30 + idx, -5.5, -2, null);
    const jr2 = this.npcAt(scene, 40 + idx, 5.5, -8, null);
    jr1.rotation.y = Math.PI / 2; jr2.rotation.y = -Math.PI / 2;

    const save = this.ctx.save;
    const jrAction = (n) => async () => {
      const key = `gym_${gym.city}_jr${n}`;
      if (save.beatenTrainers.includes(key)) {
        await this.ctx.dialog(`GYM TRAINEE`, ['You already showed me your strength. Go face the leader!']);
        return;
      }
      await this.ctx.dialog('GYM TRAINEE', [`Before ${gym.leader}, you face me!`]);
      const result = await this.ctx.startTrainerBattle('GYM TRAINEE', juniorTeam(gym, save.badges.length));
      if (result.outcome === 'win') {
        save.beatenTrainers.push(key);
        const prize = 150 * (9 + save.badges.length * 6);
        save.money += prize;
        this.ctx.toast(`Won ₹${prize}!`);
      }
    };
    this.interactions = [
      { x: -5.5, z: -2, r: 3, prompt: 'E — Gym Trainee wants to battle!', action: jrAction(0) },
      { x: 5.5, z: -8, r: 3, prompt: 'E — Gym Trainee wants to battle!', action: jrAction(1) },
      {
        x: 0, z: -D / 2 + 5.2, r: 3.6,
        prompt: `E — Challenge LEADER ${gym.leader} (${gym.type.toUpperCase()})`,
        action: async () => {
          const hasBadge = save.badges.includes(gym.city);
          await this.ctx.dialog(`LEADER ${gym.leader}`, hasBadge
            ? ['Back for more? My team has grown stronger — like yours.']
            : [`So you're the trainer everyone's talking about.`,
              `I am ${gym.leader}, master of ${gym.type.toUpperCase()} types. Show me your bond!`]);
          const result = await this.ctx.startTrainerBattle(`LEADER ${gym.leader}`, gymTeam(gym, save.badges.length));
          if (result.outcome === 'win') {
            if (!hasBadge) {
              save.badges.push(gym.city);
              const prize = 2500 + gymIndex(gym) * 500;
              save.money += prize;
              SFX.caught();
              await this.ctx.dialog(`LEADER ${gym.leader}`,
                [`Incredible! Take the ${gym.type.toUpperCase()} BADGE and ₹${prize}.`,
                  `${save.badges.length}/8 badges. ${save.badges.length === 8
                    ? 'You are the CHAMPION OF INDIA!' : 'The league awaits you.'}`]);
              if (save.badges.length === 8) this.ctx.toast('🏆 CHAMPION OF INDIA!');
            } else {
              save.money += 1000;
              this.ctx.toast('Rematch won! +₹1000');
            }
          }
        },
      },
    ];
  }

  // ---------- per-frame ----------
  update(dt, keys) {
    if (!this.active || this.busy) return;
    const m = this.ctx.playerMesh;
    const { W, D } = this.room;
    const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const strafe = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
    if (fwd || strafe) {
      // camera looks down -z, so forward walks into the room
      const dir = Math.atan2(strafe, fwd) + Math.PI;
      const sp = 10 * dt;
      m.position.x = Math.max(-W / 2 + 1, Math.min(W / 2 - 1, m.position.x + Math.sin(dir) * sp));
      m.position.z = Math.max(-D / 2 + 1.4, Math.min(D / 2 - 0.6, m.position.z + Math.cos(dir) * sp));
      m.rotation.y = dir;
      this.walkT += dt * 9;
      m.userData.legL.rotation.x = Math.sin(this.walkT) * 0.7;
      m.userData.legR.rotation.x = -Math.sin(this.walkT) * 0.7;
      if (m.position.z > D / 2 - 1) return this.exit(); // stepped out the door
    } else {
      m.userData.legL.rotation.x = 0;
      m.userData.legR.rotation.x = 0;
    }
    // fixed observer camera: behind and above, looking at the player
    this.ctx.camera.position.set(m.position.x * 0.4, 13, m.position.z + 14);
    this.ctx.camera.lookAt(m.position.x, 2.5, m.position.z - 2);

    this.current = null;
    for (const it of this.interactions) {
      if (Math.hypot(it.x - m.position.x, it.z - m.position.z) < it.r) { this.current = it; break; }
    }
    this.ctx.showPrompt(this.current
      ? this.current.prompt
      : (m.position.z > D / 2 - 5 ? 'Walk out the door to leave' : null));
  }

  async interact() {
    if (!this.active || !this.current || this.busy) return;
    this.busy = true;
    try { await this.current.action(); } finally { this.busy = false; }
  }

  render(renderer) {
    if (this.active) renderer.render(this.active.scene, this.ctx.camera);
  }
}
