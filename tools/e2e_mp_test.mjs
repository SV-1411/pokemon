// Multiplayer e2e: two browsers on one server. Verifies presence (they see
// each other), the challenge/accept flow, an authoritative PvP battle with
// real turns, and disconnect-forfeit.
import puppeteer from 'puppeteer-core';
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8128/index.html?autotest&nograss';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new',
  args: ['--window-size=1100,700'],
  defaultViewport: { width: 1100, height: 700 },
});
async function mkPage(tag) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log(`[${tag}] PAGEERROR:`, String(e).slice(0, 200)));
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  return page;
}
const p1 = await mkPage('P1');
await sleep(3000);
const p2 = await mkPage('P2');
await sleep(4000);

const net1 = await p1.evaluate(() => ({
  connected: window.__game.net.connected,
  remotes: [...window.__game.net.remotePlayers.values()].map((r) => r.name),
}));
const net2 = await p2.evaluate(() => ({
  connected: window.__game.net.connected,
  remotes: [...window.__game.net.remotePlayers.values()].map((r) => r.name),
}));
console.log('P1 sees:', JSON.stringify(net1));
console.log('P2 sees:', JSON.stringify(net2));

// nudge P2 so both trainers are visible in the shot, then challenge from P1
await p2.keyboard.down('a'); await sleep(400); await p2.keyboard.up('a');
await sleep(800);
await p1.screenshot({ path: 'D:/pokemon-battle/smoke_mp_world.png' });

const prompt1 = await p1.evaluate(() => document.getElementById('prompt').textContent);
console.log('P1 PROMPT:', prompt1);
await p1.keyboard.press('e');         // challenge
await sleep(800);
await p2.keyboard.press('y');         // accept
await sleep(1000);

const battleOpen = await Promise.all([p1, p2].map((p) =>
  p.evaluate(() => !document.getElementById('battle').classList.contains('hidden'))));
console.log('BATTLE OPEN (p1, p2):', battleOpen);

// auto-player: whenever a menu shows, click FIGHT then the first usable move
async function autoPlay(page, tag, ms) {
  const t0 = Date.now();
  const msgs = new Set();
  while (Date.now() - t0 < ms) {
    const state = await page.evaluate(() => {
      const hidden = document.getElementById('battle').classList.contains('hidden');
      const btns = [...document.querySelectorAll('#bmenu button')]
        .map((b) => ({ txt: b.textContent.trim(), dis: b.disabled }));
      return { hidden, btns, msg: document.getElementById('bmsg').textContent };
    });
    msgs.add(state.msg);
    if (state.hidden) break;
    const fight = state.btns.findIndex((b) => b.txt.startsWith('FIGHT'));
    const move = state.btns.findIndex((b) => !b.dis && b.txt.includes('pw'));
    const pick = state.btns.findIndex((b) => !b.dis && b.txt.includes('HP '));
    const idx = fight >= 0 ? fight : move >= 0 ? move : pick >= 0 ? pick : -1;
    if (idx >= 0) {
      await page.evaluate((i) => document.querySelectorAll('#bmenu button')[i].click(), idx);
    }
    await sleep(700);
  }
  return [...msgs];
}
const [log1] = await Promise.all([
  autoPlay(p1, 'P1', 90000),
  autoPlay(p2, 'P2', 90000),
  (async () => { await sleep(6000); await p1.screenshot({ path: 'D:/pokemon-battle/smoke_mp_battle.png' }); })(),
]);
console.log('P1 BATTLE LOG:');
for (const m of log1) console.log('  -', m);

const toast1 = await p1.evaluate(() => document.getElementById('toast').textContent);
const toast2 = await p2.evaluate(() => document.getElementById('toast').textContent);
console.log('P1 TOAST:', toast1, '| P2 TOAST:', toast2);

// disconnect test: new battle, then P2 vanishes mid-fight
await p1.keyboard.press('e'); await sleep(800);
await p2.keyboard.press('y'); await sleep(2500);
await p2.close();
await sleep(2500);
const endToast = await p1.evaluate(() => document.getElementById('toast').textContent);
const battleClosed = await p1.evaluate(() => document.getElementById('battle').classList.contains('hidden'));
console.log('AFTER P2 DISCONNECT — P1 toast:', endToast, '| battle closed:', battleClosed);
const remotesLeft = await p1.evaluate(() => window.__game.net.remotePlayers.size);
console.log('P1 remotePlayers after leave:', remotesLeft);

await browser.close();
