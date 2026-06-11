// POKeMON INDIA — boot, world assembly, game loop, interactions.
import * as THREE from 'three';
import { loadData, DEX, byName, makeMon, sprFront, displayName, MOVES } from './data.js';
import {
  buildWorld, lonLatToWorld, heightAt, biomeAt, nearCity, locationName,
  drawMap, CITIES, CITY_R,
} from './world.js';
import { Player } from './player.js';
import { Spawns } from './spawns.js';
import { initBattle, startBattle } from './battle.js';
import {
  initUI, refreshPartyBar, setLocation, showPrompt, toast, openDex, openParty,
  anyModalOpen, closeModals,
} from './ui.js';
import { newSave, loadSave, persist } from './save.js';
import { Net } from './net.js';

const $ = (id) => document.getElementById(id);

// Surface runtime errors on-screen (also makes headless smoke tests readable).
window.addEventListener('error', (e) => {
  let el = $('errbox');
  if (!el) {
    el = document.createElement('div');
    el.id = 'errbox';
    el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99;background:#a00;' +
      'color:#fff;font:12px monospace;padding:6px;white-space:pre-wrap';
    document.body.appendChild(el);
  }
  el.textContent = `ERROR: ${e.message} (${e.filename?.split('/').pop()}:${e.lineno})`;
});

const STARTERS = [
  'bulbasaur', 'charmander', 'squirtle', 'chikorita', 'cyndaquil', 'totodile',
  'treecko', 'torchic', 'mudkip', 'turtwig', 'chimchar', 'piplup',
  'snivy', 'tepig', 'oshawott', 'chespin', 'fennekin', 'froakie',
  'rowlet', 'litten', 'popplio', 'grookey', 'scorbunny', 'sobble',
];

let save = null, scene, camera, renderer, player, spawns, net;
let startX = 0, startZ = 0;
let claudeNPC = null;
let mode = 'title'; // title | world | battle
let lastSave = 0, mapTick = 0;

// ---------- boot ----------
(async function boot() {
  try {
    await loadData();
  } catch (e) {
    $('loadmsg').textContent = 'Failed to load data/ — serve the folder over HTTP (python -m http.server).';
    throw e;
  }
  $('loading').classList.add('hidden');
  $('title').classList.remove('hidden');

  if (location.search.includes('autotest')) {
    save = newSave('TESTER');
    const starter = makeMon(byName.charmander.id, 12);
    save.party = [starter];
    save.seen[starter.id - 1] = 1; save.caught[starter.id - 1] = 1;
    beginGame();
    return;
  }

  const existing = loadSave();
  if (existing) {
    $('btnContinue').classList.remove('hidden');
    $('btnContinue').onclick = () => { save = existing; beginGame(); };
  }
  $('btnNew').onclick = () => {
    $('titleHome').classList.add('hidden');
    $('titleCreate').classList.remove('hidden');
    buildStarterCards();
  };
  $('btnBegin').onclick = () => {
    const name = ($('trainerName').value.trim() || 'RED').toUpperCase().slice(0, 12);
    save = newSave(name);
    const starter = makeMon(byName[pickedStarter].id, 5, { shiny: false });
    save.party = [starter];
    save.seen[starter.id - 1] = 1; save.caught[starter.id - 1] = 1;
    beginGame();
  };
})();

let pickedStarter = null;
function buildStarterCards() {
  const wrap = $('starters');
  wrap.innerHTML = '';
  for (const name of STARTERS) {
    const sp = byName[name];
    const card = document.createElement('div');
    card.className = 'starter-card';
    card.innerHTML = `<img src="${sprFront(sp.id)}"><div class="nm">${displayName(sp).toUpperCase()}</div>
      <div class="tp">${sp.types.join(' / ')}</div>`;
    card.onclick = () => {
      wrap.querySelectorAll('.picked').forEach((c) => c.classList.remove('picked'));
      card.classList.add('picked');
      pickedStarter = name;
      $('btnBegin').disabled = false;
    };
    wrap.appendChild(card);
  }
}

// ---------- world ----------
function beginGame() {
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');

  renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 1500);
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });
  scene = new THREE.Scene();
  buildWorld(scene);

  const blr = CITIES.find((c) => c.name === 'BENGALURU');
  startX = blr.x; startZ = blr.z;

  player = new Player(scene, camera, $('game'));
  if (save.x || save.z) player.setPosition(save.x, save.z);
  else player.setPosition(blr.x + 34, blr.z + 18); // just outside the plaza

  spawns = new Spawns(scene, save);
  net = new Net();
  buildClaudeNPC();

  initUI(save);
  initBattle({
    save,
    onSee: (id) => { save.seen[id - 1] = 1; },
    onCaught: (id) => { save.caught[id - 1] = 1; },
    addCaught: (mon) => {
      if (save.party.length < 6) save.party.push(mon);
      else { save.box.push(mon); toast(`${mon.name} sent to PC Box`); }
      refreshPartyBar();
    },
    toast,
  });
  refreshPartyBar();
  bindKeys();
  mode = 'world';
  toast(`Welcome to INDIA, ${save.name}! Wild Pokémon await.`);
  if (location.search.includes('battletest')) {
    setTimeout(async () => {
      mode = 'battle'; player.frozen = true;
      const result = await startBattle({ wild: makeMon(byName.gengar.id, 20), biome: 'forest' });
      afterBattle(result);
    }, 1200);
  }

  let last = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tick(dt, now);
    renderer.render(scene, camera);
  })(performance.now());
}

function buildClaudeNPC() {
  // Trainer CLAUDE waits in Delhi for the rematch.
  const delhi = CITIES.find((c) => c.name === 'DELHI');
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 8),
    new THREE.MeshLambertMaterial({ color: 0xd97757 }));
  robe.position.y = 2.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xf0e0c8 }));
  head.position.y = 5.6;
  g.add(robe, head);
  const x = delhi.x + 13, z = delhi.z + 9;
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  claudeNPC = { x, z, mesh: g };
}
function claudeTeam() {
  const maxLvl = Math.max(...save.party.map((p) => p.lvl));
  const lvl = Math.min(100, Math.max(8, maxLvl + 1 + save.claudeBeaten * 3));
  return ['gengar', 'dragonite', 'blastoise', 'arcanine', 'alakazam', 'snorlax']
    .map((n) => makeMon(byName[n].id, lvl, { shiny: false }));
}

// ---------- interactions / loop ----------
function bindKeys() {
  addEventListener('keydown', (e) => {
    if (mode !== 'world') return;
    if (e.code === 'KeyX') { anyModalOpen() ? closeModals() : openDex(); }
    if (e.code === 'KeyP') { anyModalOpen() ? closeModals() : openParty(); }
    if (e.code === 'KeyM') {
      if (anyModalOpen()) closeModals();
      else {
        $('mapmodal').classList.remove('hidden');
        drawMap($('bigmap'), player.pos.x, player.pos.z, player.camYaw + Math.PI, true);
      }
    }
    if (e.code === 'Escape') closeModals();
    if (e.code === 'KeyE') interact();
    player.frozen = anyModalOpen();
  });
}

let nearSpawn = null, nearPokecenter = null, nearClaude = false;
function tick(dt, now) {
  if (mode !== 'world') return;
  player.frozen = anyModalOpen();
  player.update(dt);
  spawns.update(dt, player, startX, startZ);
  net.update(dt);
  save.playSeconds += dt;

  // proximity prompts
  nearSpawn = spawns.nearest(player.pos.x, player.pos.z);
  const city = nearCity(player.pos.x, player.pos.z, 13);
  nearPokecenter = city ?? null;
  nearClaude = claudeNPC && Math.hypot(player.pos.x - claudeNPC.x, player.pos.z - claudeNPC.z) < 10;
  if (nearClaude) showPrompt(`E — Battle TRAINER CLAUDE ${save.claudeBeaten ? `(rematches won: ${save.claudeBeaten})` : '(he remembers losing to you)'}`);
  else if (nearSpawn) showPrompt(spawns.promptFor(nearSpawn));
  else if (nearPokecenter) showPrompt(`E — Pokécenter ${nearPokecenter.name}: heal party & restock balls`);
  else showPrompt(null);

  // HUD
  if ((mapTick -= dt) <= 0) {
    mapTick = 0.25;
    setLocation(locationName(player.pos.x, player.pos.z));
    drawMap($('minimap'), player.pos.x, player.pos.z, player.camYaw + Math.PI, false);
  }
  if (now - lastSave > 10000) {
    lastSave = now;
    save.x = player.pos.x; save.z = player.pos.z;
    persist(save);
  }
}

async function interact() {
  if (mode !== 'world' || anyModalOpen()) return;
  if (nearClaude) return battleClaude();
  if (nearSpawn) return battleWild(nearSpawn);
  if (nearPokecenter) {
    for (const p of save.party) {
      p.hp = p.maxHp;
      for (const mv of p.moves) p.pp[mv] = MOVES[mv].pp;
    }
    save.balls.poke = Math.max(save.balls.poke, 15);
    save.balls.great = Math.max(save.balls.great, 5);
    save.balls.ultra = Math.max(save.balls.ultra, 2);
    refreshPartyBar();
    persist(save);
    toast(`Party healed at ${nearPokecenter.name} Pokécenter! Balls restocked.`);
  }
}

async function battleWild(s) {
  mode = 'battle';
  player.frozen = true;
  const result = await startBattle({ wild: s.mon, biome: biomeAt(player.pos.x, player.pos.z) });
  if (result.outcome !== 'ran') spawns.remove(s);
  else if (!s.legendary) spawns.remove(s); // it flees too
  afterBattle(result);
}
async function battleClaude() {
  mode = 'battle';
  player.frozen = true;
  const result = await startBattle({
    trainer: { name: 'CLAUDE', team: claudeTeam() },
    biome: 'city',
  });
  if (result.outcome === 'win') {
    save.claudeBeaten++;
    save.balls.ultra += 5;
    toast('CLAUDE: "GG again. Take 5 Ultra Balls — and next time I level up." (+5 Ultra Balls)');
  }
  afterBattle(result);
}
function afterBattle(result) {
  if (result.outcome === 'lose') {
    // blackout: revive at the nearest city's Pokécenter
    let best = CITIES[0], bd = Infinity;
    for (const c of CITIES) {
      const d = Math.hypot(player.pos.x - c.x, player.pos.z - c.z);
      if (d < bd) { bd = d; best = c; }
    }
    player.setPosition(best.x + 10, best.z + 6);
    for (const p of save.party) p.hp = p.maxHp;
    toast(`You blacked out and woke up in ${best.name}…`);
  }
  refreshPartyBar();
  save.x = player.pos.x; save.z = player.pos.z;
  persist(save);
  mode = 'world';
  player.frozen = false;
}
