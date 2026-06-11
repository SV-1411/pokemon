# CONTEXT.md — full project context

This file is the complete development context for **POKeMON INDIA**: what was
built, in what order, every design decision and why, where everything lives,
how to run and test it, known quirks, and what's next. Read this first when
resuming work (human or AI).

---

## 1. What this project is

A browser-based, open-world 3D Pokémon game set on a stylized map of India,
with all 898 Pokémon of Generations 1–8 (real stats/catch rates/learnsets),
animated sprites and official cries, a complete single-player loop
(explore → catch → train → 8 gyms → Champion), and working LAN multiplayer
(see other players in-world, server-authoritative PvP battles).

- Repo: https://github.com/SV-1411/pokemon (branch `main`)
- Local path: `D:\pokemon-battle`
- Owner: Atharva (GitHub SV-1411). Built pair-programming with Claude.

## 2. How to run

```
cd server && npm install && node index.mjs     # serves game + multiplayer
# open http://localhost:8128   (LAN: http://<your-ip>:8128)
```
Solo fallback: any static server (`python -m http.server 8000`) — the client
detects the missing WebSocket and runs offline.

URL flags: `?low` (no shadows/bloom, half vegetation) · `?nobloom` ·
`?autotest` (skips title, fresh Charmander save, fps + boot logs) ·
`?nograss` (no tall-grass surprise encounters; for tests) ·
`?battletest` (auto-starts a wild Gengar battle).

Controls: WASD/Shift move/run · mouse-drag orbit, wheel zoom · E interact ·
P party/box · X Pokédex · M map · N sound toggle · Y accept PvP challenge.

## 3. Build history (one day, 2026-06-11, in order)

1. **Origin**: a single-file GBA-style 6v6 battle game (`pokemon.html`, kept
   as a relic) written during an unrelated session; user beat Claude's team,
   then asked for "hard mode" AI. Pushed to a fresh repo.
2. **Open world v1**: Three.js world from an India coastline polygon, biome
   terrain, 20 cities, wild spawns as static billboards, catching, Pokédex,
   IVs/natures/genders, localStorage saves, Trainer CLAUDE NPC in Delhi.
   PokéAPI data baked to JSON (see §5). Type chart rewritten complete —
   fixing the original game's missing-Dark-matchups bug (user-reported:
   Crunch wasn't super-effective on Gengar; it is now, 2×).
3. **World 2.0**: fixed inverted A/D strafing (camera-right sign error);
   physical sky + day/night cycle (1 game-hour = 1 real minute); soft
   shadows following the player; animated water shader; roads between all
   cities + villages; biome vegetation (palms/pines/snow pines/cacti);
   tall-grass encounter patches; per-biome **weather** (rain/snow/sandstorm/
   fog/sun) with particles, affecting spawn tables AND battle damage
   (rain = water ×1.5/fire ×0.5, sun reversed); **friendship** stat
   (walking/battles/levels; high friendship = better crits + endure-at-1HP);
   lead Pokémon **follower** with mood/weather emotes; wild **temperament**
   (high-Atk species chase, fast-frail flee, some sleep at night = 2× catch).
4. **Multiplayer**: `server/index.mjs` (Node + ws) serves the game AND runs
   presence (10 Hz position broadcast, remote trainers rendered in-world)
   plus **server-authoritative PvP**: clients submit only
   (id, lvl, IVs, nature, moves); `server/battlecore.mjs` rebuilds stats
   from dex data (anti-cheat), validates move legality, resolves turns,
   streams event lists that `src/pvp.js` merely renders. Disconnect =
   forfeit. PvP is exhibition (full-HP teams, real party untouched).
5. **Graphics 3.0**: cities rebuilt as real towns (plaza, radiating streets
   with sidewalks, textured multi-storey facades whose **windows glow at
   night** via emissive maps, shops with awnings + Indian signboards, parked
   auto-rickshaws, rooftop water tanks); GBA-style painted battle backdrops
   per biome + entry/lunge/shake animations; UnrealBloom post-processing;
   drifting clouds; per-instance vegetation hue variety. **Three.js vendored
   into `vendor/`** after unpkg CDN stalls froze boot intermittently.
6. **Life update**: official **Showdown animated sprites** everywhere —
   DOM GIFs in battle/dex, WebCodecs `ImageDecoder` → per-frame textures for
   overworld billboards (`src/anim-sprites.js`); creature behavior animation
   (hop gait, sprint lean, startle-jump, night dozing); **audio**
   (`src/audio.js`): official cries from the PokéAPI cries archive on battle
   entry/dex views, synthesized SFX kit, generative chiptune BGM (overworld
   + battle themes); protagonist redesign; anime dome Pokécenter + Poké Mart
   exteriors.
7. **Interiors + NPCs + India League**: walkable rooms with scene-swap
   (`src/interiors.js`) — Pokécenter (Nurse Joyti dialogue + heal, PC
   terminal → Box), Mart (shop counter); **₹ economy** (start ₹3000; earn
   from NPC trainers/gym trainees/leaders/CLAUDE; spend on balls + potions);
   potions usable in battle (balls stay wild-only); city NPCs
   (`src/npc.js`) — wandering villagers with tip dialogue, 2 youth trainers
   per city with biome teams and one-time prizes; **8 gyms** (see §7).
8. **Anime art pass**: shared character anatomy kit (`src/chars.js`) — round
   heads with eyes/pupils/brows, tapered pivoted limbs; protagonist with
   spiky hair/dome cap/cheek marks, idle breathing + sprint lean; villager
   archetypes (man/woman/kid/elder, 4 skin tones); houses as anime cottages
   (gabled prism roofs with eaves, chimneys, flower-box windows, picket
   fences); battle hit FX (type-colored bursts + floating damage numbers).
   Fixed upside-down animated sprites (ImageBitmap ignores UNPACK_FLIP_Y →
   `createImageBitmap(image, { imageOrientation: 'flipY' })`).

## 4. File map

```
index.html            shell: UI markup, CSS (HUD/battle/modals/FX keyframes), importmap → vendor/
src/
  main.js             boot, title/starter flow, game loop, all wiring, interactions, debug handle
  data.js             dex/move loading, FULL 18-type chart, stat/damage/catch/exp formulas,
                      makeMon (IVs/nature/gender/friendship), natures, rarity tiers — PURE, server-reusable
  world.js            India terrain (coastline polygon §6), biomes, heightAt, cities+GYMS data,
                      roads, tall grass, vegetation prefabs, houses/shops/rickshaws/Pokécenter/Mart/gym
                      exteriors, sky/sun/water/clouds, door anchors (c.pcDoor/martDoor/gymDoor), maps
  player.js           third-person controller, camera orbit, walk/idle/lean animation
  chars.js            character anatomy kit: buildProtagonist, buildVillagerV2, heads/limbs/torsos
  spawns.js           biome encounter pools (BST-weighted, weather/night-modified), wander/chase/flee/
                      sleep AI, tall-grass clustering, landmark legendaries
  battle.js           battle engine + GBA overlay: phys/special, STAB, crits, priority, PP, weather
                      mults, friendship perks, catching (Gen-3 formula), exp/levels/evolution,
                      potions, painted backdrops, animations, hit FX, sounds; "Claude v2" trainer AI
  pvp.js              PvP battle UI driven purely by server events
  interiors.js        scene-swapped rooms: Pokécenter/Mart/gym arenas; gymTeam/juniorTeam scaling
  npc.js              city pedestrians + youth trainers, dialogue lines, npcTeam
  follower.js         lead Pokémon follows + emotes; friendship-by-walking
  weather.js          Atmosphere: clock, per-biome weather rolls, particles, fog, typeMult, labels
  anim-sprites.js     Showdown GIF → animated 3D textures (WebCodecs), showdownUrl, static fallback
  audio.js            SFX engine + official cries + generative BGM (SFX singleton)
  ui.js               HUD, Pokédex (seen/caught %), party/IV summary, box, shop, dialogue, money chip
  save.js             localStorage save + migrate() for older saves
  net.js              WebSocket client (presence, challenge, battle events), serializeTeam, offline fallback
server/
  index.mjs           HTTP static + ws lobby: hello/pos/challenge/accept/action/replace/forfeit
  battlecore.mjs      authoritative battle: sanitizeMon (recompute stats, validate moves), PvpBattle
data/
  pokedex.json        898 species: stats, types, catch rate, gender ratio, learnsets, evo, flavor
  moves.json          712 damaging moves: type/power/acc/priority/class/pp
tools/
  bake_data.mjs       regenerate data/ from PokéAPI (`npm run bake`)
  e2e_test.mjs        battle smoke (moves menu, turn, narration)
  e2e_ui_test.mjs     dex grid/detail, party summary
  e2e_visual.mjs      day/night/rain world screenshots
  e2e_city.mjs        city day/night + battle backdrop screenshots
  e2e_interiors.mjs   Pokécenter nurse flow + gym leader prompt
  e2e_mp_test.mjs     two clients: presence, challenge/accept, full PvP, disconnect-forfeit
  e2e_closeup.mjs     character/cottage close-ups
  e2e_console.mjs     boot triage (console probes, fps)
vendor/               three.js 0.160 + Sky + postprocessing addons (LOCAL — never use CDN, see §9)
docs/                 README screenshots
pokemon.html          the original 2D battle game (classic mode, untouched)
```

## 5. Data & assets (all hotlinked or baked, no bundled IP)

- **Game data**: baked from PokéAPI by `tools/bake_data.mjs` (~3000 requests,
  ~5 min). Catch rates/gender ratios match Bulbapedia (same source data).
  Learnsets = level-up moves from each species' newest version group,
  damaging moves only; every mon guaranteed ≥1 move (tackle fallback).
- **Sprites** (hotlinked, raw.githubusercontent.com/PokeAPI/sprites):
  static pixel `/sprites/pokemon/{id}.png` (+`/back`, `/shiny`), official
  artwork `/other/official-artwork/{id}.png` (dex), **animated Showdown**
  `/other/showdown/[back/][shiny/]{id}.gif` (battles, dex, overworld via
  WebCodecs). Always chain onerror fallbacks → static front PNG.
- **Cries**: `raw.githubusercontent.com/PokeAPI/cries/.../latest/{id}.ogg`.
- Everything else (terrain, buildings, characters, textures, music, SFX) is
  procedural — canvas textures + WebAudio synthesis. No copyrighted assets
  in the repo.

## 6. World geography (the knobs people will want)

- Mapping: `lonLatToWorld` — 60 units/degree, centered (82.75E, 21.75N).
  World ≈ 1840×1960 units. Coastline = ~46-vertex polygon `COAST`
  (stylized; Bangladesh/Nepal folded into playable land).
- Biomes by rules in `biomeAtLonLat`: himalaya (lat≥29), hills, Thar desert
  (lon<75.5, lat>23.5), eastern jungle (lon>89.5), southern forest (lat<16),
  coast (≤0.55° from shore), plains; cities override within `CITY_R`(24).
- `heightAt(x,z)` is THE ground-truth height (terrain mesh, walking,
  spawns, roads all use it). City flattening lives inside it.
- 20 cities (real coords); start = Bengaluru (+34,+18 offset).
  22 legendary landmark shrines (`LANDMARKS`) — one chance each, persisted
  in `save.landmarksDone`.
- Spawn levels scale with distance from Bengaluru (`3 + d/24 ±3`, himalaya
  min 38, cap 58). Rarity by base-stat-total tier: <400 w10, <500 w4,
  <570 w1.2, else 0.4; legendaries excluded from pools.

## 7. The India League

`GYMS` in world.js: Electric TARA (Bengaluru) → Water MARINA (Mumbai) →
Rock RAJVEER (Jaipur) → Grass MALLIKA (Kochi) → Ghost ESHANI (Kolkata) →
Bug MILIND (Guwahati) → Ice HIMANI (Shimla) → Dragon ARYAVEER (Delhi).
Leader teams: themed species sorted by BST, picked at 45–95% up the power
curve; level `12 + 6×badges`, ace +3; 4th mon from badge 4. Two gym
trainees per gym (one-time ₹). First leader win = badge + ₹2500+500×idx;
rematches ₹1000. 8/8 badges → "CHAMPION OF INDIA" toast. Losses inside a
gym black out to the nearest Pokécenter (party healed, no money loss).

## 8. Multiplayer protocol (client ↔ server JSON over ws)

C→S: `hello{name,lead,x,z}` · `pos{x,z,h,lead}` (10 Hz) ·
`challenge{to,team}` · `accept{from,team}` · `action{action}` ·
`replace{idx}` · `forfeit`.
S→C: `welcome{id,players}` · `join/leave/pos` · `challenged{from,name}` ·
`challenge_sent/fail` · `battle_start{side,oppName,yourTeam,oppLead,oppCount}`
(yourTeam is the SERVER-sanitized canon) · `events{events[]}`
(switch/move/miss/immune/hit/faint/request_switch/end) · `battle_end{youWon,reason}`.
Trust model: never trust client stats — `sanitizeMon` recomputes from dex
data + IVs and rejects unlearnable moves.

## 9. Bugs fixed & gotchas (do not re-learn these the hard way)

- **Type chart**: original game's chart was incomplete (no Dark column) —
  the full 18×18 chart lives in data.js AND server/battlecore.mjs (kept in
  sync manually; if you touch one, touch both).
- **A/D inversion**: screen-right for this camera is −x; strafe must be
  `(KeyA?1:0)-(KeyD?1:0)`. Don't "fix" it back.
- **CDN dependency**: unpkg stalls froze boot at "Loading Pokédex data…"
  (module imports never resolved). Three.js + addons are vendored in
  `vendor/`; importmap points there. **Never reintroduce CDN imports.**
- **ImageBitmap flip**: WebGL's UNPACK_FLIP_Y is ignored for ImageBitmap
  uploads → animated textures rendered upside-down. Fix:
  `createImageBitmap(img, { imageOrientation: 'flipY' })` in anim-sprites.js.
- **Lambert + custom geometry = black**: any hand-built BufferGeometry needs
  `computeVertexNormals()` or it renders black (bit us with grass quads).
- **Spawn-in-building**: don't spawn/teleport players inside city rings;
  plaza-adjacent open ground only.
- **Headless testing**: e2e uses puppeteer-core + Edge (`tools/`). Server
  must be running on 8128. `networkidle` never fires (sprites stream
  continuously) — use `waitUntil:'load'` + `waitForFunction(window.__game)`.
  Intermittent `Runtime.callFunctionOn timed out` happens under load —
  retry once before debugging. `window.__game` exposes
  {atmosphere, player, save, world, net, interiors} for tests;
  `window.__test_battle()` forces a wild battle.
- **Audio autoplay**: AudioContext unlocks on first keydown/mousedown.
- **Save migration**: `migrate()` in save.js backfills new fields
  (items/money/badges/beatenTrainers, friend) — extend it when adding
  save fields; old saves must keep working.

## 10. Testing

`node tools/e2e_test.mjs && node tools/e2e_ui_test.mjs &&
node tools/e2e_interiors.mjs` is the regression trio (server on 8128).
`e2e_mp_test.mjs` for multiplayer (boots 2 browsers). Visual suites
(`e2e_city/visual/closeup`) write smoke_*.png (gitignored) for eyeballing;
copy keepers into docs/. All suites print PAGE ERRORS — must be `none`.

## 11. Roadmap (user-agreed priorities)

1. **Multiplayer accounts** (explicitly "at last" = next): move the save
   JSON server-side, name+key login, progress follows the player across
   devices. The save shape is already server-friendly.
2. Public hosting (single Node process — Railway/Fly/VPS; needs owner's
   hosting account).
3. Trading, region-sharded presence rooms, co-op legendary raids.
4. Quality backlog: Pokécenter interior polish, wind sway on vegetation,
   gym-leader rematch teams with held items, status conditions
   (sleep/burn/para) in battle, exp-share toggles, controller support.

## 12. Conventions

- Plain ES modules, no build step, no TypeScript, no frameworks. 2-space
  indent, single quotes, trailing commas. Comments explain *constraints*,
  not narration.
- Battle math must stay pure/data-driven (it's shared conceptually with the
  server core). UI reads state; engines own it.
- Every feature lands with: syntax check (`node --check`), the regression
  trio, a visual screenshot if it's visible, then commit (imperative
  subject, body = what+why) and push to `main`.
