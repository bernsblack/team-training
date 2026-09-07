import {JSDOM} from 'jsdom';
import fs from 'node:fs';
let html=fs.readFileSync(new URL('../index.html',import.meta.url).pathname,'utf8');
html=html.replace(/const SUPABASE_URL='[^']*';/,"const SUPABASE_URL='http://stub';").replace(/const SUPABASE_KEY='[^']*';/,"const SUPABASE_KEY='k';");
const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1;}else console.log('ok  ',m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ---- stub server shared by all phones ----
const server={rows:[],phones:[]};
function stubFor(phone){
  return {createClient(){return {
    channel(){const ch={on(ev,f,cb){phone.handler=cb;return ch;},subscribe(cb){setTimeout(()=>cb('SUBSCRIBED'),0);return ch;}};return ch;},
    removeChannel(){phone.handler=null;},
    from(){return {
      select(){return {eq:async(k,code)=>({data:server.rows.filter(r=>r.code===code).map(r=>({slice:r.slice,data:JSON.parse(JSON.stringify(r.data))})),error:null})};},
      upsert(rows){
        rows.forEach(r=>{const i=server.rows.findIndex(x=>x.code===r.code&&x.slice===r.slice);if(i>=0)server.rows[i]=r;else server.rows.push(r);
          server.phones.filter(p=>p!==phone&&p.handler).forEach(p=>setTimeout(()=>p.handler({new:JSON.parse(JSON.stringify(r))}),0));});
        return Promise.resolve({error:null});
      }
    };}
  };}};
}
function phone(url){
  const ph={handler:null};
  const dom=new JSDOM(html,{runScripts:'dangerously',url,pretendToBeVisual:true,beforeParse(w){w.supabase=stubFor(ph);}});
  ph.dom=dom;ph.w=dom.window;ph.d=dom.window.document;
  ph.$=s=>ph.d.querySelector(s);
  ph.click=s=>{const el=ph.$(s);if(!el)throw new Error('no el '+s);el.click();};
  ph.txt=()=>ph.$('#app').textContent;
  ph.state=()=>JSON.parse(ph.w.localStorage.getItem('team-training-v1'));
  ph.check=(s,v)=>{const el=ph.$(s);el.checked=v;el.dispatchEvent(new ph.w.Event('change',{bubbles:true}));};
  ph.hold=async s=>{const el=ph.$(s);if(!el)throw new Error('no el '+s);el.dispatchEvent(new ph.w.Event('pointerdown',{bubbles:true}));await sleep(1600);el.dispatchEvent(new ph.w.Event('pointerup',{bubbles:true}));};
  server.phones.push(ph);
  return ph;
}

// Phone A creates a room
const A=phone('http://localhost/');
ok(!A.$('[data-a="create"]'),'room card closed by default');
A.click('[data-a="room"]');
ok(A.$('[data-a="create"]'),'A sees create room');
A.click('[data-a="create"]');
await sleep(50);
const code=A.state().room;
ok(/^[A-Z]{4}$/.test(code),'A has a 4-letter code: '+code);
ok(server.rows.length===3,'A pushed 3 slices on subscribe');
ok(A.txt().includes('?room='+code),'A shows share link');
ok(A.state().own.host&&A.state().own.team[0]&&A.state().own.team[1],'creator owns everything');

// Phone B joins as a viewer via the link
const B=phone('http://localhost/?room='+code);
await sleep(50);
ok(B.state().room===code,'B joined via URL');
ok(!B.state().own.host,'B is a viewer');
ok(B.state().teams[0]===A.state().teams[0],'B got A team names: '+B.state().teams.join('/'));
ok(B.state().members[1][2]==='Gert Jan','B got A members');
ok(B.$('[data-member="0:0"]').disabled,'B cannot edit members');
ok(B.$('[data-a="start"]').disabled,'B cannot start the clock');
ok(B.$('[data-a="next"]').disabled,'B cannot change phase');
ok(B.$('[data-chk="warm"]').disabled,'B cannot tick the checklist');

// A starts the warm-up timer; B sees it running
A.click('[data-a="start"]');
await sleep(250);
ok(B.state().timers.warm.running===true,'B sees the running timer');
ok(B.$('[data-a="pause"]')&&B.$('[data-a="pause"]').disabled,'B sees pause, disabled');

// B takes team 1
B.check('[data-own="team1"]',true);
await sleep(50);
ok(server.rows.find(r=>r.slice==='team1'),'B pushed team1 slice');
await sleep(50);
ok(A.state().own.team[1]===false&&A.state().own.team[0]===true,'A yielded team 1, kept team 0');
ok(A.txt().includes('took over'),'A shows the takeover message');

// A moves to block 2; B follows
A.click('[data-a="goto"][data-i="4"]');
await sleep(250);
ok(B.state().phase===4,'B followed A to block 2');
ok(B.$('[data-a="b2"][data-t="0"][data-d="1"]').disabled,'B cannot count team 0');
ok(!B.$('[data-a="b2"][data-t="1"][data-d="1"]').disabled,'B can count team 1');
ok(B.txt().includes('view'),'B shows view label on team 0');
ok(B.$('[data-own="team0"]').disabled,'roles locked on B from Block 1');
B.check('[data-own="team0"]',true);
ok(B.state().own.team[0]===false,'locked role change ignored');
ok(B.txt().includes('Roles are locked'),'lock note shown');

// B counts for team 1, A sees it
B.click('[data-a="b2"][data-t="1"][data-i="0"][data-d="5"]');
B.click('[data-a="b2"][data-t="1"][data-i="0"][data-d="5"]');
await sleep(300);
ok(A.state().b2.counts[1][0]===10,'A sees team 1 squats = 10');
ok(A.txt().includes('10 / 75'),'A renders 10 / 75');
ok(B.state().timers.b2.running===false,'B did not auto-start the host timer');

// A counts team 0, B sees it
A.click('[data-a="b2"][data-t="0"][data-i="5"][data-d="1"]');
await sleep(300);
ok(B.state().b2.counts[0][5]===1,'B sees team 0 burpees = 1');
ok(A.state().timers.b2.running===true,'A auto-started the block timer');

// A resets block 2; B clears its own slice and pushes
await A.hold('[data-hold="resetblock"]');
await sleep(400);
ok(A.state().b2.counts[1][0]===0,'A cleared team 1 locally');
ok(B.state().b2.counts[1][0]===0,'B cleared its own team 1 slice');
ok(server.rows.find(r=>r.slice==='team1').data.b2.counts[0]===0,'server team1 row cleared');
ok(B.state().resets.b2===1,'B tracked the reset counter');

// Block 3: B stamps home for team 1 on A's clock
A.click('[data-a="goto"][data-i="6"]');
await sleep(250);
ok(B.$('[data-a="b3home"][data-t="1"]').disabled,'B home disabled before start');
A.click('[data-a="start"]');
await sleep(350);
ok(!B.$('[data-a="b3home"][data-t="1"]').disabled,'B home enabled after A starts');
B.click('[data-a="b3home"][data-t="1"]');
await sleep(300);
ok(A.state().b3.home[1]>=250,'A sees team 1 home time');

// Reset session from A propagates
A.click('[data-a="goto"][data-i="7"]');
await sleep(250);
await A.hold('[data-hold="resetall"]');
await sleep(400);
ok(A.state().phase===0&&A.state().room===code,'A reset kept the room');
ok(B.state().phase===0&&B.state().b3.home[1]===null,'B followed the session reset');

// A leaves
A.click('[data-a="leave"]');
ok(A.state().room===null&&A.state().own.host,'A left and owns everything again');
process.exit(process.exitCode||0);
