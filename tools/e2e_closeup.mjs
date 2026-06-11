// Close-up shots: the new character model + an anime cottage.
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
await page.goto('http://localhost:8128/index.html?autotest&nograss&nobloom', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__game, { timeout: 60000 });
await sleep(2000);

// open ground, camera north of the player, player facing the camera
await page.evaluate(() => {
  const g = window.__game;
  g.player.setPosition(-309 + 70, 525 + 50);
  g.player.heading = Math.PI;
  g.player.camYaw = 0;
  g.player.camPitch = 0.14;
  g.player.camDist = 11;
  g.atmosphere.time = 10;
  g.atmosphere.weather = 'clear'; g.atmosphere.applyWeatherVisuals(); g.atmosphere.nextRoll = 999;
});
await sleep(1500);
await page.screenshot({ path: 'D:/pokemon-battle/smoke_closeup.png' });
// and one of a village house: hop to a road midpoint cottage
await page.evaluate(() => {
  const g = window.__game;
  g.player.camDist = 22; g.player.camPitch = 0.3;
});
await sleep(800);
await page.screenshot({ path: 'D:/pokemon-battle/smoke_closeup2.png' });
await browser.close();
console.log('done');
