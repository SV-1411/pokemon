// Pokémon data layer: dex loading, full 18-type chart, stat/damage/catch math,
// and the instance factory (IVs, nature, gender, level-up learnset).

export let DEX = [];        // array indexed by id-1
export let MOVES = {};      // name -> {t, p, a, pr, c, pp}
export const byName = {};

export async function loadData() {
  const [dex, moves] = await Promise.all([
    fetch('data/pokedex.json').then((r) => r.json()),
    fetch('data/moves.json').then((r) => r.json()),
  ]);
  DEX = dex; MOVES = moves;
  for (const m of dex) byName[m.name] = m;
}

// ---------- sprites (official, served from the PokeAPI sprites CDN) ----------
const SPR = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
export const sprFront = (id, shiny) => `${SPR}${shiny ? '/shiny' : ''}/${id}.png`;
export const sprBack = (id, shiny) => `${SPR}/back${shiny ? '/shiny' : ''}/${id}.png`;
export const sprArt = (id) => `${SPR}/other/official-artwork/${id}.png`;

// ---------- full 18-type chart (attacker -> {defender: multiplier}) ----------
// Anything not listed is 1x. This is the complete official chart — the old
// game's table was missing whole types (Dark vs Ghost is 2x: Crunch DOES
// crush Gengar now).
export const CHART = {
  normal:   { rock: .5, ghost: 0, steel: .5 },
  fire:     { fire: .5, water: .5, grass: 2, ice: 2, bug: 2, rock: .5, dragon: .5, steel: 2 },
  water:    { fire: 2, water: .5, grass: .5, ground: 2, rock: 2, dragon: .5 },
  electric: { water: 2, electric: .5, grass: .5, ground: 0, flying: 2, dragon: .5 },
  grass:    { fire: .5, water: 2, grass: .5, poison: .5, ground: 2, flying: .5, bug: .5, rock: 2, dragon: .5, steel: .5 },
  ice:      { fire: .5, water: .5, grass: 2, ice: .5, ground: 2, flying: 2, dragon: 2, steel: .5 },
  fighting: { normal: 2, ice: 2, poison: .5, flying: .5, psychic: .5, bug: .5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: .5 },
  poison:   { grass: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: .5, poison: 2, flying: 0, bug: .5, rock: 2, steel: 2 },
  flying:   { electric: .5, grass: 2, fighting: 2, bug: 2, rock: .5, steel: .5 },
  psychic:  { fighting: 2, poison: 2, psychic: .5, dark: 0, steel: .5 },
  bug:      { fire: .5, grass: 2, fighting: .5, poison: .5, flying: .5, psychic: 2, ghost: .5, dark: 2, steel: .5, fairy: .5 },
  rock:     { fire: 2, ice: 2, fighting: .5, ground: .5, flying: 2, bug: 2, steel: .5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: .5 },
  dragon:   { dragon: 2, steel: .5, fairy: 0 },
  dark:     { fighting: .5, psychic: 2, ghost: 2, dark: .5, fairy: .5 },
  steel:    { fire: .5, water: .5, electric: .5, ice: 2, rock: 2, steel: .5, fairy: 2 },
  fairy:    { fire: .5, fighting: 2, poison: .5, dragon: 2, dark: 2, steel: .5 },
};
export function effectiveness(moveType, defenderTypes) {
  let m = 1;
  for (const t of defenderTypes) m *= CHART[moveType]?.[t] ?? 1;
  return m;
}

export const TYPE_COLORS = {
  normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
  grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
  ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
  rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
  steel: '#B8B8D0', fairy: '#EE99AC',
};

// ---------- natures (+10% / -10%) ----------
export const NATURES = {
  hardy: [], lonely: ['atk','def'], brave: ['atk','spe'], adamant: ['atk','spa'], naughty: ['atk','spd'],
  bold: ['def','atk'], docile: [], relaxed: ['def','spe'], impish: ['def','spa'], lax: ['def','spd'],
  timid: ['spe','atk'], hasty: ['spe','def'], serious: [], jolly: ['spe','spa'], naive: ['spe','spd'],
  modest: ['spa','atk'], mild: ['spa','def'], quiet: ['spa','spe'], bashful: [], rash: ['spa','spd'],
  calm: ['spd','atk'], gentle: ['spd','def'], sassy: ['spd','spe'], careful: ['spd','spa'], quirky: [],
};
const NATURE_NAMES = Object.keys(NATURES);
function natureMult(nature, stat) {
  const [up, down] = NATURES[nature] ?? [];
  return stat === up ? 1.1 : stat === down ? 0.9 : 1;
}

// ---------- stat / exp math (official formulas, EVs omitted) ----------
export function calcStat(base, iv, lvl, stat, nature) {
  if (stat === 'hp') return Math.floor((2 * base + iv) * lvl / 100) + lvl + 10;
  return Math.floor((Math.floor((2 * base + iv) * lvl / 100) + 5) * natureMult(nature, stat));
}
export const expForLevel = (lvl) => lvl * lvl * lvl;            // medium-fast group
export const expGain = (baseExp, faintedLvl) => Math.floor(baseExp * faintedLvl / 7);

// ---------- instance factory ----------
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const displayName = (species) => cap(species.name).replace(/-/g, ' ');
export const moveName = (n) => n.split('-').map(cap).join(' ');

export function pickMoves(species, lvl) {
  const known = species.lm.filter(([, l]) => l <= lvl);
  const pool = known.length ? known : species.lm.slice(0, 1);
  // newest 4 by learn level, deduped
  const seen = new Set(), out = [];
  for (let i = pool.length - 1; i >= 0 && out.length < 4; i--) {
    if (!seen.has(pool[i][0])) { seen.add(pool[i][0]); out.push(pool[i][0]); }
  }
  return out.reverse();
}

export function rollGender(species) {
  if (species.gr === -1) return '—';
  return Math.random() * 8 < species.gr ? '♀' : '♂';
}

export function makeMon(speciesId, lvl, opts = {}) {
  const sp = DEX[speciesId - 1];
  const ivs = opts.ivs ?? {
    hp: rnd32(), atk: rnd32(), def: rnd32(), spa: rnd32(), spd: rnd32(), spe: rnd32(),
  };
  const nature = opts.nature ?? NATURE_NAMES[Math.floor(Math.random() * NATURE_NAMES.length)];
  const mon = {
    id: sp.id, name: displayName(sp), types: sp.types, lvl,
    ivs, nature,
    gender: opts.gender ?? rollGender(sp),
    shiny: opts.shiny ?? Math.random() < 1 / 512,
    moves: opts.moves ?? pickMoves(sp, lvl),
    pp: {},
    exp: expForLevel(lvl),
    hp: 0, // set below
  };
  recalcStats(mon);
  mon.hp = mon.maxHp;
  for (const mv of mon.moves) mon.pp[mv] = MOVES[mv]?.pp ?? 10;
  return mon;
}
const rnd32 = () => Math.floor(Math.random() * 32);

export function recalcStats(mon) {
  const sp = DEX[mon.id - 1];
  const frac = mon.maxHp ? mon.hp / mon.maxHp : 1;
  mon.maxHp = calcStat(sp.bs.hp, mon.ivs.hp, mon.lvl, 'hp', mon.nature);
  mon.atk = calcStat(sp.bs.atk, mon.ivs.atk, mon.lvl, 'atk', mon.nature);
  mon.def = calcStat(sp.bs.def, mon.ivs.def, mon.lvl, 'def', mon.nature);
  mon.spa = calcStat(sp.bs.spa, mon.ivs.spa, mon.lvl, 'spa', mon.nature);
  mon.spd = calcStat(sp.bs.spd, mon.ivs.spd, mon.lvl, 'spd', mon.nature);
  mon.spe = calcStat(sp.bs.spe, mon.ivs.spe, mon.lvl, 'spe', mon.nature);
  if (mon.hp > 0) mon.hp = Math.max(1, Math.round(mon.maxHp * frac));
}

// Returns list of move names newly learnable at exactly this level.
export function movesAtLevel(mon, lvl) {
  return DEX[mon.id - 1].lm.filter(([, l]) => l === lvl).map(([n]) => n);
}

// ---------- catching (Gen 3/4 formula — rates match Bulbapedia) ----------
export const BALLS = {
  poke: { mult: 1, label: 'Poké Ball' },
  great: { mult: 1.5, label: 'Great Ball' },
  ultra: { mult: 2, label: 'Ultra Ball' },
};
// Returns {caught, shakes 0-3}
export function tryCapture(mon, ballMult) {
  const rate = DEX[mon.id - 1].cr;
  const a = Math.min(255, ((3 * mon.maxHp - 2 * mon.hp) * rate * ballMult) / (3 * mon.maxHp));
  if (a >= 255) return { caught: true, shakes: 3 };
  const b = Math.floor(1048560 / Math.sqrt(Math.sqrt(16711680 / a)));
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (Math.floor(Math.random() * 65536) >= b) break;
    shakes++;
  }
  return { caught: shakes === 4, shakes: Math.min(shakes, 3) };
}
