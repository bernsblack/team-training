import {JSDOM} from 'jsdom';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url).pathname,'utf8');
const opts={runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true};
const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1;}else console.log('ok  ',m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// jsdom has no PointerEvent constructor; dispatch a plain bubbling Event
// with the same type name, since the handlers only use ev.target.closest.
function fire(w,el,type){el.dispatchEvent(new w.Event(type,{bubbles:true}));}

function fresh(){
  const dom=new JSDOM(html,opts);
  return {dom,w:dom.window,d:dom.window.document};
}
const $=(d,s)=>d.querySelector(s);
const state=w=>JSON.parse(w.localStorage.getItem('team-training-v1'));

// ---- resetall: full 1.6s hold resets ----
{
  const {dom,w,d}=fresh();
  const click=s=>{const el=$(d,s); el.click();};
  // put some state in b1 so a reset is observable
  click('[data-a="goto"][data-i="2"]');
  click('[data-a="b1run"][data-t="0"]');
  ok(state(w).b1[0].runner===1,'setup: b1 has progress before reset');
  // go to cooldown to reach the reset-all button
  click('[data-a="goto"][data-i="7"]');
  const btn=$(d,'[data-hold="resetall"]');
  ok(!!btn,'resetall hold button renders');
  fire(w,btn,'pointerdown');
  await sleep(1600);
  fire(w,btn,'pointerup');
  ok(state(w).resets.all===1,'full hold on reset-all resets the session');
  ok(state(w).b1[0].runner===0,'session data cleared after full hold');
  dom.window.close();
}

// ---- resetall: early release cancels ----
{
  const {dom,w,d}=fresh();
  const click=s=>{const el=$(d,s); el.click();};
  click('[data-a="goto"][data-i="2"]');
  click('[data-a="b1run"][data-t="0"]');
  click('[data-a="goto"][data-i="7"]');
  const btn=$(d,'[data-hold="resetall"]');
  fire(w,btn,'pointerdown');
  await sleep(500);
  fire(w,btn,'pointerup');
  await sleep(1200); // well past HOLD_MS, to prove the timer was cancelled
  ok((state(w).resets.all||0)===0,'early release does not reset the session');
  ok(state(w).b1[0].runner===1,'session data untouched after early release');
  dom.window.close();
}

// ---- resetblock: full hold resets only that block ----
{
  const {dom,w,d}=fresh();
  const click=s=>{const el=$(d,s); el.click();};
  click('[data-a="goto"][data-i="2"]');
  click('[data-a="b1run"][data-t="0"]');
  const btn=$(d,'[data-hold="resetblock"]');
  ok(!!btn,'resetblock hold button renders in block 1');
  fire(w,btn,'pointerdown');
  await sleep(1600);
  fire(w,btn,'pointerup');
  ok(state(w).resets.b1===1,'full hold on reset-block bumps resets.b1');
  ok(state(w).b1[0].runner===0&&state(w).b1[0].legs===0,'block 1 data cleared after full hold');
  dom.window.close();
}

// ---- resetblock: pointercancel also cancels ----
{
  const {dom,w,d}=fresh();
  const click=s=>{const el=$(d,s); el.click();};
  click('[data-a="goto"][data-i="2"]');
  click('[data-a="b1run"][data-t="0"]');
  const btn=$(d,'[data-hold="resetblock"]');
  fire(w,btn,'pointerdown');
  await sleep(500);
  fire(w,btn,'pointercancel');
  await sleep(1200);
  ok((state(w).resets.b1||0)===0,'pointercancel before hold completes does not reset');
  dom.window.close();
}

// ---- fill style progresses during a hold, then clears on cancel ----
{
  const {dom,w,d}=fresh();
  const click=s=>{const el=$(d,s); el.click();};
  click('[data-a="goto"][data-i="7"]');
  const btn=$(d,'[data-hold="resetall"]');
  const fill=btn.querySelector('.holdfill');
  fire(w,btn,'pointerdown');
  await sleep(400);
  const midWidth=parseFloat(fill.style.width)||0;
  ok(midWidth>0&&midWidth<100,'fill width grows partway through the hold: '+fill.style.width);
  fire(w,btn,'pointerup');
  ok(fill.style.width==='0%','fill resets to 0% after release');
  dom.window.close();
}

// ---- confirmUntil / two-tap path is gone ----
{
  const {dom,w,d}=fresh();
  ok(!/confirmUntil/.test(html),'confirmUntil removed from source');
  ok(!html.includes('setTimeout(render,3100)'),'the 2-tap setTimeout(render,3100) path is removed');
  dom.window.close();
}

process.exit(process.exitCode||0);
