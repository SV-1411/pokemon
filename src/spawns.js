// Wild Pokémon: biome encounter tables over all 898 species (rarity weighted
// by base-stat total, modified by weather and time of day), billboard sprites
// with temperament AI — aggressive species chase you, timid ones flee, some
// sleep at night — plus tall-grass clustering and fixed legendary landmarks.
import * as THREE from 'three';
import { DEX, byName, makeMon, sprFront } from './data.js';
import { biomeAt, heightAt, isLand, nearCity, LANDMARKS, CITY_R, TALL_GRASS } from './world.js';

const BIOME_TYPES = {
  coast: ['water'],
  desert: ['ground', 'rock', 'fire', 'steel'],
  plains: ['normal', 'grass', 'bug', 'flying', 'electric', 'fairy'],
  forest: ['grass', 'bug', 'poison', 'fairy'],
  jungle: ['bug', 'poison', 'dark', 'ghost', 'grass'],
  hills: ['fighting', 'ground', 'rock', 'flying'],
  himalaya: ['ice', 'rock', 'dragon', 'steel', 'psychic'],
  city: ['electric', 'psychic', 'normal', 'steel', 'fighting', 'dark'],
};

// Species temperament, derived from base stats: hard hitters charge at you,
// fast frail ones bolt, the rest don't care.
export function temperament(sp) {
  if (sp.bs.atk >= 100 || (sp.bs.atk >= 85 && sp.types.some((t) => ['dark', 'fighting', 'dragon'].includes(t)))) return 'aggressive';
  if (sp.bs.spe >= 90 && sp.bs.def < 70) return 'timid';
  return 'calm';
}

const texLoader = new THREE.TextureLoader();
const texCache = new Map();
function spriteTexture(id, shiny) {
  const key = `${id}_${shiny ? 1 : 0}`;
  if (!texCache.has(key)) {
    const t = texLoader.load(sprFront(id, shiny));
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, t);
  }
  return texCache.get(key);
}

export class Spawns {
  constructor(scene, save) {
    this.scene = scene;
    this.save = save;
    this.active = [];
    this.cooldown = 0;
    this.pools = {};
    const bst = (sp) => sp.bs.hp + sp.bs.atk + sp.bs.def + sp.bs.spa + sp.bs.spd + sp.bs.spe;
    for (const [biome, types] of Object.entries(BIOME_TYPES)) {
      const pool = [];
      for (const sp of DEX) {
        if (sp.leg || sp.myth) continue;
        if (!sp.types.some((t) => types.includes(t))) continue;
        const s = bst(sp);
        pool.push({ id: sp.id, w: s < 400 ? 10 : s < 500 ? 4 : s < 570 ? 1.2 : 0.4 });
      }
      this.pools[biome] = pool;
    }
    this.landmarkMons = new Map();
    for (const l of LANDMARKS) this.spawnLandmark(l);
  }

  spawnLandmark(l) {
    if (this.save.landmarksDone.includes(l.species)) return;
    const sp = byName[l.species];
    if (!sp) return;
    const mon = makeMon(sp.id, l.lvl);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: spriteTexture(sp.id, mon.shiny), depthTest: true,
    }));
    spr.scale.set(13, 13, 1);
    spr.position.set(l.x, l.y + 8, l.z);
    this.scene.add(spr);
    this.landmarkMons.set(l.species, { mon, sprite: spr, landmark: l, legendary: true });
  }

  // Weighted pick honoring weather/night multipliers from the atmosphere.
  pickFromPool(biome, atmosphere) {
    const pool = this.pools[biome];
    if (!pool || !pool.length) return null;
    const w = (p) => {
      let m = p.w;
      if (atmosphere) for (const t of DEX[p.id - 1].types) m *= atmosphere.typeMult(t);
      return m;
    };
    let total = 0;
    for (const p of pool) total += w(p);
    let r = Math.random() * total;
    for (const p of pool) { r -= w(p); if (r <= 0) return p.id; }
    return pool[pool.length - 1].id;
  }

  levelFor(x, z, startX, startZ) {
    const d = Math.hypot(x - startX, z - startZ);
    let lvl = Math.round(3 + d / 24 + (Math.random() * 6 - 3));
    if (biomeAt(x, z) === 'himalaya') lvl = Math.max(lvl, 38 + Math.floor(Math.random() * 10));
    return Math.max(2, Math.min(58, lvl));
  }

  update(dt, player, startX, startZ, atmosphere) {
    this.cooldown -= dt;
    const px = player.pos.x, pz = player.pos.z;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i];
      if (Math.hypot(s.sprite.position.x - px, s.sprite.position.z - pz) > 180) {
        this.scene.remove(s.sprite);
        this.active.splice(i, 1);
      }
    }
    if (this.active.length < 24 && this.cooldown <= 0) {
      this.cooldown = 0.35;
      let x, z;
      // wild pokemon cluster in tall grass: bias spawns toward nearby patches
      const patches = TALL_GRASS.filter((g) =>
        Math.abs(g.x - px) < 140 && Math.abs(g.z - pz) < 140);
      if (patches.length && Math.random() < 0.6) {
        const g = patches[Math.floor(Math.random() * patches.length)];
        const a = Math.random() * Math.PI * 2, d = Math.random() * g.r;
        x = g.x + Math.sin(a) * d; z = g.z + Math.cos(a) * d;
      } else {
        const a = Math.random() * Math.PI * 2;
        const d = 45 + Math.random() * 95;
        x = px + Math.sin(a) * d; z = pz + Math.cos(a) * d;
      }
      if (isLand(x, z)) {
        const city = nearCity(x, z, CITY_R);
        const biome = city ? 'city' : biomeAt(x, z);
        if (!city || Math.hypot(x - city.x, z - city.z) > 12) {
          const id = this.pickFromPool(biome, atmosphere);
          if (id) {
            const mon = makeMon(id, this.levelFor(x, z, startX, startZ));
            const spr = new THREE.Sprite(new THREE.SpriteMaterial({
              map: spriteTexture(id, mon.shiny), depthTest: true,
            }));
            const sc = 6.5 + Math.min(3, DEX[id - 1].bs.hp / 60);
            spr.scale.set(sc, sc, 1);
            spr.position.set(x, heightAt(x, z) + sc * 0.45, z);
            this.scene.add(spr);
            this.active.push({
              mon, sprite: spr, t: Math.random() * 10,
              wx: x, wz: z, tx: x, tz: z, retarget: 0,
              temper: temperament(DEX[id - 1]),
              sleeping: atmosphere?.isNight() && Math.random() < 0.35,
            });
          }
        }
      }
    }
    // behavior: sleep / chase / flee / wander
    for (const s of this.active) {
      s.t += dt;
      const sx = s.sprite.position.x, sz = s.sprite.position.z;
      const toPlayer = Math.hypot(px - sx, pz - sz);
      let speed = 3;
      if (s.sleeping) {
        // sleeps until you get close
        if (toPlayer < 7) s.sleeping = false;
        s.sprite.position.y = heightAt(sx, sz) + s.sprite.scale.x * 0.38
          + Math.sin(s.t * 0.9) * 0.12;
        continue;
      }
      s.retarget -= dt;
      if (s.temper === 'aggressive' && toPlayer < 28 && toPlayer > 4) {
        s.tx = px; s.tz = pz; speed = 6.5;             // charge!
      } else if (s.temper === 'timid' && toPlayer < 18) {
        const fx = sx - px, fz = sz - pz;
        s.tx = sx + (fx / toPlayer) * 20; s.tz = sz + (fz / toPlayer) * 20;
        speed = 8;                                      // bolt
      } else if (s.retarget <= 0) {
        s.retarget = 2 + Math.random() * 4;
        const a = Math.random() * Math.PI * 2, d = Math.random() * 14;
        const nx = s.wx + Math.sin(a) * d, nz = s.wz + Math.cos(a) * d;
        if (isLand(nx, nz)) { s.tx = nx; s.tz = nz; }
      }
      const dx = s.tx - sx, dz = s.tz - sz;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.5) {
        const step = speed * dt;
        const nx = sx + (dx / dist) * step, nz = sz + (dz / dist) * step;
        if (isLand(nx, nz)) { s.sprite.position.x = nx; s.sprite.position.z = nz; }
      }
      const sc = s.sprite.scale.x;
      s.sprite.position.y = heightAt(s.sprite.position.x, s.sprite.position.z)
        + sc * 0.45 + Math.sin(s.t * 2.2) * 0.5;
      if (s.mon.shiny) s.sprite.material.rotation = Math.sin(s.t * 6) * 0.06;
    }
  }

  nearest(px, pz, maxDist = 9) {
    let best = null, bd = maxDist;
    for (const s of this.active) {
      const d = Math.hypot(s.sprite.position.x - px, s.sprite.position.z - pz);
      if (d < bd) { bd = d; best = s; }
    }
    for (const s of this.landmarkMons.values()) {
      const d = Math.hypot(s.sprite.position.x - px, s.sprite.position.z - pz);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  remove(s) {
    this.scene.remove(s.sprite);
    if (s.legendary) {
      this.landmarkMons.delete(s.landmark.species);
      if (!this.save.landmarksDone.includes(s.landmark.species)) {
        this.save.landmarksDone.push(s.landmark.species);
      }
    } else {
      const i = this.active.indexOf(s);
      if (i >= 0) this.active.splice(i, 1);
    }
  }

  promptFor(s) {
    const shiny = s.mon.shiny ? '✨ SHINY ' : '';
    const mood = s.sleeping ? ' 💤 (asleep — easier to catch!)'
      : s.temper === 'aggressive' ? ' 😠' : s.temper === 'timid' ? ' 😨' : '';
    return `E — Battle ${shiny}${s.mon.name.toUpperCase()} Lv${s.mon.lvl}${s.legendary ? ' ⭐ LEGENDARY' : mood}`;
  }
}
