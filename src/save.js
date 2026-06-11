// localStorage persistence. The save is plain JSON — the same shape a future
// multiplayer server would store per account (see net.js).
const KEY = 'pokemon_india_save_v1';

export function newSave(name) {
  return {
    name,
    x: 0, z: 0,
    party: [],            // mon instances (data.js makeMon shape)
    box: [],
    seen: new Array(898).fill(0),
    caught: new Array(898).fill(0),
    balls: { poke: 15, great: 5, ultra: 2 },
    items: { potion: 3, superpotion: 0, hyperpotion: 0 },
    money: 3000,
    badges: [],           // gym city names, in win order
    beatenTrainers: [],   // one-time NPC trainer reward keys
    landmarksDone: [],    // legendary landmark species already caught/defeated
    claudeBeaten: 0,
    playSeconds: 0,
  };
}

// older saves predate the economy fields
export function migrate(s) {
  s.items ??= { potion: 3, superpotion: 0, hyperpotion: 0 };
  s.money ??= 3000;
  s.badges ??= [];
  s.beatenTrainers ??= [];
  return s;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!Array.isArray(s.party) || !s.party.length) return null;
    return s;
  } catch { return null; }
}

export function persist(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage full */ }
}

export function wipeSave() { localStorage.removeItem(KEY); }
