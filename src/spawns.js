// Wild Pokémon: biome encounter tables over all 898 species (rarity weighted
// by base-stat total, modified by weather and time of day), billboard sprites
// with temperament AI — aggressive species chase you, timid ones flee, some
// sleep at night — plus tall-grass clustering and fixed legendary landmarks.
import * as THREE from 'three';
import { DEX, byName, makeMon } from './data.js';
import { biomeAt, heightAt, isLand, nearCity, LANDMARKS, CITY_R, TALL_GRASS } from './world.js';
import { AnimMonSprite } from './anim-sprites.js';

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
    const anim = new AnimMonSprite(sp.id, mon.shiny, 13);
    anim.sprite.position.set(l.x, l.y + 8, l.z);
    this.scene.add(anim.sprite);
    this.landmarkMons.set(l.species, {
      mon, sprite: anim.sprite, anim, landmark: l, legendary: true, t: 0,
    });
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
        s.anim?.dispose();
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
            const sc = 6.5 + Math.min(3, DEX[id - 1].bs.hp / 60);
            const anim = new AnimMonSprite(id, mon.shiny, sc);
            anim.sprite.position.set(x, heightAt(x, z) + sc * 0.45, z);
            this.scene.add(anim.sprite);
            this.active.push({
              mon, sprite: anim.sprite, anim, sc, t: Math.random() * 10,
              wx: x, wz: z, tx: x, tz: z, retarget: 0, alertT: 0,
              temper: temperament(DEX[id - 1]),
              sleeping: atmosphere?.isNight() && Math.random() < 0.35,
            });
          }
        }
      }
    }
    // behavior: sleep / chase / flee / wander, with creature-like motion
    for (const s of this.active) {
      s.t += dt;
      s.anim.update(dt);
      const sx = s.sprite.position.x, sz = s.sprite.position.z;
      const toPlayer = Math.hypot(px - sx, pz - sz);
      let speed = 3;
      if (s.sleeping) {
        // sleeps until you get close — then startles awake
        if (toPlayer < 7) { s.sleeping = false; s.alertT = 0.6; }
        s.sprite.position.y = heightAt(sx, sz) + s.sc * 0.38 + Math.sin(s.t * 0.9) * 0.12;
        continue;
      }
      s.retarget -= dt;
      let moving = false;
      if (s.temper === 'aggressive' && toPlayer < 28 && toPlayer > 4) {
        if (!s.noticed) { s.noticed = true; s.alertT = 0.6; } // spotted you!
        s.tx = px; s.tz = pz; speed = 6.5;
      } else if (s.temper === 'timid' && toPlayer < 18) {
        if (!s.noticed) { s.noticed = true; s.alertT = 0.6; }
        const fx = sx - px, fz = sz - pz;
        s.tx = sx + (fx / toPlayer) * 20; s.tz = sz + (fz / toPlayer) * 20;
        speed = 8;
      } else {
        if (toPlayer > 32) s.noticed = false;
        if (s.retarget <= 0) {
          s.retarget = 2 + Math.random() * 4;
          const a = Math.random() * Math.PI * 2, d = Math.random() * 14;
          const nx = s.wx + Math.sin(a) * d, nz = s.wz + Math.cos(a) * d;
          if (isLand(nx, nz)) { s.tx = nx; s.tz = nz; }
        }
      }
      const dx = s.tx - sx, dz = s.tz - sz;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.5) {
        const step = speed * dt;
        const nx = sx + (dx / dist) * step, nz = sz + (dz / dist) * step;
        if (isLand(nx, nz)) { s.sprite.position.x = nx; s.sprite.position.z = nz; moving = true; }
      }
      // gait: hop while moving, gentle bob while idle; alert = startled leap
      let y = heightAt(s.sprite.position.x, s.sprite.position.z) + s.sc * 0.45;
      if (s.alertT > 0) {
        s.alertT -= dt;
        y += Math.sin(Math.min(1, 1 - s.alertT / 0.6) * Math.PI) * 2.4;
      } else if (moving) {
        y += Math.abs(Math.sin(s.t * (speed > 5 ? 11 : 7))) * 0.9;
        s.sprite.material.rotation = Math.sin(s.t * 9) * 0.05 * (speed > 5 ? 1.6 : 1);
      } else {
        y += Math.sin(s.t * 2.2) * 0.4;
        s.sprite.material.rotation *= 0.9;
      }
      if (s.mon.shiny) s.sprite.material.rotation = Math.sin(s.t * 6) * 0.06;
      s.sprite.position.y = y;
    }
    for (const lm of this.landmarkMons.values()) {
      lm.t += dt;
      lm.anim.update(dt);
      lm.sprite.position.y = lm.landmark.y + 8 + Math.sin(lm.t * 1.4) * 0.7;
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
    s.anim?.dispose();
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
