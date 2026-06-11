// Boot triage: load the page, capture console + request failures, no evaluate.
import puppeteer from 'puppeteer-core';
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new',
  defaultViewport: { width: 640, height: 400 },
  protocolTimeout: 240000,
});
const page = await browser.newPage();
page.on('console', (m) => console.log('CONSOLE:', m.type(), m.text().slice(0, 300)));
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 400)));
page.on('requestfailed', (r) => console.log('REQFAIL:', r.url().slice(0, 120), r.failure()?.errorText));
await page.goto('http://localhost:8128/index.html?autotest&nograss&nobloom', { waitUntil: 'load', timeout: 60000 });
console.log('LOAD EVENT FIRED');
await sleep(25000);
console.log('done waiting');
await browser.close();
