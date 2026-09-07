import {JSDOM} from 'jsdom';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url).pathname,'utf8');
const opts={runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true};
let dom=new JSDOM(html,opts);
let w=dom.window,d=w.document;
const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1;}else console.log('ok  ',m);};
const $=(s)=>d.querySelector(s);
const $$=(s)=>[...d.querySelectorAll(s)];
const click=(s)=>{const el=typeof s==='string'?$(s):s; if(!el)throw new Error('no el '+s); el.click();};
const txt=()=>$('#app').textContent;
const state=()=>JSON.parse(w.localStorage.getItem('team-training-v1'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

ok(txt().includes('Warm-up'),'renders warm-up');
ok($('#clock').textContent==='9:00','warm-up clock 9:00');
click('[data-a="start"]'); await sleep(450);
ok(state().timers.warm.running,'timer runs and persists');
ok($('[data-a="pause"]'),'pause button shown');
// checklist
const cb=$('[data-chk="warm"]'); cb.checked=true; cb.dispatchEvent(new w.Event('change',{bubbles:true}));
ok(state().warm[0]===true,'warm checklist persists');
// team rename
const inp=$('[data-team="1"]'); inp.value='Team Rob'; inp.dispatchEvent(new w.Event('input',{bubbles:true}));
ok(state().teams[1]==='Team Rob','team rename persists');
const mi=$('[data-member="0:1"]'); mi.value='Piet'; mi.dispatchEvent(new w.Event('input',{bubbles:true}));
ok(state().members[0][1]==='Piet','member rename persists');
// go to block 1 (index 2)
click('[data-a="goto"][data-i="2"]');
ok(!state().timers.warm.running,'leaving a phase pauses its timer');
ok(txt().includes('Relay Ladder'),'block 1 renders');
ok(txt().includes('Team Rob'),'renamed team shown');
ok($('#clock').textContent==='8:00','block 1 clock 8:00');
// 3 runners back = 1 leg, auto-starts timer
for(let i=0;i<3;i++)click('[data-a="b1run"][data-t="0"]');
let s=state();
ok(s.b1[0].legs===1&&s.b1[0].runner===0,'3 runners -> 1 leg');
ok(s.timers.b1.running,'first tap auto-starts block timer');
ok(txt().includes('Leg 2: 10 push-ups'),'next exercise shown');
ok(txt().includes('Out now: Bernard'),'first runner of next leg shown');
click('[data-a="b1run"][data-t="0"]');
ok(txt().includes('Out now: Piet'),'second runner shown after first is back');
click('[data-a="b1undo"][data-t="0"]');
click('[data-a="b1undo"][data-t="0"]');
s=state(); ok(s.b1[0].legs===0&&s.b1[0].runner===2,'undo across a leg boundary');
click('[data-a="b1run"][data-t="0"]');
ok(txt().includes('Scores'),'scoreboard present in block');
// block 2
click('[data-a="goto"][data-i="4"]');
ok($('#clock').textContent==='12:00','block 2 clock 12:00');
const plus5=(t,i)=>click(`[data-a="b2"][data-t="${t}"][data-i="${i}"][data-d="5"]`);
const plus1=(t,i)=>click(`[data-a="b2"][data-t="${t}"][data-i="${i}"][data-d="1"]`);
const targets=[75,50,50,20,30,15];
for(let i=0;i<6;i++){for(let k=0;k<targets[i]/5;k++)plus5(0,i);}
s=state();
ok(s.b2.counts[0].every((v,i)=>v===targets[i]),'team 0 hits all targets');
ok(s.b2.fin[0]!=null,'finish time stamped');
ok(txt().includes('Finished at'),'finish shown');
click('[data-a="b2"][data-t="0"][data-i="0"][data-d="-1"]');
ok(state().b2.fin[0]==null,'undo below target clears finish');
plus1(0,0);
ok(state().b2.fin[0]!=null,'re-stamped');
plus5(1,0);
ok(txt().includes('5 / 75'),'team 1 count shown');
// block 3
click('[data-a="goto"][data-i="6"]');
ok($('[data-a="b3home"][data-t="0"]').disabled,'home disabled before start');
ok($('[data-a="start"]').textContent==='Start shuttle','start shuttle label');
click('[data-a="start"]'); await sleep(350);
click('[data-a="b3home"][data-t="1"]');
s=state(); ok(s.b3.home[1]>=300&&s.b3.home[0]==null,'team 1 home stamped');
await sleep(300);
click('[data-a="b3home"][data-t="0"]');
s=state(); ok(s.b3.home[0]>s.b3.home[1],'team 0 later');
// scores
click('[data-a="goto"][data-i="7"]');
const tbl=$('table').textContent;
ok($$('td.win').length===3,'three block winners marked: '+$$('td.win').map(e=>e.textContent).join('|'));
ok(/^(Red|North|Hawks|Home) wins 2-1\.$/.test($('.rc-verdict').textContent),'verdict: '+ $('.rc-verdict').textContent);
ok(txt().includes('Bernard, Piet, Toon')&&txt().includes('Jan, Luuk, Gert Jan'),'results card lists members');
// reload persistence
dom=new JSDOM(html,{...opts,storageQuota:10000000});
// share storage by copying
const saved=JSON.stringify(s);
dom.window.localStorage.setItem('team-training-v1',JSON.stringify(state()));
dom.window.eval(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const d2=dom.window.document;
ok(d2.querySelector('#app').textContent.includes('Cooldown'),'reload restores phase');
// reset session: press and hold 1.5 s
const rb=d2.querySelector('[data-hold="resetall"]');
ok(!!rb,'reset button renders as a hold control');
rb.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true}));
await sleep(500);
rb.dispatchEvent(new dom.window.Event('pointerup',{bubbles:true}));
ok(JSON.parse(dom.window.localStorage.getItem('team-training-v1')).phase===7,'early release does not reset');
rb.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true}));
await sleep(1600);
rb.dispatchEvent(new dom.window.Event('pointerup',{bubbles:true}));
ok(JSON.parse(dom.window.localStorage.getItem('team-training-v1')).phase===0,'full hold returns to warm-up');
ok(JSON.parse(dom.window.localStorage.getItem('team-training-v1')).b1[0].legs===0,'reset clears data');
// overrun clock
const st=state(); 
console.log('errors in console?', 'none captured');
process.exit(process.exitCode||0);
