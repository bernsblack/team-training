import {chromium, devices} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1;}else console.log('ok  ',m);};

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const url='file://'+path.join(__dirname,'..','index.html');
const shotsDir=path.join(__dirname,'..','test-shots');
fs.mkdirSync(shotsDir,{recursive:true});

const browser=await chromium.launch();
const ctx=await browser.newContext({...devices['iPhone 13'], hasTouch:true});
const page=await ctx.newPage();
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
await page.goto(url);
await page.waitForTimeout(500);

// go to Block 2
await page.click('[data-a="goto"][data-i="4"]');
await page.waitForTimeout(200);

const boxes=await page.$$eval('.rep button',els=>els.map(el=>{
  const r=el.getBoundingClientRect();
  return {w:r.width,h:r.height,text:el.textContent};
}));

ok(boxes.length>0,'found .rep buttons');
boxes.forEach(b=>{
  ok(b.h>=56,`button "${b.text}" height >= 56px (got ${b.h})`);
  ok(b.w>=56,`button "${b.text}" width >= 56px (got ${b.w})`);
});

const shotPath=path.join(shotsDir,'block2-tap-targets.png');
await page.screenshot({path:shotPath});
console.log('shot',shotPath);

await browser.close();
