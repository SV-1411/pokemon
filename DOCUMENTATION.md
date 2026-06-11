# POKeMON INDIA — Master Documentation

The complete manual: how to run it, how to play it, how it's made, how to
test it, and how to deploy it. (Developer deep-context lives in
[CONTEXT.md](CONTEXT.md); this file is the front door.)

---

## Table of contents

1. [Quick start](#1-quick-start)
2. [Player manual](#2-player-manual)
3. [How it's made (architecture)](#3-how-its-made)
4. [Running & developing](#4-running--developing)
5. [Testing](#5-testing)
6. [Deployment](#6-deployment)
7. [Troubleshooting](#7-troubleshooting)
8. [Credits & legal](#8-credits--legal)

---

## 1. Quick start

**Play online (single-player):** https://sv-1411.github.io/pokemon/

**Play with multiplayer (recommended, LAN):**
```bash
git clone https://github.com/SV-1411/pokemon.git
cd pokemon/server
npm install
node index.mjs
# → open http://localhost:8128  — friends on your WiFi use http://<your-ip>:8128
```

**Requirements:** Node.js 18+ for the server. Any modern Chromium/Firefox
browser (Chrome/Edge recommended — animated overworld Pokémon use WebCodecs).
Internet connection (Pokémon sprites and cries stream from the PokéAPI CDN).

---

## 2. Player manual

### 2.1 Controls

| Input | Action |
|---|---|
| `W A S D` | Walk (camera-relative) |
| `Shift` | Run |
| Mouse drag | Orbit camera |
| Mouse wheel | Zoom |
| `E` | Interact: battle wild Pokémon, talk to NPCs, enter buildings, advance dialogue, challenge players |
| `Y` | Accept a PvP challenge |
| `P` | Party & PC Box |
| `X` | Pokédex |
| `M` | Region map |
| `N` | Sound on/off |
| `Esc` | Close menus |

Click the page once before expecting sound — browsers require one gesture
before audio is allowed.

### 2.2 Starting out

Pick your trainer name and one of **24 starters** (every classic starter,
Gen 1–8). You begin outside **Bengaluru** with ₹3000, 15 Poké Balls,
5 Great Balls, 2 Ultra Balls and 3 Potions. Your save is automatic
(browser localStorage) — the title screen offers CONTINUE next time.

### 2.3 The world

The map is a stylized 3D **India** — walk it end to end:

- **Biomes decide what spawns**: water types on the coasts, ice/rock/dragon
  in the Himalaya, ground/fire in the Thar desert, grass/bug/poison in the
  southern forests, ghost/dark in the eastern jungle, electric/psychic/steel
  in cities, and more. Levels rise the farther you travel from Bengaluru
  (Himalaya is end-game, level 38+).
- **Tall grass**: wild Pokémon cluster in it, and walking through it
  triggers surprise encounters.
- **Day/night** (1 game hour = 1 real minute): ghosts and dark types come
  out at night, some wild Pokémon fall asleep (sleeping = **2× easier to
  catch**), street lamps and building windows light up.
- **Weather** (per biome — rain, snow, sandstorms, fog, harsh sun): changes
  spawns (water types love rain…) and battle damage (rain boosts water
  moves 1.5× and halves fire; sun reversed).
- **Wild temperament**: hard hitters charge at you on sight, fast frail
  species flee, the rest wander. Watch the emoji in the encounter prompt.
- **22 legendary shrines** (purple pillars, shown on the M map): each holds
  one legendary — Mewtwo, Rayquaza, Ho-Oh at Varanasi, Eternatus in the
  Rann crater… **one chance each**, so save your Ultra Balls.

### 2.4 Cities

20 real Indian cities, each with:

- **Pokécenter** (red dome): walk in, talk to **Nurse Joyti** to heal, use
  the **PC terminal** to move Pokémon between party and Box.
- **Poké Mart** (blue roof): buy balls and potions with ₹.
- **NPCs**: villagers share real gameplay tips; youth trainers battle you
  for prize money (once each).
- **TRAINER CLAUDE** waits in Delhi with Gengar/Dragonite/Blastoise/
  Arcanine/Alakazam/Snorlax — he scales to your level, pays ₹1500 + 5
  Ultra Balls per loss, and comes back 3 levels stronger every rematch.

### 2.5 Battles

Classic GBA-style turn battles with the full modern ruleset: complete
18-type chart, physical/special split, STAB, crits, accuracy, priority,
speed order, PP, switching.

- **FIGHT** — moves show type, power and PP. Type matchups matter
  (it says "super effective" for a reason).
- **BAG** — Poké/Great/Ultra Balls (wild battles only; Gen-3 catch formula —
  weaken first, status helps) and Potions (any battle, costs your turn).
- **POKéMON** — switch (costs your turn).
- **RUN** — wild battles only; speed-based odds.

Winning grants EXP → levels → new moves (you choose what to forget) →
**evolutions** at the real levels. **Friendship** grows by walking,
battling and levelling: high friendship sharpens crit rate and can let
your Pokémon **endure a lethal hit at 1 HP**. Your lead Pokémon follows
you in the world and emotes about it.

If your whole party faints you black out to the nearest Pokécenter —
healed, nothing lost.

### 2.6 The India League — 8 gyms

| # | City | Type | Leader |
|---|---|---|---|
| 1 | Bengaluru | Electric | TARA |
| 2 | Mumbai | Water | MARINA |
| 3 | Jaipur | Rock | RAJVEER |
| 4 | Kochi | Grass | MALLIKA |
| 5 | Kolkata | Ghost | ESHANI |
| 6 | Guwahati | Bug | MILIND |
| 7 | Shimla | Ice | HIMANI |
| 8 | Delhi | Dragon | ARYAVEER |

Each gym is a walkable arena: two **gym trainees** (optional, prize money)
and the **leader**, whose themed team scales with your badge count
(level 12 + 6 per badge; a 4th Pokémon from badge 4). First win = badge +
big prize; leaders accept rematches. **Win all 8 to become Champion of
India.** Suggested route: the table order, roughly south → north.

### 2.7 Pokédex

`X` opens the dex: all 898 species with seen/caught counts and percentages.
Unseen = silhouettes. Caught entries show official artwork, the animated
sprite, the **official cry**, real base stats, **catch rate** (with the
full-HP Poké Ball % so you know what you're in for), encounter rarity,
gender ratio and the flavor text. Every Pokémon you catch rolls IVs (0–31,
shown as bars in the party summary), one of 25 natures, a gender — and has
a **1/512 shiny chance** (they sparkle in the overworld).

### 2.8 Multiplayer

When the game is served by `server/index.mjs`, everyone on the same server
shares the world: other trainers appear with name tags (orange jackets).
Walk up, press **E** to challenge; they press **Y** to accept. PvP battles
use your **real caught teams** (entered at full HP; your party is untouched
afterwards) and are **resolved by the server** — stats are recomputed from
species data + IVs server-side, so modified clients can't cheat.
Disconnecting forfeits.

---

## 3. How it's made

### 3.1 Stack — deliberately boring

- **No build step.** Plain ES modules, loaded directly by the browser via
  an import map. No bundler, no TypeScript, no framework.
- **Three.js 0.160** (vendored locally in `vendor/` — a CDN once froze boot,
  never again) renders the world; the UI (HUD, battle screen, Pokédex,
  shops, dialogue) is plain DOM + CSS.
- **Node.js + `ws`** for the multiplayer server — also serves the static
  files, so one process is the whole deployment.

### 3.2 Data: real Pokémon, no bundled IP

`tools/bake_data.mjs` pulls every species (national dex 1–898) and every
referenced move from **PokéAPI** into `data/pokedex.json` + `data/moves.json`:
base stats, types, catch rates, gender ratios, level-up learnsets (newest
game version), evolution levels, dex flavor text. These are the same values
Bulbapedia documents. Sprites (static, official artwork, and the animated
Showdown set) and **official cries** are hotlinked from the PokéAPI CDN at
runtime — the repo contains zero copyrighted assets. Everything else
(terrain, buildings, characters, ground/facade textures, music, sound
effects) is generated procedurally in code.

### 3.3 The world is math

The terrain comes from a hand-traced India coastline polygon (lon/lat).
One function — `heightAt(x,z)` — is the single source of truth for ground
height (terrain mesh, walking, spawning, road draping all sample it):
base noise + Himalaya gradient + Western Ghats ridge + beach falloff +
city flattening. Biomes are lat/lon rules. Cities sit at real coordinates;
roads connect each city to its 2 nearest neighbours; villages sprout at
road midpoints. Vegetation, tall grass, houses and props are placed by
deterministic hash noise, so the world is identical for everyone without
shipping a map file.

Rendering: physical sky with a moving sun (day/night), soft shadow camera
that follows the player, custom animated water shader, drifting cloud
billboards, bloom post-processing, per-instance hue variation on instanced
vegetation, emissive window/lamp maps for night.

### 3.4 Pokémon presentation

Overworld Pokémon are **billboard sprites of the official animated set**,
decoded GIF→frames with the WebCodecs `ImageDecoder` and cycled as 3D
textures — on top of which sits behavioral animation (hop gait, sprint
lean, startled jumps, idle bob, night dozing). Battles and the dex use the
animated GIFs directly in the DOM. This is the classic Pokémon-games
approach (HGSS/B2W2 era) and the only way to have all 898 species look
*exactly right* — free legal 3D models of them don't exist.

### 3.5 Battle engine

`src/data.js` holds the pure math: complete 18×18 type chart, official
stat formulas (IV-aware, nature-modified), the official damage formula
(level, physical/special split, STAB, crit, weather, random factor), the
Gen-3 capture formula, medium-fast EXP. `src/battle.js` runs the state
machine and GBA-style presentation (painted per-biome backdrops, entry/
lunge/shake animations, type-colored hit bursts, damage numbers, synthesized
SFX + cries). The trainer AI estimates real damage both directions, takes
guaranteed KOs (preferring priority when slower), switches out of losing
matchups, and revenge-picks the best answer after a faint.

### 3.6 Multiplayer trust model

Clients are presentation. For PvP, each side submits only
`(species, level, IVs, nature, moves, gender, shiny)`. The server
(`server/battlecore.mjs`) **recomputes all stats from the dex data**,
rejects moves the species can't learn at that level, resolves every turn
with its own copy of the battle math, and streams an event list both
clients render. A client claiming 9999 Attack simply gets corrected.

### 3.7 Audio

`src/audio.js` is a WebAudio engine: enveloped-oscillator SFX (hits scale
with effectiveness, faints, ball throw/shake/click, level-up and heal
jingles), a tiny generative chiptune sequencer (separate overworld and
battle loops), and the official cry player. No audio files in the repo.

---

## 4. Running & developing

```bash
# multiplayer + static serving (the normal way)
cd server && npm install && node index.mjs      # → :8128, PORT env to change

# static only (offline mode)
python -m http.server 8000

# regenerate Pokémon data from PokéAPI (~5 min, only if data/ is lost/stale)
npm run bake
```

URL flags for development: `?low` (no shadows/bloom, half vegetation — weak
GPUs), `?nobloom`, `?autotest` (skip title, test save, FPS logging),
`?nograss` (disable surprise encounters), `?battletest` (instant battle).
In autotest, `window.__game` exposes the live game state and
`window.__test_battle()` forces a battle.

Project layout, all module responsibilities, geography knobs, and the
fixed-bug list: see **[CONTEXT.md](CONTEXT.md)**.

## 5. Testing

E2E tests drive the real game in headless Edge (puppeteer-core;
`cd tools && npm install` once). Server must be running on 8128.

```bash
node tools/e2e_test.mjs        # battle: menus, a real turn, narration
node tools/e2e_ui_test.mjs     # Pokédex grid/detail, party/IV summary
node tools/e2e_interiors.mjs   # Pokécenter nurse flow, gym leader prompt
node tools/e2e_mp_test.mjs     # 2 browsers: presence, challenge, full PvP, disconnect-forfeit
node tools/e2e_city.mjs        # screenshot suite (day/night/battle)
```
Every suite prints `PAGE ERRORS:` — it must say `none`.

## 6. Deployment

### 6.1 Single-player — GitHub Pages (free, no server)

The game is fully static; Pages serves it as-is and the client silently
falls back to offline mode (no other players, everything else works).
It's enabled for this repo: **https://sv-1411.github.io/pokemon/**.
Re-deploying = pushing to `main` (Settings → Pages → Deploy from branch,
`main` / root).

### 6.2 Full multiplayer — any Node host

The entire backend is one process with one npm dependency, so any
Node-capable host works (Railway, Render, Fly.io, a ₹400/mo VPS):

```bash
# on the host
git clone https://github.com/SV-1411/pokemon.git && cd pokemon/server
npm install
PORT=8128 node index.mjs        # put behind nginx/Caddy for TLS
```
Requirements: Node 18+, one open port, WebSocket passthrough (every
mentioned host supports it). With TLS the client automatically uses `wss://`.
On Railway/Render specifically: point the service at the repo, set the
start command to `cd server && npm install && node index.mjs`, done.
Player saves live in each browser's localStorage; server-side accounts are
the next roadmap item (see CONTEXT.md §11).

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| Stuck at "Loading Pokédex data…" | You opened `index.html` from disk. Serve over HTTP (§4). |
| No sound | Click/keypress once (browser autoplay policy), check `N` toggle. |
| Pokémon are blank/white squares | No internet — sprites stream from the PokéAPI CDN. |
| Overworld Pokémon don't animate | Browser lacks WebCodecs (use Chrome/Edge); static sprites are the automatic fallback. |
| Laggy | Add `?low` to the URL. |
| "Offline mode" toast on localhost:8128 | Server not running, or it answered slowly — refresh once. |
| Old save after an update misbehaves | Saves migrate automatically; worst case clear site data (new game). |

## 8. Credits & legal

Fan project for personal/educational use, not affiliated with or endorsed
by Nintendo / Creatures / GAME FREAK / The Pokémon Company, who own Pokémon
and all related IP. Data and sprite/cry hosting: the open-source
[PokéAPI](https://pokeapi.co) project; animated battle sprites originate
from Pokémon Showdown's community sprite set. Engine: [Three.js](https://threejs.org).
Everything else was built from scratch in this repo.
