// PvP battle screen: same GBA overlay as battle.js, but every outcome comes
// from the server's event stream — this module only sends actions and renders.
import { MOVES, sprFront, sprBack, moveName, TYPE_COLORS } from './data.js';
import { paintBattleBg, animate, setSpriteImg, hitFX } from './battle.js';
import { showdownUrl } from './anim-sprites.js';
import { SFX } from './audio.js';

const $ = (id) => document.getElementById(id);

let queue = [], pumping = false;
function say(text) { return new Promise((res) => { queue.push({ text, res }); pump(); }); }
function pump() {
  if (pumping || !queue.length) return;
  pumping = true;
  const { text, res } = queue.shift();
  $('bmsg').textContent = text;
  setTimeout(() => { pumping = false; res(); pump(); }, 850);
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
function hpColor(f) { return f > 0.5 ? '#58c858' : f > 0.2 ? '#f8c838' : '#e84848'; }

let S = null; // pvp state

function syncBars() {
  const M = S.team[S.myIdx], O = S.opp;
  const fo = Math.max(0, O.hp / O.maxHp);
  $('infoEnemy').querySelector('.nm').textContent =
    `${O.name.toUpperCase()} ${O.gender}${O.shiny ? '✨' : ''}`;
  $('infoEnemy').querySelector('.lv').textContent = `Lv${O.lvl}`;
  const eb = $('infoEnemy').querySelector('.hpfill');
  eb.style.width = `${fo * 100}%`; eb.style.background = hpColor(fo);
  const fm = Math.max(0, M.hp / M.maxHp);
  $('infoMe').querySelector('.nm').textContent =
    `${M.name.toUpperCase()} ${M.gender}${M.shiny ? '✨' : ''}`;
  $('infoMe').querySelector('.lv').textContent = `Lv${M.lvl}`;
  const mb = $('infoMe').querySelector('.hpfill');
  mb.style.width = `${fm * 100}%`; mb.style.background = hpColor(fm);
  $('infoMe').querySelector('.hptext').textContent = `${Math.max(0, M.hp)}/${M.maxHp}`;
  $('infoMe').querySelector('.expfill').style.width = '0%';
}
function setSprites() {
  const M = S.team[S.myIdx], O = S.opp;
  setSpriteImg($('sprEnemy').querySelector('img'),
    [showdownUrl(O.id, { shiny: O.shiny }), sprFront(O.id, O.shiny)]);
  $('sprEnemy').style.opacity = O.hp > 0 ? 1 : 0;
  setSpriteImg($('sprMe').querySelector('img'),
    [showdownUrl(M.id, { back: true, shiny: M.shiny }), sprBack(M.id, M.shiny), sprFront(M.id, M.shiny)]);
  $('sprMe').style.opacity = M.hp > 0 ? 1 : 0;
}
function flash(id) {
  const el = $(id);
  el.style.transition = 'none'; el.style.filter = 'brightness(3)';
  setTimeout(() => { el.style.transition = 'filter .3s'; el.style.filter = ''; }, 80);
}

function mainMenu() {
  if (S.over) return;
  setMenu([
    { label: 'FIGHT', color: '#e84848', fn: fightMenu },
    { label: 'POKéMON', fn: switchMenu },
    { label: 'FORFEIT', fn: () => { clearMenu(); S.net.forfeit(); } },
    { label: '', disabled: true, fn: () => {} },
  ]);
}
function fightMenu() {
  const M = S.team[S.myIdx];
  const items = M.moves.map((mv) => {
    const d = MOVES[mv];
    return {
      label: moveName(mv),
      sub: `${d.t.toUpperCase()} · ${d.p} pw · PP ${M.pp[mv] ?? 0}/${d.pp}`,
      color: TYPE_COLORS[d.t],
      disabled: (M.pp[mv] ?? 0) <= 0,
      fn: () => act({ move: mv }),
    };
  });
  items.push({ label: '← BACK', fn: mainMenu });
  setMenu(items);
}
function switchMenu(forced) {
  const items = S.team.map((p, i) => ({
    label: `${p.name.toUpperCase()} Lv${p.lvl}`,
    sub: `HP ${Math.max(0, p.hp)}/${p.maxHp}`,
    disabled: p.hp <= 0 || i === S.myIdx,
    fn: () => {
      clearMenu();
      S.pendingIdx = i;
      if (forced) S.net.replace(i);
      else act({ switch: i });
    },
  }));
  if (!forced) items.push({ label: '← BACK', fn: mainMenu });
  setMenu(items);
}
function act(action) {
  clearMenu();
  if (action.switch !== undefined) S.pendingIdx = action.switch;
  S.net.action(action);
  $('bmsg').textContent = `Waiting for ${S.oppName}…`;
}

async function processEvents(events) {
  S.busy = true;
  let askMenu = true;
  for (const ev of events) {
    switch (ev.e) {
      case 'switch':
        if (ev.side === S.side) {
          if (S.pendingIdx !== null) { S.myIdx = S.pendingIdx; S.pendingIdx = null; }
          // trust server numbers for our active mon
          const mine = S.team[S.myIdx];
          mine.hp = ev.mon.hp;
          setSprites(); syncBars();
          await say(`Go! ${ev.mon.name.toUpperCase()}!`);
        } else {
          S.opp = ev.mon;
          setSprites(); syncBars();
          SFX.cry(ev.mon.id);
          await say(`${S.oppName} sent out ${ev.mon.name.toUpperCase()}!`);
        }
        break;
      case 'move': {
        const isMe = ev.side === S.side;
        const who = isMe ? S.team[S.myIdx] : S.opp;
        if (isMe && ev.mv !== 'struggle') who.pp[ev.mv] = Math.max(0, (who.pp[ev.mv] ?? 1) - 1);
        animate($(isMe ? 'sprMe' : 'sprEnemy'), isMe ? 'lunge-me' : 'lunge-en', 460);
        await say(`${who.name.toUpperCase()} used ${moveName(ev.mv).toUpperCase()}!`);
        break;
      }
      case 'miss': await say('But it missed!'); break;
      case 'immune': await say("It doesn't affect the target…"); break;
      case 'hit': {
        const mineHit = ev.side === S.side;
        if (mineHit) S.team[S.myIdx].hp = ev.hp; else S.opp.hp = ev.hp;
        flash(mineHit ? 'sprMe' : 'sprEnemy');
        animate($('bframe'), 'hit-shake', 420);
        hitFX(mineHit ? 'sprMe' : 'sprEnemy', '#ffffff', ev.dmg);
        SFX.hit(ev.eff);
        syncBars();
        if (ev.crit) await say('A critical hit!');
        if (ev.eff >= 2) await say("It's super effective!");
        else if (ev.eff > 0 && ev.eff < 1) await say("It's not very effective…");
        break;
      }
      case 'faint': {
        const mine = ev.side === S.side;
        if (mine) { S.team[S.myIdx].hp = 0; $('sprMe').style.opacity = 0; }
        else { S.opp.hp = 0; $('sprEnemy').style.opacity = 0; }
        SFX.faint();
        syncBars();
        await say(`${(mine ? S.team[S.myIdx] : S.opp).name.toUpperCase()} fainted!`);
        break;
      }
      case 'request_switch':
        if (ev.side === S.side) {
          $('bmsg').textContent = 'Choose your next POKéMON!';
          switchMenu(true);
          askMenu = false;
        } else {
          $('bmsg').textContent = `${S.oppName} is choosing the next POKéMON…`;
          askMenu = false;
        }
        break;
      case 'end':
        askMenu = false;
        break;
    }
  }
  S.busy = false;
  if (askMenu && !S.over) mainMenu();
}

export function startPvpBattle(net, start) {
  return new Promise(async (resolve) => {
    S = {
      net,
      side: start.side,
      oppName: start.oppName,
      team: start.yourTeam,
      opp: start.oppLead,
      myIdx: 0,
      pendingIdx: null,
      over: false,
      busy: false,
    };
    const chain = { p: Promise.resolve() };
    net.onEvents = (events) => { chain.p = chain.p.then(() => processEvents(events)); };
    net.onBattleEnd = (msg) => {
      chain.p = chain.p.then(async () => {
        S.over = true;
        SFX.bgm('world');
        clearMenu();
        await say(msg.youWon
          ? `You defeated ${S.oppName}!${msg.reason === 'disconnect' ? ' (opponent fled)' : ''}`
          : `You lost to ${S.oppName}…`);
        $('battle').classList.add('hidden');
        $('sprEnemy').style.opacity = 1; $('sprMe').style.opacity = 1;
        queue = []; pumping = false;
        net.onEvents = null; net.onBattleEnd = null;
        resolve({ youWon: msg.youWon, reason: msg.reason });
      });
    };

    $('bscene').style.backgroundImage = `url(${paintBattleBg('city')})`;
    $('bframe').style.background = '#000';
    $('battle').classList.remove('hidden');
    setSprites(); syncBars();
    animate($('sprMe'), 'enter-me', 600);
    animate($('sprEnemy'), 'enter-en', 600);
    SFX.encounter();
    SFX.bgm('battle');
    await say(`TRAINER ${S.oppName} wants to battle!`);
    SFX.cry(S.opp.id);
    await say(`${S.oppName} sent out ${S.opp.name.toUpperCase()}!`);
    await say(`Go! ${S.team[0].name.toUpperCase()}!`);
    mainMenu();
  });
}
