// Bakes PokeAPI data for national dex #1-898 (Gen 1-8) into data/pokedex.json
// and data/moves.json. Run once: node tools/bake_data.mjs
// Data fields match Bulbapedia (PokeAPI is sourced from the games directly):
// base stats, types, capture rate, gender ratio, level-up learnsets, evolutions.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_ID = 898;
const API = 'https://pokeapi.co/api/v2';

// Version-group recency order, so each learnset entry comes from the newest
// game that teaches the move by level-up.
const VG = ['red-blue','yellow','gold-silver','crystal','ruby-sapphire','emerald',
  'firered-leafgreen','diamond-pearl','platinum','heartgold-soulsilver','colosseum','xd',
  'black-white','black-2-white-2','x-y','omega-ruby-alpha-sapphire','sun-moon',
  'ultra-sun-ultra-moon','lets-go-pikachu-lets-go-eevee','sword-shield',
  'the-isle-of-armor','the-crown-tundra','brilliant-diamond-and-shining-pearl',
  'legends-arceus','scarlet-violet'];
const vgRank = (n) => { const i = VG.indexOf(n); return i < 0 ? -1 : i; };

async function getJSON(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
      return await r.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((s) => setTimeout(s, 800 * (i + 1)));
    }
  }
}

async function pool(items, n, fn) {
  const res = new Array(items.length);
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const k = i++;
      res[k] = await fn(items[k], k);
      if (++done % 50 === 0) console.log(`  ${done}/${items.length}`);
    }
  }));
  return res;
}

console.log('Fetching pokemon + species 1..' + MAX_ID);
const ids = Array.from({ length: MAX_ID }, (_, i) => i + 1);
const chainUrls = new Set();

const mons = await pool(ids, 12, async (id) => {
  const [p, s] = await Promise.all([
    getJSON(`${API}/pokemon/${id}`),
    getJSON(`${API}/pokemon-species/${id}`),
  ]);
  if (s.evolution_chain?.url) chainUrls.add(s.evolution_chain.url);
  const stats = {};
  for (const st of p.stats) stats[st.stat.name] = st.base_stat;
  // Level-up learnset, newest version group per move.
  const lm = [];
  for (const m of p.moves) {
    let best = null;
    for (const d of m.version_group_details) {
      if (d.move_learn_method.name !== 'level-up') continue;
      const r = vgRank(d.version_group.name);
      if (!best || r > best.r) best = { r, lvl: d.level_learned_at };
    }
    if (best) lm.push([m.move.name, Math.max(1, best.lvl)]);
  }
  lm.sort((a, b) => a[1] - b[1]);
  // English flavor text (newest entry), squashed whitespace.
  let flavor = '';
  for (let i = s.flavor_text_entries.length - 1; i >= 0; i--) {
    const f = s.flavor_text_entries[i];
    if (f.language.name === 'en') { flavor = f.flavor_text.replace(/[\f\n\r]+/g, ' '); break; }
  }
  return {
    id,
    name: s.name,
    types: p.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
    bs: {
      hp: stats.hp, atk: stats.attack, def: stats.defense,
      spa: stats['special-attack'], spd: stats['special-defense'], spe: stats.speed,
    },
    cr: s.capture_rate,            // Bulbapedia catch rate (0-255)
    gr: s.gender_rate,             // -1 genderless, else female eighths (0-8)
    exp: p.base_experience ?? 100,
    leg: s.is_legendary, myth: s.is_mythical,
    flavor,
    lm,
  };
});

console.log('Fetching evolution chains:', chainUrls.size);
const evoMap = {}; // species name -> { to, lvl }
function walkChain(node) {
  for (const next of node.evolves_to) {
    const det = next.evolution_details.find((d) => d.trigger.name === 'level-up' && d.min_level);
    if (det) evoMap[node.species.name] = { to: next.species.name, lvl: det.min_level };
    walkChain(next);
  }
}
await pool([...chainUrls], 12, async (url) => walkChain((await getJSON(url)).chain));

console.log('Fetching move details');
const moveNames = new Set();
for (const m of mons) for (const [name] of m.lm) moveNames.add(name);
const moveList = [...moveNames];
const moves = {};
await pool(moveList, 12, async (name) => {
  const mv = await getJSON(`${API}/move/${name}`);
  moves[name] = {
    t: mv.type.name,
    p: mv.power ?? 0,
    a: mv.accuracy ?? 100,
    pr: mv.priority,
    c: mv.damage_class.name, // physical | special | status
    pp: mv.pp ?? 10,
  };
});

// Keep only damaging moves in learnsets (battle engine is damage-based);
// guarantee every mon has at least one.
for (const m of mons) {
  m.lm = m.lm.filter(([n]) => moves[n] && moves[n].p > 0 && moves[n].c !== 'status');
  if (m.lm.length === 0) m.lm = [['tackle', 1]];
  m.evo = evoMap[m.name] ?? null;
}
if (!moves.tackle) moves.tackle = { t: 'normal', p: 40, a: 100, pr: 0, c: 'physical', pp: 35 };

mkdirSync(join(ROOT, 'data'), { recursive: true });
writeFileSync(join(ROOT, 'data', 'pokedex.json'), JSON.stringify(mons));
writeFileSync(join(ROOT, 'data', 'moves.json'), JSON.stringify(moves));
console.log(`DONE: ${mons.length} pokemon, ${Object.keys(moves).length} moves`);
