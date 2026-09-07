import {JSDOM} from 'jsdom';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url).pathname,'utf8');
const opts={runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true};
const KEY='team-training-v1';
const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1;}else console.log('ok  ',m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// jsdom has no AudioContext. Install a fake that records the frequency and
// the start/stop times of every oscillator created, on window.__tones.
function installFakeAudio(window){
  window.__tones=[];
  class FakeOsc{
    constructor(store){this.type='sine';this.frequency={value:0};this._store=store;}
    connect(){}
    start(t){this._start=t;}
    stop(t){this._stop=t;this._store.push({freq:this.frequency.value,start:this._start,dur:this._stop-this._start});}
  }
  class FakeGain{constructor(){this.gain={setValueAtTime(){},exponentialRampToValueAtTime(){}};}connect(){}}
  class FakeAudioContext{
    constructor(){this.state='running';this.destination={};this.currentTime=0;this._tones=window.__tones;}
    createOscillator(){return new FakeOsc(this._tones);}
    createGain(){return new FakeGain();}
    createBuffer(){return {};}
    createBufferSource(){return {buffer:null,connect(){},start(){}};}
    resume(){this.state='running';}
  }
  window.AudioContext=FakeAudioContext;
}

const near=(a,b,eps=0.005)=>Math.abs(a-b)<eps;

// ---- test 1: phase start plays a single 1200 Hz / 80 ms tick ----
{
  const dom=new JSDOM(html,opts);
  const w=dom.window,d=w.document;
  installFakeAudio(w);
  const $=(s)=>d.querySelector(s);
  ok($('#clock').textContent==='9:00','warm-up starts at 9:00');
  $('[data-a="start"]').click();
  ok(w.__tones.length===1,'fresh start plays exactly one tone: '+w.__tones.length);
  const t=w.__tones[0];
  ok(t.freq===1200,'phase-start tick is 1200 Hz: '+t.freq);
  ok(near(t.dur,0.08),'phase-start tick is 80 ms: '+t.dur);

  // Block 3: Start shuttle keeps the single tick, no countdown sequence.
  $('[data-a="goto"][data-i="6"]').click();
  ok($('[data-a="start"]').textContent==='Start shuttle','block 3 shows start shuttle');
  const before=w.__tones.length;
  $('[data-a="start"]').click();
  ok(w.__tones.length===before+1,'block 3 start adds exactly one tone, no countdown: '+(w.__tones.length-before));
  const bt=w.__tones[w.__tones.length-1];
  ok(bt.freq===1200,'block 3 shuttle start tick is 1200 Hz: '+bt.freq);
  ok(near(bt.dur,0.08),'block 3 shuttle start tick is 80 ms: '+bt.dur);

  // Resuming (not a fresh start) must not fire another tick.
  $('[data-a="pause"]').click();
  const before2=w.__tones.length;
  $('[data-a="start"]').click();
  ok(w.__tones.length===before2,'resuming a timer does not fire a phase-start tick');
}

// ---- test 2: 1 minute left plays a single 440 Hz / 300 ms low tone ----
{
  const remainMs=50000; // 50 s left, comfortably short of the 9 min duration
  const durMs=9*60000;
  const elapsedInitial=durMs-remainMs;
  const dom=new JSDOM(html,{...opts,beforeParse(window){
    installFakeAudio(window);
    window.localStorage.setItem(KEY,JSON.stringify({v:2,timers:{warm:{startAt:Date.now()-elapsedInitial,acc:0,running:true}}}));
  }});
  const w=dom.window,d=w.document;
  // Unlock audio without touching the timer: the room-pill toggle has no
  // effect on the clock.
  d.querySelector('[data-a="room"]').click();
  ok(w.__tones.length===0,'unlocking audio via the room toggle plays no tone');
  await sleep(500);
  const warns=w.__tones.filter(t=>t.freq===440);
  ok(warns.length===1,'exactly one 440 Hz tone at 1 minute left: '+warns.length);
  ok(near(warns[0].dur,0.3),'1-minute warning tone is 300 ms: '+warns[0].dur);
  ok(!w.__tones.some(t=>t.freq===880),'no time-up tones yet at 1 minute left');
}

// ---- test 3: time up plays 3 high tones then 1 long low tone ----
{
  const remainMs=150; // about to cross 0
  const durMs=9*60000;
  const elapsedInitial=durMs-remainMs;
  const dom=new JSDOM(html,{...opts,beforeParse(window){
    installFakeAudio(window);
    window.localStorage.setItem(KEY,JSON.stringify({v:2,timers:{warm:{startAt:Date.now()-elapsedInitial,acc:0,running:true}}}));
  }});
  const w=dom.window,d=w.document;
  d.querySelector('[data-a="room"]').click();
  await sleep(500);
  const highs=w.__tones.filter(t=>t.freq===880);
  const lows=w.__tones.filter(t=>t.freq===330);
  ok(highs.length===3,'time up plays 3 high (880 Hz) tones: '+highs.length);
  highs.forEach((t,i)=>ok(near(t.dur,0.22),'high tone '+i+' is 220 ms: '+t.dur));
  ok(lows.length===1,'time up plays exactly 1 long low (330 Hz) tone: '+lows.length);
  if(lows.length)ok(near(lows[0].dur,0.6),'the long low tone is 600 ms: '+lows[0].dur);
  if(lows.length&&highs.length)ok(lows[0].start>highs[highs.length-1].start,'the low tone starts after the high tones');
}

console.log('sounds tests complete');
process.exit(process.exitCode||0);
