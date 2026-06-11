// City life: pedestrian NPCs that wander the plaza, chat with flavor lines,
// and youth trainers who battle you for prize money. NPCs spawn around
// whichever city you're near and despawn when you leave.
import * as THREE from 'three';
import { heightAt, nearCity, CITY_R, biomeAt } from './world.js';
import { makeMon } from './data.js';

const KURTA = [0xd88a3a, 0x4a8ad8, 0x9a4ad8, 0x3aa86a, 0xd84a6a, 0xe8d84a];
const NAMES = ['RAVI', 'PRIYA', 'ARJUN', 'MEERA', 'KIRAN', 'ANIKA', 'DEV', 'ISHA',
  'ROHAN', 'TANVI', 'VIKRAM', 'POOJA', 'AMIT', 'SNEHA', 'KABIR', 'DIYA'];
const LINES = [
  'Wild Pokémon love the tall grass — walk through it and they jump you!',
  'They say the legendaries only wait at the purple shrines. One chance each!',
  'Rain brings out water types. I saw a Lapras at the coast last monsoon!',
  'Ghost Pokémon roam after dark. I keep my lamp lit.',
  'The gym leader here is no joke. Train before you challenge them!',
  'Sleeping Pokémon at night are way easier to catch. Twice as easy!',
  'My grandfather walked to the Himalaya once. Dragon types, everywhere!',
  'Buy Ultra Balls at the Mart before you head to a shrine. Trust me.',
  'A strange trainer in DELHI rematches anyone who beats him. CLAUDE, I think?',
  'High friendship makes your Pokémon endure hits! Walk with your partner!',
  'The chai here is the best in the region. The Dosa Corner? Also the best.',
  'I once saw a SHINY one sparkle in the grass. Couldn\'t catch it…',
];

export function buildVillager(seed) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
  const kurta = new THREE.MeshLambertMaterial({ color: KURTA[seed % KURTA.length] });
  const pant = new THREE.MeshLambertMaterial({ color: 0xe8e0d0 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 0.8), pant);
  legL.geometry.translate(0, -1.1, 0);
  legL.position.set(-0.5, 2.3, 0);
  const legR = legL.clone(); legR.position.x = 0.5;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(2, 2.6, 1.1), kurta);
  torso.position.y = 3.6;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2, 0.55), kurta);
  armL.geometry.translate(0, -0.9, 0);
  armL.position.set(-1.3, 4.6, 0);
  const armR = armL.clone(); armR.position.x = 1.3;
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), skin);
  head.position.y = 5.6;
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), hair);
  hairTop.position.y = 6.35;
  g.add(legL, legR, torso, armL, armR, head, hairTop);
  // some wear a dupatta/scarf
  if (seed % 3 === 0) {
    const scarf = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.4, 1.2),
      new THREE.MeshLambertMaterial({ color: KURTA[(seed + 2) % KURTA.length] }));
    scarf.position.y = 4.7;
    g.add(scarf);
  }
  g.userData = { legL, legR };
  return g;
}

// themed team for an NPC trainer near (x,z): species drawn from local biome
export function npcTeam(spawns, x, z, atmosphere, count, lvl) {
  const biome = nearCity(x, z, CITY_R) ? 'city' : biomeAt(x, z);
  const team = [];
  for (let i = 0; i < count; i++) {
    const id = spawns.pickFromPool(biome, atmosphere);
    if (id) team.push(makeMon(id, Math.max(2, lvl + Math.floor(Math.random() * 3) - 1)));
  }
  return team.length ? team : [makeMon(19, lvl)]; // rattata fallback
}

export class CityNPCs {
  constructor(scene, save) {
    this.scene = scene;
    this.save = save;
    this.cityName = null;
    this.npcs = [];
  }

  spawnFor(city) {
    this.clear();
    this.cityName = city.name;
    const seed0 = Math.floor(Math.abs(city.x + city.z * 3));
    for (let i = 0; i < 5; i++) {
      const seed = seed0 + i;
      const mesh = buildVillager(seed);
      const a = (i / 5) * Math.PI * 2 + (seed % 10) / 3;
      const d = 7 + (seed % 9);
      const x = city.x + Math.cos(a) * d, z = city.z + Math.sin(a) * d;
      mesh.position.set(x, heightAt(x, z), z);
      this.scene.add(mesh);
      const battler = i >= 3; // two of the five want to fight
      this.npcs.push({
        mesh, city,
        name: `${battler ? 'TRAINER ' : ''}${NAMES[(seed) % NAMES.length]}`,
        battler,
        beatKey: `npc_${city.name}_${i}`,
        line: LINES[(seed * 7 + i) % LINES.length],
        wx: x, wz: z, tx: x, tz: z, retarget: Math.random() * 3, t: Math.random() * 9,
      });
    }
  }

  clear() {
    for (const n of this.npcs) this.scene.remove(n.mesh);
    this.npcs = [];
    this.cityName = null;
  }

  update(dt, px, pz) {
    const city = nearCity(px, pz, CITY_R + 30);
    if (!city) { if (this.cityName) this.clear(); return; }
    if (city.name !== this.cityName) this.spawnFor(city);
    for (const n of this.npcs) {
      n.t += dt;
      n.retarget -= dt;
      const m = n.mesh.position;
      const toPlayer = Math.hypot(px - m.x, pz - m.z);
      if (toPlayer < 6) {
        // face the player and wait
        n.mesh.rotation.y = Math.atan2(px - m.x, pz - m.z);
        n.mesh.userData.legL.rotation.x = 0;
        n.mesh.userData.legR.rotation.x = 0;
        continue;
      }
      if (n.retarget <= 0) {
        n.retarget = 3 + Math.random() * 5;
        const a = Math.random() * Math.PI * 2, d = Math.random() * 9;
        n.tx = n.wx + Math.cos(a) * d; n.tz = n.wz + Math.sin(a) * d;
      }
      const dx = n.tx - m.x, dz = n.tz - m.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.4) {
        const sp = 2.4 * dt;
        m.x += (dx / dist) * sp; m.z += (dz / dist) * sp;
        m.y = heightAt(m.x, m.z);
        n.mesh.rotation.y = Math.atan2(dx, dz);
        n.mesh.userData.legL.rotation.x = Math.sin(n.t * 6) * 0.5;
        n.mesh.userData.legR.rotation.x = -Math.sin(n.t * 6) * 0.5;
      } else {
        n.mesh.userData.legL.rotation.x = 0;
        n.mesh.userData.legR.rotation.x = 0;
      }
    }
  }

  nearest(px, pz, maxDist = 7) {
    let best = null, bd = maxDist;
    for (const n of this.npcs) {
      const d = Math.hypot(n.mesh.position.x - px, n.mesh.position.z - pz);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  promptFor(n) {
    if (n.battler && !this.save.beatenTrainers.includes(n.beatKey)) {
      return `E — ${n.name} wants to battle!`;
    }
    return `E — Talk to ${n.name}`;
  }
}
