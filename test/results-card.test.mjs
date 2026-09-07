import {JSDOM} from 'jsdom';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url).pathname,'utf8');
const opts={runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,storageQuota:10000000};
const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1;}else console.log('ok  ',m);};

// A v2 state with all 3 blocks scored, phase set to Cooldown (index 7).
function seededState(){
  return {
    v:2,
    phase:7,
    teams:['Red','Blue'],
    members:[['Ann','Bea','Cat'],['Don','Eve','Flo']],
    timers:{},
    warm:[false,false,false,false,false],
    cool:[false,false,false,false,false,false],
    resets:{all:0,b1:0,b2:0,b3:0},
    b1:[{legs:5,runner:0},{legs:4,runner:2}],
    b2:{counts:[[75,50,50,20,30,15],[70,50,50,20,30,10]],fin:[300000,null]},
    b3:{home:[65000,70000]},
    room:null,
    own:{host:true,team:[true,true]}
  };
}

// Seed localStorage, then evaluate the inline script so it loads that state.
const dom=new JSDOM(html,opts);
dom.window.localStorage.setItem('team-training-v1',JSON.stringify(seededState()));
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
dom.window.eval(script);
const d=dom.window.document;
const $=s=>d.querySelector(s);
const txt=()=>d.getElementById('app').textContent;

ok(txt().includes('Cooldown'),'renders the Cooldown screen');
ok($('.rescard'),'results card is present');
ok(txt().includes('Red'),'card shows team 0 name');
ok(txt().includes('Blue'),'card shows team 1 name');
ok(txt().includes('Ann')&&txt().includes('Bea')&&txt().includes('Cat'),'card shows team 0 members');
ok(txt().includes('Don')&&txt().includes('Eve')&&txt().includes('Flo'),'card shows team 1 members');
ok(/wins \d-\d\.|Level on blocks won\.|No block scored yet\./.test(txt()),'card shows a verdict line');
ok(!d.querySelector('main > details'),'the block-screen scoreboard details is not on Cooldown');

// Share results: navigator.share present -> used with a text summary.
let sharedArg=null;
dom.window.navigator.share=(arg)=>{sharedArg=arg;return Promise.resolve();};
const shareBtn=$('[data-a="share"]');
ok(shareBtn,'share button is present');
shareBtn.click();
ok(sharedArg&&typeof sharedArg.text==='string'&&sharedArg.text.length>0,'share was called with a text summary');
ok(sharedArg.title==='Team Training results','share was called with a title');
ok(sharedArg.text.includes('Red')&&sharedArg.text.includes('Blue'),'share text names both teams');
ok(sharedArg.text.includes('Ann, Bea, Cat'),'share text lists team 0 members');
ok(sharedArg.text.includes('Don, Eve, Flo'),'share text lists team 1 members');
ok(/Block 1/.test(sharedArg.text)&&/Block 2/.test(sharedArg.text)&&/Block 3/.test(sharedArg.text),'share text has all 3 block lines');
ok(/Blocks won: \d - \d/.test(sharedArg.text),'share text has blocks-won line');

process.exit(process.exitCode||0);
