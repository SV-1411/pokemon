// City realism check: teleport into Bengaluru, shoot day + night, then a
// battle for the painted GBA backdrop.
import puppeteer from 'puppeteer-core';
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new',
  args: ['--window-size=1280,800'],
  defaultViewport: { width: 1280, height: 800 },
  protocolTimeout: 300000,
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
// nobloom: software WebGL in headless chokes on the bloom pass; real GPUs are fine
await page.goto('http://localhost:8128/index.html?autotest&nograss&nobloom', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__game, { timeout: 60000 });
await sleep(3000);

// stand at the east street entrance looking across the plaza
await page.evaluate(() => {
  const g = window.__game;
  g.player.setPosition(-309 + 19, 525 + 1);
  g.player.camYaw = -Math.PI / 2;
  g.player.camPitch = 0.30;
  g.player.camDist = 30;
  g.atmosphere.time = 10.5;
  g.atmosphere.weather = 'clear'; g.atmosphere.applyWeatherVisuals(); g.atmosphere.nextRoll = 999;
});
await sleep(1800);
await page.screenshot({ path: 'D:/pokemon-battle/smoke_city_day.png' });

await page.evaluate(() => { window.__game.atmosphere.time = 19.8; });
await sleep(1200);
await page.screenshot({ path: 'D:/pokemon-battle/smoke_city_night.png' });

// battle backdrop
await page.evaluate(() => { window.__game.atmosphere.time = 11; });
await page.keyboard.press('e'); // maybe nothing near; force a battle via spawn check
await sleep(800);
const inBattle = await page.evaluate(() => !document.getElementById('battle').classList.contains('hidden'));
if (!inBattle) {
  await page.evaluate(() => window.__test_battle?.());
}
await sleep(4500);
await page.screenshot({ path: 'D:/pokemon-battle/smoke_battle_bg.png' });

console.log('PAGE ERRORS:', errors.length ? errors : 'none');
await browser.close();
