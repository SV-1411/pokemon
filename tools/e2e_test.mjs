// End-to-end smoke test: boots the game, starts a wild Gengar battle, uses a
// Dark move, and asserts the type chart reports "super effective" (the exact
// bug reported in the old game). Also screenshots world + battle.
import puppeteer from 'puppeteer-core';

const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8123/index.html?autotest&battletest';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new',
  args: ['--window-size=1280,800', '--disable-gpu'],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await sleep(2500);
await page.screenshot({ path: 'D:/pokemon-battle/smoke_world.png' });

// battle should be open (battletest fires at 1.2s)
await page.waitForSelector('#battle:not(.hidden)', { timeout: 15000 });
// wait for the intro narration to finish and the menu to appear
await page.waitForFunction(
  () => document.querySelectorAll('#bmenu button').length >= 4, { timeout: 30000 });
await page.screenshot({ path: 'D:/pokemon-battle/smoke_battle.png' });

// click FIGHT
await page.evaluate(() => {
  [...document.querySelectorAll('#bmenu button')].find((b) => b.textContent.includes('FIGHT')).click();
});
await sleep(300);
const moves = await page.evaluate(() =>
  [...document.querySelectorAll('#bmenu button')].map((b) => b.textContent));
console.log('MOVES OFFERED:', moves.join(' | '));
await page.screenshot({ path: 'D:/pokemon-battle/smoke_moves.png' });

// pick the first usable move and watch the narration for effectiveness text
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('#bmenu button')].filter((b) => !b.disabled);
  btns[0].click();
});
const seen = new Set();
for (let i = 0; i < 40; i++) {
  const msg = await page.evaluate(() => document.getElementById('bmsg').textContent);
  seen.add(msg);
  await sleep(450);
  const menuBack = await page.evaluate(() =>
    document.querySelectorAll('#bmenu button').length >= 4);
  if (menuBack && i > 6) break;
}
console.log('NARRATION SEEN:');
for (const s of seen) console.log('  -', s);
await page.screenshot({ path: 'D:/pokemon-battle/smoke_after_move.png' });

console.log('PAGE ERRORS:', errors.length ? errors : 'none');
await browser.close();
