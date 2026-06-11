// UI smoke test: Pokédex grid (898 cells), dex detail, party summary with IVs.
import puppeteer from 'puppeteer-core';
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new',
  args: ['--window-size=1280,800', '--disable-gpu'],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8128/index.html?autotest', { waitUntil: 'load', timeout: 60000 });
await sleep(2500);

await page.keyboard.press('x');
await sleep(1200);
const cells = await page.evaluate(() => document.querySelectorAll('.dexcell').length);
const stats = await page.evaluate(() => document.getElementById('dexstats').textContent);
console.log('DEX CELLS:', cells, '| HEADER:', stats);
await page.evaluate(() => document.getElementById('dex94').click()); // unseen gengar
const unseenTxt = await page.evaluate(() => document.getElementById('dexdetail').textContent.trim().slice(0, 40));
await page.evaluate(() => document.getElementById('dex4').click()); // caught charmander
const charTxt = await page.evaluate(() => document.getElementById('dexdetail').textContent.replace(/\s+/g, ' ').slice(0, 220));
console.log('UNSEEN ENTRY:', unseenTxt);
console.log('CHARMANDER ENTRY:', charTxt);
await page.screenshot({ path: 'D:/pokemon-battle/smoke_dex.png' });
await page.keyboard.press('x');
await sleep(300);

await page.keyboard.press('p');
await sleep(500);
await page.evaluate(() => document.querySelector('.partyrow').click());
await sleep(300);
const sum = await page.evaluate(() => document.getElementById('summary').textContent.replace(/\s+/g, ' ').slice(0, 260));
console.log('SUMMARY:', sum);
await page.screenshot({ path: 'D:/pokemon-battle/smoke_party.png' });

console.log('PAGE ERRORS:', errors.length ? errors : 'none');
await browser.close();
