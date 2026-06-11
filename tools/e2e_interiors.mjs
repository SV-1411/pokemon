// Interiors e2e: Pokécenter (nurse dialogue + heal), exit, gym (leader prompt).
import puppeteer from 'puppeteer-core';
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new',
  args: ['--window-size=1100,700'],
  defaultViewport: { width: 1100, height: 700 },
  protocolTimeout: 240000,
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await page.goto('http://localhost:8128/index.html?autotest&nograss&nobloom', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__game, { timeout: 60000 });
await sleep(2000);

const prompt = () => page.evaluate(() => document.getElementById('prompt').textContent);
const inside = () => page.evaluate(() => !!window.__game.interiors.active);
const dialogOpen = () => page.evaluate(() => !document.getElementById('dialog').classList.contains('hidden'));
const tp = (x, z) => page.evaluate(([a, b]) => window.__game.player.setPosition(a, b), [x, z]);
async function closeDialogs() {
  for (let i = 0; i < 12 && await dialogOpen(); i++) { await page.keyboard.press('e'); await sleep(420); }
}
async function walkOut() {
  for (let i = 0; i < 14 && await inside(); i++) {
    await page.keyboard.down('s'); await sleep(450); await page.keyboard.up('s');
  }
}

// --- Pokécenter ---
await tp(-309, 525 + 7);
await sleep(600);
console.log('AT PC DOOR:', await prompt());
await page.keyboard.press('e');
await sleep(800);
console.log('INSIDE CENTER:', await inside());
await page.screenshot({ path: 'D:/pokemon-battle/smoke_interior_center.png' });
await page.keyboard.down('w'); await sleep(900); await page.keyboard.up('w');
await sleep(300);
console.log('AT COUNTER:', await prompt());
await page.keyboard.press('e');
await sleep(500);
console.log('NURSE SAYS:', await page.evaluate(() => document.getElementById('dialogText').textContent));
await page.screenshot({ path: 'D:/pokemon-battle/smoke_nurse.png' });
await closeDialogs();
// step away from the counter so E doesn't re-trigger, then leave
await page.keyboard.down('s'); await sleep(400); await page.keyboard.up('s');
await walkOut();
console.log('EXITED CENTER:', !(await inside()));

// --- Gym ---
await tp(-309 + 13, 525 + 13);
await sleep(600);
console.log('AT GYM DOOR:', await prompt());
await page.keyboard.press('e');
await sleep(800);
console.log('INSIDE GYM:', await inside());
await page.screenshot({ path: 'D:/pokemon-battle/smoke_gym.png' });
await page.keyboard.down('w'); await sleep(2800); await page.keyboard.up('w');
await sleep(300);
console.log('AT FAR END:', await prompt());
await page.screenshot({ path: 'D:/pokemon-battle/smoke_gym_leader.png' });
await walkOut();
console.log('EXITED GYM:', !(await inside()));
console.log('MONEY CHIP:', await page.evaluate(() => document.getElementById('moneychip').textContent));
console.log('PAGE ERRORS:', errors.length ? errors : 'none');
await browser.close();
