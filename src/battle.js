// Battle engine + GBA-style overlay. Official damage model: physical/special
// split, full 18-type chart, STAB, crits, accuracy, priority, speed order.
// Wild battles support catching (Gen 3 formula); trainer battles use the
// "Claude v2" AI (damage estimation, guaranteed-KO detection, matchup switching).
import {
  DEX, MOVES, effectiveness, TYPE_COLORS, sprFront, sprBack, moveName,
  expForLevel, expGain, recalcStats, movesAtLevel, displayName, tryCapture, BALLS,
} from './data.js';
import { showdownUrl } from './anim-sprites.js';
import { SFX } from './audio.js';

const $ = (id) => document.getElementById(id);
let ctx = null; // { save, onSee, onCaught, addCaught, toast }
export function initBattle(c) { ctx = c; }

// ---------- message queue ----------
let queue = [], pumping = false;
function say(text) { return new Promise((res) => { queue.push({ text, res }); pump(); }); }
function pump() {
  if (pumping || !queue.length) return;
  pumping = true;
  const { text, res } = queue.shift();
  $('bmsg').textContent = text;
  setTimeout(() => { pumping = false; res(); pump(); }, 900);
}

// ---------- UI ----------
// GBA-style painted battle backdrops: sky gradient, clouds, hill silhouettes
// and a ground band — generated per biome like the Emerald battle scenes.
const BIOME_PALETTE = {
  coast: { sky: ['#7ec8ee', '#cfe9f5'], hills: '#4d9bbf', ground: '#e8d8a8', g2: '#d4bd85' },
  desert: { sky: ['#f6cf92', '#fbe6bd'], hills: '#c9913f', ground: '#e8c27a', g2: '#d3a85e' },
  plains: { sky: ['#86c8f0', '#d8eefb'], hills: '#5c9e58', ground: '#9ed07a', g2: '#7eb95e' },
  forest: { sky: ['#7fb98f', '#cfe7c8'], hills: '#36703c', ground: '#5e9b50', g2: '#4a8440' },
  jungle: { sky: ['#5e9b7c', '#b3d6b8'], hills: '#234f2c', ground: '#3f7a3c', g2: '#326530' },
  hills: { sky: ['#9dbede', '#dfe9f2'], hills: '#6f8463', ground: '#8aa06c', g2: '#74895a' },
  himalaya: { sky: ['#a8c6e8', '#eef4fb'], hills: '#b9c6d6', ground: '#e8eef5', g2: '#cdd9e6' },
  city: { sky: ['#9db8d2', '#dfe5ec'], hills: '#7b8694', ground: '#b8b2a4', g2: '#a39d90' },
  ocean: { sky: ['#74b4e4', '#cfe6f7'], hills: '#3a7ab0', ground: '#5a9ed0', g2: '#4a8cc0' },
};
export function paintBattleBg(biome) {
  const p = BIOME_PALETTE[biome] ?? BIOME_PALETTE.plains;
  const cv = document.createElement('canvas');
  cv.width = 480; cv.height = 320;
  const g = cv.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 230);
  sky.addColorStop(0, p.sky[0]); sky.addColorStop(1, p.sky[1]);
  g.fillStyle = sky; g.fillRect(0, 0, 480, 230);
  g.fillStyle = 'rgba(255,255,255,.75)';
  for (const [cx, cy, s] of [[80, 60, 26], [150, 48, 18], [340, 80, 30], [410, 60, 18]]) {
    g.beginPath();
    g.ellipse(cx, cy, s * 1.7, s * 0.62, 0, 0, 7);
    g.ellipse(cx - s, cy + 6, s * 1.1, s * 0.5, 0, 0, 7);
    g.ellipse(cx + s, cy + 7, s * 1.2, s * 0.5, 0, 0, 7);
    g.fill();
  }
  g.fillStyle = p.hills;
  g.beginPath(); g.moveTo(0, 230);
  for (let x = 0; x <= 480; x += 4) {
    g.lineTo(x, 196 + Math.sin(x * 0.012) * 16 + Math.sin(x * 0.05 + 2) * 7);
  }
  g.lineTo(480, 230); g.closePath(); g.fill();
  const gr = g.createLinearGradient(0, 215, 0, 320);
  gr.addColorStop(0, p.ground); gr.addColorStop(1, p.g2);
  g.fillStyle = gr; g.fillRect(0, 215, 480, 105);
  return cv.toDataURL();
}
function setScene(biome) {
  $('bscene').style.backgroundImage = `url(${paintBattleBg(biome)})`;
  $('bframe').style.background = '#000';
}
export function animate(el, cls, ms = 500) {
  el.classList.remove(cls);
  void el.offsetWidth; // restart the animation
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}
// impact burst + floating damage number over the defender
export function hitFX(targetId, color, dmg) {
  const scene = $('bscene');
  const t = $(targetId).getBoundingClientRect();
  const s = scene.getBoundingClientRect();
  const x = t.left - s.left + t.width / 2, y = t.top - s.top + t.height / 2;
  const burst = document.createElement('div');
  burst.className = 'fxburst';
  burst.style.left = `${x}px`; burst.style.top = `${y}px`;
  burst.style.background = `radial-gradient(circle, #fff 0%, ${color} 35%, transparent 70%)`;
  scene.appendChild(burst);
  setTimeout(() => burst.remove(), 500);
  if (dmg) {
    const num = document.createElement('div');
    num.className = 'dmgnum';
    num.style.left = `${x + 18}px`; num.style.top = `${y - 18}px`;
    num.textContent = `-${dmg}`;
    scene.appendChild(num);
    setTimeout(() => num.remove(), 900);
  }
}
// Animated Showdown GIF first; fall back through the static sprites.
export function setSpriteImg(img, candidates) {
  let i = 0;
  img.onerror = () => { if (++i < candidates.length) img.src = candidates[i]; else img.onerror = null; };
  img.src = candidates[0];
}
function setSprite(el, mon, back) {
  const img = el.querySelector('img');
  setSpriteImg(img, back
    ? [showdownUrl(mon.id, { back: true, shiny: mon.shiny }), sprBack(mon.id, mon.shiny), sprFront(mon.id, mon.shiny)]
    : [showdownUrl(mon.id, { shiny: mon.shiny }), sprFront(mon.id, mon.shiny)]);
  el.style.opacity = 1;
}
function hpColor(f) { return f > 0.5 ? '#58c858' : f > 0.2 ? '#f8c838' : '#e84848'; }
function syncBars(me, enemy) {
  if (enemy) {
    const f = Math.max(0, enemy.hp / enemy.maxHp);
    $('infoEnemy').querySelector('.nm').textContent =
      `${enemy.name.toUpperCase()} ${enemy.gender}${enemy.shiny ? '✨' : ''}`;
    $('infoEnemy').querySelector('.lv').textContent = `Lv${enemy.lvl}`;
    const bar = $('infoEnemy').querySelector('.hpfill');
    bar.style.width = `${f * 100}%`; bar.style.background = hpColor(f);
  }
  if (me) {
    const f = Math.max(0, me.hp / me.maxHp);
    $('infoMe').querySelector('.nm').textContent =
      `${me.name.toUpperCase()} ${me.gender}${me.shiny ? '✨' : ''}`;
    $('infoMe').querySelector('.lv').textContent = `Lv${me.lvl}`;
    const bar = $('infoMe').querySelector('.hpfill');
    bar.style.width = `${f * 100}%`; bar.style.background = hpColor(f);
    $('infoMe').querySelector('.hptext').textContent = `${Math.max(0, me.hp)}/${me.maxHp}`;
    const lo = expForLevel(me.lvl), hi = expForLevel(me.lvl + 1);
    $('infoMe').querySelector('.expfill').style.width =
      `${Math.min(100, ((me.exp - lo) / (hi - lo)) * 100)}%`;
  }
}
function setMenu(items) {
  const m = $('bmenu');
  m.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('button');
    b.innerHTML = `${it.label}${it.sub ? `<span class="sub2">${it.sub}</span>` : ''}`;
    if (it.color) b.style.color = it.color;
    b.disabled = !!it.disabled;
    b.onclick = it.fn;
    m.appendChild(b);
  }
}
const clearMenu = () => { $('bmenu').innerHTML = ''; };

// ---------- damage ----------
// Rain pumps water and douses fire; harsh sun does the opposite (official mults).
function weatherMult(moveType) {
  const w = B?.weather;
  if (w === 'rain') return moveType === 'water' ? 1.5 : moveType === 'fire' ? 0.5 : 1;
  if (w === 'sun') return moveType === 'fire' ? 1.5 : moveType === 'water' ? 0.5 : 1;
  return 1;
}
function calcDamage(att, def, mvName) {
  const mv = MOVES[mvName];
  const eff = effectiveness(mv.t, def.types);
  if (eff === 0) return { dmg: 0, eff, crit: false };
  const A = mv.c === 'special' ? att.spa : att.atk;
  const D = mv.c === 'special' ? def.spd : def.def;
  const stab = att.types.includes(mv.t) ? 1.5 : 1;
  // high friendship sharpens crits (affection mechanic)
  const crit = Math.random() < ((att.friend ?? 70) >= 200 ? 1 / 8 : 1 / 16);
  const base = (((2 * att.lvl) / 5 + 2) * mv.p * (A / D)) / 50 + 2;
  const dmg = Math.max(1, Math.floor(base * stab * eff * weatherMult(mv.t)
    * (crit ? 1.5 : 1) * (0.85 + Math.random() * 0.15)));
  return { dmg, eff, crit };
}
function estDmg(att, def, mvName) { // deterministic expectation, for the AI
  const mv = MOVES[mvName];
  if (!mv || mv.p === 0) return { exp: 0, min: 0, acc: 0 };
  const A = mv.c === 'special' ? att.spa : att.atk;
  const D = mv.c === 'special' ? def.spd : def.def;
  const stab = att.types.includes(mv.t) ? 1.5 : 1;
  const real = ((((2 * att.lvl) / 5 + 2) * mv.p * (A / D)) / 50 + 2) * stab
    * effectiveness(mv.t, def.types) * weatherMult(mv.t);
  return { exp: real * (mv.a / 100), min: real * 0.85, acc: mv.a };
}
function bestMove(att, def) {
  let best = att.moves[0], bestExp = -1;
  for (const mv of att.moves) {
    if ((att.pp[mv] ?? 0) <= 0) continue;
    const d = estDmg(att, def, mv);
    if (d.exp > bestExp) { bestExp = d.exp; best = mv; }
  }
  return { mv: best, exp: bestExp };
}

// ---------- battle state ----------
let B = null; // current battle

export function startBattle(opts) {
  // opts: { wild: mon, biome } or { trainer: {name, team: [mons]}, biome }
  return new Promise((resolve) => {
    B = {
      wild: opts.wild ?? null,
      weather: opts.weather ?? null,
      wildRef: opts.wildRef ?? null,
      trainer: opts.trainer ?? null,
      enemyTeam: opts.trainer ? opts.trainer.team : [opts.wild],
      enIdx: 0,
      myIdx: ctx.save.party.findIndex((p) => p.hp > 0),
      runTries: 0,
      enSwitchedLast: false,
      resolve,
      done: false,
    };
    setScene(opts.biome ?? 'plains');
    $('battle').classList.remove('hidden');
    SFX.encounter();
    SFX.bgm('battle');
    intro();
  });
}
const me = () => ctx.save.party[B.myIdx];
const en = () => B.enemyTeam[B.enIdx];

async function intro() {
  setSprite($('sprEnemy'), en(), false);
  setSprite($('sprMe'), me(), true);
  animate($('sprMe'), 'enter-me', 600);
  animate($('sprEnemy'), 'enter-en', 600);
  syncBars(me(), en());
  ctx.onSee(en().id);
  if (B.trainer) {
    await say(`TRAINER ${B.trainer.name} wants to battle!`);
    SFX.cry(en().id);
    await say(`${B.trainer.name} sent out ${en().name.toUpperCase()}!`);
  } else {
    SFX.cry(en().id);
    await say(`A wild ${en().shiny ? 'SHINY ' : ''}${en().name.toUpperCase()} appeared!`);
  }
  if (B.weather === 'rain') await say('Rain is falling…');
  else if (B.weather === 'sun') await say('The sunlight is harsh!');
  else if (B.weather === 'snow') await say('Snow is falling…');
  else if (B.weather === 'sandstorm') await say('A sandstorm rages!');
  if (B.wildRef?.sleeping) await say(`${en().name.toUpperCase()} is fast asleep…`);
  await say(`Go! ${me().name.toUpperCase()}!`);
  mainMenu();
}

function mainMenu() {
  if (B.done) return;
  setMenu([
    { label: 'FIGHT', color: '#e84848', fn: fightMenu },
    { label: 'POKéMON', fn: () => switchMenu(false) },
    { label: 'BAG', fn: bagMenu },
    { label: 'RUN', fn: tryRun, disabled: !!B.trainer },
  ]);
}
function fightMenu() {
  const M = me();
  const items = M.moves.map((mv) => {
    const d = MOVES[mv];
    return {
      label: moveName(mv),
      sub: `${d.t.toUpperCase()} · ${d.p} pw · PP ${M.pp[mv] ?? 0}/${d.pp}`,
      color: TYPE_COLORS[d.t],
      disabled: (M.pp[mv] ?? 0) <= 0,
      fn: () => playerTurn({ move: mv }),
    };
  });
  if (items.every((i) => i.disabled)) items.push({ label: 'STRUGGLE', fn: () => playerTurn({ move: '__struggle' }) });
  items.push({ label: '← BACK', fn: mainMenu });
  setMenu(items);
}
function switchMenu(forced) {
  const items = ctx.save.party.map((p, i) => ({
    label: `${p.name.toUpperCase()} Lv${p.lvl}`,
    sub: `HP ${Math.max(0, p.hp)}/${p.maxHp}`,
    disabled: p.hp <= 0 || i === B.myIdx,
    fn: () => (forced ? doForcedSwitch(i) : playerTurn({ switch: i })),
  }));
  if (!forced) items.push({ label: '← BACK', fn: mainMenu });
  setMenu(items);
}
const POTIONS = {
  potion: { heal: 20, label: 'Potion' },
  superpotion: { heal: 50, label: 'Super Potion' },
  hyperpotion: { heal: 120, label: 'Hyper Potion' },
};
function bagMenu() {
  const items = [];
  if (!B.trainer) { // balls only work on wild Pokémon
    for (const [key, b] of Object.entries(BALLS)) {
      items.push({
        label: `${b.label} ×${ctx.save.balls[key] ?? 0}`,
        sub: `catch ×${b.mult}`,
        disabled: (ctx.save.balls[key] ?? 0) <= 0,
        fn: () => playerTurn({ ball: key }),
      });
    }
  }
  for (const [key, p] of Object.entries(POTIONS)) {
    items.push({
      label: `${p.label} ×${ctx.save.items?.[key] ?? 0}`,
      sub: `restore ${p.heal} HP`,
      disabled: (ctx.save.items?.[key] ?? 0) <= 0,
      fn: () => playerTurn({ item: key }),
    });
  }
  items.push({ label: '← BACK', fn: mainMenu });
  setMenu(items);
}

// ---------- the enemy AI ----------
function aiAction() {
  const E = en(), M = me();
  const killers = E.moves.filter((mv) => {
    if ((E.pp[mv] ?? 0) <= 0) return false;
    const d = estDmg(E, M, mv);
    return d.min >= M.hp && d.acc >= 85;
  });
  if (killers.length) {
    B.enSwitchedLast = false;
    killers.sort((a, b) => (MOVES[b].pr - MOVES[a].pr) || (MOVES[b].a - MOVES[a].a));
    return { move: killers[0] };
  }
  if (B.trainer && !B.enSwitchedLast) {
    const matchup = (mine, theirs) =>
      bestMove(mine, theirs).exp / theirs.maxHp - bestMove(theirs, mine).exp / mine.maxHp
      + (mine.spe > theirs.spe ? 0.08 : -0.08);
    const cur = matchup(E, M);
    let idx = -1, best = cur;
    B.enemyTeam.forEach((p, i) => {
      if (p.hp > 0 && i !== B.enIdx) {
        const s = matchup(p, M);
        if (s > best + 0.35) { best = s; idx = i; }
      }
    });
    if (idx >= 0 && cur < -0.1) { B.enSwitchedLast = true; return { switch: idx }; }
  }
  B.enSwitchedLast = false;
  return { move: bestMove(E, M).mv };
}

// ---------- turn execution ----------
async function playerTurn(action) {
  clearMenu();
  const M = me();
  if (action.ball) return ballTurn(action.ball);
  if (action.item) {
    const p = POTIONS[action.item];
    ctx.save.items[action.item]--;
    M.hp = Math.min(M.maxHp, M.hp + p.heal);
    SFX.heal();
    syncBars(me(), en());
    await say(`${M.name.toUpperCase()} was healed with the ${p.label.toUpperCase()}!`);
    if (await enemyStrike()) return;
    return endTurn();
  }
  if (action.switch !== undefined) {
    await say(`${M.name.toUpperCase()}, come back!`);
    B.myIdx = action.switch;
    setSprite($('sprMe'), me(), true);
    syncBars(me(), en());
    await say(`Go! ${me().name.toUpperCase()}!`);
    await enemyStrike();
    return endTurn();
  }
  const act = aiAction();
  if (act.switch !== undefined) {
    const old = en().name.toUpperCase();
    B.enIdx = act.switch;
    setSprite($('sprEnemy'), en(), false);
    syncBars(me(), en());
    ctx.onSee(en().id);
    await say(`${B.trainer.name} withdrew ${old}!`);
    await say(`${B.trainer.name} sent out ${en().name.toUpperCase()}!`);
    await doMove(me(), en(), action.move, true);
    if (en().hp <= 0 && (await enemyFainted())) return;
    return endTurn();
  }
  const E = en();
  const mvMe = action.move, mvEn = act.move;
  const pMe = mvMe === '__struggle' ? 0 : MOVES[mvMe].pr;
  const pEn = MOVES[mvEn].pr;
  const meFirst = pMe !== pEn ? pMe > pEn : (M.spe === E.spe ? Math.random() < 0.5 : M.spe > E.spe);
  const seq = meFirst
    ? [[M, E, mvMe, true], [E, M, mvEn, false]]
    : [[E, M, mvEn, false], [M, E, mvMe, true]];
  for (const [att, def, mv, isMe] of seq) {
    if (att.hp <= 0 || def.hp <= 0) continue;
    await doMove(att, def, mv, isMe);
    if (def.hp <= 0) {
      if (isMe) { if (await enemyFainted()) return; }
      else if (await myFainted()) return;
    }
  }
  endTurn();
}

async function doMove(att, def, mv, isMe) {
  if (mv === '__struggle') {
    await say(`${att.name.toUpperCase()} used STRUGGLE!`);
    const dmg = Math.max(1, Math.floor(def.maxHp * 0.12));
    def.hp -= dmg; syncBars(me(), en());
    return;
  }
  att.pp[mv] = Math.max(0, (att.pp[mv] ?? 1) - 1);
  const d = MOVES[mv];
  animate($(isMe ? 'sprMe' : 'sprEnemy'), isMe ? 'lunge-me' : 'lunge-en', 460);
  await say(`${att.name.toUpperCase()} used ${moveName(mv).toUpperCase()}!`);
  if (Math.random() * 100 >= d.a) { await say('But it missed!'); return; }
  const { dmg, eff, crit } = calcDamage(att, def, mv);
  if (eff === 0) { await say(`It doesn't affect ${def.name.toUpperCase()}…`); return; }
  // a devoted partner can endure a lethal hit at 1 HP (affection mechanic)
  if (!isMe && dmg >= def.hp && (def.friend ?? 70) >= 180 && Math.random() < (def.friend ?? 70) / 450) {
    def.hp = 1;
    syncBars(me(), en());
    await say(`${def.name.toUpperCase()} endured the hit so it wouldn't make you sad!`);
    return;
  }
  def.hp = Math.max(0, def.hp - dmg);
  flashSprite(isMe ? 'sprEnemy' : 'sprMe');
  animate($('bframe'), 'hit-shake', 420);
  hitFX(isMe ? 'sprEnemy' : 'sprMe', TYPE_COLORS[d.t] ?? '#fff', dmg);
  SFX.hit(eff);
  syncBars(me(), en());
  if (crit) await say('A critical hit!');
  if (eff >= 2) await say("It's super effective!");
  else if (eff < 1) await say("It's not very effective…");
}
function flashSprite(id) {
  const el = $(id);
  el.style.transition = 'none'; el.style.filter = 'brightness(3)';
  setTimeout(() => { el.style.transition = 'filter .3s'; el.style.filter = ''; }, 80);
}

async function enemyStrike() {
  const act = aiAction();
  const mv = act.move ?? bestMove(en(), me()).mv;
  await doMove(en(), me(), mv, false);
  if (me().hp <= 0) return myFainted();
  return false;
}

// ---------- catching ----------
async function ballTurn(key) {
  ctx.save.balls[key]--;
  const E = en();
  SFX.throwBall();
  await say(`${ctx.save.name} threw a ${BALLS[key].label.toUpperCase()}!`);
  $('sprEnemy').style.opacity = 0.15;
  // sleeping wilds are twice as easy to catch (official status bonus)
  const sleepBonus = B.wildRef?.sleeping ? 2 : 1;
  const { caught, shakes } = tryCapture(E, BALLS[key].mult * sleepBonus);
  for (let i = 0; i < (caught ? 3 : shakes); i++) {
    SFX.ballShake();
    await say(`…${'tick'.repeat(1)}${i + 1}…`);
  }
  if (caught) {
    SFX.catchClick();
    setTimeout(() => SFX.caught(), 500);
    await say(`Gotcha! ${E.name.toUpperCase()} was caught!`);
    ctx.onCaught(E.id);
    ctx.addCaught(E);
    if (B.wildRef?.legendary || E.lvl >= 60) ctx.toast(`⭐ ${E.name} caught!`);
    return finish('caught');
  }
  $('sprEnemy').style.opacity = 1;
  SFX.breakout();
  await say(`Oh no! The POKéMON broke free!`);
  if (await enemyStrike()) return;
  endTurn();
}

// ---------- escapes ----------
async function tryRun() {
  clearMenu();
  B.runTries++;
  const M = me(), E = en();
  const odds = Math.min(0.95, 0.55 + (M.spe - E.spe) / 200 + B.runTries * 0.12);
  if (Math.random() < odds) {
    await say('Got away safely!');
    return finish('ran');
  }
  await say("Can't escape!");
  if (await enemyStrike()) return;
  endTurn();
}

// ---------- faints / exp / levels / evolution ----------
async function enemyFainted() {
  const E = en();
  $('sprEnemy').style.opacity = 0;
  SFX.faint();
  await say(`${E.name.toUpperCase()} fainted!`);
  await grantExp(DEX[E.id - 1].exp, E.lvl);
  if (B.trainer) {
    const M = me();
    let next = -1, best = -Infinity;
    B.enemyTeam.forEach((p, i) => {
      if (p.hp > 0) {
        const s = bestMove(p, M).exp / M.maxHp - bestMove(M, p).exp / p.maxHp;
        if (s > best) { best = s; next = i; }
      }
    });
    if (next >= 0) {
      B.enIdx = next;
      setSprite($('sprEnemy'), en(), false);
      syncBars(me(), en());
      ctx.onSee(en().id);
      await say(`${B.trainer.name} sent out ${en().name.toUpperCase()}!`);
      endTurn();
      return true;
    }
    await say(`${ctx.save.name} defeated ${B.trainer.name}!`);
    finish('win');
    return true;
  }
  finish('win');
  return true;
}
async function myFainted() {
  $('sprMe').style.opacity = 0;
  SFX.faint();
  await say(`${me().name.toUpperCase()} fainted!`);
  if (ctx.save.party.some((p) => p.hp > 0)) {
    $('bmsg').textContent = 'Choose your next POKéMON!';
    switchMenu(true);
    return true;
  }
  await say(`${ctx.save.name} is out of usable POKéMON!`);
  await say(`${ctx.save.name} blacked out…`);
  finish('lose');
  return true;
}
async function doForcedSwitch(i) {
  clearMenu();
  B.myIdx = i;
  setSprite($('sprMe'), me(), true);
  syncBars(me(), en());
  await say(`Go! ${me().name.toUpperCase()}!`);
  mainMenu();
}

async function grantExp(baseExp, faintedLvl) {
  const M = me();
  if (M.lvl >= 100) return;
  const gain = expGain(baseExp, faintedLvl);
  M.exp += gain;
  M.friend = Math.min(255, (M.friend ?? 70) + 2); // victories build friendship
  await say(`${M.name.toUpperCase()} gained ${gain} EXP!`);
  while (M.lvl < 100 && M.exp >= expForLevel(M.lvl + 1)) {
    M.lvl++;
    M.friend = Math.min(255, (M.friend ?? 70) + 3);
    recalcStats(M);
    syncBars(M, en());
    SFX.levelup();
    await say(`${M.name.toUpperCase()} grew to Lv${M.lvl}!`);
    for (const mv of movesAtLevel(M, M.lvl)) await learnMove(M, mv);
    const sp = DEX[M.id - 1];
    if (sp.evo && M.lvl >= sp.evo.lvl) await evolve(M, sp.evo.to);
  }
  syncBars(M, en());
}
function learnMove(M, mv) {
  return new Promise(async (res) => {
    if (M.moves.includes(mv)) return res();
    if (M.moves.length < 4) {
      M.moves.push(mv); M.pp[mv] = MOVES[mv].pp;
      await say(`${M.name.toUpperCase()} learned ${moveName(mv).toUpperCase()}!`);
      return res();
    }
    await say(`${M.name.toUpperCase()} wants to learn ${moveName(mv).toUpperCase()}! Forget a move?`);
    setMenu([
      ...M.moves.map((old) => ({
        label: `forget ${moveName(old)}`,
        sub: `${MOVES[old].t} · ${MOVES[old].p} pw`,
        fn: async () => {
          clearMenu();
          M.moves[M.moves.indexOf(old)] = mv;
          delete M.pp[old]; M.pp[mv] = MOVES[mv].pp;
          await say(`…and learned ${moveName(mv).toUpperCase()}!`);
          res();
        },
      })),
      { label: `keep current moves`, fn: async () => { clearMenu(); await say(`Skipped ${moveName(mv).toUpperCase()}.`); res(); } },
    ]);
  });
}
async function evolve(M, toName) {
  const target = DEX.find((d) => d.name === toName);
  if (!target) return;
  await say(`What? ${M.name.toUpperCase()} is evolving!`);
  M.id = target.id;
  M.name = displayName(target);
  M.types = target.types;
  recalcStats(M);
  setSprite($('sprMe'), M, true);
  syncBars(M, en());
  ctx.onSee(M.id); ctx.onCaught(M.id);
  await say(`Congratulations! It evolved into ${M.name.toUpperCase()}!`);
}

function endTurn() {
  if (!B.done) mainMenu();
}
function finish(outcome) {
  B.done = true;
  SFX.bgm('world');
  const resolve = B.resolve;
  setTimeout(() => {
    $('battle').classList.add('hidden');
    $('sprEnemy').style.opacity = 1; $('sprMe').style.opacity = 1;
    queue = []; pumping = false;
    resolve({ outcome });
  }, 700);
}
