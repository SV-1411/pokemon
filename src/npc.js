// City life: pedestrian NPCs that wander the plaza, chat with flavor lines,
// and youth trainers who battle you for prize money. NPCs spawn around
// whichever city you're near and despawn when you leave.
import { heightAt, nearCity, CITY_R, biomeAt } from './world.js';
import { makeMon } from './data.js';
import { buildVillagerV2 } from './chars.js';

// anime-proportioned villagers (man/woman/kid/elder) from chars.js
export const buildVillager = buildVillagerV2;
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
