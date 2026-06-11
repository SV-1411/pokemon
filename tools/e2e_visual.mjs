// Visual states test: day, night (lamps), rain — screenshots each.
import puppeteer from 'puppeteer-core';
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new',
  args: ['--window-size=1280,800'],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8123/index.html?autotest&nograss', { waitUntil: 'load', timeout: 60000 });
await sleep(4000);

// walk forward a moment so the follower settles + sprites stream in
await page.keyboard.down('w');
await sleep(2200);
await page.keyboard.up('w');
await sleep(1200);
await page.screenshot({ path: 'D:/pokemon-battle/smoke_day.png' });

await page.evaluate(() => { window.__game.atmosphere.time = 21.0; });
await sleep(900);
await page.screenshot({ path: 'D:/pokemon-battle/smoke_night.png' });

await page.evaluate(() => {
  const a = window.__game.atmosphere;
  a.time = 15.0; a.weather = 'rain'; a.applyWeatherVisuals(); a.nextRoll = 999;
});
await sleep(900);
await page.screenshot({ path: 'D:/pokemon-battle/smoke_rain.png' });

const label = await page.evaluate(() => window.__game.atmosphere.label());
console.log('ATMO LABEL:', label);
console.log('PAGE ERRORS:', errors.length ? errors : 'none');
await browser.close();
