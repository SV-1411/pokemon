// Authoritative PvP battle core. The server NEVER trusts client stats: each
// mon is rebuilt here from species data + (id, lvl, ivs, nature, moves), using
// the same formulas as src/data.js. Clients only ever submit actions; the
// server resolves turns and streams an event list both clients render.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DEX = JSON.parse(readFileSync(join(ROOT, 'data', 'pokedex.json'), 'utf8'));
export const MOVES = JSON.parse(readFileSync(join(ROOT, 'data', 'moves.json'), 'utf8'));

// ---- same chart/formulas as the client (src/data.js) ----
const CHART = {
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
const effectiveness = (t, types) => types.reduce((m, d) => m * (CHART[t]?.[d] ?? 1), 1);

const NATURES = {
  hardy: [], lonely: ['atk','def'], brave: ['atk','spe'], adamant: ['atk','spa'], naughty: ['atk','spd'],
  bold: ['def','atk'], docile: [], relaxed: ['def','spe'], impish: ['def','spa'], lax: ['def','spd'],
  timid: ['spe','atk'], hasty: ['spe','def'], serious: [], jolly: ['spe','spa'], naive: ['spe','spd'],
  modest: ['spa','atk'], mild: ['spa','def'], quiet: ['spa','spe'], bashful: [], rash: ['spa','spd'],
  calm: ['spd','atk'], gentle: ['spd','def'], sassy: ['spd','spe'], careful: ['spd','spa'], quirky: [],
};
function calcStat(base, iv, lvl, stat, nature) {
  if (stat === 'hp') return Math.floor((2 * base + iv) * lvl / 100) + lvl + 10;
  const [up, down] = NATURES[nature] ?? [];
  const m = stat === up ? 1.1 : stat === down ? 0.9 : 1;
  return Math.floor((Math.floor((2 * base + iv) * lvl / 100) + 5) * m);
}

// Rebuild a mon from untrusted client data. Returns null if invalid.
export function sanitizeMon(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = Math.floor(raw.id);
  if (!(id >= 1 && id <= DEX.length)) return null;
  const sp = DEX[id - 1];
  const lvl = Math.max(1, Math.min(100, Math.floor(raw.lvl) || 5));
  const ivs = {};
  for (const k of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) {
    ivs[k] = Math.max(0, Math.min(31, Math.floor(raw.ivs?.[k] ?? 0)));
  }
  const nature = NATURES[raw.nature] ? raw.nature : 'hardy';
  // moves must be damaging moves this species can actually learn by this level
  const legal = new Set(sp.lm.filter(([, l]) => l <= lvl).map(([n]) => n));
  let moves = Array.isArray(raw.moves) ? raw.moves.filter((m) => legal.has(m)).slice(0, 4) : [];
  if (!moves.length) moves = sp.lm.filter(([, l]) => l <= lvl).slice(-4).map(([n]) => n);
  if (!moves.length) moves = ['tackle'];
  const mon = {
    id, lvl, ivs, nature, moves,
    name: (sp.name[0].toUpperCase() + sp.name.slice(1)).replace(/-/g, ' '),
    types: sp.types,
    gender: ['♂', '♀', '—'].includes(raw.gender) ? raw.gender : '—',
    shiny: !!raw.shiny,
    pp: {},
  };
  mon.maxHp = calcStat(sp.bs.hp, ivs.hp, lvl, 'hp', nature);
  mon.hp = mon.maxHp; // PvP battles start at full health
  mon.atk = calcStat(sp.bs.atk, ivs.atk, lvl, 'atk', nature);
  mon.def = calcStat(sp.bs.def, ivs.def, lvl, 'def', nature);
  mon.spa = calcStat(sp.bs.spa, ivs.spa, lvl, 'spa', nature);
  mon.spd = calcStat(sp.bs.spd, ivs.spd, lvl, 'spd', nature);
  mon.spe = calcStat(sp.bs.spe, ivs.spe, lvl, 'spe', nature);
  for (const m of moves) mon.pp[m] = MOVES[m]?.pp ?? 10;
  return mon;
}
export const publicMon = (m) => ({
  id: m.id, name: m.name, lvl: m.lvl, gender: m.gender, shiny: m.shiny,
  hp: m.hp, maxHp: m.maxHp, types: m.types,
});

function damage(att, def, mvName) {
  const mv = MOVES[mvName];
  const eff = effectiveness(mv.t, def.types);
  if (eff === 0) return { dmg: 0, eff, crit: false };
  const A = mv.c === 'special' ? att.spa : att.atk;
  const D = mv.c === 'special' ? def.spd : def.def;
  const stab = att.types.includes(mv.t) ? 1.5 : 1;
  const crit = Math.random() < 1 / 16;
  const base = (((2 * att.lvl) / 5 + 2) * mv.p * (A / D)) / 50 + 2;
  return {
    dmg: Math.max(1, Math.floor(base * stab * eff * (crit ? 1.5 : 1) * (0.85 + Math.random() * 0.15))),
    eff, crit,
  };
}

// ---------- the match ----------
// sides: 0 and 1. Each side: {team, active, action, awaitingReplace}
export class PvpBattle {
  constructor(teamA, teamB, emit) {
    this.sides = [
      { team: teamA, active: 0, action: null, awaitingReplace: false },
      { team: teamB, active: 0, action: null, awaitingReplace: false },
    ];
    this.emit = emit; // (events) => void — broadcast to both players
    this.over = false;
  }
  mon(side) { return this.sides[side].team[this.sides[side].active]; }
  alive(side) { return this.sides[side].team.some((m) => m.hp > 0); }

  // action: {move: name} | {switch: idx} | {forfeit: true}
  submit(side, action) {
    if (this.over || this.sides[side].awaitingReplace) return;
    if (action.forfeit) return this.finish(1 - side, 'forfeit');
    if (action.switch !== undefined) {
      const i = Math.floor(action.switch);
      const t = this.sides[side].team;
      if (!(i >= 0 && i < t.length) || t[i].hp <= 0 || i === this.sides[side].active) return;
    }
    if (action.move !== undefined) {
      const M = this.mon(side);
      if (!M.moves.includes(action.move) || (M.pp[action.move] ?? 0) <= 0) {
        const usable = M.moves.find((m) => (M.pp[m] ?? 0) > 0);
        action = usable ? { move: usable } : { move: '__struggle' };
      }
    }
    this.sides[side].action = action;
    if (this.sides[0].action && this.sides[1].action) this.resolveTurn();
  }

  replace(side, idx) {
    if (this.over || !this.sides[side].awaitingReplace) return;
    const t = this.sides[side].team;
    const i = Math.floor(idx);
    if (!(i >= 0 && i < t.length) || t[i].hp <= 0) return;
    this.sides[side].active = i;
    this.sides[side].awaitingReplace = false;
    this.emit([{ e: 'switch', side, mon: publicMon(t[i]) }]);
  }

  resolveTurn() {
    const ev = [];
    const acts = [this.sides[0].action, this.sides[1].action];
    this.sides[0].action = null; this.sides[1].action = null;

    // switches happen first
    for (const side of [0, 1]) {
      if (acts[side].switch !== undefined) {
        this.sides[side].active = acts[side].switch;
        ev.push({ e: 'switch', side, mon: publicMon(this.mon(side)) });
      }
    }
    // then moves, ordered by priority -> speed
    const movers = [0, 1].filter((s) => acts[s].move !== undefined);
    movers.sort((a, b) => {
      const pa = MOVES[acts[a].move]?.pr ?? 0, pb = MOVES[acts[b].move]?.pr ?? 0;
      if (pa !== pb) return pb - pa;
      const sa = this.mon(a).spe, sb = this.mon(b).spe;
      return sa === sb ? Math.random() - 0.5 : sb - sa;
    });
    for (const side of movers) {
      const att = this.mon(side), def = this.mon(1 - side);
      if (att.hp <= 0 || def.hp <= 0) continue;
      const mv = acts[side].move;
      if (mv === '__struggle') {
        const dmg = Math.max(1, Math.floor(def.maxHp * 0.12));
        def.hp = Math.max(0, def.hp - dmg);
        ev.push({ e: 'move', side, mv: 'struggle' }, { e: 'hit', side: 1 - side, dmg, hp: def.hp, eff: 1, crit: false });
      } else {
        att.pp[mv] = Math.max(0, (att.pp[mv] ?? 1) - 1);
        ev.push({ e: 'move', side, mv });
        if (Math.random() * 100 >= (MOVES[mv].a ?? 100)) { ev.push({ e: 'miss' }); continue; }
        const { dmg, eff, crit } = damage(att, def, mv);
        if (eff === 0) { ev.push({ e: 'immune', side: 1 - side }); continue; }
        def.hp = Math.max(0, def.hp - dmg);
        ev.push({ e: 'hit', side: 1 - side, dmg, hp: def.hp, eff, crit });
      }
      if (def.hp <= 0) {
        ev.push({ e: 'faint', side: 1 - side });
        if (!this.alive(1 - side)) {
          ev.push({ e: 'end', winner: side });
          this.emit(ev);
          return this.finish(side, 'ko');
        }
        this.sides[1 - side].awaitingReplace = true;
        ev.push({ e: 'request_switch', side: 1 - side });
        break; // turn ends when something faints
      }
    }
    this.emit(ev);
  }

  finish(winner, reason) {
    if (this.over) return;
    this.over = true;
    this.onFinish?.(winner, reason);
  }
}
