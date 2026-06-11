// Wild Pokémon: biome-based spawn pools over all 898 species, rarity weighted
// by base-stat total, level scaling with distance from the starter city,
// billboard sprites that wander, shinies, and fixed legendary landmarks.
import * as THREE from 'three';
import { DEX, byName, makeMon, sprFront, displayName } from './data.js';
import { biomeAt, heightAt, isLand, nearCity, LANDMARKS, CITY_R } from './world.js';

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
    this.save = save;          // for landmark defeated/caught tracking
    this.active = [];
    this.cooldown = 0;
    this.pools = {};           // biome -> [{id, w}]
    const bst = (sp) => sp.bs.hp + sp.bs.atk + sp.bs.def + sp.bs.spa + sp.bs.spd + sp.bs.spe;
    for (const [biome, types] of Object.entries(BIOME_TYPES)) {
      const pool = [];
      for (const sp of DEX) {
        if (sp.leg || sp.myth) continue; // legendaries live at landmarks only
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

  pickFromPool(biome) {
    const pool = this.pools[biome];
    if (!pool || !pool.length) return null;
    let total = 0;
    for (const p of pool) total += p.w;
    let r = Math.random() * total;
    for (const p of pool) { r -= p.w; if (r <= 0) return p.id; }
    return pool[pool.length - 1].id;
  }

  levelFor(x, z, startX, startZ) {
    const d = Math.hypot(x - startX, z - startZ);
    let lvl = Math.round(3 + d / 24 + (Math.random() * 6 - 3));
    if (biomeAt(x, z) === 'himalaya') lvl = Math.max(lvl, 38 + Math.floor(Math.random() * 10));
    return Math.max(2, Math.min(58, lvl));
  }

  update(dt, player, startX, startZ) {
    this.cooldown -= dt;
    const px = player.pos.x, pz = player.pos.z;
    // despawn far ones
    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i];
      if (Math.hypot(s.sprite.position.x - px, s.sprite.position.z - pz) > 180) {
        this.scene.remove(s.sprite);
        this.active.splice(i, 1);
      }
    }
    // top up
    if (this.active.length < 22 && this.cooldown <= 0) {
      this.cooldown = 0.35;
      const a = Math.random() * Math.PI * 2;
      const d = 45 + Math.random() * 95;
      const x = px + Math.sin(a) * d, z = pz + Math.cos(a) * d;
      if (isLand(x, z)) {
        const city = nearCity(x, z, CITY_R);
        const biome = city ? 'city' : biomeAt(x, z);
        if (!city || Math.hypot(x - city.x, z - city.z) > 12) {
          const id = this.pickFromPool(biome);
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
            });
          }
        }
      }
    }
    // wander + bob
    for (const s of this.active) {
      s.t += dt; s.retarget -= dt;
      if (s.retarget <= 0) {
        s.retarget = 2 + Math.random() * 4;
        const a = Math.random() * Math.PI * 2, d = Math.random() * 14;
        const nx = s.wx + Math.sin(a) * d, nz = s.wz + Math.cos(a) * d;
        if (isLand(nx, nz)) { s.tx = nx; s.tz = nz; }
      }
      const dx = s.tx - s.sprite.position.x, dz = s.tz - s.sprite.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.5) {
        const sp = 3 * dt;
        s.sprite.position.x += (dx / dist) * sp;
        s.sprite.position.z += (dz / dist) * sp;
      }
      const sc = s.sprite.scale.x;
      s.sprite.position.y = heightAt(s.sprite.position.x, s.sprite.position.z)
        + sc * 0.45 + Math.sin(s.t * 2.2) * 0.5;
      if (s.mon.shiny) s.sprite.material.rotation = Math.sin(s.t * 6) * 0.06; // shiny shimmer
    }
  }

  // nearest interactable wild (or landmark legendary)
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
    return `E — Battle ${shiny}${s.mon.name.toUpperCase()} Lv${s.mon.lvl}${s.legendary ? ' ⭐ LEGENDARY' : ''}`;
  }
}
