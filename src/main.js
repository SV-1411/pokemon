// POKeMON INDIA — boot, world assembly, game loop, interactions.
import * as THREE from 'three';
import { loadData, DEX, byName, makeMon, sprFront, displayName, MOVES } from './data.js';
import {
  buildWorld, lonLatToWorld, heightAt, biomeAt, nearCity, locationName,
  drawMap, CITIES, CITY_R, inTallGrass, makeLabel,
} from './world.js';
import { Player, buildTrainer } from './player.js';
import { startPvpBattle } from './pvp.js';
import { serializeTeam } from './net.js';
import { Spawns } from './spawns.js';
import { Atmosphere } from './weather.js';
import { Follower } from './follower.js';
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

let save = null, scene, camera, renderer, player, spawns, net, world, atmosphere, follower;
let startX = 0, startZ = 0;
const lowSpec = location.search.includes('low');
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.75;
  if (!lowSpec) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 1500);
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });
  scene = new THREE.Scene();
  world = buildWorld(scene, { lowSpec });
  atmosphere = new Atmosphere(scene, world);
  follower = new Follower(scene);

  // older saves predate the friendship stat
  for (const p of [...save.party, ...save.box]) p.friend ??= 70;

  const blr = CITIES.find((c) => c.name === 'BENGALURU');
  startX = blr.x; startZ = blr.z;

  player = new Player(scene, camera, $('game'));
  if (save.x || save.z) player.setPosition(save.x, save.z);
  else player.setPosition(blr.x + 34, blr.z + 18); // just outside the plaza

  spawns = new Spawns(scene, save);
  net = new Net();
  net.onToast = toast;
  net.onChallenged = (from, name) => {
    pendingChallenge = { from, name };
    toast(`⚔ ${name} challenges you to a battle! Press Y to accept`);
  };
  net.onBattleStart = (msg) => {
    if (mode !== 'world') { net.forfeit(); return; }
    battlePvp(msg);
  };
  net.connect(save.name, save.party[0]?.id ?? 25, player.pos.x, player.pos.z)
    .then((ok) => toast(ok
      ? '🌐 Online — other trainers will appear in your world!'
      : 'Offline mode (start server/index.mjs for multiplayer)'));
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
  window.__game = { atmosphere, player, save, world, net }; // debug/e2e handle
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
    if (e.code === 'KeyY' && pendingChallenge) {
      net.accept(pendingChallenge.from, serializeTeam(save.party));
      toast(`Accepted ${pendingChallenge.name}'s challenge!`);
      pendingChallenge = null;
    }
    player.frozen = anyModalOpen();
  });
}

let nearSpawn = null, nearPokecenter = null, nearClaude = false, nearRemote = null;
let pendingChallenge = null;
let grassCooldown = 0;
const remoteMeshes = new Map(); // id -> {group, label}

function reconcileRemotePlayers(dt) {
  for (const [id, rp] of net.remotePlayers) {
    let rm = remoteMeshes.get(id);
    if (!rm) {
      const group = buildTrainer();
      const blue = group.children[2].material.clone();
      blue.color.set(0x4878e8); // blue shirt = other trainers
      for (const i of [2, 3, 4]) group.children[i].material = blue; // torso + arms
      const label = makeLabel(rp.name, '#8fd0ff', 18);
      label.position.y = 9;
      group.add(label);
      scene.add(group);
      rm = { group };
      remoteMeshes.set(id, rm);
      group.position.set(rp.x, heightAt(rp.x, rp.z), rp.z);
    }
    // smooth toward the latest network position
    const g = rm.group;
    const k = Math.min(1, dt * 8);
    g.position.x += (rp.x - g.position.x) * k;
    g.position.z += (rp.z - g.position.z) * k;
    g.position.y = heightAt(g.position.x, g.position.z);
    g.rotation.y = rp.h ?? 0;
    const movedDist = Math.hypot(rp.x - g.position.x, rp.z - g.position.z);
    const ud = g.userData;
    ud.walkT = (ud.walkT ?? 0) + dt * (movedDist > 0.3 ? 9 : 0);
    ud.legL.rotation.x = Math.sin(ud.walkT) * 0.7;
    ud.legR.rotation.x = -Math.sin(ud.walkT) * 0.7;
  }
  for (const [id, rm] of remoteMeshes) {
    if (!net.remotePlayers.has(id)) {
      scene.remove(rm.group);
      remoteMeshes.delete(id);
    }
  }
}
function tick(dt, now) {
  if (mode !== 'world') return;
  player.frozen = anyModalOpen();
  const px0 = player.pos.x, pz0 = player.pos.z;
  player.update(dt);
  const moved = Math.hypot(player.pos.x - px0, player.pos.z - pz0) > 0.01;
  const biome = biomeAt(player.pos.x, player.pos.z);
  atmosphere.update(dt, player.pos.x, player.pos.z, biome);
  follower.setMon(save.party[0]);
  follower.update(dt, player, atmosphere, moved);
  spawns.update(dt, player, startX, startZ, atmosphere);
  net.sendState(dt, player.pos.x, player.pos.z, player.heading, save.party[0]?.id);
  reconcileRemotePlayers(dt);
  save.playSeconds += dt;

  // tall grass: surprise encounters while walking through it
  grassCooldown -= dt;
  if (moved && grassCooldown <= 0 && !player.frozen
    && !location.search.includes('nograss')
    && inTallGrass(player.pos.x, player.pos.z)) {
    if (Math.random() < dt * 0.4) {
      grassCooldown = 5;
      const id = spawns.pickFromPool(biome === 'city' ? 'plains' : biome, atmosphere);
      if (id) {
        const mon = makeMon(id, spawns.levelFor(player.pos.x, player.pos.z, startX, startZ));
        battleWild({ mon, fromGrass: true });
        return;
      }
    }
  }

  // proximity prompts
  nearSpawn = spawns.nearest(player.pos.x, player.pos.z);
  const city = nearCity(player.pos.x, player.pos.z, 13);
  nearPokecenter = city ?? null;
  nearClaude = claudeNPC && Math.hypot(player.pos.x - claudeNPC.x, player.pos.z - claudeNPC.z) < 10;
  nearRemote = null;
  let nrd = 10;
  for (const [id, rp] of net.remotePlayers) {
    const d = Math.hypot(player.pos.x - rp.x, player.pos.z - rp.z);
    if (d < nrd) { nrd = d; nearRemote = rp; }
  }
  if (nearClaude) showPrompt(`E — Battle TRAINER CLAUDE ${save.claudeBeaten ? `(rematches won: ${save.claudeBeaten})` : '(he remembers losing to you)'}`);
  else if (nearRemote) showPrompt(`E — Challenge TRAINER ${nearRemote.name} to a PvP battle!`);
  else if (nearSpawn) showPrompt(spawns.promptFor(nearSpawn));
  else if (nearPokecenter) showPrompt(`E — Pokécenter ${nearPokecenter.name}: heal party & restock balls`);
  else showPrompt(null);

  // HUD
  if ((mapTick -= dt) <= 0) {
    mapTick = 0.25;
    setLocation(locationName(player.pos.x, player.pos.z));
    $('skychip').textContent = atmosphere.label();
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
  if (nearRemote) {
    net.challenge(nearRemote.id, serializeTeam(save.party));
    return;
  }
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
  const result = await startBattle({
    wild: s.mon,
    wildRef: s,
    weather: atmosphere.battleWeather(),
    biome: biomeAt(player.pos.x, player.pos.z),
  });
  if (!s.fromGrass) spawns.remove(s); // billboard spawns leave either way
  afterBattle(result);
}
async function battleClaude() {
  mode = 'battle';
  player.frozen = true;
  const result = await startBattle({
    trainer: { name: 'CLAUDE', team: claudeTeam() },
    weather: atmosphere.battleWeather(),
    biome: 'city',
  });
  if (result.outcome === 'win') {
    save.claudeBeaten++;
    save.balls.ultra += 5;
    toast('CLAUDE: "GG again. Take 5 Ultra Balls — and next time I level up." (+5 Ultra Balls)');
  }
  afterBattle(result);
}
async function battlePvp(msg) {
  mode = 'battle';
  player.frozen = true;
  closeModals();
  const result = await startPvpBattle(net, msg);
  toast(result.youWon
    ? `🏆 You beat ${msg.oppName} in PvP!`
    : `${msg.oppName} won this time — rematch?`);
  // PvP doesn't faint your real party — it's a friendly exhibition match
  mode = 'world';
  player.frozen = false;
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
