// HUD + modal UIs: Pokédex (seen/caught %), party & IV summary, PC box, maps.
import {
  DEX, sprFront, sprArt, displayName, TYPE_COLORS, MOVES, moveName,
  expForLevel, NATURES, rarityOf,
} from './data.js';
import { showdownUrl } from './anim-sprites.js';
import { SFX } from './audio.js';

const $ = (id) => document.getElementById(id);
let S = null; // save ref
let boxView = false;
let dexBuilt = false;

export function initUI(save) {
  S = save;
  document.querySelectorAll('[data-close]').forEach((b) => {
    b.onclick = () => b.closest('.modal').classList.add('hidden');
  });
  $('btnBoxToggle').onclick = () => { boxView = !boxView; renderPartyList(); };
}

// ---------- HUD ----------
export function refreshPartyBar() {
  const bar = $('partybar');
  bar.innerHTML = '';
  for (const p of S.party) {
    const d = document.createElement('div');
    d.className = 'pslot';
    const f = Math.max(0, p.hp / p.maxHp);
    d.innerHTML = `<img src="${sprFront(p.id, p.shiny)}" alt="">
      <div><div>${p.name.toUpperCase()} <span style="opacity:.7">Lv${p.lvl}</span></div>
      <div class="hpw"><div class="hpf" style="width:${f * 100}%;
        background:${f > 0.5 ? '#58c858' : f > 0.2 ? '#f8c838' : '#e84848'}"></div></div></div>`;
    bar.appendChild(d);
  }
}
export function setLocation(text) { $('locname').textContent = text; }
export function showPrompt(text) {
  const p = $('prompt');
  if (text) { p.textContent = text; p.classList.remove('hidden'); }
  else p.classList.add('hidden');
}
let toastTimer = null;
export function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = 0; }, 2600);
}

// ---------- Pokédex ----------
export function dexCounts() {
  const seen = S.seen.reduce((a, b) => a + b, 0);
  const caught = S.caught.reduce((a, b) => a + b, 0);
  return { seen, caught };
}
export function openDex() {
  if (!dexBuilt) buildDexGrid();
  refreshDexGrid();
  const { seen, caught } = dexCounts();
  $('dexstats').textContent =
    `SEEN ${seen}/898 (${(seen / 8.98).toFixed(1)}%) · CAUGHT ${caught}/898 (${(caught / 8.98).toFixed(1)}%)`;
  $('dexmodal').classList.remove('hidden');
}
function buildDexGrid() {
  dexBuilt = true;
  const grid = $('dexgrid');
  for (const sp of DEX) {
    const c = document.createElement('div');
    c.className = 'dexcell unseen';
    c.id = `dex${sp.id}`;
    c.innerHTML = `<img loading="lazy" src="${sprFront(sp.id)}" alt="">
      <div class="no">#${String(sp.id).padStart(3, '0')}</div><div class="ball hidden">●</div>`;
    c.onclick = () => showDexDetail(sp);
    grid.appendChild(c);
  }
}
function refreshDexGrid() {
  for (const sp of DEX) {
    const c = $(`dex${sp.id}`);
    c.classList.toggle('unseen', !S.seen[sp.id - 1]);
    c.classList.toggle('caught', !!S.caught[sp.id - 1]);
    const ball = c.querySelector('.ball');
    ball.classList.toggle('hidden', !S.caught[sp.id - 1]);
    ball.style.color = '#e84848';
  }
}
const typeTag = (t) =>
  `<span class="typetag" style="background:${TYPE_COLORS[t]}">${t}</span>`;
function showDexDetail(sp) {
  const d = $('dexdetail');
  if (!S.seen[sp.id - 1]) {
    d.innerHTML = `<img src="${sprArt(sp.id)}" style="filter:brightness(0);opacity:.5">
      <h3 style="text-align:center">??? — Not yet seen</h3>`;
    return;
  }
  SFX.cry(sp.id); // the dex plays each Pokémon's official cry
  const genderTxt = sp.gr === -1 ? 'Genderless'
    : `♀ ${(sp.gr / 8 * 100).toFixed(1)}% / ♂ ${((8 - sp.gr) / 8 * 100).toFixed(1)}%`;
  const fullHpPct = Math.min(100, (sp.cr / 3 / 255) * 100);
  d.innerHTML = `
    <img src="${sprArt(sp.id)}">
    <div style="text-align:center"><img src="${showdownUrl(sp.id)}"
      onerror="this.style.display='none'" style="width:64px;height:64px;object-fit:contain"></div>
    <h3 style="text-align:center">#${sp.id} ${displayName(sp).toUpperCase()}
      ${S.caught[sp.id - 1] ? '<span style="color:#e84848">●</span>' : ''}</h3>
    <div style="text-align:center;margin:4px 0">${sp.types.map(typeTag).join('')}</div>
    <p style="font-style:italic">${S.caught[sp.id - 1] ? sp.flavor : 'Catch it to record its dex entry.'}</p>
    <hr style="margin:8px 0">
    <b>Base stats:</b> HP ${sp.bs.hp} · Atk ${sp.bs.atk} · Def ${sp.bs.def} ·
      SpA ${sp.bs.spa} · SpD ${sp.bs.spd} · Spe ${sp.bs.spe}
    <br><b>Catch rate:</b> ${sp.cr}/255 (~${fullHpPct.toFixed(1)}% per Poké Ball at full HP)
    <br><b>Encounter rarity:</b> ${rarityOf(sp)}
    <br><b>Gender ratio:</b> ${genderTxt}
    ${sp.leg || sp.myth ? '<br><b style="color:#a060e0">⭐ Legendary/Mythical</b>' : ''}`;
}

// ---------- party / box ----------
export function openParty() {
  boxView = false;
  renderPartyList();
  $('partymodal').classList.remove('hidden');
}
function renderPartyList() {
  $('partyTitle').textContent = boxView ? 'PC BOX' : 'PARTY';
  $('btnBoxToggle').textContent = boxView ? 'VIEW PARTY' : 'VIEW PC BOX';
  $('boxcount').textContent = `Box: ${S.box.length} stored`;
  const list = $('partylist');
  list.innerHTML = '';
  const src = boxView ? S.box : S.party;
  if (!src.length) list.innerHTML = '<p style="padding:12px">Empty.</p>';
  src.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'partyrow' + (!boxView && i === 0 ? ' lead' : '');
    const f = Math.max(0, p.hp / p.maxHp);
    row.innerHTML = `<img src="${sprFront(p.id, p.shiny)}">
      <div class="grow">${p.shiny ? '✨' : ''}${p.name.toUpperCase()} ${p.gender}
        <span style="opacity:.6">Lv${p.lvl}</span><br>
        <span style="font-weight:normal">${p.types.map(typeTag).join('')}</span></div>
      <div class="hpw"><div class="hpf" style="width:${f * 100}%"></div></div>`;
    row.onclick = () => showSummary(p, i);
    list.appendChild(row);
  });
}
function showSummary(p, i) {
  const sum = $('summary');
  const lo = expForLevel(p.lvl), hi = expForLevel(p.lvl + 1);
  const [up, down] = NATURES[p.nature] ?? [];
  const ivBar = (lbl, v) => `<div class="ivrow"><span class="lbl">${lbl}</span>
    <div class="barw"><div class="barf" style="width:${(v / 31) * 100}%"></div></div>
    <span>${v}/31</span></div>`;
  sum.innerHTML = `
    <img src="${sprArt(p.id)}">
    <h3 style="text-align:center">${p.shiny ? '✨' : ''}${p.name.toUpperCase()} ${p.gender} — Lv${p.lvl}</h3>
    <div style="text-align:center">${p.types.map(typeTag).join('')}</div>
    <p><b>Nature:</b> ${p.nature}${up ? ` (+${up}/−${down})` : ' (neutral)'}
    <br><b>Friendship:</b> ${'♥'.repeat(Math.max(1, Math.round((p.friend ?? 70) / 51)))}
      <span style="opacity:.6">(${p.friend ?? 70}/255)</span>
    <br><b>HP:</b> ${Math.max(0, p.hp)}/${p.maxHp}
    · <b>EXP:</b> ${p.exp - lo}/${hi - lo} to next</p>
    <b>Stats:</b> Atk ${p.atk} · Def ${p.def} · SpA ${p.spa} · SpD ${p.spd} · Spe ${p.spe}
    <hr style="margin:6px 0"><b>IVs</b>
    ${ivBar('HP', p.ivs.hp)}${ivBar('Attack', p.ivs.atk)}${ivBar('Defense', p.ivs.def)}
    ${ivBar('Sp. Atk', p.ivs.spa)}${ivBar('Sp. Def', p.ivs.spd)}${ivBar('Speed', p.ivs.spe)}
    <hr style="margin:6px 0"><b>Moves</b><br>
    ${p.moves.map((m) => `${typeTag(MOVES[m].t)} ${moveName(m)} — ${MOVES[m].p} pw,
      PP ${p.pp[m] ?? 0}/${MOVES[m].pp}`).join('<br>')}
    <div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap" id="sumBtns"></div>`;
  const btns = $('sumBtns');
  const mk = (label, fn, cls = 'btn alt') => {
    const b = document.createElement('button');
    b.className = cls; b.style.fontSize = '11px'; b.textContent = label; b.onclick = fn;
    btns.appendChild(b);
  };
  if (!boxView) {
    if (i > 0) mk('MAKE LEAD', () => { S.party.splice(i, 1); S.party.unshift(p); renderPartyList(); refreshPartyBar(); });
    if (S.party.length > 1) mk('SEND TO BOX', () => { S.party.splice(i, 1); S.box.push(p); renderPartyList(); refreshPartyBar(); });
  } else if (S.party.length < 6) {
    mk('ADD TO PARTY', () => { S.box.splice(i, 1); S.party.push(p); renderPartyList(); refreshPartyBar(); });
  }
}

export function anyModalOpen() {
  return ['dexmodal', 'partymodal', 'mapmodal'].some((id) => !$(id).classList.contains('hidden'));
}
export function closeModals() {
  ['dexmodal', 'partymodal', 'mapmodal'].forEach((id) => $(id).classList.add('hidden'));
}
