import puppeteer from './node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import fs from 'fs';
import path from 'path';

const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] ? `-${process.argv[3]}` : '';
const outDir = './temporary screenshots';

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Auto-increment filename
let n = 1;
while (fs.existsSync(path.join(outDir, `screenshot-${n}${label}.png`))) n++;
const outPath = path.join(outDir, `screenshot-${n}${label}.png`);

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();

console.log(`Screenshot saved: ${outPath}`);
