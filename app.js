(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const el=(tag,cls,txt)=>{const e=document.createElement(tag); if(cls)e.className=cls; if(txt!=null)e.textContent=txt; return e;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const store={
  get(k,d){try{const v=localStorage.getItem('vibebooth_'+k);return v?JSON.parse(v):d;}catch(e){return d;}},
  set(k,v){try{localStorage.setItem('vibebooth_'+k,JSON.stringify(v));}catch(e){}}
};
const prefersReduced=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
// the bottom-sheet layout (portrait phones, folded phones); phones on their side use a side panel instead
const isMobile=()=>window.matchMedia('(max-width:820px) and (orientation:portrait), (max-width:820px) and (min-height:501px)').matches;
// phones render the 3D at 1.5x at most: far fewer pixels than 2-3x, and the GPU/main thread leave room for audio
const pixelRatio=()=>Math.min(window.devicePixelRatio||1,(isMobile()||window.matchMedia('(pointer: coarse)').matches)?1.5:2);

/* ================= MUSIC DATA ================= */
const P=s=>s.split('').map(c=>c==='x'?1:'1234'.includes(c)?+c:0);
const KITS={
  house:{name:'House',kick:'punch',snare:'clap',hat:'tight',bass:'saw',chords:'organ',vox:'chop',perc:'conga',duck:0.45,fill:true},
  garage:{name:'Garage',kick:'deep',snare:'rim',hat:'shaker',bass:'sub',chords:'piano',vox:'chop',perc:'rim',duck:0.6,fill:false},
  melodic:{name:'Melodic house',kick:'punch',snare:'clap',hat:'shaker',bass:'sub',chords:'piano',vox:'chop',perc:'shaker',duck:0.55,fill:true},
  riddim:{name:'Riddim',kick:'riddim',snare:'big',hat:'tight',bass:'wobble',chords:'supersaw',vox:'screech',perc:'metal',duck:0.7,fill:true},
  altpop:{name:'Alt pop',kick:'pop',snare:'snare',hat:'tight',bass:'gbass',chords:'guitar',vox:'riff',perc:'tamb',duck:0.25,fill:true},
  trance:{name:'Trance',kick:'punch',snare:'clap',hat:'tight',bass:'saw',chords:'supersaw',vox:'lead',perc:'shaker',duck:0.6,fill:true},
  techno:{name:'Techno',kick:'punch',snare:'clap',hat:'tight',bass:'rumble',chords:'pluck',vox:'screech',perc:'metal',duck:0.35,fill:false},
  future:{name:'Future bass',kick:'punch',snare:'big',hat:'tight',bass:'sub',chords:'supersaw',vox:'chop',perc:'shaker',duck:0.75,fill:true},
  island:{name:"Island (shell rattles, log drum, bow bass, kulo')",kick:'punch',snare:'log',hat:'shell',bass:'bow',chords:'pluck',vox:'chop',perc:'island',duck:0.45,fill:true,horn:true}
};
const PERC={conga:P('..x..x.x..x..x.x'),rim:P('...x..x....x.x..'),shaker:P('xxxxxxxxxxxxxxxx'),metal:P('..x...x...x..x.x'),tamb:P('....x.......x..x'),island:P('x.xx..x.x.xx..x.')};
// song structure: every track plays through these sections (76 bars), then loops
const ARR=[
  {n:'Intro',bars:8,L:'kick hat perc',lp:true},
  {n:'Groove',bars:8,L:'kick hat ohat perc bass clap'},
  {n:'Build',bars:8,L:'hat ohat perc stab vox clap kickb',build:true},
  {n:'Drop',bars:16,L:'kick hat ohat perc bass clap stab vox pad',drop:true},
  {n:'Break',bars:8,L:'pad vox stab perc',brk:true},
  {n:'Build',bars:4,L:'hat stab vox clap kickb',build:true},
  {n:'Drop',bars:16,L:'kick hat ohat perc bass clap stab vox pad',drop:true,alt:true},
  {n:'Outro',bars:8,L:'kick hat perc bass'}
];
let ARR_LEN=0; ARR.forEach(s=>{ s.on=new Set(s.L.split(' ')); s.start=ARR_LEN; ARR_LEN+=s.bars; });
function sectionAt(bar){ const b=((bar%ARR_LEN)+ARR_LEN)%ARR_LEN; for(const s of ARR) if(b<s.start+s.bars) return [s,b-s.start]; return [ARR[0],0]; }
const CUES={Intro:0,Build:ARR[2].start,Drop:ARR[3].start,Break:ARR[4].start};
const T_=(o)=>Object.assign(o,{kick:P(o.kick),clap:P(o.clap),hat:P(o.hat),ohat:P(o.ohat),bass:P(o.bass),stab:P(o.stab),vox:P(o.vox)});
const BUILTINS=[
  T_({name:'Sunset Pier',style:'House',kit:'house',bpm:124,key:'A',prog:'festival',swing:0.05,
   kick:'x...x...x...x...',clap:'....x.......x...',hat:'..x...x...x...x.',ohat:'................',bass:'..1...1...1..21.',stab:'..1..1....1..1..',vox:'..........1.3...'}),
  T_({name:'Window Light',style:'Garage',kit:'garage',bpm:132,key:'C',prog:'deep',swing:0.22,
   kick:'x.....x...x.....',clap:'....x.......x...',hat:'xxxxxxxxxxxxxxxx',ohat:'..............x.',bass:'1.....1...1...2.',stab:'1..1......1..1..',vox:'..1.13.....2.1..'}),
  T_({name:'Rooftop Feelings',style:'Melodic house',kit:'melodic',bpm:126,key:'D',prog:'dreamy',swing:0.1,
   kick:'x...x...x...x...',clap:'....x.......x...',hat:'..x...x...x.x.x.',ohat:'..x.......x.....',bass:'1..1..1...1..1..',stab:'1.....1.....1...',vox:'1.3.4...1.3.2...'}),
  T_({name:'Wobble Goblin',style:'Riddim',kit:'riddim',bpm:150,key:'F',prog:'dark',swing:0,
   kick:'x.........x.....',clap:'........x.......',hat:'..x...x...x...x.',ohat:'................',bass:'1..1..2.1..1.2..',stab:'................',vox:'..............1.'}),
  T_({name:'Gremlin Gravy',style:'Riddim',kit:'riddim',bpm:150,key:'E',prog:'dark',swing:0,
   kick:'x.....x...x.....',clap:'........x.......',hat:'x.x.x.x.x.x.x.x.',ohat:'.......x........',bass:'2.2.1...2.2.1.1.',stab:'1...............',vox:'....1.......1.2.'}),
  T_({name:'Bad Haircut Day',style:'Alt pop',kit:'altpop',bpm:100,key:'G',prog:'festival',swing:0.08,
   kick:'x......x..x.....',clap:'....x.......x...',hat:'x.x.x.x.x.x.x.x.',ohat:'................',bass:'1......1..1...2.',stab:'1..1..1...1.1...',vox:'..3.4.3.1.......'}),
  T_({name:'Laser Tag',style:'Trance',kit:'trance',bpm:138,key:'E',prog:'festival',swing:0,
   kick:'x...x...x...x...',clap:'....x.......x...',hat:'..x...x...x...x.',ohat:'................',bass:'.111.111.111.111',stab:'1.1.1.11.1.1.1.1',vox:'1.2.3.4.1.2.3.4.'}),
  T_({name:'Warehouse 4AM',style:'Techno',kit:'techno',bpm:130,key:'F',prog:'dark',swing:0.04,
   kick:'x...x...x...x...',clap:'................',hat:'x.xxx.xxx.xxx.xx',ohat:'..x...x...x...x.',bass:'.111.111.111.111',stab:'1.........1.....',vox:'...............1'}),
  T_({name:'Cotton Candy Sky',style:'Future bass',kit:'future',bpm:150,key:'C',prog:'dreamy',swing:0,
   kick:'x.........x.....',clap:'........x.......',hat:'x.x.x.x.x.x.x.xx',ohat:'......x.........',bass:'1.....1...1.....',stab:'1..1..1...1.1.1.',vox:'1..3..4...3.2...'}),
  T_({name:'Latte Sunrise',style:'Island house',kit:'island',bpm:122,key:'D',prog:'dreamy',swing:0.12,
   kick:'x...x...x...x...',clap:'....x.......x...',hat:'..x...x...x...x.',ohat:'......x.......x.',bass:'1..1...1..1.2...',stab:'..1.....1..1....',vox:'1...3.4.....2...'}),
  T_({name:"Kulo' Call",style:'Island tech',kit:'island',bpm:125,key:'A',prog:'deep',swing:0.06,
   kick:'x...x...x...x...',clap:'....x.......x..x',hat:'xxx.xxx.xxx.xxxx',ohat:'..x...x...x...x.',bass:'.1.1..1..1.1..2.',stab:'1.........1.....',vox:'..........1.3...'})
];
const PROGS={
  festival:{name:'Festival anthem (i, VI, III, VII)',ch:[[0,'m'],[8,'M'],[3,'M'],[10,'M']]},
  dark:{name:'Dark and driving (i, VII, VI, VII)',ch:[[0,'m'],[10,'M'],[8,'M'],[10,'M']]},
  deep:{name:'Deep groove (i, iv, i, v)',ch:[[0,'m7'],[5,'m7'],[0,'m7'],[7,'m7']]},
  dreamy:{name:'Dreamy (VI, VII, i, v)',ch:[[8,'M7'],[10,'M'],[0,'m7'],[7,'m7']]}
};
const QUAL={m:[0,3,7],M:[0,4,7],m7:[0,3,7,10],M7:[0,4,7,11]};
const KEYROOT={A:45,C:48,D:50,E:40,F:41,G:43};
const mtof=m=>440*Math.pow(2,(m-69)/12);
function chordFor(t,bar){
  const pr=PROGS[t.prog]||PROGS.festival;
  const [off,q]=pr.ch[bar%4];
  const w=off>=7?off-12:off;
  const root=KEYROOT[t.key]||45;
  return {bass:root+w, notes:QUAL[q].map(i=>root+12+w+i)};
}
const POOLS={
  kick:['x...x...x...x...','x...x...x...x.x.','x.........x.....','x.....x...x.....','x......x..x.....'],
  clap:['....x.......x...','....x.......x..x','........x.......','....x..x....x...'],
  hat:['..x...x...x...x.','x.x.x.x.x.x.x.x.','xxxxxxxxxxxxxxxx','..x...x...x..xx.'],
  ohat:['................','..x...x...x...x.','......x.......x.'],
  bass:['..1...1...1...1.','.111.111.111.111','1.....1...1.....','..1.1..1..1.1..2','1..1..2.1..1.2..','2.2.1...2.2.1.1.'],
  stab:['..1..1....1..1..','1..1..1...1..1..','1.........1.....','1.1.1.11.1.1.1.1','1.....1.....1...','................'],
  vox:['..1.13.....2.1..','1.3.4...1.3.2...','..3.4.3.1.......','1.2.3.4.1.2.3.4.','................','....1.......1.2.']
};
const ROWS=[
  {k:'kick',label:'Kick',hint:'Kick is the heartbeat. Hits on 1, 5, 9, and 13 make "four on the floor" for house and trance. Kicks on 1, 7, and 11 make the skippy 2-step of UK garage. Kicks on 1 and 11 give the half-time stomp of riddim and future bass.'},
  {k:'clap',label:'Snare',hint:'Snare or clap is the backbeat. Steps 5 and 13 land on beats 2 and 4. In half-time styles like riddim, one big snare on step 9 makes the drop feel huge.'},
  {k:'hat',label:'Hat',hint:'Hi-hats add drive. Offbeats (3, 7, 11, and 15) give the house bounce. Every step plus Swing gives that shuffly garage groove.'},
  {k:'ohat',label:'Open hat',hint:'Open hats ring out longer. One on the offbeat adds that "tss" lift between kicks.'},
  {k:'bass',label:'Bass',hint:'Bass follows the chord root. Tap once for the root, twice for the octave up (↑). In the Riddim kit, 1 wobbles in 8ths and ↑ wobbles in 16ths.'},
  {k:'stab',label:'Chords',hint:'Chords play your progression, one chord per bar. The kit decides the sound: piano for garage, supersaw for trance and riddim, crunchy guitar for alt pop.'},
  {k:'vox',label:'Vox/lead',hint:'Melody row. Tap to cycle through 1, 2, 3, and 4, which pick notes from the current chord. Garage and house kits sing chopped vocal "oohs" and "ahs", riddim screeches, and alt pop plays a guitar riff.'}
];
const blankTrack=()=>({name:'My First Banger',style:'Original',kit:'house',swing:0,bpm:124,key:'A',prog:'festival',
  kick:Array(16).fill(0),clap:Array(16).fill(0),hat:Array(16).fill(0),ohat:Array(16).fill(0),bass:Array(16).fill(0),stab:Array(16).fill(0),vox:Array(16).fill(0)});
function normTrack(t){ if(!t) return t; if(!t.vox) t.vox=Array(16).fill(0); if(!t.kit||!KITS[t.kit]) t.kit={organ:'house',supersaw:'trance',pluck:'techno'}[t.lead]||'house'; if(t.swing==null) t.swing=0; return t; }
let myTrack=normTrack(Object.assign(blankTrack(),store.get('mytrack',{})));
let crate=store.get('crate',[]).map(normTrack);
const saveMy=()=>store.set('mytrack',myTrack);

/* ================= GAME DATA ================= */
const MISSIONS=[
  {id:'play',xp:50,title:'Press play',how:'Tap Deck A. It waits for the next bar so it always lands on beat. That is called quantize.',target:'#pA'},
  {id:'four',xp:75,title:'Four on the floor',how:'In Studio, put a Kick on steps 1, 5, 9, and 13. That steady thump powers house, techno, and trance.',target:'#grid',tab:'studio'},
  {id:'clap',xp:75,title:'Clap on 2 and 4',how:'In Studio, add Claps on steps 5 and 13. That backbeat is what makes people move.',target:'#grid',tab:'studio'},
  {id:'bassline',xp:75,title:'Bounce the bass',how:'Add bass notes in Studio, including at least one octave note (tap a bass square twice).',target:'#grid',tab:'studio'},
  {id:'save',xp:100,title:'Make it yours',how:'Name your track in Studio and tap Save to crate. Now it loads on either deck.',target:'#saveTrack',tab:'studio'},
  {id:'prep',xp:100,title:'Cue it up',how:'With Deck A playing, slide the crossfader all the way to A, then tap Deck B. The crowd cannot hear B yet, so you can prep it.',target:'#pB'},
  {id:'blend',xp:125,title:'The full transition',how:'With both decks playing, slide the crossfader from one side all the way to the other.',target:'#xfader'},
  {id:'bassSwap',xp:200,title:'Bass swap',how:'In Mix, cut Low on the incoming deck, blend it in, then cut Low on the old deck and bring Low back on the new one.',target:'#chanB .kill',tab:'mix'},
  {id:'filter',xp:100,title:'Filter sweep',how:'In Mix, drag a Filter knob far up or down, then double-tap it back to the middle.',target:'#chanA .knob[data-k=filter]',tab:'mix'},
  {id:'build',xp:150,title:'Build and drop',how:'Tap Build. A riser and snare roll play for 2 bars, the music pauses for one beat, then it drops.',target:'#aBuild'},
  {id:'lights',xp:100,title:'Flames on the drop',how:'Tap Flames (or a flame cannon on stage) within 2 seconds after a drop lands.',target:'#aFire'},
  {id:'paint',xp:75,title:'VJ mode',how:'In Show, pick a different visual for the round screen and type your own text.',target:'#patternChips',tab:'show'},
  {id:'echo',xp:100,title:'Echo out',how:'In Mix, turn on Echo, then stop a deck. The tail rings out like a pro exit.',target:'#fxEcho',tab:'mix'},
  {id:'hotcue',xp:100,title:'Hot cue',how:'In Mix, tap Drop under a deck to jump straight to its drop on the next bar.',target:'#chanA .cue[data-s=Drop]',tab:'mix'},
  {id:'loop',xp:100,title:'Loop it',how:'Tap Loop 4 on a playing deck to repeat the current 4 bars. Tap it again to let the track move on.',target:'#chanA .loopBtn',tab:'mix'},
  {id:'roll',xp:100,title:'Beat roll',how:'Press and hold Roll on a playing deck for a stuttering repeat, then let go to fall back in.',target:'#chanA .rollBtn',tab:'mix'},
  {id:'crowd',xp:250,title:'Rock the crowd',how:'Get the crowd above 80% hyped. Drops, smooth transitions, and pyro all help.',target:'#vibeChip'}
];
const LEVELS=[[0,'Bedroom DJ'],[150,'Warm-up Act'],[400,'Club Resident'],[750,'Tour Support'],[1150,'Festival Headliner'],[1800,'Mainstage Legend']];
let progress=Object.assign({xp:0,done:{}},store.get('progress',{}));
const show=Object.assign({pattern:'hearts',palette:'candy',text:'',speed:1,bassReact:true,beatStrobe:false,laserColor:'#ff4fb0',laserMode:'fan',laserAuto:true,flameAuto:true,reduceFlash:prefersReduced,paintPattern:false,paintText:false,sky:'auto',sail:'auto',comfort:prefersReduced},store.get('show',{}));
const saveShow=()=>store.set('show',show);

/* ================= TOASTS ================= */
function toast(msg,kind){
  const t=el('div','toast'+(kind?' '+kind:''),msg);
  $('#toasts').append(t);
  setTimeout(()=>{t.style.transition='opacity .4s';t.style.opacity='0';setTimeout(()=>t.remove(),420);},2800);
  const all=$$('#toasts .toast'); if(all.length>3) all[0].remove();
}

/* ================= PROGRESSION ================= */
function levelIdx(xp){let i=0;LEVELS.forEach((l,j)=>{if(xp>=l[0])i=j;});return i;}
function updateHeader(){
  const i=levelIdx(progress.xp), cur=LEVELS[i], nxt=LEVELS[i+1];
  $('#lvlName').textContent=cur[1]; $('#lvlBig').textContent=cur[1]+', '+progress.xp+' XP';
  $('#xpFill').style.width=(nxt?(progress.xp-cur[0])/(nxt[0]-cur[0])*100:100)+'%';
  $('#lvlNext').textContent=nxt?(nxt[0]-progress.xp)+' XP until '+nxt[1]+'.':'Top level reached. You are the headliner.';
}
function addXP(n){
  const before=levelIdx(progress.xp);
  progress.xp+=n; store.set('progress',progress);
  const after=levelIdx(progress.xp);
  if(after>before){ toast('Level up! You are now a '+LEVELS[after][1]+' 🎉','good'); fireFlames(false); laserBurst=4; sgHappy(2); sgMove('jump'); }
  updateHeader();
}
function complete(id){
  if(progress.done[id]) return;
  const m=MISSIONS.find(x=>x.id===id); if(!m) return;
  progress.done[id]=true;
  toast('Quest done: '+m.title+'  +'+m.xp+' XP','good');
  sgHappy(1.2);
  addXP(m.xp); renderMissions();
}
function renderMissions(){
  const list=$('#missionList'); list.innerHTML='';
  const cur=MISSIONS.find(m=>!progress.done[m.id]);
  MISSIONS.forEach((m,i)=>{
    const row=el('div','mission'+(progress.done[m.id]?' done':'')+(m===cur?' current':''));
    const body=el('div','mBody');
    const title=el('div','mTitle',m.title); title.append(el('span','mXp','+'+m.xp+' XP'));
    body.append(title,el('div','mHow',m.how)); row.append(el('div','mIcon',progress.done[m.id]?'✓':String(i+1)),body); list.append(row);
  });
  const q=$('#coachPill'); q.innerHTML='';
  const txt=el('span');
  if(cur){ const idx=MISSIONS.indexOf(cur)+1; q.append(el('span','cpDot',String(idx))); txt.append(el('span','cpTitle',cur.title),el('span','cpHow',cur.how)); }
  else { q.append(el('span','cpDot','★')); txt.append(el('span','cpTitle','Every quest done'),el('span','cpHow','Freestyle time. Shigost is proud of you.')); }
  q.append(txt);
  $('#doneCount').textContent=Object.keys(progress.done).length+' of '+MISSIONS.length+' done';
  updateHeader(); applyCoach();
}
let curTab='mix';
const sheetOpen=()=>!isMobile()||$('#console').classList.contains('open');
function applyCoach(){
  $$('.coach').forEach(e=>e.classList.remove('coach'));
  const m=MISSIONS.find(x=>!progress.done[x.id]); if(!m) return;
  let t=$(m.target);
  if(m.tab&&!(curTab===m.tab&&sheetOpen())) t=$('.tabs button[data-tab='+m.tab+']');
  if(t) t.classList.add('coach');
}

/* ================= VIBE ================= */
let vibe=0, ambLevel=0.5;
function addVibe(n){ vibe=clamp(vibe+n,0,100); if(vibe>=80) complete('crowd'); }

/* ================= AUDIO ================= */
let uwLP=null, audioReady=false, cross, revCross, roomVerb, echo, verb, verbSend, master, limiter, analyser, riserNoise, riserFilter, riserGain, roll, clock;
let globalStep=0, echoOn=false, verbOn=false, riserActive=false, buildHype=false, lastDrop=-1e9, xfVal=0.5, xfSide=null;
const decks={}; let phaser, gateG, phaserOn=false, gateOn=false, amb=null, ambVerb=null; const GATE=P('x.x.xx.x.x.xx.x.');
/* ---------- sound design: each deck builds the voices its kit needs ---------- */
// A monophonic Tone source can't start before an event it already has booked (Tone throws "The time must be greater
// than or equal to the last scheduled time"). For triggers made outside the sequencer, monoAt returns the earliest legal
// time at or after t and books the note's last event: attack+decay with sustain 0 (the later release stop is ignored), else dur+release.
function monoAt(syn,t,dur){
  const e=syn.envelope, tail=e.sustain===0?e.toSeconds(e.attack)+e.toSeconds(e.decay):dur+e.toSeconds(e.release);
  const t0=Math.max(t,(syn._monoEnd||0)+1e-4); syn._monoEnd=t0+tail; return t0;
}
function mkClick(d,vol){ const n=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.012,sustain:0}}); const hp=new Tone.Filter(3000,'highpass'); n.chain(hp,d.drums); n.volume.value=vol; return t=>n.triggerAttackRelease(0.01,t); }
const VOICES={
  kick:{
    punch:d=>{ const k=new Tone.MembraneSynth({pitchDecay:0.045,octaves:7,envelope:{attack:0.001,decay:0.42,sustain:0,release:0.05}}).connect(d.drums); k.volume.value=-2; const c=mkClick(d,-20); return (t,v)=>{k.triggerAttackRelease('C1','8n',t,v); c(t);}; },
    deep:d=>{ const k=new Tone.MembraneSynth({pitchDecay:0.07,octaves:5,envelope:{attack:0.001,decay:0.85,sustain:0,release:0.1}}).connect(d.drums); k.volume.value=-1; const c=mkClick(d,-24); return (t,v)=>{k.triggerAttackRelease('B0','4n',t,v); c(t);}; },
    riddim:d=>{ const dist=new Tone.Distortion(0.45).connect(d.drums); const k=new Tone.MembraneSynth({pitchDecay:0.05,octaves:8,envelope:{attack:0.001,decay:0.36,sustain:0,release:0.05}}).connect(dist); k.volume.value=-5; const c=mkClick(d,-12); return (t,v)=>{k.triggerAttackRelease('D1','8n',t,v); c(t);}; },
    pop:d=>{ const k=new Tone.MembraneSynth({pitchDecay:0.03,octaves:5,envelope:{attack:0.001,decay:0.28,sustain:0,release:0.05}}).connect(d.drums); k.volume.value=-2; const c=mkClick(d,-15); return (t,v)=>{k.triggerAttackRelease('E1','8n',t,v); c(t);}; }
  },
  snare:{
    clap:d=>{ const bp=new Tone.Filter({type:'bandpass',frequency:1300,Q:1.1}); bp.connect(d.drums); bp.connect(d.rev);
      const n=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.012,sustain:0}}).connect(bp);
      const tail=new Tone.NoiseSynth({noise:{type:'pink'},envelope:{attack:0.001,decay:0.2,sustain:0}}).connect(bp); n.volume.value=-2; tail.volume.value=-4;
      return (t,v)=>{ n.triggerAttackRelease(0.008,t,v); n.triggerAttackRelease(0.008,t+0.011,v*0.9); n.triggerAttackRelease(0.008,t+0.022,v*0.8); tail.triggerAttackRelease(0.15,t+0.03,v); }; },
    snare:d=>{ const body=new Tone.MembraneSynth({pitchDecay:0.02,octaves:2,envelope:{attack:0.001,decay:0.12,sustain:0}}).connect(d.drums); body.volume.value=-8;
      const hp=new Tone.Filter(1800,'highpass'); hp.connect(d.drums); hp.connect(d.rev);
      const n=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.2,sustain:0}}).connect(hp); n.volume.value=-6;
      return (t,v)=>{ body.triggerAttackRelease('G3','16n',t,v); n.triggerAttackRelease(0.16,t,v); }; },
    big:d=>{ const body=new Tone.MembraneSynth({pitchDecay:0.03,octaves:3,envelope:{attack:0.001,decay:0.2,sustain:0}}).connect(d.drums); body.volume.value=-5;
      const hp=new Tone.Filter(1200,'highpass'); hp.connect(d.drums); const s=new Tone.Gain(2.2).connect(d.rev); hp.connect(s);
      const n=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.34,sustain:0}}).connect(hp); n.volume.value=-3;
      return (t,v)=>{ body.triggerAttackRelease('E3','8n',t,v); n.triggerAttackRelease(0.3,t,v); }; },
    rim:d=>{ const rim=new Tone.MembraneSynth({pitchDecay:0.005,octaves:1,envelope:{attack:0.001,decay:0.05,sustain:0}}); const bp=new Tone.Filter({type:'bandpass',frequency:1800,Q:2}); rim.chain(bp,d.drums); rim.volume.value=-6;
      const bp2=new Tone.Filter({type:'bandpass',frequency:1500,Q:0.9}); bp2.connect(d.drums); bp2.connect(d.rev);
      const n=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.13,sustain:0}}).connect(bp2); n.volume.value=-10;
      return (t,v)=>{ rim.triggerAttackRelease('C6','32n',t,v); n.triggerAttackRelease(0.1,t+0.005,v); }; }
  },
  hat:{
    tight:d=>{ const hp=new Tone.Filter(8000,'highpass').connect(d.drums); const n=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.04,sustain:0}}).connect(hp); n.volume.value=-15; return (t,v)=>n.triggerAttackRelease(0.03,t,v); },
    shaker:d=>{ const bp=new Tone.Filter({type:'bandpass',frequency:6500,Q:1.4}).connect(d.drums); const n=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.008,decay:0.06,sustain:0}}).connect(bp); n.volume.value=-9; return (t,v)=>n.triggerAttackRelease(0.05,t,v); }
  },
  ohat:{ open:d=>{ const hp=new Tone.Filter(7000,'highpass').connect(d.drums); const n=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.002,decay:0.3,sustain:0}}).connect(hp); n.volume.value=-17; return (t,v)=>n.triggerAttackRelease(0.25,t,v); } },
  bass:{
    sub:d=>{ const b=new Tone.MonoSynth({oscillator:{type:'sine'},portamento:0.03,envelope:{attack:0.008,decay:0.25,sustain:0.85,release:0.12},filterEnvelope:{baseFrequency:2000,octaves:0}}); const sat=new Tone.Chebyshev(2); sat.wet.value=0.2; b.chain(sat,d.sc); b.volume.value=-6; return (t,m)=>b.triggerAttackRelease(mtof(m),'8n',t); },
    saw:d=>{ const b=new Tone.MonoSynth({oscillator:{type:'sawtooth'},filter:{Q:2,type:'lowpass'},filterEnvelope:{attack:0.001,decay:0.16,sustain:0.25,release:0.2,baseFrequency:90,octaves:3},envelope:{attack:0.004,decay:0.2,sustain:0.6,release:0.08}}).connect(d.sc); b.volume.value=-11; return (t,m)=>b.triggerAttackRelease(mtof(m),'16n',t); },
    rumble:d=>{ const lp=new Tone.Filter(240,'lowpass').connect(d.sc); const dist=new Tone.Distortion(0.35).connect(lp); const b=new Tone.MonoSynth({oscillator:{type:'sine'},envelope:{attack:0.004,decay:0.22,sustain:0,release:0.05},filterEnvelope:{baseFrequency:2000,octaves:0}}).connect(dist); b.volume.value=-4; return (t,m)=>b.triggerAttackRelease(mtof(m),'16n',t); },
    gbass:d=>{ const dist=new Tone.Distortion(0.25).connect(d.sc); const b=new Tone.MonoSynth({oscillator:{type:'square'},filter:{Q:1,type:'lowpass'},filterEnvelope:{attack:0.002,decay:0.2,sustain:0.3,release:0.1,baseFrequency:180,octaves:2.5},envelope:{attack:0.003,decay:0.35,sustain:0.3,release:0.08}}).connect(dist); b.volume.value=-13; return (t,m)=>b.triggerAttackRelease(mtof(m),'8n',t); },
    wobble:d=>{
      const out=new Tone.Gain(0.42).connect(d.sc);
      const dist=new Tone.Distortion(0.6), cheb=new Tone.Chebyshev(3); cheb.wet.value=0.35;
      const f=new Tone.Filter({type:'lowpass',frequency:400,Q:5}); f.chain(dist,cheb,out);
      const lfo=new Tone.LFO({frequency:4,min:110,max:3800,type:'sine'}).start(); lfo.connect(f.frequency);
      const w=new Tone.MonoSynth({oscillator:{type:'fatsawtooth',count:2,spread:22},envelope:{attack:0.004,decay:0.1,sustain:0.95,release:0.05},filterEnvelope:{baseFrequency:8000,octaves:0}}).connect(f); w.volume.value=-8;
      const sub=new Tone.MonoSynth({oscillator:{type:'sine'},envelope:{attack:0.004,decay:0.1,sustain:0.9,release:0.06},filterEnvelope:{baseFrequency:2000,octaves:0}}).connect(d.sc); sub.volume.value=-9;
      return (t,m,val,bar)=>{ const bps=Tone.getTransport().bpm.value/60; const rate=val===2?bps*4:(bar%2?bps*3:bps*2);
        lfo.frequency.setValueAtTime(rate,t); w.triggerAttackRelease(mtof(m+12),'8n',t); sub.triggerAttackRelease(mtof(m),'8n',t); }; }
  },
  chords:{
    piano:d=>{ const g=new Tone.Gain(1); g.connect(d.sc); g.connect(d.rev);
      const p=new Tone.PolySynth(Tone.FMSynth,{harmonicity:3,modulationIndex:2.2,oscillator:{type:'sine'},modulation:{type:'sine'},envelope:{attack:0.004,decay:1.4,sustain:0.08,release:0.35},modulationEnvelope:{attack:0.002,decay:0.5,sustain:0,release:0.4}}).connect(g);
      p.maxPolyphony=24; p.volume.value=-12; d.rel.push(()=>p.releaseAll());
      return (t,ch)=>p.triggerAttackRelease(ch.notes.map(n=>mtof(n+12)),'8n',t,0.7+Math.random()*0.2); },
    supersaw:d=>{ const f=new Tone.Filter(5200,'lowpass'); f.connect(d.sc); const s=new Tone.Gain(0.6).connect(d.rev); f.connect(s);
      const p=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'fatsawtooth',count:3,spread:30},envelope:{attack:0.005,decay:0.25,sustain:0.3,release:0.3}}).connect(f); p.maxPolyphony=20; p.volume.value=-20; d.rel.push(()=>p.releaseAll());
      return (t,ch)=>p.triggerAttackRelease(ch.notes.map(mtof),'8n',t,0.8); },
    organ:d=>{ const p=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'square4'},envelope:{attack:0.003,decay:0.22,sustain:0.08,release:0.15}}).connect(d.sc); p.maxPolyphony=8; p.volume.value=-19; d.rel.push(()=>p.releaseAll()); return (t,ch)=>p.triggerAttackRelease(ch.notes.map(mtof),'16n',t,0.8); },
    pluck:d=>{ const f=new Tone.Filter(3200,'lowpass').connect(d.sc); const p=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'square'},envelope:{attack:0.002,decay:0.14,sustain:0,release:0.12}}).connect(f); p.maxPolyphony=8; p.volume.value=-22; d.rel.push(()=>p.releaseAll()); return (t,ch)=>p.triggerAttackRelease(ch.notes.map(mtof),'16n',t,0.8); },
    guitar:d=>{ const g=gtrChain(d,0.2); const p=new Tone.PolySynth(Tone.MonoSynth,GTR).connect(g); p.maxPolyphony=14; p.volume.value=-8; d.rel.push(()=>p.releaseAll());
      return (t,ch)=>{ const r=ch.bass+12; [r,r+7,r+12].forEach((n,i)=>p.triggerAttackRelease(mtof(n),'8n',t+i*0.009,0.9)); }; }
  },
  vox:{
    chop:d=>{ const out=new Tone.Gain(2.2); out.connect(d.sc); out.connect(d.rev);
      const fs=[0,1,2].map(i=>{ const f=new Tone.Filter({type:'bandpass',frequency:800,Q:7}); const g=new Tone.Gain([1,0.55,0.3][i]); f.chain(g,out); return f; });
      const s=new Tone.Synth({oscillator:{type:'fatsawtooth',count:2,spread:14},portamento:0.02,envelope:{attack:0.012,decay:0.12,sustain:0.55,release:0.09}}); fs.forEach(f=>s.connect(f)); s.volume.value=-4;
      const VOW=[[800,1150,2900],[450,800,2830],[400,1600,2700],[325,700,2530],[300,2300,3000]];
      return (t,ch,val,step,bar,dur)=>{ const vw=VOW[(step+bar*3)%5]; fs.forEach((f,i)=>f.frequency.setValueAtTime(vw[i],t)); s.triggerAttackRelease(mtof(voxNote(ch,val)+12),dur,t,0.9); }; },
    screech:d=>{ const hp=new Tone.Filter(500,'highpass'); const dist=new Tone.Distortion(0.7); const g=new Tone.Gain(0.5); hp.chain(dist,g,d.sc); g.connect(d.rev);
      const s=new Tone.FMSynth({harmonicity:0.5,modulationIndex:26,oscillator:{type:'sawtooth'},modulation:{type:'square'},envelope:{attack:0.005,decay:0.1,sustain:0.7,release:0.05},modulationEnvelope:{attack:0.002,decay:0.2,sustain:0.6,release:0.1}}).connect(hp); s.volume.value=-14;
      return (t,ch,val,step,bar,dur)=>{ const f=mtof(voxNote(ch,val)+12); s.triggerAttackRelease(f,dur,t); s.frequency.setValueAtTime(f*1.6,t+0.001); s.frequency.exponentialRampToValueAtTime(f,t+0.09); }; },
    lead:d=>{ const g=new Tone.Gain(1); g.connect(d.sc); g.connect(d.rev); const s=new Tone.MonoSynth({oscillator:{type:'square'},portamento:0.04,envelope:{attack:0.005,decay:0.15,sustain:0.4,release:0.1},filterEnvelope:{baseFrequency:900,octaves:3,decay:0.2,sustain:0.3}}).connect(g); s.volume.value=-17;
      return (t,ch,val,step,bar,dur)=>s.triggerAttackRelease(mtof(voxNote(ch,val)+12),dur,t); },
    riff:d=>{ const g=gtrChain(d,0.18); const s=new Tone.MonoSynth(GTR).connect(g); s.volume.value=-6;
      return (t,ch,val,step,bar,dur)=>s.triggerAttackRelease(mtof(voxNote(ch,val)+12),dur,t,0.9); }
  }
};
const GTR={oscillator:{type:'fatsawtooth',count:2,spread:14},filter:{Q:1.2,type:'lowpass'},envelope:{attack:0.002,decay:0.6,sustain:0.12,release:0.25},filterEnvelope:{attack:0.002,decay:0.22,sustain:0.25,release:0.2,baseFrequency:450,octaves:3.4}};
function gtrChain(d,level){ const out=new Tone.Gain(level); out.connect(d.sc); const s=new Tone.Gain(0.4).connect(d.rev); out.connect(s); const lp=new Tone.Filter(3300,'lowpass'); const dist=new Tone.Distortion(0.85); dist.chain(lp,out); return dist; }
function voxNote(ch,val){ const n=ch.notes; return val===4?n[0]+12:n[Math.min(val,3)-1]; }
const PANS=[-0.45,0.35,-0.2,0.5,-0.6,0.25];
function panned(d,p){ const pn=new Tone.Panner(p); pn.connect(d.drums); return pn; }
const VOICES_EXTRA={
  snare:{
    log:d=>{ const body=new Tone.MembraneSynth({pitchDecay:0.012,octaves:1.6,envelope:{attack:0.001,decay:0.14,sustain:0}}).connect(d.drums); body.volume.value=-5;
      const bp=new Tone.Filter({type:'bandpass',frequency:950,Q:2.5}); bp.connect(d.drums); bp.connect(d.rev);
      const n=new Tone.NoiseSynth({noise:{type:'pink'},envelope:{attack:0.001,decay:0.07,sustain:0}}).connect(bp); n.volume.value=-6;
      return (t,v)=>{ body.triggerAttackRelease('D4','16n',t,v); n.triggerAttackRelease(0.05,t,v); }; }
  },
  hat:{
    shell:d=>{ const b1=new Tone.Filter({type:'bandpass',frequency:4200,Q:4}), b2=new Tone.Filter({type:'bandpass',frequency:2700,Q:5}); const pn=panned(d,0.25); b1.connect(pn); b2.connect(pn);
      const n=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.012,sustain:0}}); n.connect(b1); n.connect(b2); n.volume.value=-3;
      return (t,v)=>{ for(let k=0;k<3;k++) n.triggerAttackRelease(0.008,t+k*0.006+Math.random()*0.004,v*(1-k*0.25)); }; }
  },
  bass:{
    bow:d=>{ // inspired by the belembaotuyan, the CHamoru musical bow with a gourd resonator: a plucked string with a moving "wah" resonance
      const lp=new Tone.Filter(2600,'lowpass').connect(d.sc); const bp=new Tone.Filter({type:'bandpass',frequency:600,Q:3}); bp.connect(lp);
      const s=new Tone.MonoSynth({oscillator:{type:'triangle'},envelope:{attack:0.003,decay:0.4,sustain:0.25,release:0.15},filterEnvelope:{baseFrequency:5000,octaves:0}}); s.connect(bp); s.volume.value=2;
      const buzz=new Tone.MonoSynth({oscillator:{type:'sawtooth'},envelope:{attack:0.003,decay:0.18,sustain:0,release:0.1},filterEnvelope:{baseFrequency:5000,octaves:0}}); buzz.connect(bp); buzz.volume.value=-10;
      const sub=new Tone.MonoSynth({oscillator:{type:'sine'},envelope:{attack:0.005,decay:0.3,sustain:0.6,release:0.1},filterEnvelope:{baseFrequency:2000,octaves:0}}).connect(d.sc); sub.volume.value=-8;
      return (t,m)=>{ bp.frequency.cancelScheduledValues(t); bp.frequency.setValueAtTime(380,t); bp.frequency.exponentialRampToValueAtTime(1500,t+0.09); bp.frequency.exponentialRampToValueAtTime(650,t+0.3);
        s.triggerAttackRelease(mtof(m+12),'8n',t); buzz.triggerAttackRelease(mtof(m+12),'16n',t); sub.triggerAttackRelease(mtof(m),'8n',t); }; }
  },
  perc:{
    conga:d=>{ const pn=panned(d,-0.35); const s=new Tone.MembraneSynth({pitchDecay:0.02,octaves:2,envelope:{attack:0.001,decay:0.22,sustain:0}}).connect(pn); s.volume.value=-12; return (t,st,v)=>s.triggerAttackRelease(st%3?'C4':'G3','16n',t,v); },
    rim:d=>{ const pn=panned(d,0.4); const bp=new Tone.Filter({type:'bandpass',frequency:2000,Q:3}).connect(pn); const s=new Tone.MembraneSynth({pitchDecay:0.004,octaves:1,envelope:{attack:0.001,decay:0.04,sustain:0}}).connect(bp); s.volume.value=-10; return (t,st,v)=>s.triggerAttackRelease('D6','32n',t,v); },
    shaker:d=>{ const pn=panned(d,-0.3); const bp=new Tone.Filter({type:'bandpass',frequency:7200,Q:1.2}).connect(pn); const n=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.012,decay:0.045,sustain:0}}).connect(bp); n.volume.value=-17; return (t,st,v)=>n.triggerAttackRelease(0.04,t,v*(st%2?0.6:1)); },
    metal:d=>{ const pn=panned(d,0.45); const m=new Tone.MetalSynth({envelope:{attack:0.001,decay:0.12,release:0.05},harmonicity:3.1,modulationIndex:18,resonance:2400,octaves:1}).connect(pn); m.volume.value=-28; return (t,st,v)=>m.triggerAttackRelease(180,'32n',t,v); },
    tamb:d=>{ const pn=panned(d,0.35); const hp=new Tone.Filter(7500,'highpass').connect(pn); const n=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.004,decay:0.14,sustain:0}}).connect(hp); n.volume.value=-14; return (t,st,v)=>{ n.triggerAttackRelease(0.1,t,v); n.triggerAttackRelease(0.05,t+0.025,v*0.5); }; },
    island:d=>{ const pl=panned(d,-0.4), pr=panned(d,0.45);
      const log=new Tone.MembraneSynth({pitchDecay:0.01,octaves:1.2,envelope:{attack:0.001,decay:0.18,sustain:0}}).connect(pl); log.volume.value=-9;
      const b=new Tone.Filter({type:'bandpass',frequency:2400,Q:4}).connect(pr); const n=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.01,sustain:0}}).connect(b); n.volume.value=-6;
      return (t,st,v)=>{ if(st%4===0||st===11) log.triggerAttackRelease(st%8===0?'A3':'E4','16n',t,v); else for(let k=0;k<2;k++) n.triggerAttackRelease(0.007,t+k*0.007,v*0.8); }; }
  },
  pad:{
    pad:d=>{ const ch=new Tone.Chorus(3,3.5,0.6).start(); const lp=new Tone.Filter(2200,'lowpass'); lp.connect(ch); ch.connect(d.sc); const s=new Tone.Gain(0.8).connect(d.rev); ch.connect(s);
      const p=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'fatsawtooth',count:3,spread:28},envelope:{attack:0.6,decay:1.0,sustain:0.7,release:1.8}}).connect(lp); p.maxPolyphony=10; p.volume.value=-24; d.rel.push(()=>p.releaseAll());
      return (t,ch2,dur,v)=>p.triggerAttackRelease(ch2.notes.map(n=>mtof(n+12)),dur,t,v); }
  },
  fx:{
    riser:d=>{ const n=new Tone.Noise('white'); const f=new Tone.Filter({type:'highpass',frequency:300,Q:2}); const g=new Tone.Gain(0); n.chain(f,g,d.input);
      return (t,dur)=>{ n.start(t); n.stop(t+dur+0.05); f.frequency.cancelScheduledValues(t); f.frequency.setValueAtTime(250,t); f.frequency.exponentialRampToValueAtTime(8500,t+dur);
        g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.16,t+dur); g.gain.setValueAtTime(0,t+dur+0.02); }; },
    crash:d=>{ const hp=new Tone.Filter(4500,'highpass'); hp.connect(d.drums); hp.connect(d.rev); const n=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:1.6,sustain:0}}).connect(hp); n.volume.value=-19; return t=>n.triggerAttackRelease(1.2,t,0.9); },
    impact:d=>{ const k=new Tone.MembraneSynth({pitchDecay:0.25,octaves:5,envelope:{attack:0.001,decay:1.4,sustain:0}}).connect(d.drums); k.volume.value=-6; const lp=new Tone.Filter(300,'lowpass'); lp.connect(d.rev); const n=new Tone.NoiseSynth({noise:{type:'brown'},envelope:{attack:0.001,decay:0.9,sustain:0}}).connect(lp); n.volume.value=-6; return t=>{ k.triggerAttackRelease('A0','2n',t); n.triggerAttackRelease(0.8,t); }; },
    kulo:d=>{ // a kulo' (triton shell trumpet) call: a breathy horn that scoops up into its note
      const out=new Tone.Gain(0.9); out.connect(d.sc); out.connect(d.rev); const vib=new Tone.Vibrato(5,0.12); vib.connect(out);
      const f1=new Tone.Filter({type:'bandpass',frequency:520,Q:1.4}), f2=new Tone.Filter({type:'bandpass',frequency:1400,Q:3}); f1.connect(vib); f2.connect(vib);
      const s=new Tone.MonoSynth({oscillator:{type:'sawtooth'},envelope:{attack:0.09,decay:0.3,sustain:0.85,release:0.5},filterEnvelope:{baseFrequency:3000,octaves:0}}); s.connect(f1); s.connect(f2); s.volume.value=-4;
      const br=new Tone.NoiseSynth({noise:{type:'pink'},envelope:{attack:0.05,decay:0.6,sustain:0.2,release:0.4}}); const bf=new Tone.Filter({type:'bandpass',frequency:900,Q:1}); br.chain(bf,out); br.volume.value=-20;
      return (t,m,dur)=>{ const f=mtof(m); s.triggerAttackRelease(f*0.89,dur,t); s.frequency.setValueAtTime(f*0.89,t+0.002); s.frequency.exponentialRampToValueAtTime(f,t+0.2); br.triggerAttackRelease(dur,t); }; }
  }
};
Object.keys(VOICES_EXTRA).forEach(k=>{ VOICES[k]=Object.assign(VOICES[k]||{},VOICES_EXTRA[k]); });
// richer vocal chops: four formants, a breath layer, vibrato and a little pitch scoop into each note
VOICES.vox.chop=d=>{ const out=new Tone.Gain(2.0); out.connect(d.sc); out.connect(d.rev);
  const fs=[0,1,2,3].map(i=>{ const f=new Tone.Filter({type:'bandpass',frequency:800,Q:[7,8,9,10][i]}); const g=new Tone.Gain([1,0.6,0.32,0.15][i]); f.chain(g,out); return f; });
  const s=new Tone.Synth({oscillator:{type:'fatsawtooth',count:2,spread:16},envelope:{attack:0.018,decay:0.14,sustain:0.6,release:0.12}}); fs.forEach(f=>s.connect(f)); s.volume.value=-4;
  const vib=new Tone.LFO(5.4,-14,14).start(); vib.connect(s.detune);
  const br=new Tone.NoiseSynth({noise:{type:'pink'},envelope:{attack:0.005,decay:0.07,sustain:0}}); const bf=new Tone.Filter({type:'bandpass',frequency:5200,Q:1.2}); br.chain(bf,out); br.volume.value=-26;
  const VOW=[[800,1150,2900,3900],[450,800,2830,3800],[400,1600,2700,3600],[325,700,2530,3500],[300,2300,3000,3800]];
  return (t,ch,val,step,bar,dur)=>{ const vw=VOW[(step+bar*3)%5]; fs.forEach((f,i)=>f.frequency.setValueAtTime(vw[i],t)); const fr=mtof(voxNote(ch,val)+12);
    s.triggerAttackRelease(fr*0.97,dur,t,0.9); s.frequency.setValueAtTime(fr*0.97,t+0.001); s.frequency.exponentialRampToValueAtTime(fr,t+0.05); br.triggerAttackRelease(0.05,t,0.7); }; };
// wider supersaw with chorus
VOICES.chords.supersaw=d=>{ const f=new Tone.Filter(5400,'lowpass'); const ch=new Tone.Chorus(2.5,3,0.5).start(); f.connect(ch); ch.connect(d.sc); const s=new Tone.Gain(0.6).connect(d.rev); ch.connect(s);
  const p=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'fatsawtooth',count:4,spread:36},envelope:{attack:0.005,decay:0.25,sustain:0.3,release:0.3}}).connect(f); p.maxPolyphony=20; p.volume.value=-21; d.rel.push(()=>p.releaseAll());
  return (t,ch2)=>p.triggerAttackRelease(ch2.notes.map(mtof),'8n',t,0.8); };
class Deck{
  constructor(id,dest,revDest){
    this.id=id; this.track=null; this.trackVal=null; this.playing=false; this.pending=false; this.pos=0;
    this.lowVal=0; this.wasCut=false; this.filterVal=0; this.filterBig=false;
    this.jump=null; this.loop=null; this.roll=null; this.startBar=0; this.sec=null;
    this.input=new Tone.Gain(1);
    this.arrHP=new Tone.Filter({type:'highpass',frequency:10,Q:0.9}); this.arrLP=new Tone.Filter({type:'lowpass',frequency:20000,Q:0.9}); this.arrGain=new Tone.Gain(1);
    this.eq=new Tone.EQ3({low:0,mid:0,high:0,lowFrequency:220,highFrequency:3000});
    this.filter=new Tone.Filter({type:'lowpass',frequency:20000,Q:1.4});
    this.fader=new Tone.Gain(0.8);
    this.meter=new Tone.Meter({smoothing:0.75});
    this.input.chain(this.arrHP,this.arrLP,this.arrGain,this.eq,this.filter,this.fader,dest); this.fader.connect(this.meter);
    this.drums=new Tone.Gain(1).connect(this.input);
    this.sc=new Tone.Gain(1).connect(this.input);
    // reverb send into the shared room reverb (initAudio). Cheap copies of the arrangement filters, DJ filter, and fader
    // keep the tail following this deck the way the dry signal does.
    this.rev=new Tone.Gain(0.28);
    this.revHP=new Tone.Filter({type:'highpass',frequency:10,Q:0.9}); this.revLP=new Tone.Filter({type:'lowpass',frequency:20000,Q:0.9});
    this.revFilter=new Tone.Filter({type:'lowpass',frequency:20000,Q:1.4}); this.revFader=new Tone.Gain(0.8);
    this.rev.chain(this.revHP,this.revLP,this.revFilter,this.revFader,revDest);
    this.v={}; this.rel=[];
  }
  voice(part,name){ const key=part+':'+name; if(!this.v[key]){ try{ this.v[key]=VOICES[part][name](this); }catch(e){ console.warn('voice failed',key,e); this.v[key]=()=>{}; } } return this.v[key]; }
  prepare(t){ const k=KITS[t.kit]||KITS.house; this.voice('kick',k.kick); this.voice('snare',k.snare); this.voice('hat',k.hat); this.voice('ohat','open'); this.voice('bass',k.bass); this.voice('chords',k.chords); this.voice('vox',k.vox); this.voice('perc',k.perc); this.voice('pad','pad'); ['riser','crash','impact'].forEach(n=>this.voice('fx',n)); if(k.horn) this.voice('fx','kulo'); }
  duck(t,amt){ const g=this.sc.gain; g.cancelScheduledValues(t); g.setValueAtTime(1-amt,t); g.setTargetAtTime(1,t+0.02,0.075); }
  audible(){ const x=this.id==='A'?1-xfVal:xfVal; return this.playing&&x>0.25&&this.fader.gain.value>0.15; }
  onBar(sec,sb,time,absBar){
    const beat=60/Tone.getTransport().bpm.value, barD=beat*4, k=KITS[this.track.kit]||KITS.house;
    if(sb===0){
      [[this.arrLP,this.arrHP],[this.revLP,this.revHP]].forEach(([lp,hp])=>{
        lp.frequency.cancelScheduledValues(time); hp.frequency.cancelScheduledValues(time);
        if(sec.lp){ lp.frequency.setValueAtTime(450,time); lp.frequency.exponentialRampToValueAtTime(19000,time+sec.bars*barD); } else lp.frequency.setValueAtTime(20000,time);
        if(sec.build){ hp.frequency.setValueAtTime(20,time); hp.frequency.exponentialRampToValueAtTime(650,time+sec.bars*barD-beat); }
        else hp.frequency.setValueAtTime(10,time);
      });
      if(sec.build) this.voice('fx','riser')(time,sec.bars*barD-beat);
      this.arrGain.gain.cancelScheduledValues(time); this.arrGain.gain.setValueAtTime(1,time);
      if(sec.drop){ this.voice('fx','crash')(time); this.voice('fx','impact')(time); if(k.horn) this.voice('fx','kulo')(time,chordFor(this.track,0).bass+24,barD*1.5); }
      const s=sec, d=this; Tone.getDraw().schedule(()=>sectionChanged(d,s),time);
    } else if(sec.drop&&sb%8===0) this.voice('fx','crash')(time);
    if(sec.build&&sb===sec.bars-1){ const tp=time+3*beat; this.arrGain.gain.setValueAtTime(1,tp-0.002); this.arrGain.gain.linearRampToValueAtTime(0,tp+0.01); this.arrGain.gain.setValueAtTime(1,time+barD); }
    const sbv=sb, d=this; Tone.getDraw().schedule(()=>deckMeta(d,sec,sbv),time);
  }
  tick(step,time){
    if(this.pending&&step===0){ this.pending=false; this.playing=true; this.pos=(this.startBar||0)*16; this.startBar=0; Tone.getDraw().schedule(()=>deckUI(this),time); }
    if(!this.playing||!this.track) return;
    if(step===0){
      if(this.jump!=null){ this.pos=this.jump*16; this.jump=null; if(this.loop) this.loop.start=Math.floor(this.pos/64)*4; }
      else if(this.loop&&this.pos>=(this.loop.start+this.loop.len)*16) this.pos=this.loop.start*16;
    }
    const t=this.track, k=KITS[t.kit]||KITS.house, absBar=Math.floor(this.pos/16), [sec,sb]=sectionAt(absBar), bar=absBar%4; this.pos++;
    if(step===0) this.onBar(sec,sb,time,absBar);
    let st=step; if(this.roll){ if(this.roll.start==null){ this.roll.start=step-step%this.roll.len; this.roll.i=0; } st=this.roll.start+(this.roll.i++%this.roll.len); }
    const six=60/Tone.getTransport().bpm.value/4, tt=time+(st%2?(t.swing||0)*six:0)+(Math.random()-0.5)*0.003;
    const on=n=>sec.on.has(n), hum=()=>0.82+Math.random()*0.18;
    const lastTwo=sec.build&&sb>=sec.bars-2, pauseBeat=sec.build&&sb===sec.bars-1&&step>=12;
    if(pauseBeat) return;
    if((on('kick')||(on('kickb')&&!lastTwo))&&t.kick[st]){ this.voice('kick',k.kick)(tt,1); this.duck(tt,k.duck); Tone.getDraw().schedule(()=>onKick(),tt); }
    if(lastTwo&&on('clap')){ const rate=sb===sec.bars-1?1:2; if(step%rate===0){ const p=((sb-(sec.bars-2))*16+step)/32; this.voice('snare',k.snare)(tt,(0.25+0.7*p)*(k.snare==='big'?0.55:1)); } }
    else if(on('clap')&&t.clap[st]) this.voice('snare',k.snare)(tt,0.95);
    else if(sec.drop&&k.fill&&(sb%8===7)&&step>=13) this.voice('snare',k.snare)(tt,0.35+(step-12)*0.17);
    if(on('hat')){ if(t.hat[st]) this.voice('hat',k.hat)(tt,(st%4===2?1:0.62)*hum()); else if(sec.alt&&st%2===1&&Math.random()<0.35) this.voice('hat',k.hat)(tt,0.3); }
    if(on('ohat')&&(t.ohat[st]||(sec.drop&&sb%8===7&&step===14))) this.voice('ohat','open')(tt,0.8);
    if(on('perc')&&PERC[k.perc]&&PERC[k.perc][st]) this.voice('perc',k.perc)(tt,st,0.7*hum());
    const wantPad=on('pad')&&step===0, wantB=on('bass')&&(t.bass[st]||(sec.drop&&bar===3&&st===14)), wantS=on('stab')&&t.stab[st], wantV=on('vox')&&t.vox&&t.vox[st];
    if(!(wantPad||wantB||wantS||wantV)) return;
    const ch=chordFor(t,bar);
    if(wantPad) this.voice('pad','pad')(tt,ch,sec.brk?'1m':'2n',sec.brk?0.75:0.3);
    if(wantB) this.voice('bass',k.bass)(tt,ch.bass+((t.bass[st]||2)===2?12:0),t.bass[st]||2,bar);
    if(wantS) this.voice('chords',k.chords)(tt,ch);
    if(wantV){ const nx=t.vox[(st+1)%16], dur=nx?six*0.9:six*1.8, vf=this.voice('vox',k.vox); vf(tt,ch,t.vox[st],st,bar,dur); if(sec.drop&&Math.random()<0.15) vf(tt+six*0.5,ch,t.vox[st],st,bar,six*0.4); }
  }
  stop(){ this.playing=false; this.pending=false; this.loop=null; this.roll=null; this.jump=null; this.rel.forEach(f=>f()); this.arrGain.gain.cancelScheduledValues(0); this.arrGain.gain.value=1; [this.arrHP,this.revHP].forEach(f=>{ f.frequency.cancelScheduledValues(0); f.frequency.value=10; }); [this.arrLP,this.revLP].forEach(f=>{ f.frequency.cancelScheduledValues(0); f.frequency.value=20000; }); }
}
function deckMeta(d,sec,sb){ if(!d.playing) return; const pill=$('#p'+d.id); pill.querySelector('.dkMeta').textContent=sec.n+', bar '+(sb+1)+' of '+sec.bars+(d.loop?' (looping)':''); }
function sectionChanged(d,sec){
  d.sec=sec;
  $$('#chan'+d.id+' .cue').forEach(b=>b.classList.toggle('now',b.dataset.s===sec.n));
  if(!d.audible()) return;
  if(sec.build) buildHype=true;
  if(sec.drop){ isl.erupt=Math.max(isl.erupt||0,1.4); buildHype=false; laserBurst=Math.max(laserBurst,5); if(show.flameAuto) fireFlames(false); crowdCheer=1; squish(1.2); addVibe(8); beatPulse=1; if(typeof sgMove==='function') sgMove('jump'); }
  if(sec.brk) buildHype=false;
}
const anyPlaying=()=>!!(decks.A&&(decks.A.playing||decks.B.playing));
const otherDeck=d=>d.id==='A'?decks.B:decks.A;
function initAudio(){
  cross=new Tone.CrossFade(0.5); revCross=new Tone.CrossFade(0.5);
  echo=new Tone.FeedbackDelay({delayTime:0.36,feedback:0.42,wet:0});
  // only two convolvers in the whole app: the room every deck (and the island chimes) sends into,
  // and the Reverb button's bigger hall as a send, so it costs nothing extra while off
  roomVerb=new Tone.Reverb({decay:2.4,preDelay:0.01}); roomVerb.wet.value=1;
  verb=new Tone.Reverb({decay:3.5,preDelay:0.02}); verb.wet.value=1; verbSend=new Tone.Gain(0);
  master=new Tone.Gain(0.9); limiter=new Tone.Limiter(-1);
  const glue=new Tone.Compressor({threshold:-16,ratio:3,attack:0.01,release:0.2});
  phaser=new Tone.Phaser({frequency:0.35,octaves:3,baseFrequency:380}); phaser.wet.value=0; gateG=new Tone.Gain(1);
  const bus=new Tone.Gain(1);
  cross.connect(echo); revCross.chain(roomVerb,echo);
  echo.connect(bus); echo.chain(verbSend,verb,bus);
  uwLP=new Tone.Filter({type:'lowpass',frequency:20000,Q:0.4});
  bus.chain(phaser,gateG,master,glue,limiter,uwLP,Tone.getDestination());
  analyser=new Tone.Analyser('fft',64); limiter.connect(analyser);
  decks.A=new Deck('A',cross.a,revCross.a); decks.B=new Deck('B',cross.b,revCross.b);
  riserFilter=new Tone.Filter({type:'highpass',frequency:300,Q:2}); riserGain=new Tone.Gain(0); riserNoise=new Tone.Noise('white');
  riserNoise.chain(riserFilter,riserGain,echo);
  const rollF=new Tone.Filter(2200,'bandpass'); rollF.connect(echo);
  roll=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.09,sustain:0}}).connect(rollF); roll.volume.value=-9;
  clock=new Tone.Loop(time=>{
    const step=globalStep%16;
    try{ decks.A.tick(step,time); }catch(e){ console.warn(e); } try{ decks.B.tick(step,time); }catch(e){ console.warn(e); }
    if(gateOn) gateG.gain.setValueAtTime(GATE[step]?1:0.1,time);
    const playing=decks.A.playing||decks.B.playing;
    Tone.getDraw().schedule(()=>{ onStep(step,playing); if(step%4===0&&playing) onBeat(step===0); },time);
    globalStep++;
  },'16n').start(0);
  audioReady=true;
  loadTrackToDeck(decks.A,'b:0'); loadTrackToDeck(decks.B,'b:2');
  setBPM(124);
  try{ startAmbience(); }catch(e){ console.warn('ambience',e); }
}
function startAmbience(){
  // the island itself: rolling surf, a hiss of foam, shell chimes on the breeze, crackling lava
  amb=new Tone.Gain(0).connect(uwLP||Tone.getDestination()); amb.gain.rampTo(0.5,3);
  const ocean=new Tone.Noise('brown'), oF=new Tone.Filter(750,'lowpass'), swell=new Tone.Gain(0.4), pan=new Tone.AutoPanner(0.04).start(); pan.depth.value=0.5;
  new Tone.LFO(0.085,0.12,0.95).start().connect(swell.gain); ocean.chain(oF,swell,pan,amb); ocean.volume.value=-9; ocean.start();
  const surf=new Tone.Noise('pink'), sF=new Tone.Filter({type:'bandpass',frequency:2200,Q:0.5}), sG=new Tone.Gain(0);
  new Tone.LFO({frequency:0.085,min:0,max:0.32,phase:90}).start().connect(sG.gain); surf.chain(sF,sG,amb); surf.volume.value=-17; surf.start();
  const chime=new Tone.PolySynth(Tone.FMSynth,{harmonicity:3.5,modulationIndex:5,envelope:{attack:0.002,decay:1.8,sustain:0,release:1.2},modulationEnvelope:{attack:0.002,decay:0.5,sustain:0,release:0.4}}); chime.maxPolyphony=10; chime.volume.value=-30;
  // dry to the ambience bus, wet through the shared room reverb (its level follows amb in the frame loop)
  const cDry=new Tone.Gain(0.6); chime.chain(cDry,amb); ambVerb=new Tone.Gain(0); chime.chain(ambVerb,roomVerb);
  const crack=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.008,sustain:0}}), cF=new Tone.Filter({type:'bandpass',frequency:3200,Q:1.5}); crack.chain(cF,amb); crack.volume.value=-26;
  const notes=['D5','E5','G5','A5','B5','D6','E6'];
  setInterval(()=>{ if(!amb) return; const now=Tone.now();
    if(Math.random()<0.1){ const n=Math.min(1+Math.floor(Math.random()*3),7-chime.activeVoices); for(let k=0;k<n;k++) chime.triggerAttackRelease(notes[Math.floor(Math.random()*notes.length)],'8n',now+0.05+k*0.09+Math.random()*0.05,0.4+Math.random()*0.4); }
    const er=(isl&&isl.erupt)||0, rate=0.25+er*0.5; if(Math.random()<rate){ const n=1+Math.floor(Math.random()*(er>0?6:3)); const ts=[...Array(n)].map(()=>now+0.05+Math.random()*0.2).sort((a,b)=>a-b); ts.forEach((tc,k)=>{ const t=monoAt(crack,tc+k*0.012,0.006); crack.triggerAttackRelease(0.006,t,0.3+Math.random()*0.7); }); }
  },250);
}

function setBPM(b){
  b=Math.round(b);
  if(audioReady){ Tone.getTransport().bpm.value=b; echo.delayTime.rampTo(60/b*0.75,0.05); }
  $('#bpmVal').textContent=b; $('#tempo').value=b; $('#tempoVal').textContent=b;
}
function togglePlay(d){
  if(!audioReady) return;
  if(!d.track){ toast('Pick a track for this deck first','warn'); return; }
  if(d.playing||d.pending){ d.stop(); deckUI(d); $('#chan'+d.id+' .loopBtn').classList.remove('on'); $$('#chan'+d.id+' .cue').forEach(b=>b.classList.remove('now')); if(echoOn) complete('echo'); return; }
  const o=otherDeck(d);
  if(!(o.playing||o.pending)) setBPM(d.track.bpm);
  if(Tone.getTransport().state!=='started'){ globalStep=0; Tone.getTransport().start('+0.06'); }
  d.pending=true; deckUI(d); markPlayed();
  complete('play');
  if(o.playing&&(o.id==='A'?xfVal<0.12:xfVal>0.88)) complete('prep');
}
function getTrack(val){
  if(val==='my') return myTrack;
  if(val&&val.startsWith('b:')) return BUILTINS[+val.slice(2)];
  if(val&&val.startsWith('c:')) return normTrack(crate[+val.slice(2)]);
  return null;
}
const STYLE_ART={'Island house':['#ffb23a','#2fbf96'],'Island tech':['#ff6a2a','#3fb2ea'],Garage:['#ffb3a7','#a98bff'],'Melodic house':['#ff9fd0','#ffd84d'],Riddim:['#2fbf96','#8f6bff'],'Alt pop':['#ffd84d','#3fb2ea'],'Future bass':['#ff9fd0','#a98bff'],House:['#ff9a3d','#ff5fa2'],Techno:['#5a4a80','#3fb2ea'],'Future Bass':['#ff9fd0','#a98bff'],Trance:['#3fb2ea','#a98bff'],'Tech House':['#ffd84d','#ff5fa2'],'Drum & Bass':['#2fbf96','#3fb2ea']};
function loadTrackToDeck(d,val){
  d.trackVal=val; d.track=getTrack(val); if(d.track) d.prepare(d.track);
  const sel=$('#chan'+d.id+' .trackSel'); if(sel) sel.value=val;
  refreshDeckInfo(d);
  if(d.playing&&!otherDeck(d).playing) setBPM(d.track.bpm);
}
function refreshDeckInfo(d){
  if(!d.track) return;
  const t=d.track, pill=$('#p'+d.id);
  pill.querySelector('.dkName').textContent=t.name;
  pill.querySelector('.dkMeta').textContent=d.playing?t.style+', '+t.bpm+' bpm':'Tap to play';
  const a=STYLE_ART[t.style]||['#ff5fa2','#ffd84d'];
  pill.querySelector('.mini i').style.setProperty('--art','linear-gradient(135deg,'+a[0]+','+a[1]+')');
}
function hotCue(id,name){ if(!audioReady) return; const d=decks[id]; if(!d.track) return;
  if(d.playing){ d.jump=CUES[name]; toast('Deck '+id+': jumping to '+name+' on the next bar'); }
  else { d.startBar=CUES[name]; if(!d.pending) togglePlay(d); }
  complete('hotcue'); }
function toggleLoop(id){ if(!audioReady) return; const d=decks[id]; const b=$('#chan'+id+' .loopBtn');
  if(d.loop){ d.loop=null; b.classList.remove('on'); return; }
  const bar=Math.floor(Math.max(0,d.pos-1)/16); d.loop={start:Math.floor(bar/4)*4,len:4}; b.classList.add('on'); if(d.playing) complete('loop'); }
function rollOn(id,on){ if(!audioReady) return; const d=decks[id]; const b=$('#chan'+id+' .rollBtn');
  if(on&&d.playing){ d.roll={len:2,i:0,start:null}; b.classList.add('on'); complete('roll'); } else { d.roll=null; b.classList.remove('on'); } }
/* Getting beginners to press play: a play/pause icon on each deck, a glow ring on Deck A until the first play (and again
   after 30 quiet seconds), a "Start the music" button right after entering, and a "Tap to play" bubble over the 3D decks. */
let everPlayed=!!store.get('played',false), silentSince=performance.now();
function markPlayed(){ if(!everPlayed){ everPlayed=true; store.set('played',true); } hideStartMusic(); }
function updatePlayNudge(){ if(!decks.A) return;
  const busy=decks.A.playing||decks.A.pending||decks.B.playing||decks.B.pending, now=performance.now();
  if(busy) silentSince=now;
  const nudge=!busy&&!startEl&&(!everPlayed||now-silentSince>30000);
  const p=$('#pA'); p.classList.toggle('nudge',nudge); p.classList.toggle('soft',!!show.reduceFlash); }
let startEl=null;
function showStartMusic(){ if(everPlayed||startEl) return;
  startEl=document.createElement('div'); startEl.className='startMusic';
  startEl.innerHTML='<button class="startBtn" type="button" aria-label="Start the music: play Deck A">Start the music <span aria-hidden="true">▶</span></button><button class="startSkip" type="button">or explore first</button>';
  document.body.append(startEl);
  startEl.querySelector('.startBtn').addEventListener('click',()=>{ hideStartMusic(); if(audioReady&&!(decks.A.playing||decks.A.pending)) togglePlay(decks.A); });
  startEl.querySelector('.startSkip').addEventListener('click',()=>{ hideStartMusic(); silentSince=performance.now(); });
  setTimeout(()=>{ const b=startEl&&startEl.querySelector('.startBtn'); if(b) b.focus({preventScroll:true}); },60); }
function hideStartMusic(){ if(startEl){ startEl.remove(); startEl=null; } }
// floating bubble over the 3D turntables, until the first play
let deckBubble=null; const _db=new THREE.Vector3();
function updateDeckBubble(){
  if(!deckBubble){ deckBubble=document.createElement('button'); deckBubble.className='deckBubble'; deckBubble.type='button'; deckBubble.textContent='Tap to play';
    deckBubble.setAttribute('aria-label','Play Deck A'); deckBubble.addEventListener('click',()=>{ if(audioReady&&!(decks.A.playing||decks.A.pending)) togglePlay(decks.A); });
    document.body.append(deckBubble); }
  let show_=audioReady&&!everPlayed&&!startEl&&uwK<0.5&&jogs.A&&!rideActive();
  if(show_){ jogs.A.getWorldPosition(_db); _db.x=0; _db.y+=0.45; _db.project(camera);
    const x=(_db.x+1)/2*view.w, y=(1-_db.y)/2*view.h; show_=_db.z<1&&x>20&&x<view.w-20&&y>40&&y<view.h-20;
    if(show_) deckBubble.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) translate(-50%,-100%)'; }
  deckBubble.style.display=show_?'block':'none'; }
function deckUI(d){
  const pill=$('#p'+d.id);
  pill.classList.toggle('live',d.playing); pill.classList.toggle('cued',d.pending);
  pill.setAttribute('aria-label',(d.playing||d.pending?'Stop':'Play')+' Deck '+d.id);
  if(d.pending) pill.querySelector('.dkMeta').textContent='Starting on the next bar';
  else refreshDeckInfo(d);
}
function setEQ(d,band,db){
  if(!audioReady) return;
  d.eq[band].rampTo(db<=-29?-60:db,0.03);
  if(band==='low'){
    d.lowVal=db;
    $('#chan'+d.id+' .kill').classList.toggle('on',db<=-29);
    if(db<=-20) d.wasCut=true;
    const o=otherDeck(d);
    if(db>=-3&&d.wasCut&&o.lowVal<=-20&&d.playing&&o.playing){ d.wasCut=false; complete('bassSwap'); addVibe(10); toast('Clean bass swap. One bassline at a time.','good'); }
  }
}
function setFilter(d,v){
  if(!audioReady) return;
  if(Math.abs(v)<0.05) v=0;
  d.filterVal=v;
  const type=v>0?'highpass':'lowpass', hz=v===0?20000:v<0?20000*Math.pow(0.006,-v):20*Math.pow(250,v);
  [d.filter,d.revFilter].forEach(f=>{ f.type=type; f.frequency.rampTo(hz,0.05); });
  if(Math.abs(v)>0.6) d.filterBig=true;
  if(v===0&&d.filterBig&&d.playing){ d.filterBig=false; complete('filter'); addVibe(5); }
}
function setXF(v){
  xfVal=v; if(audioReady){ cross.fade.rampTo(v,0.03); revCross.fade.rampTo(v,0.03); }
  const side=v<0.08?'A':v>0.92?'B':null;
  if(side&&xfSide&&side!==xfSide&&decks.A.playing&&decks.B.playing){ complete('blend'); addVibe(15); addXP(10); toast('Smooth move. Deck '+side+' has the floor.','good'); }
  if(side) xfSide=side;
}
function startRiser(){
  if(!anyPlaying()){ toast('Start a deck first, then build it up','warn'); return; }
  if(riserActive) return;
  riserActive=true; $('#aBuild').classList.add('on');
  const bar=Tone.Time('1m').toSeconds(), beat=bar/4, t0=Tone.getTransport().nextSubdivision('1m');
  riserNoise.start(t0); riserNoise.stop(t0+2*bar-beat);
  riserFilter.frequency.cancelScheduledValues(t0); riserFilter.frequency.setValueAtTime(250,t0); riserFilter.frequency.exponentialRampToValueAtTime(9000,t0+2*bar-beat);
  riserGain.gain.cancelScheduledValues(t0); riserGain.gain.setValueAtTime(0.001,t0); riserGain.gain.linearRampToValueAtTime(0.45,t0+2*bar-beat); riserGain.gain.setValueAtTime(0,t0+2*bar-beat);
  for(let i=0;i<8;i++) roll.triggerAttackRelease('32n',t0+i*bar/8,0.3+i*0.05);
  for(let i=0;i<12;i++) roll.triggerAttackRelease('32n',t0+bar+i*bar/16,0.65+i*0.03);
  Tone.getDraw().schedule(()=>{buildHype=true;},t0);
  scheduleDrop(t0+2*bar-beat,t0+2*bar,true);
  toast('Building. The drop lands in 2 bars.');
}
function scheduleDrop(tPause,tDrop,fromRiser){
  master.gain.setValueAtTime(0,tPause); master.gain.setValueAtTime(0.9,tDrop);
  Tone.getDraw().schedule(()=>{ sgMove('jump'); },tPause);
  Tone.getDraw().schedule(()=>onDrop(fromRiser),tDrop);
}
function doDrop(){
  if(!anyPlaying()){ toast('Start a deck first','warn'); return; }
  if(riserActive) return;
  const beat=Tone.Time('4n').toSeconds(), t1=Tone.getTransport().nextSubdivision('4n');
  scheduleDrop(t1,t1+beat,false);
}
function onDrop(fromRiser){
  riserActive=false; buildHype=false; $('#aBuild').classList.remove('on');
  lastDrop=performance.now(); laserBurst=6; beatPulse=1; sgBrace=0; sgJump=1; sgHappy(1.5); squish(1.8); crowdCheer=1;
  if(show.flameAuto) fireFlames(false);
  if(!show.reduceFlash) strobeT=0.35;
  projFlash=show.reduceFlash?0.2:0.9;
  addVibe(fromRiser?25:15); addXP(fromRiser?15:8);
  if(fromRiser) complete('build');
  toast(fromRiser?'Drop! The crowd lost it 💥':'Drop! 💥');
}

/* ================= SHOW STATE ================= */
let beatPulse=0, beatCount=0, laserBurst=0, strobeT=0, strobeHold=false, flameGlow=0, projFlash=0, crowdCheer=0, night=0;
let sgBob=0, sgJump=0, sgBrace=0, sgHappyT=0, sgWaveT=0, nextBlink=2, blinkT=0;
const sgHappy=s=>{sgHappyT=Math.max(sgHappyT,s);};
const lv={bass:0,mid:0,high:0}; let fft=null;
function onBeat(isBar){
  if(isBar&&anyPlaying()){ const a=Math.PI/2+0.25*Math.sin(beatCount*0.7); addRipple(Math.cos(a)*(islandR(a)+1.4),OCZ+Math.sin(a)*(islandR(a)+1.4),0.5,night>0.5,3); }
  beatPulse=1; beatCount++; sgBob=1;
  if(show.beatStrobe&&isBar) projFlash=show.reduceFlash?0.15:0.55;
  if(vibe<60) addVibe(0.6);
  if(beatCount%32===0&&vibe>55&&sg.ready&&!sg.act) sgMove('dance',8);
}
function onKick(){ squish(0.18+0.25*vibe/100); }
let lastPh=-1;
function onStep(step,playing){
  if(lastPh>=0) cellCols[lastPh].forEach(c=>c.classList.remove('ph'));
  if(playing){ cellCols[step].forEach(c=>c.classList.add('ph')); lastPh=step; } else lastPh=-1;
}
function fireFlames(manual){
  cannons.forEach(c=>c.burst=0.7); flameGlow=1;
  if(manual){ addVibe(3); crowdCheer=Math.max(crowdCheer,0.6); if(performance.now()-lastDrop<2000) complete('lights'); }
}

/* ================= ROUND SCREEN ================= */
const PALS={candy:['#ff7ad9','#7ae7ff','#c9a2ff','#fff27a'],acid:['#b6ff3b','#9b3bff','#ff3bd4','#3bfff2'],sunset:['#ff5e7e','#ffb36b','#ffd86b','#b45cff'],ocean:['#2de2e6','#2f6bff','#8af7ff','#ffffff'],uv:['#7b2bff','#c86bff','#ff4fd8','#3d1aff']};
const PAL_NAMES={candy:'Cotton candy',acid:'Acid',sunset:'Sunset',ocean:'Ocean',uv:'Blacklight'};
const PATTERNS={hearts:'Hearts and sparkles',tunnel:'Tunnel',kaleido:'Kaleido',spectrum:'Spectrum',synthwave:'Retro sun',warp:'Warp speed',ghost:'Shigost eyes'};
const PW=400, PH=400;
const projCanvas=document.createElement('canvas'); projCanvas.width=PW; projCanvas.height=PH;
const pc=projCanvas.getContext('2d');
const floaters=[...Array(30)].map(()=>({x:Math.random()*PW,y:Math.random()*PH*1.2,s:8+Math.random()*14,v:0.4+Math.random()*1.1,k:Math.random()<0.55,c:Math.floor(Math.random()*4),r:Math.random()*6}));
const newStar=r=>({x:(Math.random()-0.5)*2,y:(Math.random()-0.5)*2,z:r?Math.random():1});
const stars2d=[...Array(150)].map(()=>newStar(true));
let projT=0, projAcc=0;
// the canvas screens are main-thread work; while music plays they redraw at ~20 fps so the audio scheduler keeps its slack
const SCREEN_DT=()=>anyPlaying()?1/20:0;
function heart(c,x,y,s){c.beginPath();c.moveTo(x,y+s*0.3);c.bezierCurveTo(x,y,x-s*0.5,y,x-s*0.5,y+s*0.3);c.bezierCurveTo(x-s*0.5,y+s*0.6,x,y+s*0.8,x,y+s);c.bezierCurveTo(x,y+s*0.8,x+s*0.5,y+s*0.6,x+s*0.5,y+s*0.3);c.bezierCurveTo(x+s*0.5,y,x,y,x,y+s*0.3);c.fill();}
function sparkle(c,x,y,s){c.beginPath();c.moveTo(x,y-s);c.quadraticCurveTo(x,y,x+s,y);c.quadraticCurveTo(x,y,x,y+s);c.quadraticCurveTo(x,y,x-s,y);c.quadraticCurveTo(x,y,x,y-s);c.fill();}
const nrm=x=>Number.isFinite(x)?clamp((x+95)/60,0,1):0;
function drawProj(dt){
  const c=pc,W=PW,H=PH,pal=PALS[show.palette]||PALS.candy;
  const b=show.bassReact?lv.bass:0.2;
  projT+=dt*show.speed*(buildHype?2.4:1);
  const t=projT,p=show.pattern;
  const trail=(p==='tunnel'||p==='kaleido'||p==='warp')?0.3:1;
  c.globalAlpha=1; c.shadowBlur=0;
  c.fillStyle='rgba(18,8,32,'+trail+')'; c.fillRect(0,0,W,H);
  if(p==='tunnel'){
    c.save(); c.translate(W/2,H/2); c.rotate(Math.sin(t*0.3)*0.4+b*0.3);
    for(let i=0;i<12;i++){ const z=(t*0.25+i/12)%1, s=z*z*620; c.globalAlpha=z; c.strokeStyle=pal[i%pal.length]; c.lineWidth=1+z*8+b*8*z; c.beginPath(); c.arc(0,0,s/2,0,Math.PI*2); c.stroke(); }
    c.restore();
  } else if(p==='kaleido'){
    c.save(); c.translate(W/2,H/2); c.rotate(t*0.2);
    for(let j=0;j<8;j++){ c.rotate(Math.PI/4);
      for(let i=0;i<5;i++){ const r=20+i*30+Math.sin(t*1.2+i)*14+b*34; c.globalAlpha=0.8; c.fillStyle=pal[(i+j)%pal.length]; c.beginPath(); c.arc(r,Math.sin(t*1.6+i)*18,6+i*3+lv.mid*10,0,Math.PI*2); c.fill(); } }
    c.restore();
  } else if(p==='hearts'){
    const g=c.createLinearGradient(0,0,0,H); g.addColorStop(0,'#3a1352'); g.addColorStop(1,'#5a1a4a'); c.fillStyle=g; c.fillRect(0,0,W,H);
    floaters.forEach(f=>{ f.y-=f.v*dt*60*show.speed*(buildHype?2:1); f.r+=dt; if(f.y<-30){f.y=H+20;f.x=Math.random()*W;}
      const s=f.s*(1+b*0.7); c.fillStyle=pal[f.c]; c.globalAlpha=0.92; const x=f.x+Math.sin(f.r*1.4)*10;
      if(f.k) heart(c,x,f.y,s*1.3); else sparkle(c,x,f.y,s*0.7); });
  } else if(p==='spectrum'){
    const bins=24,bw=W/(bins*2);
    for(let i=0;i<bins;i++){ const v=fft?nrm(fft[i]):0.08+0.05*Math.sin(t*3+i); const h=Math.max(6,v*H*0.8);
      c.fillStyle=pal[i%pal.length]; c.globalAlpha=0.95;
      c.fillRect(W/2+i*bw+1,H/2-h/2,bw-2,h); c.fillRect(W/2-(i+1)*bw+1,H/2-h/2,bw-2,h); }
  } else if(p==='synthwave'){
    const hz=H*0.6, g=c.createLinearGradient(0,0,0,hz); g.addColorStop(0,'#1b0638'); g.addColorStop(1,pal[0]); c.fillStyle=g; c.fillRect(0,0,W,hz);
    const R=78+b*20, sg=c.createLinearGradient(0,hz-R,0,hz); sg.addColorStop(0,pal[3]); sg.addColorStop(1,pal[0]);
    c.fillStyle=sg; c.beginPath(); c.arc(W/2,hz,R,Math.PI,0); c.fill();
    c.fillStyle='#1b0638'; for(let i=0;i<5;i++){ const y=hz-R*0.12-i*R*0.17; c.fillRect(W/2-R,y,R*2,2+i*0.9); }
    c.fillStyle='#0f0220'; c.fillRect(0,hz,W,H-hz);
    c.strokeStyle=pal[1]; c.lineWidth=1.6; c.globalAlpha=0.9;
    for(let i=0;i<9;i++){ const z=((i/9)+t*0.35)%1, y=hz+(H-hz)*z*z; c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); }
    for(let i=-10;i<=10;i++){ c.beginPath(); c.moveTo(W/2+i*8,hz); c.lineTo(W/2+i*60,H); c.stroke(); }
  } else if(p==='warp'){
    c.save(); c.translate(W/2,H/2);
    stars2d.forEach((s,i)=>{ s.z-=dt*show.speed*(0.35+b*1.6)*(buildHype?2.5:1); if(s.z<=0.02){Object.assign(s,newStar(false));}
      const x=s.x/s.z*110, y=s.y/s.z*110; if(Math.abs(x)>W/2||Math.abs(y)>H/2){Object.assign(s,newStar(false));return;}
      c.globalAlpha=clamp(1-s.z,0,1); c.fillStyle=pal[i%pal.length]; const r=(1-s.z)*3.5; c.fillRect(x-r/2,y-r/2,r,r); });
    c.restore();
  } else if(p==='ghost'){
    const g=c.createRadialGradient(W/2,H/2,10,W/2,H/2,W*0.6); g.addColorStop(0,pal[2]); g.addColorStop(1,pal[0]); c.fillStyle=g; c.fillRect(0,0,W,H);
    c.fillStyle='#f3eee6'; c.beginPath(); c.ellipse(W/2,H/2+20,130,150,0,0,Math.PI*2); c.fill();
    const blink=(Math.sin(t*0.7)>0.97)?0.1:1, s=1+b*0.35;
    c.fillStyle='#111'; [-1,1].forEach(k=>{ c.beginPath(); c.ellipse(W/2+k*52,H/2+5,30*s,42*s*blink,0,0,Math.PI*2); c.fill(); });
  }
  c.globalAlpha=1;
  if(show.text){
    let fs=64+b*20; c.font='italic 600 '+fs+'px Fraunces, Georgia, serif';
    const w=c.measureText(show.text).width; if(w>W*0.78){ fs*=W*0.78/w; c.font='italic 600 '+fs+'px Fraunces, Georgia, serif'; }
    c.textAlign='center'; c.textBaseline='middle'; c.shadowColor=pal[0]; c.shadowBlur=20; c.fillStyle='#ffffff';
    c.fillText(show.text,W/2,H*0.5+(show.pattern==='ghost'?120:0)+Math.sin(t*2)*4); c.shadowBlur=0;
  }
  if(projFlash>0){ c.fillStyle='rgba(255,255,255,'+projFlash+')'; c.fillRect(0,0,W,H); projFlash=Math.max(0,projFlash-dt*3); }
}

/* ================= 3D DIORAMA ================= */
let renderer,scene,camera,projTex,hemi,sun,washL,washR,flameLight,laserRoot,wobble,inner,starPts;
const lasers=[],cannons=[],ledMats=[],bulbs=[],clouds=[],jogs={},crowd={},flame={},sg={},tiles={};
let duck, cloudMat, balloon; const isl={};
const C=h=>new THREE.Color(h).convertSRGBToLinear();
const std=(hex,o)=>new THREE.MeshStandardMaterial(Object.assign({color:C(hex),roughness:0.78,metalness:0},o||{}));
function rrShape(w,d,r){ const s=new THREE.Shape(), x=-w/2, y=-d/2;
  s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r); s.lineTo(x+w,y+d-r); s.quadraticCurveTo(x+w,y+d,x+w-r,y+d);
  s.lineTo(x+r,y+d); s.quadraticCurveTo(x,y+d,x,y+d-r); s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y); return s; }
function rbox(w,h,d,r,bev){ const b=bev||0; const g=new THREE.ExtrudeGeometry(rrShape(w-2*b,d-2*b,Math.max(0.01,r-b)),{depth:Math.max(0.01,h-2*b),bevelEnabled:b>0,bevelThickness:b,bevelSize:b,bevelSegments:3,curveSegments:10}); g.rotateX(-Math.PI/2); g.translate(0,b,0); return g; }
function mesh(geo,mat,x,y,z,parent,shadow){ const m=new THREE.Mesh(geo,mat); m.position.set(x||0,y||0,z||0); (parent||inner).add(m); if(shadow!==false){m.castShadow=true;m.receiveShadow=true;} return m; }
function glowTexture(){
  const cv=document.createElement('canvas'); cv.width=cv.height=64; const g=cv.getContext('2d');
  const gr=g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.35,'rgba(255,255,255,.6)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr; g.fillRect(0,0,64,64); return new THREE.CanvasTexture(cv);
}
function beamGeo(rad,len){
  const g=new THREE.CylinderGeometry(rad,rad,len,6,10,true); g.rotateX(Math.PI/2); g.translate(0,0,len/2);
  const pos=g.attributes.position, cols=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){ const f=1-pos.getZ(i)/len, v=f*f; cols[i*3]=cols[i*3+1]=cols[i*3+2]=v; }
  g.setAttribute('color',new THREE.BufferAttribute(cols,3)); return g;
}

/* ---------- Marianas island builders ---------- */
const BASE=-6.1, LIFT=0.9, OCZ=-2.15, VOLC={x:-8.8,z:-11.6,r:5.6};
const VPROF=[[5.6,0],[5.1,0.7],[4.3,1.8],[3.4,3.3],[2.5,4.9],[1.8,6.3],[1.45,7.3],[1.35,7.6]];
function canvasTex(w,h,draw,rx,ry){ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; draw(cv.getContext('2d'),w,h); const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx||1,ry||1); t.encoding=THREE.sRGBEncoding; t.anisotropy=4; return t; }
const woodTex=()=>canvasTex(256,256,(c,w,h)=>{ c.fillStyle='#8a5a3a'; c.fillRect(0,0,w,h); for(let i=0;i<8;i++){ c.fillStyle=i%2?'#94633f':'#7f5335'; c.fillRect(0,i*32,w,30); c.fillStyle='rgba(60,35,20,.5)'; c.fillRect(0,i*32+30,w,2); for(let k=0;k<14;k++){ c.strokeStyle='rgba(60,35,20,.25)'; c.beginPath(); const y=i*32+4+Math.random()*24; c.moveTo(0,y); c.bezierCurveTo(w*0.3,y+Math.random()*4-2,w*0.6,y+Math.random()*4-2,w,y); c.stroke(); } } },1,1);
const thatchTex=()=>canvasTex(256,256,(c,w,h)=>{ c.fillStyle='#c79a52'; c.fillRect(0,0,w,h); for(let i=0;i<900;i++){ const x=Math.random()*w, y=Math.random()*h; c.strokeStyle=['#b5863f','#d8ad62','#a57636','#e2bd74'][i%4]; c.lineWidth=1+Math.random()*1.5; c.beginPath(); c.moveTo(x,y); c.lineTo(x+(Math.random()-0.5)*6,y+18+Math.random()*16); c.stroke(); } for(let r=0;r<6;r++){ c.fillStyle='rgba(90,60,25,.35)'; c.fillRect(0,r*43+38,w,4); } },2,2);
const wovenTex=()=>canvasTex(128,128,(c,w,h)=>{ const s=16; for(let i=0;i<w/s;i++) for(let j=0;j<h/s;j++){ c.fillStyle=(i+j)%2?'#d9be86':'#c8a56a'; c.fillRect(i*s,j*s,s,s); c.fillStyle='rgba(255,255,255,.12)'; (i+j)%2?c.fillRect(i*s,j*s+2,s,3):c.fillRect(i*s+2,j*s,3,s); c.strokeStyle='rgba(90,60,25,.35)'; c.strokeRect(i*s+0.5,j*s+0.5,s-1,s-1); } },1,1);
const lavaTex=()=>{ const t=canvasTex(256,64,(c,w,h)=>{ const g=c.createLinearGradient(0,0,0,h); g.addColorStop(0,'#ff3d1a'); g.addColorStop(0.5,'#ffb22e'); g.addColorStop(1,'#ff3d1a'); c.fillStyle=g; c.fillRect(0,0,w,h); for(let i=0;i<60;i++){ c.fillStyle=Math.random()<0.5?'rgba(120,20,10,.55)':'rgba(255,240,150,.6)'; c.beginPath(); c.ellipse(Math.random()*w,Math.random()*h,8+Math.random()*24,2+Math.random()*5,0,0,Math.PI*2); c.fill(); } },1,1); return t; };
const waveTex=()=>canvasTex(256,256,(c,w,h)=>{ c.clearRect(0,0,w,h); c.strokeStyle='rgba(255,255,255,.55)'; c.lineWidth=2; for(let i=0;i<14;i++){ const y=Math.random()*h; c.beginPath(); c.moveTo(0,y); for(let x=0;x<=w;x+=16) c.lineTo(x,y+Math.sin(x*0.05+i)*5); c.stroke(); } },0.2,0.2);
function islandShape(sc,amp){
  const s=new THREE.Shape(), n=80, e=3;
  for(let i=0;i<n;i++){ const t=i/n*Math.PI*2, c=Math.cos(t), sn=Math.sin(t);
    let r=Math.pow(Math.pow(Math.abs(c),e)+Math.pow(Math.abs(sn),e),-1/e)*(1+amp*(Math.sin(t*3+1.3)*0.5+Math.sin(t*7+0.4)*0.3+Math.sin(t*11)*0.2));
    const x=c*r*10.3*sc, y=sn*r*10.45*sc; i?s.lineTo(x,y):s.moveTo(x,y); }
  return s;
}
function slabFromShape(shape,h,topY,bev){ const b=bev||0.08; const g=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:true,bevelThickness:b,bevelSize:b*1.4,bevelSegments:2,curveSegments:4}); g.rotateX(-Math.PI/2); g.translate(0,topY-h-b,OCZ); return g; }
const landK=(x,z)=>Math.pow(Math.abs(x/10.3),3)+Math.pow(Math.abs((z-OCZ)/10.45),3);
// the volcano mesh: VPROF lathed into VSEG segments, each vertex pushed out radially by volcBump (the rugged ridges)
const VPTS=[...VPROF,[1.2,7.5],[1.0,7.05],[0.001,6.95]], VSEG=72;
function volcBump(th,y){ return 1+0.055*Math.sin(th*7+y*1.3)+0.035*Math.sin(th*13-y*2.1)+0.02*Math.sin(th*29+y*4)-0.04*Math.max(0,Math.sin(th*5+0.4))*Math.min(1,y/3); }
let VVERT=null;
// exact height of the volcano mesh at (x,z), or -Infinity off it. Radial displacement keeps every vertical edge in its own
// radial plane, so (x,z) lies in one wedge and only that wedge's triangles need testing; the highest hit wins (crater walls).
function volcSurf(x,z){
  if(!VVERT){ VVERT=[]; for(let i=0;i<=VSEG;i++){ const ph=i/VSEG*Math.PI*2; VVERT.push(VPTS.map(([r,y])=>{ let vx=r*Math.sin(ph), vz=r*Math.cos(ph); if(!(r<0.3||y>7.45)){ const f=volcBump(Math.atan2(vz,vx),y); vx*=f; vz*=f; } return [vx,y,vz]; })); } }
  const lx=x-VOLC.x, lz=z-VOLC.z; let ph=Math.atan2(lx,lz); if(ph<0) ph+=Math.PI*2;
  const i=Math.min(VSEG-1,Math.floor(ph/(Math.PI*2)*VSEG)), A=VVERT[i], B=VVERT[i+1]; let best=-Infinity;
  const tri=(p,q,s)=>{ const d=(q[2]-s[2])*(p[0]-s[0])+(s[0]-q[0])*(p[2]-s[2]); if(Math.abs(d)<1e-9) return;
    const a=((q[2]-s[2])*(lx-s[0])+(s[0]-q[0])*(lz-s[2]))/d, b=((s[2]-p[2])*(lx-s[0])+(p[0]-s[0])*(lz-s[2]))/d, c=1-a-b;
    if(a>=-1e-6&&b>=-1e-6&&c>=-1e-6) best=Math.max(best,a*p[1]+b*q[1]+c*s[1]); };
  for(let k=0;k<VPTS.length-1;k++){ tri(A[k],B[k],A[k+1]); tri(B[k],B[k+1],A[k+1]); }
  return best;
}
function surfY(x,z){ return Math.max(surfRaw(x,z),-0.29); }
function ribbon(pts,width,mat){
  const curve=new THREE.CatmullRomCurve3(pts.map(([x,z])=>new THREE.Vector3(x,0,z))), N=90, pos=[], uv=[], idx=[];
  for(let i=0;i<=N;i++){ const t=i/N, p=curve.getPoint(t), tg=curve.getTangent(t); let nx=-tg.z, nz=tg.x; const l=Math.hypot(nx,nz)||1; nx/=l; nz/=l;
    const w=width*(0.75+0.25*Math.sin(t*17))*(1+t*0.6);
    [-1,1].forEach(s=>{ const x=p.x+nx*w*s, z=p.z+nz*w*s; pos.push(x,surfY(x,z)+0.06,z); uv.push(t*8,s>0?1:0); }); }
  for(let i=0;i<N;i++){ const a=i*2; idx.push(a,a+2,a+1,a+1,a+2,a+3); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat); inner.add(m); return {mesh:m,end:curve.getPoint(1)};
}
function leafGeo(L,W,droop){
  const n=10,pos=[],idx=[];
  for(let i=0;i<=n;i++){ const t=i/n, w=W*Math.sin(Math.PI*Math.min(1,t*1.1))+0.015, x=t*L, y=0.45*t*L/2.4-droop*t*t; pos.push(x,y-w*0.25,-w, x,y+0.02,0, x,y-w*0.25,w); }
  for(let i=0;i<n;i++){ const a=i*3; idx.push(a,a+3,a+1, a+1,a+3,a+4, a+1,a+4,a+2, a+2,a+4,a+5); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function mat4(px,py,pz,rx,ry,rz,sx,sy,sz){ const o=new THREE.Object3D(); o.position.set(px,py,pz); o.rotation.set(rx,ry,rz); o.scale.set(sx||1,sy||sx||1,sz||sx||1); o.updateMatrix(); return o.matrix.clone(); }
function addMerged(g,parts,m){ const me=new THREE.Mesh(mergeGeos(parts),m); me.castShadow=true; me.receiveShadow=true; g.add(me); return me; }
function pandanus(x,z,s){
  const g=new THREE.Group(); g.position.set(x,0,z); g.scale.setScalar(s); g.rotation.y=Math.random()*6.28; inner.add(g);
  const wood=[], leaves=[], lg=leafGeo(1.5,0.07,0.5);
  for(let i=0;i<4;i++){ const a=i*1.57; wood.push([new THREE.CylinderGeometry(0.035,0.05,1.1,6),mat4(Math.cos(a)*0.32,0.45,Math.sin(a)*0.32,Math.sin(a)*0.45,0,-Math.cos(a)*0.45)]); }
  wood.push([new THREE.CylinderGeometry(0.1,0.13,1.6,8),mat4(0,1.5,0,0,0,0)]);
  [[-0.5,2.7,0],[0.55,2.5,0.2],[0,2.9,-0.45]].forEach(([bx,by,bz])=>{
    wood.push([new THREE.CylinderGeometry(0.06,0.08,0.9,6),mat4(bx*0.5,2.25+(by-2.7)*0.5,bz*0.5,bz*0.9,0,-bx*0.9)]);
    for(let k=0;k<9;k++) leaves.push([lg,mat4(bx,by,bz,0,k/9*Math.PI*2,0.5+Math.random()*0.5)]); });
  addMerged(g,wood,std('#8a7458',{roughness:0.95})); addMerged(g,leaves,std('#5c9a48',{side:THREE.DoubleSide,roughness:0.8}));
  g.userData.tap=()=>plantTap(g); g.userData.plant=true;
}
const SG_S=0.04;
const SG_DJ={x:0,y:0.6+LIFT,z:-3.92,ry:0}, SG_SIT={x:2.75,y:0.6+LIFT,z:-2.9,ry:-0.35};
function b64ToBuf(b64){ const bin=atob(b64), u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u.buffer; }
function buildShigost(){
  const wrap=new THREE.Group(); wrap.position.set(SG_SIT.x,SG_SIT.y,SG_SIT.z); wrap.rotation.y=SG_SIT.ry; inner.add(wrap); sg.root=wrap;
  const body=new THREE.Group(); body.scale.setScalar(SG_S); body.position.y=41.4*SG_S; wrap.add(body); sg.body=body;
  const hit=new THREE.Mesh(new THREE.CylinderGeometry(0.8,0.8,3.3,10),new THREE.MeshBasicMaterial()); hit.visible=false; hit.position.y=1.6; wrap.add(hit);
  sg.mode='sit'; sg.ready=false; sg.idleT=10; sg.pop=0;
  wrap.userData.tap=()=>{
    if(sg.mode==='dj'&&anyPlaying()) sgMove('dance',4); else sgWaveT=1.8;
    sgHappy(1.4); addVibe(2);
    const lines=['Shigost waves hi ✿','Shigost says: play something!','Shigost is feeling the vibes','Shigost wants more bass','Shigost does a little wiggle'];
    toast(anyPlaying()?lines[2+Math.floor(Math.random()*3)]:lines[Math.floor(Math.random()*2)]);
  };
  if(!THREE.GLTFLoader){ toast("Shigost's model could not load",'warn'); return; }
  const emb=document.getElementById('sgGlb');
  (emb?Promise.resolve(b64ToBuf(emb.textContent.trim())):fetch('assets/shigost.glb').then(r=>{ if(!r.ok) throw new Error('missing model'); return r.arrayBuffer(); })).then(buf=>new THREE.GLTFLoader().parse(buf,'',gltf=>{
    const root=gltf.scene; body.add(root); sg.gltfRoot=root;
    const tex=new THREE.TextureLoader().load(document.getElementById('sgTex')?'data:image/jpeg;base64,'+document.getElementById('sgTex').textContent.trim():'assets/shigost.jpg');
    tex.flipY=false; tex.encoding=THREE.sRGBEncoding; tex.anisotropy=4;
    root.traverse(o=>{ if(o.isMesh){ o.material.map=tex; o.material.color.set(0xffffff); o.material.roughness=0.96; o.material.metalness=0; o.material.needsUpdate=true; o.castShadow=true; o.receiveShadow=true; o.frustumCulled=false; } });
    sg.bones={};
    ['body','body_top0','neck','arm_left_top','arm_left_bot','arm_left_hand','arm_right_top','arm_right_bot','arm_right_hand'].forEach(n=>sg.bones[n]=root.getObjectByName(n));
    sg.bind=[]; root.traverse(o=>{ if(o.isBone) sg.bind.push([o,o.position.clone(),o.quaternion.clone()]); });
    root.updateMatrixWorld(true);
    const head=root.getObjectByName('head');
    // pink headphones, built in model space then pinned to the head bone
    const hp=new THREE.Group(); root.add(hp);
    const phM=std('#ff8fc0',{roughness:0.45}), cushM=std('#ffd6e8',{roughness:0.9});
    const band=new THREE.Mesh(new THREE.TorusGeometry(17.2,1.3,10,44,Math.PI),phM); band.position.set(0.3,25.5,0.5); band.castShadow=true; hp.add(band);
    [-1,1].forEach(s=>{ const cup=new THREE.Mesh(new THREE.CylinderGeometry(4.8,4.8,3.2,24),phM); cup.rotation.z=Math.PI/2; cup.position.set(0.3+s*17.6,25.5,0.5); cup.castShadow=true; hp.add(cup);
      const cu=new THREE.Mesh(new THREE.CylinderGeometry(3.9,3.9,1.6,22),cushM); cu.rotation.z=Math.PI/2; cu.position.set(0.3+s*15.9,25.5,0.5); hp.add(cu); });
    head.attach(hp);
    // LED eye glow, pulses with the bass at night (a nod to the animatronic)
    const gm=new THREE.MeshBasicMaterial({map:glowTexture(),color:C('#ff6fb8'),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
    sg.glow=gm; sg.glows=[];
    [[9.5,24.6,13.6],[-3.6,24.4,15.6]].forEach(p=>{ const g=new THREE.Mesh(new THREE.PlaneGeometry(13,16),gm); g.position.set(p[0],p[1],p[2]); root.add(g); head.attach(g); sg.glows.push(g); });
    sg.mixer=new THREE.AnimationMixer(root);
    const clip=n=>gltf.animations.find(a=>a.name===n)||gltf.animations[0];
    sg.sit=sg.mixer.clipAction(clip('sit'));
    sg.dance=sg.mixer.clipAction(clip('dance'));
    sg.jump=sg.mixer.clipAction(clip('jump')); sg.jump.setLoop(THREE.LoopOnce,1); sg.jump.clampWhenFinished=true;
    sg.act=null; sg.fading=null; sg.actT=0; sg.w=0; sg.snap=[];
    // POV camera: head bone rotation -> "looking straight out of her face" (body's +z forward, +y up)
    sg.head=head; sg.hp=hp; wrap.updateMatrixWorld(true);
    sg.headOff=head.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wrap.getWorldQuaternion(new THREE.Quaternion()));
    sg.ready=true;
  },err=>{ console.error(err); toast("Shigost's model could not load",'warn'); })).catch(err=>{ console.error(err); toast("Shigost's model could not load. Open the site through a local server, not by double-clicking the file.",'warn'); });
}
function sgStopMove(){ if(!sg.ready) return; sg.dance.stop(); sg.jump.stop(); sg.act=null; sg.fading=null; sg.w=0; sg.actT=0; }
function sgMove(name,beats){
  if(!sg.ready||sg.mode!=='dj') return;
  const beat=60/(audioReady?Tone.getTransport().bpm.value:124), a=sg[name];
  if(sg.act&&sg.act!==a) sg.act.stop();
  if(sg.fading&&sg.fading!==a){ sg.fading.stop(); sg.fading=null; }
  if(name==='dance') a.timeScale=a.getClip().duration/(2*beat);
  if(name==='jump'){ a.timeScale=0.44/beat; beats=a.getClip().duration/a.timeScale/beat; }
  a.reset().play(); sg.act=a; sg.actT=beats*beat;
}
function sgReset(){ sg.bind.forEach(([o,p,q])=>{ o.position.copy(p); o.quaternion.copy(q); }); }
function setSgMode(m){
  if(sg.mode===m) return;
  poof(sg.root.position);
  sg.mode=m; const P=m==='dj'?SG_DJ:SG_SIT;
  sg.root.position.set(P.x,P.y,P.z); sg.root.rotation.y=P.ry;
  sg.body.position.y=41.4*SG_S;
  if(m==='sit') sgStopMove();
  sgReset();
  poof(sg.root.position); sg.pop=1;
}
const _A=new THREE.Vector3(),_B=new THREE.Vector3(),_Cv=new THREE.Vector3(),_E=new THREE.Vector3(),_T=new THREE.Vector3(),_d=new THREE.Vector3(),_pv=new THREE.Vector3(),_v1=new THREE.Vector3(),_v2=new THREE.Vector3();
const _q=new THREE.Quaternion(),_qw=new THREE.Quaternion(),_qp=new THREE.Quaternion(),_qx=new THREE.Quaternion(),_eu=new THREE.Euler();
const sgL=new THREE.Vector3(),sgR=new THREE.Vector3(),poleL=new THREE.Vector3(30,-8,-10),poleR=new THREE.Vector3(-30,-8,-10);
function aimBone(bone,cur,target){
  _q.setFromUnitVectors(cur.normalize(),target.normalize());
  bone.getWorldQuaternion(_qw); _qw.premultiply(_q);
  bone.parent.getWorldQuaternion(_qp); bone.quaternion.copy(_qp.invert().multiply(_qw));
  bone.updateMatrixWorld(true);
}
function ik2(up,lo,hd,Tm,Pm){
  const g=sg.gltfRoot;
  _T.copy(Tm); g.localToWorld(_T); _pv.copy(Pm); g.localToWorld(_pv);
  up.getWorldPosition(_A); lo.getWorldPosition(_B); hd.getWorldPosition(_Cv);
  const la=_A.distanceTo(_B), lb=_B.distanceTo(_Cv);
  _d.subVectors(_T,_A); const dist=clamp(_d.length(),1e-4,la+lb-1e-4); _d.normalize();
  const ca=clamp((la*la+dist*dist-lb*lb)/(2*la*dist),-1,1), sa=Math.sqrt(1-ca*ca);
  _pv.sub(_A); _pv.addScaledVector(_d,-_pv.dot(_d)); if(_pv.lengthSq()<1e-12) _pv.set(0,-1,0); _pv.normalize();
  _E.copy(_A).addScaledVector(_d,ca*la).addScaledVector(_pv,sa*la);
  aimBone(up,_v1.subVectors(_B,_A),_v2.subVectors(_E,_A));
  lo.getWorldPosition(_B); hd.getWorldPosition(_Cv);
  _T.copy(_A).addScaledVector(_d,dist);
  aimBone(lo,_v1.subVectors(_Cv,_B),_v2.subVectors(_T,_B));
}
function boneTurn(bone,x,y,z){ _qx.setFromEuler(_eu.set(x,y,z)); bone.quaternion.multiply(_qx); }
function updateShigost(dt,T,e,playing){
  sgBob=Math.max(0,sgBob-dt*4); sgJump=Math.max(0,sgJump-dt*1.6); sgHappyT=Math.max(0,sgHappyT-dt); sgWaveT=Math.max(0,sgWaveT-dt);
  sg.pop=Math.max(0,sg.pop-dt*1.8);
  if(!sg.ready) return;
  const wantDJ=!!(decks.A&&(decks.A.playing||decks.A.pending||decks.B.playing||decks.B.pending));
  if(wantDJ){ sg.idleT=0; setSgMode('dj'); } else { sg.idleT+=dt; if(sg.idleT>2.5) setSgMode('sit'); }
  const P=sg.mode==='dj'?SG_DJ:SG_SIT;
  const jumpY=0;
  sg.root.position.y=P.y+jumpY;
  const pop=sg.pop, sq=1-0.4*pop+0.18*Math.sin(pop*13)*pop, bobS=sg.mode==='dj'?sgBob:0;
  sg.root.scale.set(sq*(1+bobS*0.03),(2-sq)*(1-bobS*0.04),sq*(1+bobS*0.03));
  const b=sg.bones, happy=sgHappyT>0?Math.sin(T*16)*0.12:0;
  if(sg.mode==='sit'){
    // standing idle: tall and straight, breathing and looking around
    sgReset();
    b.body.position.y+=Math.sin(T*1.7)*0.35;
    boneTurn(b.body_top0,0,Math.sin(T*0.5)*0.05,Math.sin(T*0.9)*0.02);
    boneTurn(b.neck,Math.sin(T*1.1)*0.03,Math.sin(T*0.31)*0.4+Math.sin(T*0.83)*0.1+happy,Math.sin(T*0.8)*0.04+happy*0.5);
    sg.root.updateMatrixWorld(true);
    if(sgWaveT>0){ sgR.set(-21+Math.sin(T*14)*2.5,8.5,8+Math.cos(T*14)*1.5); ik2(b.arm_right_top,b.arm_right_bot,b.arm_right_hand,sgR,poleR); }
  } else {
    if(sg.act){ sg.actT-=dt; if(sg.actT<=0){ if(sg.act===sg.jump) sgMove('dance',8); else { sg.fading=sg.act; sg.act=null; } } }
    const wT=sg.act?1:0; sg.w+=(wT-sg.w)*(1-Math.exp(-dt*(wT?10:5)));
    if(!sg.act&&sg.fading&&sg.w<=0.01){ sg.fading.stop(); sg.fading=null; }
    const clipOn=!!(sg.act||sg.fading);
    if(clipOn){ sg.mixer.update(dt); sg.bind.forEach(([o],i)=>{ const q=sg.snap[i]||(sg.snap[i]={p:new THREE.Vector3(),q:new THREE.Quaternion()}); q.p.copy(o.position); q.q.copy(o.quaternion); }); }
    sgReset();
    b.body.position.y-=bobS*2.2;
    boneTurn(b.body_top0,0,Math.sin(T*1.2)*0.07*(0.4+e)+happy,Math.sin(T*1.6)*0.05*(0.4+e));
    boneTurn(b.neck,bobS*0.18+sgBrace*0.25+Math.sin(T*1.3)*0.03,happy,Math.sin(T*0.9)*0.07*(0.4+e)+happy*0.5);
    sg.root.updateMatrixWorld(true);
    const sc=playing?1:0;
    sgL.set(15+Math.sin(T*9)*1.6*sc,5+Math.abs(Math.sin(T*9))*0.7*sc,11.5+Math.cos(T*9)*0.9*sc);
    sgR.set(-15+Math.sin(T*1.7)*2.4*sc,5+bobS*1.4,11.5);
    if(sgWaveT>0) sgR.set(-21+Math.sin(T*14)*2.5,8.5,8+Math.cos(T*14)*1.5);
    ik2(b.arm_left_top,b.arm_left_bot,b.arm_left_hand,sgL,poleL);
    ik2(b.arm_right_top,b.arm_right_bot,b.arm_right_hand,sgR,poleR);
    if(clipOn){ const w=sg.w; sg.bind.forEach(([o],i)=>{ const q=sg.snap[i]; o.position.lerp(q.p,w); o.quaternion.slerp(q.q,w); }); }
  }
  const g=night*(0.25+lv.bass*1.3);
  sg.glow.opacity=clamp(g,0,1); sg.glows.forEach(m=>m.scale.setScalar(0.85+lv.bass*0.35));
}
/* sparkle poof for Shigost's ghostly teleport */
const poofs={n:280,i:0};
function spark(at,cols,count,speed){ for(let k=0;k<count;k++){ const p=poofs.p[poofs.i]; poofs.i=(poofs.i+1)%poofs.n; const th=Math.random()*6.28; Object.assign(p,{alive:true,life:0,max:0.9+Math.random()*0.8,x:at.x+(Math.random()-0.5)*0.4,y:at.y,z:at.z+(Math.random()-0.5)*0.4,vx:Math.cos(th)*speed*0.25,vy:speed*(0.6+Math.random()*0.6),vz:Math.sin(th)*speed*0.25,c:cols[k%cols.length]}); } }
function buildPoof(){
  poofs.pos=new Float32Array(poofs.n*3); poofs.col=new Float32Array(poofs.n*3); poofs.p=[];
  for(let i=0;i<poofs.n;i++){ poofs.p.push({life:1,max:1,alive:false,x:0,y:0,z:0,vx:0,vy:0,vz:0,c:[1,1,1]}); poofs.pos[i*3+1]=-100; }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(poofs.pos,3)); g.setAttribute('color',new THREE.BufferAttribute(poofs.col,3)); poofs.geo=g;
  const pts=new THREE.Points(g,new THREE.PointsMaterial({size:0.5,map:glowTexture(),vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})); pts.frustumCulled=false; inner.add(pts);
}
function poof(at){
  const cols=[[1,0.55,0.8],[0.75,0.6,1],[0.55,0.9,1],[1,0.9,0.5],[1,1,1]];
  for(let k=0;k<45;k++){ const p=poofs.p[poofs.i]; poofs.i=(poofs.i+1)%poofs.n;
    const th=Math.random()*Math.PI*2, ph=Math.acos(Math.random()*2-1), sp=1.2+Math.random()*2;
    Object.assign(p,{alive:true,life:0,max:0.6+Math.random()*0.5,x:at.x,y:at.y+1.4+(Math.random()-0.5)*1.6,z:at.z,vx:Math.sin(ph)*Math.cos(th)*sp,vy:Math.cos(ph)*sp*0.7+0.6,vz:Math.sin(ph)*Math.sin(th)*sp,c:cols[k%cols.length]}); }
}
function updatePoof(dt){
  let any=false;
  poofs.p.forEach((p,i)=>{ if(!p.alive) return; any=true; p.life+=dt; const t=p.life/p.max;
    if(t>=1){ p.alive=false; poofs.pos[i*3+1]=-100; poofs.col.fill(0,i*3,i*3+3); return; }
    p.vx*=0.94; p.vy*=0.94; p.vz*=0.94; p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt;
    poofs.pos[i*3]=p.x; poofs.pos[i*3+1]=p.y; poofs.pos[i*3+2]=p.z; const f=1-t; poofs.col[i*3]=p.c[0]*f; poofs.col[i*3+1]=p.c[1]*f; poofs.col[i*3+2]=p.c[2]*f; });
  if(any||poofs.dirty){ poofs.geo.attributes.position.needsUpdate=true; poofs.geo.attributes.color.needsUpdate=true; }
  poofs.dirty=any;
}
function mergeGeos(parts){
  const pos=[],nor=[];
  parts.forEach(([g,m])=>{ const gg=g.index?g.toNonIndexed():g.clone(); gg.applyMatrix4(m); pos.push(gg.attributes.position.array); nor.push(gg.attributes.normal.array); });
  const cat=a=>{ const o=new Float32Array(a.reduce((s,x)=>s+x.length,0)); let k=0; a.forEach(x=>{o.set(x,k);k+=x.length;}); return o; };
  const out=new THREE.BufferGeometry(); out.setAttribute('position',new THREE.BufferAttribute(cat(pos),3)); out.setAttribute('normal',new THREE.BufferAttribute(cat(nor),3)); return out;
}
// soft body material for the crowd, matching Shigost's smooth matte look: near-neutral white, rough, no reflections,
// baked AO in the vertex colours, an ambient tint from the surroundings (sky blue from above, grass and sand from below,
// shifting to the night palette), and a soft brightness cap so night washes, strobes, and bass-driven lights tint but never glow
const BODY_TINT={sky:[C('#a9d2ff'),C('#7d6bd6')],ground:[C('#c9dfa2'),C('#2a2050')]};
function softBodyMat(){
  const m=new THREE.MeshStandardMaterial({color:C('#f4f2ee'),vertexColors:true,roughness:0.92,metalness:0});
  const u=m.userData.tint={uTSky:{value:new THREE.Color()},uTGround:{value:new THREE.Color()}};
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,u);
    sh.fragmentShader='uniform vec3 uTSky; uniform vec3 uTGround;\n'+sh.fragmentShader
      .replace('#include <lights_fragment_maps>','#include <lights_fragment_maps>\n { vec3 fbN=inverseTransformDirection(normal,viewMatrix); irradiance+=mix(uTGround,uTSky,0.5+0.5*fbN.y)*PI; }')
      // soft knee: light above 0.8x the surface colour rolls off toward 1.15x it, so coloured washes tint but never bloom
      .replace('#include <output_fragment>','{ vec3 fbCap=diffuseColor.rgb*1.15, fbKnee=fbCap*0.7; outgoingLight=mix(outgoingLight,fbKnee+(fbCap-fbKnee)*(1.-exp(-(outgoingLight-fbKnee)/max(fbCap-fbKnee,vec3(1e-3)))),step(fbKnee,outgoingLight)); }\n#include <output_fragment>');
  };
  return m;
}
function updateBodyTint(m,night){ const u=m.userData.tint, k=0.42;
  u.uTSky.value.copy(BODY_TINT.sky[0]).lerp(BODY_TINT.sky[1],night).multiplyScalar(k*lerp(1,0.6,night));
  u.uTGround.value.copy(BODY_TINT.ground[0]).lerp(BODY_TINT.ground[1],night).multiplyScalar(k*0.7*lerp(1,0.6,night)); }
// bakes soft ambient occlusion into vertex colours: darker near the ground, where limbs meet the body, and under the arms.
// limbs are spheres [x,y,z,r]; body(x,y) returns the nearest body sphere for a vertex at that height; hgt is the body's height
function bakeBodyAO(geo,limbs,body,hgt){
  const P=geo.attributes.position, N=geo.attributes.normal, col=new Float32Array(P.count*3), v=new THREE.Vector3(), n=new THREE.Vector3(), d=new THREE.Vector3();
  const occ=(cx,cy,cz,r)=>{ d.set(cx-v.x,cy-v.y,cz-v.z); const l=d.length(); if(l<r*1.02) return 0; return Math.max(0,n.dot(d.divideScalar(l)))*(r*r)/(l*l); };
  for(let i=0;i<P.count;i++){ v.fromBufferAttribute(P,i); n.fromBufferAttribute(N,i);
    let o=0; limbs.forEach(([x,y,z,r])=>{ o+=occ(x,y,z,r*1.6); }); const b=body(v.x,v.y); o+=occ(b[0],b[1],b[2],b[3])*0.8;
    const ground=1-0.42*(1-sstep(0,0.32*hgt,v.y))*(0.55-0.45*n.y), grad=0.9+0.1*sstep(0.1,0.7*hgt,v.y);
    const a=clamp((1-Math.min(0.5,o*1.3))*ground*grad,0.5,1); col[i*3]=a; col[i*3+1]=a; col[i*3+2]=a; }
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
}
function makeEnv(){
  const pm=new THREE.PMREMGenerator(renderer), es=new THREE.Scene();
  const g=new THREE.SphereGeometry(10,32,16), cols=new Float32Array(g.attributes.position.count*3), top=new THREE.Color('#ffffff'), mid=new THREE.Color('#ece3f7'), bot=new THREE.Color('#b9aed0'), c=new THREE.Color();
  for(let i=0;i<g.attributes.position.count;i++){ const y=g.attributes.position.getY(i)/10; c.copy(y>0?mid:bot).lerp(y>0?top:mid,y>0?y:1+y); cols.set([c.r,c.g,c.b],i*3); }
  g.setAttribute('color',new THREE.BufferAttribute(cols,3));
  es.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.BackSide,vertexColors:true})));
  [[-5,6,6,'#ffffff',3],[7,3,2,'#ffd6ec',2],[0,9,-4,'#ffffff',2.5]].forEach(([x,y,z,col,k])=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(5,2.5),new THREE.MeshBasicMaterial({color:new THREE.Color(col).multiplyScalar(k),side:THREE.DoubleSide})); m.position.set(x,y,z); m.lookAt(0,0,0); es.add(m); });
  const tex=pm.fromScene(es,0.02).texture; pm.dispose(); return tex;
}
function catenary(a,b,sag,n){ const pts=[]; for(let i=0;i<=n;i++){ const t=i/n; const p=a.clone().lerp(b,t); p.y-=sag*4*t*(1-t); pts.push(p); } return pts; }
/* ---------- ocean, reef, lava and sakman upgrades ---------- */
const NOISE_GLSL=`
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float v=0.,a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }`;
/* ---------- irregular island shoreline, beach, reef flat, drop-off ---------- */
// the ocean slab is roomier than the island: ISLE is the footprint the shoreline is generated in, SLAB the sea around it
const SLAB={w:52,d:50,r:0.6}, ISLE={w:40,d:39}, RN=256;
// distances from the shoreline: the sand slopes gently into a shallow lagoon, then a wide reef flat, then the drop-off
const SHELF={beach:3.6,flat:7.0,drop:9.6};
// maps a distance on the old, narrower shelf (beach 2.2, flat 4.6, drop 6.4) to the same spot on this one, so the reef, fish, and boats keep their places
const shelfD=d=>{ const K=[[-0.3,-0.3],[2.2,SHELF.beach],[4.6,SHELF.flat],[6.4,SHELF.drop],[9,SHELF.drop+2.6],[20,SHELF.drop+13.6]]; for(let i=0;i<K.length-1;i++){ const [a,A]=K[i],[b,B]=K[i+1]; if(d<=b) return A+(B-A)*(d-a)/(b-a); } return d+SHELF.drop-6.4; };
const RA=(()=>{
  const req=[[4.3,-7.1,1],[-4.3,-7.1,1],[4.3,-1.8,1],[-4.3,-1.8,1],[7.25,-3.7,0.8],[-7.25,-3.7,0.8],[7.25,-5.1,0.8],[-7.25,-5.1,0.8],[4.5,-0.9,0.8],[-4.5,-0.9,0.8],[4.5,5.0,1.0],[-4.5,5.0,1.0],[0,5.0,1.0],
    [7.6,-1.8,0.8],[-7.6,-1.8,0.8],[5.3,-1.0,0.6],[-5.3,-1.0,0.6],[7.9,5.6,0.8],[-7.9,5.6,0.8],[-8.7,1.2,1.2],[8.6,2.6,1.2],[8.4,-6.4,1.2],[2.6,-10.6,1.2],[6.6,-9.6,1.2],[-8.0,5.2,1.2],[8.2,5.4,1.2],
    [8.7,-2.6,1.1],[-8.6,-2.6,1.1],[-2.6,-10.4,1.1],[-8.3,3.4,0.8],[5.3,-7.6,0.8],[6.0,-7.1,0.8],[-8.8,4.1,0.8]];
  for(let k=0;k<24;k++){ const a=k/24*Math.PI*2; req.push([VOLC.x+Math.cos(a)*(VOLC.r-0.5),VOLC.z+Math.sin(a)*(VOLC.r-0.5),0.9]); }
  const R=new Float32Array(RN);
  for(let i=0;i<RN;i++){ const th=i/RN*Math.PI*2; let r=6.5;
    req.forEach(([x,z,m])=>{ const dx=x, dz=z-(-2.15), D=Math.hypot(dx,dz), ph=Math.atan2(dz,dx); let dl=Math.abs(((th-ph+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI); const s=D*Math.sin(dl);
      if(dl<Math.PI/2&&s<m) r=Math.max(r,D*Math.cos(dl)+Math.sqrt(m*m-s*s)); });
    R[i]=r; }
  const blur=(a,w)=>{ const o=new Float32Array(RN); for(let i=0;i<RN;i++){ let s=0,c=0; for(let k=-w;k<=w;k++){ const g=Math.exp(-(k*k)/(w*w*0.5)); s+=a[(i+k+RN)%RN]*g; c+=g; } o[i]=s/c; } return o; };
  let S=new Float32Array(RN);
  for(let i=0;i<RN;i++){ const th=i/RN*Math.PI*2, c=Math.abs(Math.cos(th)), sn=Math.abs(Math.sin(th)), room=Math.min(ISLE.w/2/Math.max(c,1e-3),ISLE.d/2/Math.max(sn,1e-3))-6.2;
    const base=11.8+1.5*Math.sin(th*2+0.4)+0.9*Math.sin(th*3+2.0)+0.55*Math.sin(th*5+1.1)+0.3*Math.sin(th*8+0.2)+0.15*Math.sin(th*13+1.7);
    S[i]=Math.max(Math.min(base,room),R[i]+0.3); }
  S=blur(S,5); for(let i=0;i<RN;i++) S[i]=Math.max(S[i],R[i]+0.2);
  return S;
})();
function islandR(th){ const t=((th/(Math.PI*2))%1+1)%1*RN, i=Math.floor(t), f=t-i; return RA[i%RN]*(1-f)+RA[(i+1)%RN]*f; }
function shoreD(x,z){ const dz=z-OCZ; return Math.hypot(x,dz)-islandR(Math.atan2(dz,x)); }
const sstep=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const vnoise=(x,z)=>Math.sin(x*1.3+Math.sin(z*0.9))*0.5+Math.sin(z*1.7+Math.sin(x*1.1)*1.3)*0.3+Math.sin((x+z)*3.1)*0.2;
function terrainH(x,z){
  const d=shoreD(x,z), n=vnoise(x,z);
  if(d<-0.3) return 0;
  if(d<SHELF.beach) return -0.62*sstep(-0.3,SHELF.beach,d);
  if(d<SHELF.flat) return -0.62-0.23*sstep(SHELF.beach,SHELF.flat,d)+0.07*n;
  if(d<SHELF.drop) return lerp(-0.85+0.07*n,-3.95,sstep(SHELF.flat,SHELF.drop,d));
  return -3.95-0.22*sstep(SHELF.drop,SHELF.drop+2.6,d)+0.08*n-26*sstep(SHELF.drop+5,SHELF.drop+110,d);
}
// the ridges push the volcano's foot out to about 1.11 x VOLC.r, so look it up a little past the profile radius
// little rocky islets out in the lagoon, between the turtle's lap and the reef (a: angle round the island, R: rock radius, h: height)
let ISLETS=null;
function islets(){ return ISLETS||(ISLETS=[{a:0.15,R:1.05,h:1.35,s:1.7},{a:2.95,R:0.85,h:1.0,s:4.3},{a:5.6,R:0.95,h:1.2,s:2.2}].map(o=>{ const d=islandR(o.a)+5.6;
  return Object.assign(o,{x:Math.cos(o.a)*d,z:OCZ+Math.sin(o.a)*d,cove:o.a}); })); }
function isletLocal(o,dx,dz){ const d=Math.hypot(dx,dz), th=Math.atan2(dz,dx), Rt=o.R*(1+0.18*Math.sin(3*th+o.s)+0.1*Math.sin(5*th+2*o.s)),
    cv=Math.max(0,Math.cos(th-o.cove)), Rc=Rt*(1+0.55*Math.pow(cv,4)), t=d/Rt;
  const rock=t<1?o.h*Math.pow(1-t*t,0.8)*(0.85+0.15*Math.sin(7*th+o.s)+0.08*Math.sin(11*th)):0, sand=d<Rc?0.14*(1-d/Rc):-1;
  return {y:Math.max(rock,sand),Rc}; }
// height of the islets above the sea at (x,z), or -Infinity off them
function isletH(x,z){ let best=-Infinity; for(const o of islets()){ const dx=x-o.x, dz=z-o.z; if(dx*dx+dz*dz>o.R*o.R*2.6) continue; const l=isletLocal(o,dx,dz); if(Math.hypot(dx,dz)<=l.Rc) best=Math.max(best,-0.31+l.y); } return best; }
function surfRaw(x,z){ const dv=Math.hypot(x-VOLC.x,z-VOLC.z); const g=dv<VOLC.r*1.15?Math.max(volcSurf(x,z),terrainH(x,z)):terrainH(x,z); return Math.max(g,isletH(x,z)); }
function buildIslet(o){
  const NS=28, F=[0.13,0.27,0.41,0.54,0.66,0.76,0.85,0.92,0.97,1], pos=[], idx=[];
  const top=-0.31+isletLocal(o,0,0).y; pos.push(o.x,top,o.z);
  F.forEach(f=>{ for(let i=0;i<NS;i++){ const th=i/NS*6.283, Rc=isletLocal(o,Math.cos(th)*1e-3,Math.sin(th)*1e-3).Rc, r=Rc*f*0.999, x=o.x+Math.cos(th)*r, z=o.z+Math.sin(th)*r; pos.push(x,-0.31+isletLocal(o,x-o.x,z-o.z).y,z); } });
  for(let i=0;i<NS;i++){ const th=i/NS*6.283, Rc=isletLocal(o,Math.cos(th)*1e-3,Math.sin(th)*1e-3).Rc, x=o.x+Math.cos(th)*Rc*1.3, z=o.z+Math.sin(th)*Rc*1.3; pos.push(x,terrainH(x,z)-0.05,z); }
  pos.push(o.x,terrainH(o.x,o.z)-0.1,o.z);
  const ring=k=>1+k*NS, nR=F.length+1, bot=1+nR*NS;
  for(let i=0;i<NS;i++){ const j=(i+1)%NS; idx.push(0,ring(0)+j,ring(0)+i); }
  for(let k=0;k<nR-1;k++) for(let i=0;i<NS;i++){ const j=(i+1)%NS, a=ring(k)+i, b=ring(k)+j, c=ring(k+1)+i, d=ring(k+1)+j; idx.push(a,b,c, b,d,c); }
  for(let i=0;i<NS;i++){ const j=(i+1)%NS; idx.push(bot,ring(nR-1)+i,ring(nR-1)+j); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx);
  const flat=g.toNonIndexed(); flat.computeVertexNormals();
  const P=flat.attributes.position, N=flat.attributes.normal, col=new Float32Array(P.count*3), c=new THREE.Color();
  const sand=C('#ead7a8'), wet=C('#c9b17f'), bas=C('#2e2a30'), bas2=C('#463e44'), moss=C('#5d8a3a'), moss2=C('#7aa84a');
  for(let f=0;f<P.count;f+=3){ const y=(P.getY(f)+P.getY(f+1)+P.getY(f+2))/3+0.31, ny=N.getY(f);
    if(y<-0.08) c.copy(bas).lerp(wet,0.15); else if(y<0.02) c.copy(wet); else if(y<0.17&&ny>0.6) c.copy(sand); else if(ny<0.62) c.copy(hash1(f+o.s)<0.5?bas:bas2); else c.copy(hash1(f*1.3+o.s)<0.5?moss:moss2);
    for(let k=0;k<3;k++){ col[(f+k)*3]=c.r; col[(f+k)*3+1]=c.g; col[(f+k)*3+2]=c.b; } }
  flat.setAttribute('color',new THREE.BufferAttribute(col,3)); flat.userData.indexed=g;
  const m=new THREE.Mesh(flat,applyUnderwater(new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.95})));
  m.castShadow=m.receiveShadow=true; m.userData.tap=groundTap; m.userData.islet=true; inner.add(m); return m; }
function clampRB(x,z){ const hx=SLAB.w/2-0.02, hz=SLAB.d/2-0.02, r=SLAB.r; let ax=Math.min(Math.abs(x),hx), az=Math.min(Math.abs(z-OCZ),hz); const qx=ax-(hx-r), qz=az-(hz-r);
  if(qx>0&&qz>0){ const l=Math.hypot(qx,qz); if(l>r){ ax=hx-r+qx/l*r; az=hz-r+qz/l*r; } } return [Math.sign(x)*ax, OCZ+Math.sign(z-OCZ)*az]; }
const TCOL={grass:'#79c95f',sand:'#f1dfb4',wet:'#d8bf8c',reef:'#e6d3a6',rock:'#56485a',bed:'#d8c79c'};
function terrainColor(x,z,y,c){ const d=shoreD(x,z), cs=C, n=vnoise(x*2.3,z*2.1);
  if(d<-0.1){ c.copy(cs(TCOL.grass)).lerp(cs(TCOL.sand),sstep(-1.5,-0.4,d)); return c; }
  if(y>-0.36){ c.copy(cs(TCOL.sand)).lerp(cs(TCOL.wet),sstep(-0.22,-0.34,y)); return c; }
  if(y>-1.0){ c.copy(cs(TCOL.wet)).lerp(cs(TCOL.reef),sstep(-0.36,-0.6,y)); if(n>0.55) c.lerp(cs('#c9a8b8'),0.35); return c; }
  if(y>-3.7){ c.copy(cs(TCOL.reef)).lerp(cs(TCOL.rock),sstep(-1.0,-1.8,y)); return c; }
  c.copy(cs(TCOL.rock)).lerp(cs(TCOL.bed),sstep(-3.7,-4.0,y)); return c; }
// rows of vertices stepping outward from a closed perimeter (points relative to the island centre at z=OCZ), scaled by each entry of scales.
// Used to carry the seabed and the sea surface from the detailed area out to the horizon with few triangles.
function perimeterRing(per,scales,yFn,colour){
  const pos=[], col=[], idx=[], c=new THREE.Color(), n=per.length;
  scales.forEach(sc=>per.forEach(p=>{ const x=p.x*sc, z=OCZ+p.y*sc, y=yFn(x,z); pos.push(x,y,z); if(colour){ terrainColor(x,z,y,c); col.push(c.r,c.g,c.b); } }));
  for(let k=0;k<scales.length-1;k++) for(let i=0;i<n-1;i++){ const a=k*n+i, b=a+n; idx.push(a,a+1,b,a+1,b+1,b); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); if(colour) g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
  // the perimeter's direction decides the winding; make sure the surface faces up
  if(g.attributes.normal.getY(n)<0){ for(let i=0;i<idx.length;i+=3){ const t=idx[i+1]; idx[i+1]=idx[i+2]; idx[i+2]=t; } g.setIndex(idx); g.computeVertexNormals(); }
  return g;
}
function buildTerrain(){
  const NX=Math.round(SLAB.w*4.75), NZ=Math.round(SLAB.d*4.72), pos=[], col=[], idx=[], c=new THREE.Color();
  for(let j=0;j<=NZ;j++) for(let i=0;i<=NX;i++){ let x=-SLAB.w/2+SLAB.w*i/NX, z=OCZ-SLAB.d/2+SLAB.d*j/NZ; [x,z]=clampRB(x,z); const y=terrainH(x,z); pos.push(x,y,z); terrainColor(x,z,y,c); col.push(c.r,c.g,c.b); }
  for(let j=0;j<NZ;j++) for(let i=0;i<NX;i++){ const a=j*(NX+1)+i, b=a+NX+1; idx.push(a,b,a+1,a+1,b,b+1); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
  const m=new THREE.Mesh(g,applyUnderwater(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.95}))); m.receiveShadow=true; inner.add(m);
  // the seabed keeps going past the detailed area, sloping off into the deep (fog hides where it ends)
  const bed=new THREE.Mesh(perimeterRing(rrShape(SLAB.w-0.03,SLAB.d-0.03,SLAB.r).getSpacedPoints(360),[0.996,1.03,1.08,1.18,1.35,1.6,2,2.7,3.8,5.5,8,12],(x,z)=>terrainH(x,z),true),m.material);
  bed.receiveShadow=true; inner.add(bed); isl.seabed=bed;
  return m;
}
function riverPath(start,dir){ const pts=[start]; let x=start[0], z=start[1]; const l=Math.hypot(dir[0],dir[1]), dx=dir[0]/l, dz=dir[1]/l;
  for(let i=0;i<80;i++){ x+=dx*0.55+Math.sin(i*1.3)*0.1; z+=dz*0.55+Math.cos(i*1.1)*0.1; pts.push([x,z]); if(Math.hypot(x-VOLC.x,z-VOLC.z)>VOLC.r&&terrainH(x,z)<-0.36){ pts.push([x+dx*0.8,z+dz*0.8]); break; } } return pts; }
// darkens the water over coral: splats every coral position into the height texture's G channel
function bakeReefMask(){ const t=isl.hTex, N=t.image.width, d=t.image.data, cell=SLAB.w/N, R=1.5;
  (isl.coralPts||[]).forEach(([x,y,z])=>{ const ci=(x+SLAB.w/2)/SLAB.w*N, cj=(z-(OCZ-SLAB.d/2))/SLAB.d*N, rr=Math.ceil(R/cell);
    for(let j=Math.max(0,Math.floor(cj-rr));j<=Math.min(N-1,Math.ceil(cj+rr));j++) for(let i=Math.max(0,Math.floor(ci-rr));i<=Math.min(N-1,Math.ceil(ci+rr));i++){
      const dd=Math.hypot((i-ci)*cell,(j-cj)*cell*SLAB.d/SLAB.w); if(dd>R) continue; const k=(j*N+i)*4+1; d[k]=Math.min(255,d[k]+Math.round(90*(1-dd/R))); } });
  t.needsUpdate=true; }
function heightTex(){
  const N=256, data=new Uint8Array(N*N*4);
  for(let j=0;j<N;j++) for(let i=0;i<N;i++){ const x=-SLAB.w/2+SLAB.w*(i+0.5)/N, z=OCZ-SLAB.d/2+SLAB.d*(j+0.5)/N; const y=surfRaw(x,z); const v=clamp((y+4.5)/5,0,1)*255; const k=(j*N+i)*4; data[k]=v; data[k+1]=0; data[k+2]=v; data[k+3]=255; }
  const t=new THREE.DataTexture(data,N,N,THREE.RGBAFormat); t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearFilter; t.needsUpdate=true; return t;
}
function waveHjs(x,z,t){
  let h=0.06*Math.sin(x*0.55+z*0.25+t*1.3)+0.04*Math.sin((-x*0.3+z*0.7)*1.6+t*1.9)+0.025*Math.sin((x*0.8-z*0.5)*2.7+t*2.6)+0.015*Math.sin((-x*0.6-z*0.6)*4.1+t*3.3);
  const depth=-0.31-terrainH(x,z); return h*(0.2+0.8*sstep(0.05,2.0,depth));
}
function randOcean(d0,d1,tries){ for(let k=0;k<(tries||400);k++){ const x=(Math.random()-0.5)*(SLAB.w-1.2), z=OCZ+(Math.random()-0.5)*(SLAB.d-1.2); const d=shoreD(x,z); if(d<d0||d>d1) continue; if(islets().some(o=>Math.hypot(x-o.x,z-o.z)<o.R*1.6+0.5)) continue; return [x,z,d]; } return null; }
function makeWaterSurface(hTex){
  const u={uTime:{value:0},uNight:{value:0},uBass:{value:0},uH:{value:hTex},uSun:{value:new THREE.Vector3(-0.45,0.8,0.42).normalize()},
    uRip:{value:[0,1,2,3].map(()=>new THREE.Vector4(0,0,-99,0))},uRipG:{value:[0,0,0,0]},uUw:{value:0},uUwFog:{value:new THREE.Color()},uFogN:{value:70},uFogF:{value:520}};
  const g=new THREE.PlaneGeometry(SLAB.w,SLAB.d,Math.round(SLAB.w*4.5),Math.round(SLAB.d*4.5)); g.rotateX(-Math.PI/2);
  // up to four ripple rings (x, z, start time, strength), each optionally glowing at night: taps and beats, never a deforming sea
  const RIP=`uniform vec4 uRip[4]; uniform float uRipG[4];
    float ripH(vec2 p){ float h=0.; for(int i=0;i<4;i++){ float age=uTime-uRip[i].z; if(age>0.&&age<4.){ float f=length(p-uRip[i].xy)-age*2.4; h+=sin(f*6.)*exp(-f*f*2.)*exp(-age*0.9)*0.06*uRip[i].w; } } return h; }
    vec2 ripRing(vec2 p){ vec2 r=vec2(0.); for(int i=0;i<4;i++){ float age=uTime-uRip[i].z; if(age>0.&&age<4.){ float f=length(p-uRip[i].xy)-age*2.4, e=exp(-f*f*2.)*exp(-age*0.9)*uRip[i].w; r+=vec2(e*(0.5+0.5*sin(f*6.)),e*uRipG[i]); } } return r; }`;
  const HS=`uniform sampler2D uH; float terr(vec2 w){ vec2 uv=vec2((w.x+${(SLAB.w/2).toFixed(2)})/${SLAB.w.toFixed(1)},(w.y-(${(OCZ-SLAB.d/2).toFixed(2)}))/${SLAB.d.toFixed(1)}); return texture2D(uH,uv).r*5.-4.5; }
    float reefM(vec2 w){ vec2 uv=vec2((w.x+${(SLAB.w/2).toFixed(2)})/${SLAB.w.toFixed(1)},(w.y-(${(OCZ-SLAB.d/2).toFixed(2)}))/${SLAB.d.toFixed(1)}); return texture2D(uH,uv).g; }
    float waveH(vec2 p,float t,float depth){ float h=0.06*sin(dot(p,vec2(0.55,0.25))+t*1.3)+0.04*sin(dot(p,vec2(-0.3,0.7))*1.6+t*1.9)+0.025*sin(dot(p,vec2(0.8,-0.5))*2.7+t*2.6)+0.015*sin(dot(p,vec2(-0.6,-0.6))*4.1+t*3.3); return h*(0.2+0.8*smoothstep(0.05,2.,depth)); }`;
  const m=new THREE.ShaderMaterial({uniforms:u,transparent:true,side:THREE.DoubleSide,
    vertexShader:HS+`
      uniform float uTime; varying vec2 vP; varying vec3 vN; varying vec3 vW; varying float vH; varying float vD; varying float vNear;
      ${RIP}
      void main(){ vec3 p=position; vP=vec2(p.x,p.z+(${OCZ.toFixed(2)})); float d=-0.31-terr(vP); vD=d;
        vNear=1.-smoothstep(${(SLAB.w/2-5).toFixed(1)},${(SLAB.w/2-0.5).toFixed(1)},max(abs(p.x),abs(p.z)*${(SLAB.w/SLAB.d).toFixed(3)}));
        float far=(1.-smoothstep(60.,260.,length((modelMatrix*vec4(p,1.)).xyz-cameraPosition)))*vNear;
        float h=waveH(vP,uTime,d)*far+ripH(vP);
        float e=0.2; float hx=waveH(vP+vec2(e,0.),uTime,d)*far+ripH(vP+vec2(e,0.))-h, hz=waveH(vP+vec2(0.,e),uTime,d)*far+ripH(vP+vec2(0.,e))-h;
        vN=normalize(mat3(modelMatrix)*normalize(vec3(-hx/e,1.,-hz/e))); p.y+=h; vH=h;
        vec4 w=modelMatrix*vec4(p,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader:NOISE_GLSL+HS+`
      uniform float uTime,uNight,uBass,uUw,uFogN,uFogF; uniform vec3 uSun,uUwFog; varying vec2 vP; varying vec3 vN; varying vec3 vW; varying float vH; varying float vD; varying float vNear;
      ${RIP}
      void main(){
        float depth=-0.31-terr(vP);
        if(depth<-0.06) discard;
        if(!gl_FrontFacing){
          vec3 vv=normalize(vW-cameraPosition); float up=clamp(vv.y,0.,1.), win=smoothstep(0.62,0.86,up);
          float wn=noise(vP*2.2+vec2(uTime*0.5,-uTime*0.35))*0.6+noise(vP*5.1-vec2(uTime*0.8,uTime*0.6))*0.4;
          vec3 c=mix(vec3(0.07,0.42,0.5),vec3(0.82,0.97,1.),win*(0.75+0.35*wn))+vec3(0.15,0.2,0.2)*smoothstep(0.55,0.85,wn)*(0.3+0.7*win);
          c*=mix(1.,0.3,uNight); c=mix(c,uUwFog,smoothstep(3.,40.,length(vW-cameraPosition))*(1.-win*0.6));
          gl_FragColor=vec4(c,0.94); return;
        }
        vec3 col=mix(vec3(0.37,0.89,0.86),vec3(0.13,0.71,0.79),smoothstep(0.05,0.7,depth));
        col=mix(col,vec3(0.12,0.5,0.72),smoothstep(0.7,1.8,depth));
        col=mix(col,vec3(0.04,0.25,0.48),smoothstep(1.8,3.6,depth));
        float rm=vNear>0.01?reefM(vP)*smoothstep(0.4,1.2,depth):0.; col=mix(col,vec3(0.05,0.3,0.45),rm*0.5);
        float far=1.-smoothstep(60.,260.,length(vW-cameraPosition));
        vec3 n=normalize(vN), v=normalize(cameraPosition-vW), hh=normalize(uSun+v);
        if(vNear<0.999){ vec2 q=vP*0.4+vec2(uTime*0.06,uTime*0.04); float d0=noise(q), nx=noise(q+vec2(0.6,0.))-d0, nz=noise(q+vec2(0.,0.6))-d0; n=normalize(n+vec3(-nx,0.,-nz)*0.35*(1.-vNear)*(0.3+0.7*far)); }
        float diff=clamp(dot(n,uSun),0.,1.), spec=pow(max(dot(n,hh),0.),110.)*(1.-uNight*0.85), fres=pow(1.-max(dot(n,v),0.),3.);
        col=col*(0.74+0.36*diff)+spec*1.3;
        // at grazing angles the sea mirrors the sky
        col=mix(col,vec3(0.72,0.86,0.96)*mix(1.,0.3,uNight),fres*0.6);
        float camD=length(vW-cameraPosition), fogK=smoothstep(uFogN,uFogF,camD);
        if(vNear<0.01){ col*=mix(1.,0.42,uNight); col+=uNight*vec3(0.,0.03,0.07); gl_FragColor=vec4(mix(col,uUwFog,fogK),1.); return; }
        float fn=noise(vP*3.2+vec2(uTime*0.35,uTime*0.22));
        float lap=0.16+0.1*sin(uTime*1.5+vP.x*0.45+vP.y*0.35);
        float shore=1.-smoothstep(0.,lap,depth);
        float line2=(1.-smoothstep(0.0,0.04,abs(depth-(lap+0.12+0.05*sin(uTime*1.1+vP.y)))))*0.8;
        float foam=clamp(shore*(0.55+0.6*fn)+line2*fn+smoothstep(0.075,0.12,vH)*fn*0.7*far,0.,1.);
        vec2 rp=ripRing(vP); col=mix(col,vec3(0.97,1.,1.),rp.x*0.4);
        col=mix(col,vec3(0.97,1.,1.),foam);
        float iri=0.05*sin(vP.x*0.8+vP.y*0.6+uTime*0.7); col+=vec3(iri,-iri*0.5,iri*1.2)*smoothstep(0.8,2.,depth)*far;
        col*=mix(1.,0.42,uNight);
        float bio=uNight<0.01?0.:uNight*(0.25+uBass*1.1)*smoothstep(0.55,0.88,noise(vP*1.6-uTime*0.3))*far*(1.-smoothstep(17.,24.,length(vP-vec2(0.,${OCZ.toFixed(2)})))); // glows around the island, not the open sea
        col+=vec3(0.1,0.85,1.)*(bio+rp.y*uNight*1.4)+uNight*vec3(0.,0.03,0.07);
        float a=mix(0.22,0.6,smoothstep(0.05,1.6,depth)); a=mix(a,1.,fres*0.7); a=mix(a,0.85,smoothstep(2.,4.,depth)); a=mix(a,1.,max(smoothstep(5.,9.,depth),1.-vNear)); // open ocean is opaque, so the seabed's far edge never shows a=min(0.9,a+rm*0.12);
        a*=smoothstep(-0.06,0.03,depth);
        col=mix(col,uUwFog,fogK);
        gl_FragColor=vec4(col,max(mix(a,1.,fogK),foam*smoothstep(-0.06,0.02,depth)));
      }`});
  const me=new THREE.Mesh(g,m); me.position.set(0,-0.31,OCZ); me.renderOrder=2; inner.add(me);
  // the same sea carries on past the detailed area to the horizon, as a light ring of big triangles
  const rg=perimeterRing(rrShape(SLAB.w,SLAB.d,0.01).getSpacedPoints(300),[1,1.06,1.15,1.3,1.55,2,2.8,4,6,9,14,20,27],()=>0,false); rg.translate(0,0,-OCZ);
  const ring=new THREE.Mesh(rg,m); ring.position.copy(me.position); ring.renderOrder=2; ring.frustumCulled=false; inner.add(ring);
  [me,ring].forEach(w=>w.userData.tap=waterTap); isl.waterMeshes=[me,ring];
  return u;
}
/* ---------- reef life: detailed fish and critters ---------- */
function colorGeo(geo,fn){ const g=geo.index?geo.toNonIndexed():geo.clone(); const p=g.attributes.position, c=new Float32Array(p.count*3), tc=new THREE.Color(); for(let i=0;i<p.count;i++){ fn(p.getX(i),p.getY(i),p.getZ(i),tc); c[i*3]=tc.r; c[i*3+1]=tc.g; c[i*3+2]=tc.b; } g.setAttribute('color',new THREE.BufferAttribute(c,3)); return g; }
function mergeC(parts){ const pos=[],nor=[],col=[];
  parts.forEach(([g,m])=>{ const gg=g.clone(); gg.applyMatrix4(m); pos.push(gg.attributes.position.array); nor.push(gg.attributes.normal.array); col.push(gg.attributes.color.array); });
  const cat=a=>{ const o=new Float32Array(a.reduce((s,x)=>s+x.length,0)); let k=0; a.forEach(x=>{o.set(x,k);k+=x.length;}); return o; };
  const out=new THREE.BufferGeometry(); out.setAttribute('position',new THREE.BufferAttribute(cat(pos),3)); out.setAttribute('normal',new THREE.BufferAttribute(cat(nor),3)); out.setAttribute('color',new THREE.BufferAttribute(cat(col),3)); return out; }
function finGeo(pts){ const s=new THREE.Shape(); pts.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y)); const g=new THREE.ShapeGeometry(s); return g; }
function fishGeo(sp){
  const L=sp.L, H=sp.H, W=sp.W, parts=[], I=new THREE.Matrix4();
  const body=new THREE.SphereGeometry(1,22,14); body.scale(L/2,H/2,W/2);
  parts.push([colorGeo(body,(x,y,z,c)=>sp.body(x/(L/2),y/(H/2),c)),I]);
  const tail=finGeo([[0,0],[-L*0.32,H*0.42],[-L*0.24,0],[-L*0.32,-H*0.42]]); tail.translate(-L*0.44,0,0);
  parts.push([colorGeo(tail,(x,y,z,c)=>c.copy(C(sp.fin))),I]);
  const dor=finGeo(sp.dorsal(L,H)); parts.push([colorGeo(dor,(x,y,z,c)=>c.copy(C(sp.dfin||sp.fin))),I]);
  const anal=finGeo([[L*0.05,-H*0.4],[-L*0.3,-H*0.42],[-L*0.18,-H*0.62]]); parts.push([colorGeo(anal,(x,y,z,c)=>c.copy(C(sp.fin))),I]);
  [-1,1].forEach(s=>{ const pec=finGeo([[0,0],[-L*0.18,H*0.12],[-L*0.16,-H*0.1]]); parts.push([colorGeo(pec,(x,y,z,c)=>c.copy(C(sp.fin))),mat4(L*0.18,-H*0.08,s*W*0.45,0,s*0.6,0)]);
    const eye=new THREE.SphereGeometry(1,10,8); parts.push([colorGeo(eye,(x,y,z,c)=>c.set(z*s>0.4?0x050505:0xf4f4f4)),mat4(L*0.3,H*0.12,s*W*0.36,0,0,0,H*0.11,H*0.11,H*0.07)]); });
  return mergeC(parts);
}
const FISH=[
  {name:'clown',n:12,L:0.36,H:0.17,W:0.1,fin:'#ff8a1f',body:(x,y,c)=>{ const b=(Math.abs(x-0.45)<0.12||Math.abs(x+0.1)<0.13||Math.abs(x+0.72)<0.08); const e=(Math.abs(Math.abs(x-0.45)-0.12)<0.04||Math.abs(Math.abs(x+0.1)-0.13)<0.04); c.copy(C(e?'#111111':b?'#ffffff':'#ff7a10')); },dorsal:(L,H)=>[[L*0.25,H*0.38],[-L*0.3,H*0.42],[-L*0.05,H*0.62],[L*0.1,H*0.55]]},
  {name:'idol',n:10,L:0.4,H:0.38,W:0.07,fin:'#ffd23f',dfin:'#f6f6f6',body:(x,y,c)=>{ c.copy(C(x>0.05&&x<0.42?'#141414':x<-0.35&&x>-0.7?'#141414':x>0.55?'#ffd23f':'#f8f4e8')); if(x>0.7&&y<0) c.copy(C('#ff9a30')); },dorsal:(L,H)=>[[L*0.2,H*0.45],[-L*0.15,H*0.4],[-L*0.55,H*1.05],[-L*0.05,H*0.7]]},
  {name:'butterfly',n:14,L:0.32,H:0.26,W:0.07,fin:'#ffe14d',body:(x,y,c)=>{ c.copy(C(Math.abs(x-0.55)<0.1?'#151515':'#ffe14d')); if(x<-0.3&&y>0.2) c.copy(C('#1d1d1d')); if(x<-0.55) c.copy(C('#fff3b8')); },dorsal:(L,H)=>[[L*0.3,H*0.45],[-L*0.35,H*0.4],[-L*0.1,H*0.62]]},
  {name:'parrot',n:8,L:0.62,H:0.24,W:0.15,fin:'#ff7ab8',body:(x,y,c)=>{ c.copy(C(y>0.2?'#2f9e8f':'#3fc4a8')); if(Math.sin(x*18)>0.6) c.lerp(C('#7be3ff'),0.5); if(x>0.75) c.copy(C('#ff8fc2')); },dorsal:(L,H)=>[[L*0.3,H*0.42],[-L*0.36,H*0.4],[-L*0.2,H*0.55],[L*0.15,H*0.55]]}
];
function fishMaterial(){ const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.45,side:THREE.DoubleSide}); m.userData.u={uGlow:{value:0},uTime:{value:0}};
  m.onBeforeCompile=sh=>{ sh.uniforms.uGlow=m.userData.u.uGlow; sh.uniforms.uTime=m.userData.u.uTime;
    sh.vertexShader='uniform float uTime;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n float ph=instanceMatrix[3].x*2.1+instanceMatrix[3].z*1.3; transformed.z+=sin(uTime*10.+ph-position.x*9.)*0.04*(1.-smoothstep(-0.25,0.05,position.x));');
    sh.fragmentShader='uniform float uGlow;\n'+sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uGlow;'); };
  return m; }
function critterGeos(){
  const table=mergeGeos([[new THREE.CylinderGeometry(0.06,0.09,0.3,8),mat4(0,0.15,0,0,0,0)],[new THREE.CylinderGeometry(0.55,0.5,0.06,20),mat4(0,0.32,0,0,0,0)],[new THREE.CylinderGeometry(0.35,0.3,0.05,16),mat4(0.1,0.38,0.05,0,0,0)]]);
  const an=[[new THREE.CylinderGeometry(0.16,0.2,0.16,14),mat4(0,0.08,0,0,0,0)]];
  for(let k=0;k<26;k++){ const a=k*2.4, r=0.05+(k%3)*0.05; an.push([new THREE.ConeGeometry(0.025,0.28,5),mat4(Math.cos(a)*r,0.27,Math.sin(a)*r,Math.sin(a)*0.5,0,-Math.cos(a)*0.5)]); }
  const anemone=mergeGeos(an);
  const st=new THREE.Shape(); for(let i=0;i<10;i++){ const a=i/10*Math.PI*2+Math.PI/2, r=i%2?0.08:0.26; i?st.lineTo(Math.cos(a)*r,Math.sin(a)*r):st.moveTo(Math.cos(a)*r,Math.sin(a)*r); }
  const star=new THREE.ExtrudeGeometry(st,{depth:0.04,bevelEnabled:true,bevelThickness:0.02,bevelSize:0.02,bevelSegments:2}); star.rotateX(-Math.PI/2);
  const ur=[[new THREE.SphereGeometry(0.12,12,10),mat4(0,0.1,0,0,0,0)]];
  for(let k=0;k<30;k++){ const v=new THREE.Vector3(Math.random()-0.5,Math.random()*0.8,Math.random()-0.5).normalize(); const o=new THREE.Object3D(); o.position.copy(v).multiplyScalar(0.18).add(new THREE.Vector3(0,0.1,0)); o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v); o.updateMatrix(); ur.push([new THREE.ConeGeometry(0.012,0.22,4),o.matrix.clone()]); }
  const urchin=mergeGeos(ur);
  const cuc=new THREE.SphereGeometry(0.1,14,10); cuc.scale(3.2,0.75,1); const cp=cuc.attributes.position; for(let i=0;i<cp.count;i++){ cp.setY(i,cp.getY(i)*(1+0.15*Math.sin(cp.getX(i)*40))+0.07); } cuc.computeVertexNormals();
  const soft=new THREE.CylinderGeometry(0.32,0.12,0.22,24,2); const sp=soft.attributes.position; for(let i=0;i<sp.count;i++){ const x=sp.getX(i),z=sp.getZ(i),y=sp.getY(i); if(y>0) sp.setY(i,y+0.06*Math.sin(Math.atan2(z,x)*6)); sp.setY(i,sp.getY(i)+0.11); } soft.computeVertexNormals();
  return {table,anemone,star,urchin,cuc,soft};
}
function makeLavaShader(){
  const u={uTime:{value:0},uBass:{value:0},uBoost:{value:0}};
  const m=new THREE.ShaderMaterial({uniforms:u,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:NOISE_GLSL+`
      uniform float uTime,uBass,uBoost; varying vec2 vUv;
      void main(){
        vec2 p=vec2(vUv.x*2.2-uTime*0.3,vUv.y*2.2);
        float n=fbm(p*1.7), crustN=fbm(p*3.1+vec2(7.,3.));
        float center=1.-abs(vUv.y-0.5)*2.;
        float crack=smoothstep(0.42,0.6,crustN)*(1.-smoothstep(0.25,0.9,center)*0.6);
        vec3 hot=mix(vec3(1.,0.28,0.04),vec3(1.,0.86,0.36),pow(n,1.5)*(0.8+uBass*0.6+uBoost*0.3));
        vec3 crust=mix(vec3(0.09,0.04,0.035),vec3(0.24,0.08,0.05),noise(p*9.));
        vec3 col=mix(hot*(1.1+uBass*0.7+uBoost*0.5),crust,crack);
        col+=vec3(1.,0.5,0.1)*0.25*sin(uTime*3.+vUv.x*6.)*(1.-crack);
        gl_FragColor=vec4(col,1.);
      }`});
  return {m,u};
}
function ribbon2(pts,width,mat,lift,bulge,seg){
  const curve=new THREE.CatmullRomCurve3(pts.map(([x,z])=>new THREE.Vector3(x,0,z))), N=110, M=seg||6, pos=[], uv=[], idx=[], ds=curve.getLength()/N/2;
  for(let i=0;i<=N;i++){ const t=i/N, p=curve.getPoint(t), tg=curve.getTangent(t); let nx=-tg.z, nz=tg.x; const l=Math.hypot(nx,nz)||1; nx/=l; nz/=l;
    const w=width*(0.8+0.2*Math.sin(t*19)+0.12*Math.sin(t*43))*(1+t*0.5), dw=w/M;
    // highest ground within half a cell, so the flat span between vertices clears ridges and the crater rim
    for(let j=0;j<=M;j++){ const v=j/M, s=v*2-1, x=p.x+nx*w*s, z=p.z+nz*w*s;
      let h=-Infinity; for(let a=-1;a<=1;a++) for(let c=-1;c<=1;c++) h=Math.max(h,surfY(x+tg.x*ds*a+nx*dw*c,z+tg.z*ds*a+nz*dw*c));
      pos.push(x,h+lift+bulge*Math.sin(Math.PI*v),z); uv.push(t*8,v); } }
  for(let i=0;i<N;i++) for(let j=0;j<M;j++){ const a=i*(M+1)+j, b=a+M+1; idx.push(a,b,a+1,a+1,b,b+1); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals();
  const me=new THREE.Mesh(g,mat); me.receiveShadow=true; inner.add(me); return {mesh:me,curve,end:curve.getPoint(1)};
}
// Underwater look for the seabed and reef: light absorption tints them turquoise in the shallows and deep blue further
// down, and soft animated caustics play over them in daylight, fading with depth. Chains onto an existing patch (glowify).
const UWU={uUwT:{value:0},uUwDay:{value:1}};
function applyUnderwater(m){ const prev=m.onBeforeCompile;
  m.onBeforeCompile=(sh,r)=>{ if(prev) prev(sh,r); Object.assign(sh.uniforms,UWU);
    sh.vertexShader='varying vec3 vUwP;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n { vec4 uwp=vec4(transformed,1.);\n #ifdef USE_INSTANCING\n uwp=instanceMatrix*uwp;\n #endif\n vUwP=(modelMatrix*uwp).xyz; }');
    sh.fragmentShader='varying vec3 vUwP; uniform float uUwT,uUwDay;\n'+
      'float uwCaus(vec2 p,float t){ vec2 q=p*1.3; float c=0.; for(int i=0;i<3;i++){ q+=vec2(sin(q.y*1.3+t*0.8),cos(q.x*1.1-t*0.6))*0.5; c+=abs(sin(q.x+q.y*0.7+t*0.5)); q=q*1.6+vec2(1.7,9.2); } return pow(max(0.,1.-c*0.38),4.); }\n'+
      sh.fragmentShader
      .replace('#include <color_fragment>','#include <color_fragment>\n float uwD=max(0.,-0.31-vUwP.y); diffuseColor.rgb*=mix(vec3(1.),mix(vec3(0.42,0.88,0.92),vec3(0.16,0.44,0.74),smoothstep(0.8,4.,uwD)),smoothstep(0.,0.3,uwD));')
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n if(uwD>0.03&&uwD<7.&&uUwDay>0.05) totalEmissiveRadiance+=vec3(0.8,1.,0.95)*uwCaus(vUwP.xz,uUwT)*smoothstep(0.03,0.3,uwD)*(1.-smoothstep(2.,7.,uwD))*uUwDay*0.55;');
  };
  m.customProgramCacheKey=()=>'uw|'+(prev?prev.toString():'');
  return m;
}
function glowify(m){ m.userData.u={uGlow:{value:0}}; m.onBeforeCompile=sh=>{ sh.uniforms.uGlow=m.userData.u.uGlow; sh.fragmentShader='uniform float uGlow;\n'+sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uGlow;'); }; return m; }
function coralGeos(){
  const brain=new THREE.SphereGeometry(0.34,28,16,0,Math.PI*2,0,Math.PI/2), bp=brain.attributes.position;
  for(let i=0;i<bp.count;i++){ const x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i); const r=1+0.07*Math.sin(x*38+Math.sin(z*30)*2)*Math.min(1,y*6); bp.setXYZ(i,x*r,y*r*0.8,z*r); }
  brain.computeVertexNormals();
  const parts=[], tip=new THREE.SphereGeometry(1,5,4);
  const grow=(x,y,z,dx,dy,dz,len,rad,depth)=>{ const d=new THREE.Vector3(dx,dy,dz).normalize(), e=new THREE.Vector3(x,y,z).addScaledVector(d,len);
    const c=new THREE.CylinderGeometry(rad*0.75,rad,len,5); const o=new THREE.Object3D(); o.position.set((x+e.x)/2,(y+e.y)/2,(z+e.z)/2); o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d); o.updateMatrix(); parts.push([c,o.matrix.clone()]);
    if(depth>0){ for(let k=0;k<2;k++){ const a=Math.random()*6.28; grow(e.x,e.y,e.z,d.x+Math.cos(a)*0.7,d.y+0.3,d.z+Math.sin(a)*0.7,len*0.72,rad*0.72,depth-1); } }
    else parts.push([tip,mat4(e.x,e.y,e.z,0,0,0,rad*0.85)]); };
  for(let k=0;k<4;k++){ const a=k*1.57+0.3; grow(0,0,0,Math.cos(a)*0.4,1,Math.sin(a)*0.4,0.32,0.05,2); }
  const stag=mergeGeos(parts);
  const tubes=[]; for(let k=0;k<7;k++){ const a=k*0.9, r=k?0.14:0, h=0.25+Math.random()*0.3; tubes.push([new THREE.CylinderGeometry(0.06,0.07,h,10,1,true),mat4(Math.cos(a)*r,h/2,Math.sin(a)*r,0,0,0)]); tubes.push([new THREE.TorusGeometry(0.06,0.018,6,12),mat4(Math.cos(a)*r,h,Math.sin(a)*r,Math.PI/2,0,0)]); }
  const tube=mergeGeos(tubes);
  const fan=new THREE.CircleGeometry(0.55,24,0,Math.PI); fan.translate(0,0.02,0);
  const clamS=new THREE.SphereGeometry(0.3,20,10,0,Math.PI,0,Math.PI); const cp=clamS.attributes.position;
  for(let i=0;i<cp.count;i++){ const x=cp.getX(i),y=cp.getY(i),z=cp.getZ(i); cp.setXYZ(i,x*1.3,Math.abs(y)*0.55+0.03*Math.sin(x*30),z*0.7); }
  clamS.computeVertexNormals();
  const clam=mergeGeos([[clamS,mat4(0,0,0.05,0.35,0,0)],[clamS,mat4(0,0,-0.05,-0.35,Math.PI,0)]]);
  const mantle=new THREE.SphereGeometry(0.3,20,8); mantle.scale(1.25,0.18,0.25); mantle.translate(0,0.16,0);
  return {brain,stag,tube,fan,clam,mantle};
}
const fanTex=()=>{ const cv=document.createElement('canvas'); cv.width=cv.height=128; const c=cv.getContext('2d'); c.clearRect(0,0,128,128); c.strokeStyle='#fff'; c.lineWidth=2.2;
  for(let i=0;i<22;i++){ const a=Math.PI+i/21*Math.PI; c.beginPath(); c.moveTo(64,128); c.quadraticCurveTo(64+Math.cos(a)*30,128+Math.sin(a)*40,64+Math.cos(a)*62,128+Math.sin(a)*120); c.stroke(); }
  c.lineWidth=1.4; for(let r=20;r<128;r+=10){ c.beginPath(); c.arc(64,128,r,Math.PI,0); c.stroke(); }
  const t=new THREE.CanvasTexture(cv); return t; };
function proa(){
  const g=new THREE.Group(), wood=std('#6e3f26',{roughness:0.75,side:THREE.DoubleSide}), dark=std('#3f2416',{roughness:0.8}), pale=std('#d9c39a',{roughness:0.9});
  // asymmetric double-ended hull with upswept ends
  const L=4.2,nU=36,nV=12,pos=[],idx=[];
  for(let i=0;i<=nU;i++){ const u=i/nU*2-1, taper=Math.pow(Math.max(0,1-Math.abs(u)),0.55), sheer=0.16+0.42*Math.pow(Math.abs(u),3), depth=0.42*Math.sqrt(Math.max(0,1-u*u))+0.02;
    for(let j=0;j<=nV;j++){ const a=j/nV*Math.PI, c=Math.cos(a); pos.push(u*L/2,sheer-Math.sin(a)*depth,-c*0.25*taper*(c>0?0.62:1)); } }
  for(let i=0;i<nU;i++) for(let j=0;j<nV;j++){ const a=i*(nV+1)+j,b=a+nV+1; idx.push(a,b,a+1,a+1,b,b+1); }
  const hg=new THREE.BufferGeometry(); hg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); hg.setIndex(idx); hg.computeVertexNormals();
  const hull=new THREE.Mesh(hg,wood); hull.castShadow=true; g.add(hull);
  const strake=new THREE.Mesh(new THREE.BoxGeometry(L*0.86,0.05,0.04),pale); strake.position.set(0,0.2,0.2); g.add(strake);
  [-1,1].forEach(s=>{ const horn=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.5,8),dark); horn.position.set(s*(L/2+0.05),0.72,0); horn.rotation.z=-s*0.55; g.add(horn); });
  for(let k=-1;k<=1;k++){ const th=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.04,0.42),dark); th.position.set(k*0.9,0.14,0.02); g.add(th); }
  // outrigger float, booms, struts, and a woven platform
  const fl=new THREE.LatheGeometry([[0.001,-1.35],[0.06,-1.15],[0.1,-0.7],[0.11,0],[0.1,0.7],[0.06,1.15],[0.001,1.35]].map(p=>new THREE.Vector2(p[0],p[1])),12);
  const flo=new THREE.Mesh(fl,wood); flo.rotation.z=Math.PI/2; flo.position.set(0,-0.04,1.35); flo.castShadow=true; g.add(flo);
  [-0.6,0.6].forEach(x=>{ const bm=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,1.5,8),dark); bm.rotation.x=Math.PI/2; bm.position.set(x,0.34,0.72); g.add(bm);
    [-0.12,0.12].forEach(dx=>{ const st=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.42,6),dark); st.position.set(x+dx,0.15,1.33); st.rotation.z=dx*2; g.add(st); }); });
  const mt=wovenTex(); mt.repeat.set(1,1);
  const plat=new THREE.Mesh(new THREE.BoxGeometry(1.3,0.03,0.62),new THREE.MeshStandardMaterial({map:mt,roughness:0.95})); plat.position.set(0,0.38,0.62); g.add(plat);
  // mast and a billowing lateen sail with yard and boom
  const tack=new THREE.Vector3(1.75,0.45,-0.02), peak=new THREE.Vector3(-0.55,3.4,-0.02), clew=new THREE.Vector3(-1.75,0.62,-0.02);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.045,2.6,8),dark); mast.position.set(0.15,1.4,0.04); mast.rotation.z=0.12; g.add(mast);
  const spar=(a,b)=>{ const d=b.clone().sub(a), sp=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,d.length(),6),dark); sp.position.copy(a).add(b).multiplyScalar(0.5); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); g.add(sp); };
  spar(tack,peak); spar(tack,clew);
  const S=12, sp2=[], su=[], si=[], sw=[];
  for(let i=0;i<=S;i++) for(let j=0;j<=S-i;j++){ const a=i/S, b=j/S, c=1-a-b; const p=new THREE.Vector3().addScaledVector(tack,c).addScaledVector(peak,a).addScaledVector(clew,b); sp2.push(p.x,p.y,p.z); su.push(b+a*0.5,a); sw.push(a*b*c*27); }
  let row=0; const rowStart=[]; for(let i=0;i<=S;i++){ rowStart.push(row); row+=S-i+1; }
  for(let i=0;i<S;i++) for(let j=0;j<S-i;j++){ const a=rowStart[i]+j, b=rowStart[i+1]+j; si.push(a,a+1,b); if(j<S-i-1) si.push(a+1,b+1,b); }
  const sg2=new THREE.BufferGeometry(); sg2.setAttribute('position',new THREE.Float32BufferAttribute(sp2,3)); sg2.setAttribute('uv',new THREE.Float32BufferAttribute(su,2)); sg2.setIndex(si); sg2.computeVertexNormals();
  const st2=canvasTex(128,128,(c,w,h)=>{ c.fillStyle='#e3cc98'; c.fillRect(0,0,w,h); for(let y=0;y<h;y+=4){ c.fillStyle=(y/4)%2?'rgba(150,110,60,.18)':'rgba(255,255,255,.12)'; c.fillRect(0,y,w,2); } for(let y=0;y<h;y+=21){ c.fillStyle='rgba(120,80,40,.45)'; c.fillRect(0,y,w,2); } },1,1);
  const sail=new THREE.Mesh(sg2,new THREE.MeshStandardMaterial({map:st2,side:THREE.DoubleSide,roughness:0.95})); sail.castShadow=true; g.add(sail);
  g.userData.sail=sail; g.userData.sailBase=Float32Array.from(sp2); g.userData.sailW=sw;
  const lines=new THREE.Line(new THREE.BufferGeometry().setFromPoints([peak,new THREE.Vector3(0.28,2.7,0.04),clew]),new THREE.LineBasicMaterial({color:0x3f2416})); g.add(lines);
  return g;
}

function pointsSys(n,size,blend){ const o={n,pos:new Float32Array(n*3).fill(-100),col:new Float32Array(n*3),age:new Float32Array(n).fill(99),life:new Float32Array(n).fill(1),vel:new Float32Array(n*3),i:0};
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(o.pos,3)); g.setAttribute('color',new THREE.BufferAttribute(o.col,3)); o.geo=g;
  o.pts=new THREE.Points(g,new THREE.PointsMaterial({size,map:glowTexture(),vertexColors:true,transparent:true,depthWrite:false,blending:blend||THREE.AdditiveBlending})); o.pts.frustumCulled=false; inner.add(o.pts); return o; }
function psEmit(o,x,y,z,vx,vy,vz,life){ const i=o.i; o.i=(o.i+1)%o.n; o.pos[i*3]=x; o.pos[i*3+1]=y; o.pos[i*3+2]=z; o.vel[i*3]=vx; o.vel[i*3+1]=vy; o.vel[i*3+2]=vz; o.age[i]=0; o.life[i]=life; }
function psUpdate(o,dt,r,g,b,k){ for(let i=0;i<o.n;i++){ if(o.age[i]>=o.life[i]){ o.col[i*3]=o.col[i*3+1]=o.col[i*3+2]=0; continue; } o.age[i]+=dt; const f=Math.max(0,1-o.age[i]/o.life[i])*(k||1);
    o.pos[i*3]+=o.vel[i*3]*dt; o.pos[i*3+1]+=o.vel[i*3+1]*dt; o.pos[i*3+2]+=o.vel[i*3+2]*dt; o.col[i*3]=r*f; o.col[i*3+1]=g*f; o.col[i*3+2]=b*f; }
  o.geo.attributes.position.needsUpdate=true; o.geo.attributes.color.needsUpdate=true; }
const _wv=new THREE.Vector3();
function updateEdges(dt,T){
  // underwater only: light shafts slant down from the surface around the camera, bubbles rise and motes drift
  const uwOn=uwK>0.02, cp=camera.position; isl.bub.visible=uwOn; isl.rays.forEach(r=>r.visible=uwOn);
  if(uwOn){
    isl.rays.forEach((r,i)=>{ const a=i*2.4+T*0.02, d=3+(i*1.7)%8; r.position.set(cp.x+Math.cos(a)*d,-0.31-r.geometry.parameters.height*1.4/2,cp.z+Math.sin(a)*d);
      r.scale.y=1.4; r.rotation.set(0,Math.atan2(cp.x-r.position.x,cp.z-r.position.z),0.18+Math.sin(T*0.3+i)*0.06);
      r.material.opacity=uwK*(0.1+0.07*Math.sin(T*0.7+i*1.9))*(1-night*0.7); });
    const bp=isl.bub.geometry.attributes.position;
    for(let i=0;i<bp.count;i++){ let x=bp.getX(i), y=bp.getY(i), z=bp.getZ(i); const bub=i%3===0;
      y+=dt*(bub?0.5+(i%5)*0.12:0.03*Math.sin(T*0.5+i)); x+=Math.sin(T*(bub?3:0.4)+i)*(bub?0.004:0.003); z+=Math.cos(T*0.37+i)*0.002;
      if(y>-0.4||Math.hypot(x-cp.x,z-cp.z)>8||y<terrainH(x,z)){ const a=Math.random()*6.28, rr=0.8+Math.random()*7; x=cp.x+Math.cos(a)*rr; z=cp.z+Math.sin(a)*rr;
        const fl=terrainH(x,z)+0.1; y=bub?fl+Math.random()*0.5:fl+Math.random()*Math.max(0.1,-0.45-fl); }
      bp.setXYZ(i,x,y,z); }
    bp.needsUpdate=true; isl.bub.material.opacity=uwK*(0.55+night*0.3);
  }
  // steam where lava meets the sea
  isl.steamT-=dt;
  if(isl.steamT<=0){ isl.steamT=0.06; isl.rivers.forEach(r=>psEmit(isl.steam,r.end.x+(Math.random()-0.5)*0.8,-0.15,r.end.z+(Math.random()-0.5)*0.8,(Math.random()-0.5)*0.2,0.7+Math.random()*0.6+isl.erupt*0.4,(Math.random()-0.5)*0.2,1.6+Math.random())); }
  psUpdate(isl.steam,dt,0.9,0.92,0.95,0.55);
  // foam wake behind the sakman
  isl.wakeT-=dt;
  if(isl.wakeT<=0){ isl.wakeT=0.05;
    [[-2.0,0.1],[-1.2,1.35],[1.9,0.15]].forEach(([lx,lz],k)=>{ _wv.set(lx,0,lz).applyQuaternion(balloon.quaternion).multiplyScalar(2.7).add(balloon.position); psEmit(isl.wake,_wv.x+(Math.random()-0.5)*0.15,-0.27,_wv.z+(Math.random()-0.5)*0.15,(Math.random()-0.5)*0.15,0,(Math.random()-0.5)*0.15,k===2?0.5:2.4); }); }
  psUpdate(isl.wake,dt,0.85,0.95,1,0.75);
  // sail fills and flutters
  const sail=balloon.userData.sail, sb=balloon.userData.sailBase, sw=balloon.userData.sailW, sp=sail.geometry.attributes.position;
  for(let i=0;i<sp.count;i++) sp.setZ(i,sb[i*3+2]-sw[i]*(0.32+0.05*Math.sin(T*7+i*0.35)));
  sp.needsUpdate=true; sail.geometry.computeVertexNormals();
}
/* ---------- sail screen: CHamoru-inspired mandala visuals ---------- */
const SAIL_MODES={auto:'Cycle all',puntan:"Puntan and Fu'una",cave:'Cave pictographs',latte:'Latte and sinahi',off:'Plain woven'};
const SW=320, mkCv=()=>{ const cv=document.createElement('canvas'); cv.width=cv.height=SW; return cv; };
const sailCv=mkCv(), sx=sailCv.getContext('2d'), mandCv=mkCv(), mx=mandCv.getContext('2d'), fbCv=mkCv(), fx=fbCv.getContext('2d');
const sailBase=(()=>{ const cv=mkCv(), c=cv.getContext('2d'); c.fillStyle='#e3cc98'; c.fillRect(0,0,SW,SW);
  for(let y=0;y<SW;y+=5){ c.fillStyle=(y/5)%2?'rgba(150,110,60,.18)':'rgba(255,255,255,.12)'; c.fillRect(0,y,SW,2); } for(let y=0;y<SW;y+=26){ c.fillStyle='rgba(120,80,40,.45)'; c.fillRect(0,y,SW,2); } return cv; })();
let sailT=0, sailAcc=0, sailBeat=-1, sailMode='', ripples=[];
const hsl=(h,s,l,a)=>'hsla('+(((h%360)+360)%360).toFixed(0)+','+s+'%,'+l+'%,'+a+')';
function sym(m,n,fn,mirror){ for(let k=0;k<n;k++){ m.save(); m.rotate(k*Math.PI*2/n); fn(k); if(mirror){ m.scale(-1,1); fn(k); } m.restore(); } }
function dotRing(m,R,n,size,hue,spin,a){ for(let i=0;i<n;i++){ const ang=i/n*Math.PI*2+spin; m.fillStyle=hsl(hue+i*(360/n),100,70,a); m.beginPath(); m.arc(Math.cos(ang)*R,Math.sin(ang)*R,size,0,Math.PI*2); m.fill(); } }
function phyllo(m,t,count,scale,hue,b){ const ga=2.39996; for(let i=8;i<count;i++){ const r=scale*Math.sqrt(i+((t*6)%1)*1), a=i*ga+t*0.2; const tw=0.4+0.6*Math.abs(Math.sin(t*2+i*0.7)); m.fillStyle=hsl(hue+i*3,100,72,0.55*tw); m.beginPath(); m.arc(Math.cos(a)*r,Math.sin(a)*r,0.9+b*1.6*tw,0,Math.PI*2); m.fill(); } }
function figure(m,y,s,arm,col){ m.strokeStyle=col; m.lineWidth=1.6; m.beginPath(); m.arc(0,y-s*1.05,s*0.2,0,Math.PI*2);
  m.moveTo(0,y-s*0.85); m.lineTo(0,y-s*0.25); m.moveTo(0,y-s*0.25); m.lineTo(-s*0.3,y+s*0.25); m.moveTo(0,y-s*0.25); m.lineTo(s*0.3,y+s*0.25);
  m.moveTo(0,y-s*0.65); m.lineTo(-s*0.5,y-s*0.65-s*0.45*arm); m.moveTo(0,y-s*0.65); m.lineTo(s*0.5,y-s*0.65-s*0.45*arm); m.stroke(); }
function turtle(m,s,col){ m.strokeStyle=col; m.lineWidth=1.8; m.beginPath(); m.ellipse(0,0,s*0.5,s*0.65,0,0,Math.PI*2); m.moveTo(s*0.16,-s*0.82); m.arc(0,-s*0.82,s*0.16,0,Math.PI*2);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>{ m.moveTo(a*s*0.4,b*s*0.35); m.lineTo(a*s*0.85,b*s*0.62); }); m.moveTo(-s*0.5,0); m.lineTo(s*0.5,0); m.moveTo(0,-s*0.65); m.lineTo(0,s*0.65); m.stroke(); }
function fishShape(m,s,col){ m.strokeStyle=col; m.lineWidth=1.5; m.beginPath(); m.moveTo(-s*0.6,0); m.quadraticCurveTo(0,-s*0.45,s*0.6,0); m.quadraticCurveTo(0,s*0.45,-s*0.6,0); m.lineTo(-s*0.9,-s*0.3); m.lineTo(-s*0.9,s*0.3); m.closePath(); m.stroke(); }
function latteShape(m,s,col){ m.strokeStyle=col; m.lineWidth=1.5; m.beginPath(); m.moveTo(-s*0.16,0); m.lineTo(-s*0.1,-s); m.lineTo(s*0.1,-s); m.lineTo(s*0.16,0); m.closePath(); m.moveTo(-s*0.32,-s); m.quadraticCurveTo(0,-s*1.42,s*0.32,-s); m.closePath(); m.stroke(); }
function sinahi(m,r,col,fill){ m.beginPath(); m.arc(0,0,r,Math.PI*0.12,Math.PI*0.88); m.arc(0,-r*0.36,r*0.83,Math.PI*0.84,Math.PI*0.16,true); m.closePath(); m.fillStyle=fill; m.fill(); m.strokeStyle=col; m.lineWidth=2; m.stroke(); }
function drawSail(dt){
  sailT+=dt; sailAcc+=dt; if(sailAcc<Math.max(1/30,SCREEN_DT())) return; const step=sailAcc; sailAcc=0;
  const mode=show.sail==='auto'?['puntan','cave','latte'][Math.floor(sailT/20)%3]:show.sail;
  const c=sx; c.globalCompositeOperation='source-over'; c.globalAlpha=1; c.shadowBlur=0; c.drawImage(sailBase,0,0);
  if(mode==='off'){ isl.sailTex.needsUpdate=true; return; }
  if(mode!==sailMode){ sailMode=mode; fx.clearRect(0,0,SW,SW); }
  const t=sailT, b=lv.bass, cx=SW/2, cy=SW*0.66, hue=(t*22)%360, m=mx;
  if(beatCount!==sailBeat){ sailBeat=beatCount; ripples.push({r:6,life:1,h:hue}); if(ripples.length>8) ripples.shift(); }
  // feedback trail: last frame, zoomed and twisted, slowly fading (the kaleidoscope tunnel)
  m.globalCompositeOperation='source-over'; m.globalAlpha=1; m.clearRect(0,0,SW,SW);
  m.save(); m.globalAlpha=0.68; m.translate(cx,cy); m.rotate((mode==='cave'?-1:1)*(0.018+b*0.02)); const z=1.028+b*0.04; m.scale(z,z); m.translate(-cx,-cy); m.drawImage(fbCv,0,0); m.restore();
  let post=null;
  m.globalCompositeOperation='lighter'; m.globalAlpha=0.6; m.save(); m.translate(cx,cy);
  // shared backdrop: a slow starburst of fine rays
  m.save(); m.rotate(t*0.05); sym(m,36,k=>{ m.strokeStyle=hsl(hue+k*10,90,60,0.18); m.lineWidth=0.8; m.beginPath(); m.moveTo(0,-18); m.lineTo(0,-150); m.stroke(); }); m.restore();
  if(mode==='puntan'){
    // Puntan's eyes became the sun and moon and his eyebrows the rainbows: a 12-fold rainbow mandala around twin eyes
    m.save(); m.rotate(t*0.18);
    sym(m,12,k=>{ for(let i=0;i<6;i++){ m.strokeStyle=hsl(i*55+hue*0.3,100,62,0.7); m.lineWidth=1.4; m.beginPath(); m.arc(0,-(92+b*12),16+i*3.2,Math.PI*1.08,Math.PI*1.92); m.stroke(); } });
    m.restore(); m.save(); m.rotate(-t*0.32);
    sym(m,16,k=>{ const L=64+b*16; m.strokeStyle=hsl(hue+180+k*6,95,66,0.65); m.lineWidth=1.2; m.beginPath(); m.moveTo(0,-26); m.bezierCurveTo(13,-40,11,-L+8,0,-L); m.bezierCurveTo(-11,-L+8,-13,-40,0,-26); m.stroke();
      m.fillStyle=hsl(hue+k*20,100,75,0.9); m.beginPath(); m.arc(0,-L-5,1.8+b*1.5,0,Math.PI*2); m.fill(); },false);
    m.restore();
    m.save(); m.rotate(t*0.5); sym(m,24,k=>{ m.strokeStyle=hsl(hue+90,100,70,0.35); m.lineWidth=0.8; m.beginPath(); m.arc(0,-112,10,0,Math.PI); m.stroke(); }); m.restore();
    dotRing(m,40+b*6,30,1.4,hue,t*0.6,0.8); dotRing(m,76,44,1.2,hue+120,-t*0.4,0.7); dotRing(m,130,60,1.3,hue+240,t*0.25,0.6);
    post=()=>[[0,'255,207,74'],[Math.PI,'207,233,255']].forEach(([off,rgb])=>{ const a=t*0.9+off, x=Math.cos(a)*15, y=Math.sin(a)*8, r=11+b*7;
      const g=m.createRadialGradient(x,y,0,x,y,r*2.4); g.addColorStop(0,'rgba(255,255,255,0.7)'); g.addColorStop(0.35,'rgba('+rgb+',0.55)'); g.addColorStop(1,'rgba('+rgb+',0)'); m.fillStyle=g; m.beginPath(); m.arc(x,y,r*2.4,0,Math.PI*2); m.fill();
      for(let k=0;k<12;k++){ const ra=k/12*Math.PI*2+t*(off?-1:1); m.strokeStyle='rgba('+rgb+',0.7)'; m.lineWidth=1; m.beginPath(); m.moveTo(x+Math.cos(ra)*(r+2),y+Math.sin(ra)*(r+2)); m.lineTo(x+Math.cos(ra)*(r+7+b*10),y+Math.sin(ra)*(r+7+b*10)); m.stroke(); } });
  } else if(mode==='cave'){
    // pictograph mandala: a ring of dancers around a turtle, fish circling, zigzag marks
    phyllo(m,t,140,7.2,hue,b);
    m.save(); m.rotate(t*0.22); const arm=0.5+0.5*Math.sin(t*7);
    sym(m,10,k=>{ const lift=Math.max(0,Math.sin(t*7+k))*4*(0.4+b); figure(m,-74-lift,15,k%2?arm:1-arm,hsl(hue+k*36,100,65,0.95)); m.strokeStyle=hsl(hue+k*36,100,65,0.6); m.lineWidth=1.2; m.beginPath(); m.arc(0,0,76,-Math.PI/2-0.12,-Math.PI/2+0.12); m.stroke(); });
    m.restore();
    m.save(); m.rotate(-t*0.6); sym(m,6,k=>{ m.save(); m.translate(0,-40); m.rotate(Math.PI/2); fishShape(m,13,hsl(hue+150+k*20,100,66,0.9)); m.restore(); }); m.restore();
    m.save(); m.rotate(-t*0.12); m.strokeStyle=hsl(hue+60,100,65,0.75); m.lineWidth=1.4; m.beginPath();
    for(let i=0;i<=96;i++){ const a=i/96*Math.PI*2, r=i%2?100:108+b*8; i?m.lineTo(Math.cos(a)*r,Math.sin(a)*r):m.moveTo(Math.cos(a)*r,Math.sin(a)*r); } m.stroke(); m.restore();
    dotRing(m,120,48,1.3,hue+200,t*0.3,0.6);
    post=()=>{ m.save(); m.rotate(Math.sin(t*0.8)*0.3); turtle(m,22+b*8,hsl(hue+120,100,68,1)); m.restore(); };
  } else {
    // latte stones radiating like petals around a turning sinahi, under a spiral of stars
    phyllo(m,t,120,9,hue+40,b);
    m.save(); m.rotate(t*0.15); sym(m,12,k=>{ m.save(); m.translate(0,-34-b*6); latteShape(m,44+b*10,hsl(hue+k*30,100,66,0.85)); m.restore(); }); m.restore();
    m.save(); m.rotate(-t*0.25); sym(m,24,k=>{ m.strokeStyle=hsl(hue+k*15,100,72,0.4); m.lineWidth=0.9; m.beginPath(); m.arc(0,-92,9,Math.PI,0); m.stroke(); }); m.restore();
    for(let i=0;i<4;i++){ m.strokeStyle=hsl(hue+i*40,90,70,0.3+b*0.3); m.lineWidth=1; m.beginPath(); m.arc(0,0,104+i*9+Math.sin(t*2+i)*3,0,Math.PI*2); m.stroke(); }
    dotRing(m,24,20,1.2,hue,t,0.9);
    post=()=>{ m.save(); m.rotate(Math.sin(t*0.6)*0.5); sinahi(m,22+b*7,'#fff6e8','rgba(191,243,255,'+(0.18+b*0.3)+')'); m.restore(); };
  }
  ripples.forEach(r=>{ m.strokeStyle=hsl(r.h,100,72,r.life*0.7); m.lineWidth=2.2*r.life; m.beginPath(); m.arc(0,0,r.r,0,Math.PI*2); m.stroke(); r.r+=step*150; r.life-=step*1.1; });
  ripples=ripples.filter(r=>r.life>0);
  m.restore(); m.globalAlpha=1; m.globalCompositeOperation='source-over';
  fx.clearRect(0,0,SW,SW); fx.drawImage(mandCv,0,0);
  if(post){ m.save(); m.globalCompositeOperation='lighter'; m.globalAlpha=0.85; m.translate(cx,cy); post(); m.restore(); m.globalCompositeOperation='source-over'; m.globalAlpha=1; }
  c.fillStyle='rgba(18,6,32,'+(0.62+night*0.3)+')'; c.fillRect(0,0,SW,SW);
  c.globalCompositeOperation='lighter'; c.drawImage(mandCv,0,0); c.globalCompositeOperation='source-over';
  isl.sailTex.needsUpdate=true;
}
function addMergedC(g,parts,m){ const me=new THREE.Mesh(mergeC(parts),m); me.castShadow=true; me.receiveShadow=true; g.add(me); return me; }
/* ---------- island plants: niyok palms, nunu (banyan), dokdok (breadfruit), pågo, shrubs, and flowers ---------- */
function vcolGeo(g,fn){ const gg=g.index?g.toNonIndexed():g.clone(); const p=gg.attributes.position, c=new Float32Array(p.count*3), tc=new THREE.Color(); for(let i=0;i<p.count;i++){ fn(p.getX(i),p.getY(i),p.getZ(i),tc); c[i*3]=tc.r; c[i*3+1]=tc.g; c[i*3+2]=tc.b; } gg.setAttribute('color',new THREE.BufferAttribute(c,3)); return gg; }
const PLANT_M={}; function plantMat(k,o){ return PLANT_M[k]||(PLANT_M[k]=new THREE.MeshStandardMaterial(Object.assign({vertexColors:true,roughness:0.85},o||{}))); }
function frondGeo(L,droop){ // a pinnate palm frond: a curved midrib with paired leaflets
  const pos=[], col=[], c0=C('#2f7a35'), c1=C('#7fcf55'), tc=new THREE.Color(), n=16;
  const P=(t)=>[t*L, 0.35*t*L*0.4-droop*t*t, 0];
  for(let i=1;i<n;i++){ const t=i/n, [x,y]=P(t), [x2,y2]=P(Math.min(1,t+0.07)); const ll=(0.55+0.35*Math.sin(Math.PI*t))*L*0.26*(1-t*0.35);
    [-1,1].forEach(s=>{ const tip=[x2+ll*0.25,y2-ll*0.55,s*ll], base=[x,y,0], b2=[x2,y2,0];
      [base,b2,tip].forEach(v=>pos.push(...v)); tc.copy(c0).lerp(c1,t); [0,1,2].forEach(k=>col.push(...(k===2?[tc.r*1.1,tc.g*1.1,tc.b]:[tc.r*0.8,tc.g*0.8,tc.b*0.8]))); }); }
  for(let i=0;i<n;i++){ const t0=i/n,t1=(i+1)/n,[a,b]=P(t0),[c,d]=P(t1); pos.push(a,b,-0.04,c,d,0,a,b,0.04); col.push(0.4,0.3,0.15,0.4,0.3,0.15,0.4,0.3,0.15); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.computeVertexNormals(); return g;
}
function palm(x,z,h,lean){
  const g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=Math.random()*6.28; inner.add(g);
  const segs=14, trunk=[], rings=[]; let top=new THREE.Vector3();
  for(let i=0;i<segs;i++){ const t=i/(segs-1), y=t*h, off=lean*h*0.18*t*t; const r=0.2-0.07*t+(i===0?0.06:0);
    trunk.push([new THREE.CylinderGeometry(r*0.92,r,h/segs*1.05,9),mat4(off,y+h/segs*0.5,0,0,0,-lean*0.35*t)]);
    rings.push([new THREE.TorusGeometry(r*0.98,0.025,5,10),mat4(off,y,0,Math.PI/2,0,0)]); top.set(off,h,0); }
  addMergedC(g,trunk.map(([gg,m])=>[vcolGeo(gg,(x2,y2,z2,c)=>c.copy(C('#a3825c')).lerp(C('#7a5c3e'),Math.random()*0.3)),m]),plantMat('bark'));
  addMergedC(g,rings.map(([gg,m])=>[vcolGeo(gg,(x2,y2,z2,c)=>c.copy(C('#6b4f35'))),m]),plantMat('bark'));
  const fg=frondGeo(h*0.42,h*0.22), fr=[];
  for(let k=0;k<11;k++){ const ry=k/11*Math.PI*2+Math.random()*0.25, tilt=k%2?0.35:0.05; fr.push([fg,mat4(top.x,top.y,0,0,ry,tilt+Math.random()*0.15)]); }
  for(let k=0;k<4;k++) fr.push([fg,mat4(top.x,top.y,0,0,k*1.6,0.9)]);
  const fm=addMergedC(g,fr,plantMat('frond',{side:THREE.DoubleSide,roughness:0.75}));
  const nuts=[]; const ng=vcolGeo(new THREE.SphereGeometry(0.17,10,8),(a,b,c2,c)=>c.copy(C('#5f7a2c')));
  for(let k=0;k<6;k++) nuts.push([ng,mat4(top.x+Math.cos(k*1.1)*0.22,top.y-0.28-(k%2)*0.12,Math.sin(k*1.1)*0.22,0,0,0)]);
  addMergedC(g,nuts,plantMat('fruit',{roughness:0.5}));
  g.userData.tap=()=>plantTap(g); g.userData.plant=true; g.userData.top=top.clone().add(new THREE.Vector3(0,-0.35,0)); g.userData.sway={m:fm,ph:Math.random()*6};
  return g;
}
function blobCanopy(parts,cx,cy,cz,R,n,col0,col1,flat){ const sg=new THREE.IcosahedronGeometry(1,1);
  for(let k=0;k<n;k++){ const a=Math.random()*6.28, rr=R*Math.sqrt(Math.random()), y=cy+(Math.random()-0.3)*R*0.45*(flat||1), r=R*(0.32+Math.random()*0.22);
    const gg=vcolGeo(sg,(x,y2,z,c)=>c.copy(C(col0)).lerp(C(col1),clamp(0.5+y2*0.5,0,1)));
    parts.push([gg,mat4(cx+Math.cos(a)*rr,y,cz+Math.sin(a)*rr,Math.random(),Math.random(),0,r*1.15,r*0.75*(flat||1),r*1.15)]); } }
function banyan(x,z,s){ // nunu: a huge banyan with twisting trunks and hanging aerial roots
  const g=new THREE.Group(); g.position.set(x,0,z); g.scale.setScalar(s); g.rotation.y=Math.random()*6.28; inner.add(g);
  const wood=[], bark=(gg)=>vcolGeo(gg,(a,b,c2,c)=>c.copy(C('#8a7a66')).lerp(C('#6a5a4a'),Math.random()*0.4));
  for(let k=0;k<6;k++){ const a=k*1.05, r=0.35; wood.push([bark(new THREE.CylinderGeometry(0.22,0.38,4.4,8)),mat4(Math.cos(a)*r,2.2,Math.sin(a)*r,Math.sin(a)*0.12,0,-Math.cos(a)*0.12)]); }
  for(let k=0;k<7;k++){ const a=k*0.9+0.3, L=2.6+Math.random()*1.2; const o=new THREE.Object3D(); o.position.set(Math.cos(a)*L*0.45,4.0+Math.random()*0.6,Math.sin(a)*L*0.45); o.rotation.set(0,-a,Math.PI/2-0.35); o.updateMatrix();
    wood.push([bark(new THREE.CylinderGeometry(0.1,0.2,L,6)),o.matrix.clone()]);
    for(let r=0;r<3;r++){ const d=0.7+r*0.75, hx=Math.cos(a)*d*1.3, hz=Math.sin(a)*d*1.3, top=4.1-d*0.2; wood.push([bark(new THREE.CylinderGeometry(0.03,0.05,top,5)),mat4(hx,top/2,hz,0,0,0)]); } }
  for(let k=0;k<5;k++){ const a=k*1.3; wood.push([bark(new THREE.ConeGeometry(0.3,1.0,6)),mat4(Math.cos(a)*0.65,0.35,Math.sin(a)*0.65,Math.sin(a)*0.6,0,-Math.cos(a)*0.6)]); }
  addMergedC(g,wood,plantMat('bark'));
  const can=[]; blobCanopy(can,0,5.2,0,3.4,22,'#2f6b34','#5fae4c',0.9); blobCanopy(can,0,6.3,0,2.2,10,'#3c7d3a','#6fbf55',0.9);
  addMergedC(g,can,plantMat('leaf'));
  g.userData.tap=()=>plantTap(g); g.userData.plant=true;
}
function lobedLeafGeo(){ const sh=new THREE.Shape(); sh.moveTo(0,0); const pts=[[0.18,0.12],[0.14,0.25],[0.28,0.38],[0.16,0.5],[0.22,0.66],[0,0.82],[-0.22,0.66],[-0.16,0.5],[-0.28,0.38],[-0.14,0.25],[-0.18,0.12]]; pts.forEach(p=>sh.lineTo(p[0],p[1])); sh.lineTo(0,0); const g=new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI/2+0.5); return g; }
function breadfruit(x,z,s){ // dokdok: broad rounded canopy of big lobed leaves and round green fruit
  const g=new THREE.Group(); g.position.set(x,0,z); g.scale.setScalar(s); g.rotation.y=Math.random()*6.28; inner.add(g);
  const wood=[[vcolGeo(new THREE.CylinderGeometry(0.2,0.3,3.2,8),(a,b,c2,c)=>c.copy(C('#8b7a62'))),mat4(0,1.6,0,0,0,0)]];
  for(let k=0;k<4;k++){ const a=k*1.6; wood.push([vcolGeo(new THREE.CylinderGeometry(0.07,0.12,1.6,6),(a2,b,c2,c)=>c.copy(C('#7d6c56'))),mat4(Math.cos(a)*0.5,3.3,Math.sin(a)*0.5,Math.sin(a)*0.7,0,-Math.cos(a)*0.7)]); }
  addMergedC(g,wood,plantMat('bark'));
  const can=[]; blobCanopy(can,0,4.2,0,2.2,12,'#2c6a2e','#4f9a3e',0.85);
  const lg=vcolGeo(lobedLeafGeo(),(a,b,c2,c)=>c.copy(C('#3f8f3a')).lerp(C('#79c45a'),Math.random()*0.5));
  for(let k=0;k<46;k++){ const th=Math.random()*6.28, ph=0.55+Math.random()*0.9, r=2.3; can.push([lg,mat4(Math.cos(th)*Math.sin(ph)*r,4.2+Math.cos(ph)*r*0.7,Math.sin(th)*Math.sin(ph)*r,0,-th+Math.PI/2,0,1.6)]); }
  addMergedC(g,can,plantMat('leaf2',{side:THREE.DoubleSide}));
  const fr=[], fg=vcolGeo(new THREE.IcosahedronGeometry(0.2,1),(a,b,c2,c)=>c.copy(C('#9cc43c')).lerp(C('#c9d96a'),Math.random()*0.3));
  for(let k=0;k<9;k++){ const th=Math.random()*6.28, r=1.4+Math.random()*0.6; fr.push([fg,mat4(Math.cos(th)*r,3.4+Math.random()*0.8,Math.sin(th)*r,0,0,0)]); }
  addMergedC(g,fr,plantMat('fruit',{roughness:0.5}));
  g.userData.tap=()=>plantTap(g); g.userData.plant=true;
}
function pago(x,z,s){ // pågo (sea hibiscus): a sprawling coastal tree with heart-shaped leaves and yellow flowers
  const g=new THREE.Group(); g.position.set(x,0,z); g.scale.setScalar(s); g.rotation.y=Math.random()*6.28; inner.add(g);
  const wood=[]; for(let k=0;k<4;k++){ const a=k*1.6+0.3; wood.push([vcolGeo(new THREE.CylinderGeometry(0.06,0.12,2.4,6),(a2,b,c2,c)=>c.copy(C('#7a6450'))),mat4(Math.cos(a)*0.45,1.0,Math.sin(a)*0.45,Math.sin(a)*0.5,0,-Math.cos(a)*0.5)]); }
  addMergedC(g,wood,plantMat('bark'));
  const can=[]; blobCanopy(can,0,2.3,0,1.6,12,'#3f8a3a','#7cc65a',0.8); addMergedC(g,can,plantMat('leaf'));
  g.userData.flowers=[]; for(let k=0;k<16;k++){ const th=Math.random()*6.28, ph=0.3+Math.random()*1.1; g.userData.flowers.push([Math.cos(th)*Math.sin(ph)*1.75,2.3+Math.cos(ph)*1.25,Math.sin(th)*Math.sin(ph)*1.75]); }
  g.userData.tap=()=>plantTap(g); g.userData.plant=true;
  return g;
}
function flowerGeo(){ const parts=[], pg=new THREE.CircleGeometry(1,7); pg.rotateX(-Math.PI/2);
  for(let k=0;k<5;k++){ const a=k/5*Math.PI*2; parts.push([vcolGeo(pg,(x,y,z,c)=>c.setRGB(1,1,1)),mat4(Math.cos(a)*0.09,0.01,Math.sin(a)*0.09,0.25,-a,0,0.1,1,0.06)]); }
  parts.push([vcolGeo(new THREE.SphereGeometry(0.045,6,4),(x,y,z,c)=>c.setRGB(1,0.55,0.2)),mat4(0,0.02,0,0,0,0)]);
  return mergeC(parts); }
function bladeTuftGeo(n,h,col0,col1){ const parts=[]; for(let k=0;k<n;k++){ const a=Math.random()*6.28, t=0.25+Math.random()*0.35; const b=vcolGeo(new THREE.ConeGeometry(0.035,h*(0.6+Math.random()*0.6),3),(x,y,z,c)=>c.copy(C(col0)).lerp(C(col1),clamp(y/h+0.5,0,1)));
    const o=new THREE.Object3D(); o.position.set(Math.cos(a)*0.08,h*0.3,Math.sin(a)*0.08); o.rotation.set(Math.sin(a)*t,0,-Math.cos(a)*t); o.updateMatrix(); parts.push([b,o.matrix.clone()]); }
  return mergeC(parts); }
function strapClumpGeo(n,L,col0,col1){ const parts=[], lg=leafGeo(L,0.07,L*0.45); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+Math.random()*0.3; parts.push([vcolGeo(lg,(x,y,z,c)=>c.copy(C(col0)).lerp(C(col1),clamp(x/L,0,1))),mat4(0,0.05,0,0,a,0.55+Math.random()*0.4)]); }
  return mergeC(parts); }
function bushGeo(R,col0,col1){ const parts=[]; blobCanopy(parts,0,R*0.55,0,R,7,col0,col1,0.8); return mergeC(parts); }
// keep plants off the stage, dance floor, paths, and props
const PLANT_BLOCK=[];
// r is the plant's canopy radius (kept clear of the stage and volcano); foot (default r) is its spacing from other plants and props,
// smaller than a tree's canopy so neighbouring crowns can overlap the way they do in a real grove
function plantFree(x,z,r,foot){
  if(terrainH(x,z)<-0.02||shoreD(x,z)>-0.2) return false;
  if(x>-5.4-r&&x<5.4+r&&z>-7.8-r&&z<5.9+r) return false;
  if(Math.hypot(x-VOLC.x,z-VOLC.z)<VOLC.r+0.4+r) return false;
  const f=foot||r; for(const [bx,bz,br] of PLANT_BLOCK) if(Math.hypot(x-bx,z-bz)<br+f) return false;
  return true;
}
function plantSpot(r,tries,pref,foot){ for(let k=0;k<(tries||300);k++){ const x=(Math.random()-0.5)*36, z=OCZ+(Math.random()-0.5)*36; if(pref&&!pref(x,z)) continue; if(plantFree(x,z,r,foot)) { PLANT_BLOCK.push([x,z,foot||r]); return [x,z]; } } return null; }
function beachSpot(){ for(let k=0;k<200;k++){ const x=(Math.random()-0.5)*38, z=OCZ+(Math.random()-0.5)*38, d=shoreD(x,z); if(d>-0.35&&d<0.55&&terrainH(x,z)>-0.25){ if(x>-5.4&&x<5.4&&z>-7.8&&z<5.9) continue; if(Math.hypot(x-VOLC.x,z-VOLC.z)<VOLC.r+0.1) continue; return [x,z]; } } return null; }
/* ---------- the wider world: sky dome, open ocean below the floating island, hazy islands on the horizon ---------- */
// The island's own sea runs to the horizon; far islands sit on it at sea level.
const FAR={seaY:-0.31, zen:[C('#4fa3e6'),C('#120c33')], haze:[C('#d4ecf6'),C('#3a2f70')]};
// Backdrop islands seen from here (a: angle around the island centre, d: distance, r: radius, h: height). When an island
// becomes visitable, give its entry a scene of its own and swap it in at the same spot so the view from here stays true.
// Placed away from the main volcano's line in the Island view, and small enough on screen never to rival it.
const FAR_ISLES=[
  {id:'spires',a:1.25,d:230,r:30,h:22,seed:1.3,palms:true},
  {id:'twins', a:2.05,d:300,r:38,h:26,seed:4.1},
  {id:'crag',  a:4.95,d:260,r:28,h:18,seed:2.7},
  {id:'knoll', a:0.35,d:190,r:20,h:14,seed:6.2,palms:true},
];
const farWorld={};
// how far under the waterline the camera is: 0 above, 1 below, blended across the waves so the transition is smooth
let uwK=0;
const UW_FOG={day:C('#1f8c9a'),night:C('#10264a')}, _uwc=new THREE.Color(), _fogc=new THREE.Color();
// above water: the island stays crisp, each farther layer gets lighter and bluer, the farthest peaks melt into the horizon
const FOG_AIR={near:70,far:520};
const hash1=n=>{ const x=Math.sin(n*127.1)*43758.5453; return x-Math.floor(x); };
// a closed mesh: apex, rings of jagged jungle slopes, a sand rim, a skirt down below the sea, and a bottom cap.
// Faces are coloured one by one (sand low down, dark basalt where steep, two jungle greens elsewhere) for a faceted low-poly look.
function farIsleGeo(o){
  const NS=32, T=[0.1,0.22,0.36,0.5,0.63,0.75,0.86,0.95,1,1.05], pos=[], idx=[];
  const spikes=[0,1,2,3].map(k=>({th:hash1(o.seed+k)*6.283,t:0.15+hash1(o.seed*3+k)*0.45,hh:0.25+hash1(o.seed*7+k)*0.45,w:0.12+hash1(o.seed*5+k)*0.1}));
  const rad=th=>o.r*(1+0.14*Math.sin(th*3+o.seed)+0.08*Math.sin(th*5+o.seed*1.7));
  const hgt=(t,th)=>{ if(t>=1) return t>1.02?0.18:0.55; let y=o.h*Math.pow(1-t,1.25)*(0.8+0.28*(1-Math.abs(Math.sin(th*4+o.seed)))+0.12*Math.sin(th*9+o.seed*2));
    spikes.forEach(p=>{ const dth=Math.atan2(Math.sin(th-p.th),Math.cos(th-p.th)); y+=o.h*p.hh*Math.exp(-(dth*dth)/(p.w*p.w)-((t-p.t)*(t-p.t))/0.02); });
    return Math.max(0.6,y); };
  pos.push(0,hgt(0,0)*1.04,0);
  T.forEach(t=>{ for(let i=0;i<NS;i++){ const th=i/NS*6.283, R=rad(th)*t; pos.push(Math.cos(th)*R,hgt(t,th),Math.sin(th)*R); } });
  for(let i=0;i<NS;i++){ const th=i/NS*6.283, R=rad(th)*1.05; pos.push(Math.cos(th)*R,-8,Math.sin(th)*R); }
  pos.push(0,-8,0);
  const ring=k=>1+k*NS, nR=T.length+1, bot=1+nR*NS;
  for(let i=0;i<NS;i++){ const j=(i+1)%NS; idx.push(0,ring(0)+j,ring(0)+i); }
  for(let k=0;k<nR-1;k++) for(let i=0;i<NS;i++){ const j=(i+1)%NS, a=ring(k)+i, b=ring(k)+j, c=ring(k+1)+i, d=ring(k+1)+j; idx.push(a,b,c, b,d,c); }
  for(let i=0;i<NS;i++){ const j=(i+1)%NS; idx.push(bot,ring(nR-1)+i,ring(nR-1)+j); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx);
  const flat=g.toNonIndexed(); flat.computeVertexNormals();
  const P=flat.attributes.position, N=flat.attributes.normal, col=new Float32Array(P.count*3), c=new THREE.Color();
  const sand=C('#e3cf9c'), basalt=C('#3a3438'), j1=C('#2f7a3a'), j2=C('#4b9a45'), j3=C('#1f5a30');
  for(let f=0;f<P.count;f+=3){ const y=(P.getY(f)+P.getY(f+1)+P.getY(f+2))/3, ny=N.getY(f);
    if(y<0.9&&y>-1) c.copy(sand); else if(y<=-1||ny<0.5) c.copy(basalt).lerp(j3,ny<0.35?0:0.35); else { const r=hash1(f*0.37+o.seed); c.copy(r<0.4?j1:r<0.75?j2:j3); }
    for(let k=0;k<3;k++){ col[(f+k)*3]=c.r; col[(f+k)*3+1]=c.g; col[(f+k)*3+2]=c.b; } }
  flat.setAttribute('color',new THREE.BufferAttribute(col,3)); flat.userData.indexed=g; flat.userData.rad=rad;
  return flat;
}
// a handful of tiny palm tufts on the sand rim of the nearer peaks
function farPalmsGeo(o,rad){ const parts=[], tc=vcolGeo(new THREE.CylinderGeometry(0.25,0.4,1,5),(x,y,z,c)=>c.copy(C('#7a5c40'))), cr=vcolGeo(new THREE.ConeGeometry(2.6,1.1,6),(x,y,z,c)=>c.copy(C('#2f7a35')));
  for(let k=0;k<7;k++){ const th=hash1(o.seed*11+k)*6.283, R=rad(th)*0.97, x=Math.cos(th)*R, z=Math.sin(th)*R, h=5+hash1(k+o.seed)*2;
    parts.push([tc,mat4(x,0.55+h/2,z,0,0,0,1,h,1)]); parts.push([cr,mat4(x,0.55+h,z,Math.PI,k,0)]); }
  return mergeC(parts); }
function buildFarWorld(){
  const sunDir=sun.position.clone().normalize(), U={uNight:{value:0},uTime:{value:0},uSun:{value:sunDir},
    uZen:{value:FAR.zen[0].clone()},uHaze:{value:FAR.haze[0].clone()},uUw:{value:0},uUwCol:{value:new THREE.Color()}};
  farWorld.u=U;
  scene.fog=new THREE.Fog(0xffffff,FOG_AIR.near,FOG_AIR.far);
  // sky dome: follows the camera, drawn first and behind everything
  const sky=new THREE.Mesh(new THREE.SphereGeometry(800,32,16),new THREE.ShaderMaterial({uniforms:U,side:THREE.BackSide,depthWrite:false,depthTest:false,
    vertexShader:'varying vec3 vD; void main(){ vD=normalize((modelMatrix*vec4(position,1.)).xyz-cameraPosition); gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }',
    fragmentShader:'uniform vec3 uZen,uHaze,uSun,uUwCol; uniform float uNight,uUw; varying vec3 vD; void main(){ vec3 d=normalize(vD); float e=max(d.y,0.); vec3 c=mix(uHaze,uZen,pow(e,0.5));'+
      ' c+=vec3(1.,0.93,0.78)*(pow(max(dot(d,uSun),0.),24.)*0.35+pow(max(dot(d,uSun),0.),400.)*0.6)*(1.-uNight); c=mix(c,uUwCol,uUw); gl_FragColor=linearToOutputTexel(vec4(c,1.)); }'}));
  sky.renderOrder=-1000; sky.frustumCulled=false; scene.add(sky); farWorld.sky=sky;
  // distant islands: opaque, flat-shaded, lit by the sun and moon, hazed by the scene fog like everything else
  const im=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1,metalness:0});
  farWorld.isles=FAR_ISLES.map(o=>{ const geo=farIsleGeo(o), m=new THREE.Mesh(geo,im); m.position.set(Math.cos(o.a)*o.d,FAR.seaY,OCZ+Math.sin(o.a)*o.d); m.rotation.y=o.seed;
    m.castShadow=m.receiveShadow=false; m.userData.isle=o.id; scene.add(m);
    if(o.palms){ const pm=new THREE.Mesh(farPalmsGeo(o,geo.userData.rad),im); pm.castShadow=pm.receiveShadow=false; m.add(pm); }
    return m; });
}
function updateFarWorld(T){
  const u=farWorld.u; if(!u) return;
  u.uNight.value=night; u.uTime.value=T;
  u.uZen.value.copy(FAR.zen[0]).lerp(FAR.zen[1],night); u.uHaze.value.copy(FAR.haze[0]).lerp(FAR.haze[1],night);
  farWorld.sky.position.copy(camera.position);
  const cp=camera.position, wl=-0.31+waveHjs(cp.x,cp.z,T), uk=sstep(0.12,-0.12,cp.y-wl); uwK=Number.isFinite(uk)?uk:0;
  _uwc.copy(UW_FOG.day).lerp(UW_FOG.night,night); u.uUw.value=uwK; u.uUwCol.value.copy(_uwc);
  // fog colour is applied after the sRGB encode, so it takes the sRGB value of the same colour
  // fog colour is mixed in after the sRGB encode, so it takes the sRGB value of the same colour as the sky's horizon
  _fogc.copy(u.uHaze.value).lerp(_uwc,uwK).convertLinearToSRGB(); scene.fog.color.copy(_fogc);
  const fk=Math.pow(1-uwK,6); scene.fog.near=2+FOG_AIR.near*fk; scene.fog.far=28+(FOG_AIR.far-28)*fk;
  if(isl.wu){ isl.wu.uFogN.value=scene.fog.near; isl.wu.uFogF.value=scene.fog.far; }
  if(isl.wu){ isl.wu.uUw.value=uwK; isl.wu.uUwFog.value.copy(scene.fog.color); }
}
function init3D(){
  const canvas=$('#three');
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(pixelRatio());
  renderer.setClearColor(0x000000,0);
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(30,1,0.1,1000);
  hemi=new THREE.HemisphereLight(C('#fff6fb'),C('#c4b4e0'),0.72); scene.add(hemi);
  sun=new THREE.DirectionalLight(C('#fff2e4'),1.0); sun.position.set(-12,24,15); sun.castShadow=true;
  sun.shadow.mapSize.set(1536,1536); Object.assign(sun.shadow.camera,{left:-26,right:26,top:26,bottom:-26,near:1,far:100}); sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03;
  scene.add(sun); scene.add(sun.target);
  washL=new THREE.PointLight(C('#ff5fb8'),0,26); washL.position.set(-4,6,2); scene.add(washL);
  washR=new THREE.PointLight(C('#4fd8ff'),0,26); washR.position.set(4,6,2); scene.add(washR);
  flameLight=new THREE.PointLight(C('#ff8a2a'),0,24); flameLight.position.set(0,3,-0.5); scene.add(flameLight);

  wobble=new THREE.Group(); wobble.position.y=BASE; scene.add(wobble);
  inner=new THREE.Group(); inner.position.y=-BASE; wobble.add(inner);

  // ---- the island in an endless ocean: irregular island, beach, reef, seabed sloping into the deep ----
  buildFarWorld();
  isl.cWE=C('#1fd7ff');
  const terr=buildTerrain(); terr.userData.tap=groundTap;
  isl.hTex=heightTex(); isl.wu=makeWaterSurface(isl.hTex);
  // light shafts and bubbles inside the water column
  const rayTex=canvasTex(32,128,(c,w,h)=>{ const g=c.createLinearGradient(0,0,0,h); g.addColorStop(0,'rgba(255,255,255,.9)'); g.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=g; c.fillRect(0,0,w,h); const g2=c.createLinearGradient(0,0,w,0); g2.addColorStop(0,'rgba(0,0,0,1)'); g2.addColorStop(0.5,'rgba(0,0,0,0)'); g2.addColorStop(1,'rgba(0,0,0,1)'); c.globalCompositeOperation='destination-out'; c.fillStyle=g2; c.fillRect(0,0,w,h); },1,1);
  const hw=SLAB.w/2, hd=SLAB.d/2;
  isl.rays=[];
  for(let i=0;i<14;i++){ const side=i%4, u=(Math.random()-0.5)*0.8; let x,z;
    if(side===0){x=u*hw*1.8;z=OCZ+hd-0.8;} else if(side===1){x=u*hw*1.8;z=OCZ-hd+0.8;} else if(side===2){x=hw-0.8;z=OCZ+u*hd*1.8;} else {x=-hw+0.8;z=OCZ+u*hd*1.8;}
    const r=new THREE.Mesh(new THREE.PlaneGeometry(1.1+Math.random()*0.8,3.7),new THREE.MeshBasicMaterial({map:rayTex,color:C('#c8fbff'),transparent:true,opacity:0.15,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
    r.position.set(x,-2.4,z); r.rotation.y=side<2?0:Math.PI/2; inner.add(r); isl.rays.push(r); }
  const bubP=new Float32Array(130*3);
  for(let i=0;i<130;i++){ const side=i%4, u=(Math.random()-0.5)*0.9, inset=0.3+Math.random()*1.1; let x,z;
    if(side===0){x=u*hw*1.9;z=OCZ+hd-inset;} else if(side===1){x=u*hw*1.9;z=OCZ-hd+inset;} else if(side===2){x=hw-inset;z=OCZ+u*hd*1.9;} else {x=-hw+inset;z=OCZ+u*hd*1.9;}
    bubP[i*3]=x; bubP[i*3+1]=-4.1+Math.random()*3.6; bubP[i*3+2]=z; }
  const bg=new THREE.BufferGeometry(); bg.setAttribute('position',new THREE.BufferAttribute(bubP,3));
  isl.bub=new THREE.Points(bg,new THREE.PointsMaterial({size:0.16,map:glowTexture(),color:C('#e8fdff'),transparent:true,opacity:0.5,depthWrite:false,blending:THREE.AdditiveBlending})); isl.bub.frustumCulled=false; inner.add(isl.bub);
  // (hidden until they become the underwater view's light shafts and bubbles)
  isl.bub.visible=false; isl.rays.forEach(r=>r.visible=false);
  // coral reef on the reef flat and down the drop-off, glowing at night
  const CG=coralGeos(), KG=critterGeos(), dmc=new THREE.Object3D(); isl.coralMats=[]; isl.anemones=[];
  const reef=(geo,mat,n,cols,d0,d1,sc0,sc1,opt)=>{ opt=opt||{}; const im=new THREE.InstancedMesh(geo,mat,n), cc=cols.map(C); let placed=0; geo.computeBoundingBox(); const gh=Math.max(0.05,geo.boundingBox.max.y);
    for(let i=0;i<n;i++){ const p=randOcean(shelfD(d0),shelfD(d1)); if(!p) continue; const [x,z]=p; const y=terrainH(x,z);
      dmc.position.set(x,y-0.02,z); const outward=Math.atan2(x,z-OCZ); dmc.rotation.set(opt.tilt?(Math.random()-0.5)*0.4:0,opt.face?outward:Math.random()*6.28,0); const ys=0.85+Math.random()*0.35; let k=sc0+Math.random()*(sc1-sc0); k=Math.min(k,(-0.31-0.3-y)/(gh*ys)); if(k<0.35) continue; dmc.scale.set(k,k*ys,k); dmc.updateMatrix(); im.setMatrixAt(placed,dmc.matrix); im.setColorAt(placed,cc[placed%cc.length]); if(opt.list) opt.list.push(new THREE.Vector3(x,y,z));
      const bb=geo.boundingBox; (isl.coralPts||(isl.coralPts=[])).push([x,y,z,y-0.02+gh*k*ys,Math.max(-bb.min.x,bb.max.x,-bb.min.z,bb.max.z)*k]); placed++; }
    im.count=placed; im.castShadow=true; inner.add(im); isl.coralMats.push(mat); return im; };
  const cm=(o)=>applyUnderwater(glowify(new THREE.MeshStandardMaterial(Object.assign({color:0xffffff,roughness:0.65},o||{}))));
  reef(CG.brain,cm(),50,['#ffb36b','#b98bff','#ff8fb8','#ffd98a','#9fe0a0'],5.0,11,0.9,1.7);
  reef(CG.stag,cm(),64,['#ff6fa8','#ffd27a','#7af0d0','#c58bff','#ff9a6b'],5.0,11,1.1,2.0);
  reef(KG.table,cm(),24,['#b7e86b','#ff9ab8','#9ad8ff'],5.2,11,0.9,1.6);
  reef(CG.tube,cm(),32,['#ff9a4a','#ffe27a','#ff6fb8'],5.0,11,1.0,1.7);
  reef(KG.soft,cm(),24,['#d8a7ff','#ffc8a0','#a0f0d8'],5.0,11,0.9,1.6);
  reef(CG.fan,applyUnderwater(glowify(new THREE.MeshStandardMaterial({color:0xffffff,map:fanTex(),alphaTest:0.4,side:THREE.DoubleSide,roughness:0.7}))),30,['#ff5f8f','#b06bff','#ffb84d'],4.9,10,1.0,1.8,{face:true});
  reef(CG.brain,cm(),24,['#e7a0ff','#ffa07a','#80e0c0'],4.7,5.9,0.6,1.1);
  reef(KG.anemone,cm(),16,['#ff7ad0','#b88bff','#7ae0ff'],5.2,11,1.0,1.5,{list:isl.anemones});
  reef(KG.star,cm({roughness:0.5}),22,['#2f6bff','#ff7a3d','#3b7bff'],4.8,11,0.9,1.4,{tilt:true});
  reef(KG.urchin,cm({roughness:0.4}),20,['#3a1f4a','#2a2a40'],4.8,11,0.8,1.2);
  reef(KG.cuc,cm({roughness:0.7}),12,['#3b2a2a','#5a3d2a'],5.0,11,0.9,1.3);
  const clamCols=['#3fb8ff','#7a5cff','#28d6c8'];
  const clamA=reef(CG.clam,applyUnderwater(std('#efe8dc',{roughness:0.5})),12,['#ffffff'],5.0,11,1,1.4);
  const mantM=applyUnderwater(glowify(new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.3})));
  const mant=new THREE.InstancedMesh(CG.mantle,mantM,clamA.count); const mt4=new THREE.Matrix4();
  for(let i=0;i<clamA.count;i++){ clamA.getMatrixAt(i,mt4); mant.setMatrixAt(i,mt4); mant.setColorAt(i,C(clamCols[i%3])); } inner.add(mant); isl.coralMats.push(mantM); bakeReefMask();
  { let best=null, bs=-1; (isl.coralPts||[]).forEach(([x,y,z])=>{ const a=Math.atan2(z-OCZ,x), sd=shoreD(x,z); if(Math.abs(a-Math.PI/2)>0.9||sd<shelfD(4.6)||sd>shelfD(5.4)) return;
      let n=0; isl.coralPts.forEach(q=>{ if(Math.hypot(q[0]-x,q[2]-z)<2.2) n++; }); if(n>bs){ bs=n; best=[x,y,z]; } });
    if(best){ const [x,,z]=best, ty=Math.min(-0.95,terrainH(x,z)+0.55), a=Math.atan2(z-OCZ,x);
      PRESETS.reef={tx:x,ty,tz:z,r:4.5,theta:Math.atan2(Math.cos(a),Math.sin(a)),phi:1.42,fov:55}; } }
  // detailed reef fish: clownfish by the anemones, Moorish idols, butterflyfish, parrotfish
  isl.fishM=fishMaterial(); isl.fishSets=[];
  FISH.forEach(sp=>{ const im=new THREE.InstancedMesh(fishGeo(sp),isl.fishM,sp.n); inner.add(im);
    const data=[...Array(sp.n)].map((_,i)=>{ if(sp.name==='clown'&&isl.anemones.length){ const a=isl.anemones[i%isl.anemones.length]; return {home:a,r:0.25+Math.random()*0.25,a:Math.random()*6.28,sp:1.2+Math.random(),y:0.25+Math.random()*0.2}; }
      return {off:5.4+Math.random()*4.6,a:Math.random()*6.28,sp:(0.04+Math.random()*0.05)*(Math.random()<0.5?1:-1),depth:0.9+Math.random()*2.7,ph:Math.random()*6.28,school:Math.floor(i/3)}; });
    const si=isl.fishSets.length; im.userData.tap=()=>{ if(rideActive()&&tapHit&&tapHit.instanceId!==undefined) rideFish(si,tapHit.instanceId,true); else waterTap(); };
    isl.fishSets.push({im,data,sp}); });
  // volcano: a big rugged cone with jungle at its foot, ash and scorched rock up top, and a glowing crater
  const vg=new THREE.LatheGeometry(VPTS.map(p=>new THREE.Vector2(p[0],p[1])),VSEG,0,Math.PI*2);
  { const vp=vg.attributes.position;
    for(let i=0;i<vp.count;i++){ const x=vp.getX(i), y=vp.getY(i), z=vp.getZ(i), r=Math.hypot(x,z); if(r<0.3||y>7.45) continue;
      const f=volcBump(Math.atan2(z,x),y); vp.setX(i,x*f); vp.setZ(i,z*f); }
    vg.computeVertexNormals();
    const vcol=[], cg=C('#5fae4c'), cj=C('#3d7f3a'), cb=C('#6a4a3c'), ck=C('#2b252c'), cr=C('#5a2a22'), tc=new THREE.Color();
    for(let i=0;i<vp.count;i++){ const y=vp.getY(i), th=Math.atan2(vp.getZ(i),vp.getX(i)), n=0.5+0.5*Math.sin(th*11+y*3);
      tc.copy(cj).lerp(cg,n*0.6).lerp(cb,sstep(1.2,3.0,y+n*0.5)).lerp(ck,sstep(3.6,5.6,y+n*0.4)).lerp(cr,sstep(6.6,7.4,y)); vcol.push(tc.r,tc.g,tc.b); }
    vg.setAttribute('color',new THREE.Float32BufferAttribute(vcol,3)); }
  const volcano=mesh(vg,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.95,side:THREE.DoubleSide}),VOLC.x,0,VOLC.z);
  isl.lavaTex=lavaTex();
  isl.lavaM=new THREE.MeshBasicMaterial({map:isl.lavaTex,side:THREE.DoubleSide,color:0xffffff});
  const LS=makeLavaShader(); isl.lavaS=LS;
  const crater=mesh(new THREE.CircleGeometry(1.08,48),LS.m,VOLC.x,7.0,VOLC.z,null,false); crater.rotation.x=-Math.PI/2;
  const rimM=std('#241e24',{roughness:0.9});
  const craterRim=mesh(new THREE.TorusGeometry(1.36,0.15,8,48),rimM,VOLC.x,7.55,VOLC.z,null,false); craterRim.rotation.x=Math.PI/2;
  const rimRocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),rimM,14), drr=new THREE.Object3D();
  for(let k=0;k<14;k++){ const a=k/14*Math.PI*2+Math.random()*0.2; drr.position.set(VOLC.x+Math.cos(a)*1.42,7.6+Math.random()*0.1,VOLC.z+Math.sin(a)*1.42); drr.rotation.set(Math.random()*3,Math.random()*3,0); drr.scale.setScalar(0.16+Math.random()*0.14); drr.updateMatrix(); rimRocks.setMatrixAt(k,drr.matrix); }
  inner.add(rimRocks);
  // a small cinder cone with its own glowing vent, on flat ground at the volcano's foot (toward +z, away from the lava rivers and the house)
  // (VOLC.r+1.2 is the nearest spot where its whole base sits on flat ground clear of the volcano's ridged foot)
  { const a=100*Math.PI/180, d=VOLC.r+1.2, cx=VOLC.x+Math.cos(a)*d, cz=VOLC.z+Math.sin(a)*d, cy=0; PLANT_BLOCK.push([cx,cz,1.6]); isl.cone2=[cx,cz];
    const cone=mesh(new THREE.LatheGeometry([[1.25,0],[0.95,0.6],[0.55,1.15],[0.45,1.25],[0.3,1.05],[0.001,1.0]].map(p=>new THREE.Vector2(p[0],p[1])),28),new THREE.MeshStandardMaterial({color:C('#3a2f33'),roughness:0.95,side:THREE.DoubleSide}),cx,cy,cz);
    const vent=mesh(new THREE.CircleGeometry(0.34,20),LS.m,cx,cy+1.04,cz,null,false); vent.rotation.x=-Math.PI/2; isl.vent2=new THREE.Vector3(cx,cy+1.15,cz); }
  isl.lavaLight=new THREE.PointLight(C('#ff6a2a'),1.4,26); isl.lavaLight.position.set(VOLC.x,9.4,VOLC.z); inner.add(isl.lavaLight);
  isl.top=new THREE.Vector3(VOLC.x,7.2,VOLC.z);
  const erupt=()=>{ isl.erupt=3; rumble(1); addVibe(4); toast('The volcano erupts! 🌋'); };
  volcano.userData.tap=erupt; crater.userData.tap=erupt; craterRim.userData.tap=erupt;
  // smoke plume and lava bombs
  isl.smoke=[]; const smTex=glowTexture();
  for(let k=0;k<28;k++){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:smTex,color:0xd8d0dc,transparent:true,opacity:0,depthWrite:false})); sp.userData.life=99; inner.add(sp); isl.smoke.push(sp); }
  isl.smokeT=0; isl.bombs=[];
  for(let k=0;k<16;k++){ const b=new THREE.Mesh(new THREE.IcosahedronGeometry(0.16,1),LS.m); b.visible=false; b.userData={v:new THREE.Vector3(),live:false}; inner.add(b); isl.bombs.push(b); }
  // lava rivers: glowing molten channels with crusted plates, dark basalt banks and boulders
  const rockM=std('#2a2328',{roughness:0.95});
  const rpaths=[riverPath([VOLC.x-1.2,VOLC.z+0.5],[-1,0.45]),riverPath([VOLC.x+0.4,VOLC.z-1.2],[0.35,-1]),riverPath([VOLC.x-0.9,VOLC.z-0.9],[-0.75,-0.8])];
  const RW=[0.38,0.32,0.3];
  isl.rivers=rpaths.map((pp,i)=>{ const w=RW[i]; const bank=ribbon2(pp,w*1.8,rockM,0.03,0.07,5); bank.mesh.userData.tap=erupt; return ribbon2(pp,w,LS.m,0.075,0.08,6); });
  isl.rivers.forEach(r=>r.mesh.userData.tap=erupt);
  const bould=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),rockM,110), db=new THREE.Object3D(); let bi=0;
  isl.rivers.forEach((r,ri)=>{ for(let k=0;k<36;k++){ const t=Math.random()*0.92, p=r.curve.getPoint(t), tg=r.curve.getTangent(t), side=k%2?1:-1, off=RW[ri]*(1.7+Math.random()*0.6)*(1+t*0.5);
    const x=p.x-tg.z*off*side, z=p.z+tg.x*off*side; db.position.set(x,surfRaw(x,z)+0.05,z); db.rotation.set(Math.random()*3,Math.random()*3,0); db.scale.setScalar(0.08+Math.random()*0.14); db.updateMatrix(); bould.setMatrixAt(bi++,db.matrix); } });
  bould.count=bi; bould.castShadow=true; inner.add(bould);
  const hp=[]; isl.rivers.forEach(r=>{ for(let k=0;k<=18;k++){ const p=r.curve.getPoint(k/18); hp.push(p.x,surfY(p.x,p.z)+0.25,p.z); } });
  const hg=new THREE.BufferGeometry(); hg.setAttribute('position',new THREE.Float32BufferAttribute(hp,3));
  isl.heatM=new THREE.PointsMaterial({size:1.4,map:glowTexture(),color:C('#ff7a2a'),transparent:true,opacity:0.5,depthWrite:false,blending:THREE.AdditiveBlending});
  const heat=new THREE.Points(hg,isl.heatM); heat.frustumCulled=false; inner.add(heat);
  isl.rivers.forEach(r=>{ for(let k=0;k<4;k++){ const px=r.end.x+(Math.random()-0.5)*1.4, pz=r.end.z+(Math.random()-0.5)*1.4; const pl=mesh(new THREE.SphereGeometry(0.22+Math.random()*0.15,14,10),LS.m,px,Math.min(terrainH(px,pz)+0.08,-0.45),pz,null,false); pl.scale.y=0.6; } });
  isl.steam=pointsSys(140,1.2); isl.steamT=0;
  // ---- guma' latte: a CHamoru latte-stone house is the stage ----
  const stoneM=std('#dcd2c0',{roughness:0.95}), woodM=new THREE.MeshStandardMaterial({map:woodTex(),roughness:0.85}), darkWoodM=std('#4a3226',{roughness:0.75});
  [-3.6,-1.2,1.2,3.6].forEach(x=>[-2.35,-6.55].forEach(z=>{
    const h=mesh(new THREE.CylinderGeometry(0.2,0.32,0.8,4),stoneM,x,0.4,z); h.rotation.y=Math.PI/4;
    const cap=mesh(new THREE.SphereGeometry(0.44,18,10,0,Math.PI*2,Math.PI/2,Math.PI/2),stoneM,x,1.0,z); cap.scale.y=0.7; }));
  mesh(rbox(8.6,0.5,5.3,0.25,0.04),woodM,0,1.0,-4.45);
  ledMats.push(mesh(new THREE.BoxGeometry(8.2,0.08,0.05),new THREE.MeshBasicMaterial({color:0xff8fc0}),0,1.25,-1.79,null,false).material);
  [[-4.05,-2.0],[4.05,-2.0],[-4.05,-6.9],[4.05,-6.9]].forEach(([x,z])=>mesh(new THREE.CylinderGeometry(0.12,0.14,3.4,8),darkWoodM,x,3.2,z));
  const thM=new THREE.MeshStandardMaterial({map:thatchTex(),roughness:1,side:THREE.DoubleSide});
  [-1,1].forEach(sd=>{ const r=mesh(new THREE.BoxGeometry(6.6,0.35,6.5),thM,sd*2.45,6.6,-4.25); r.rotation.z=-sd*0.64;
    const b=mesh(new THREE.BoxGeometry(6.6,0.16,0.18),darkWoodM,sd*2.45,6.45,-1.0,null,false); b.rotation.z=-sd*0.64; });
  const ridge=mesh(new THREE.CylinderGeometry(0.14,0.14,6.8,10),darkWoodM,0,8.55,-4.25); ridge.rotation.x=Math.PI/2;
  const wallS=new THREE.Shape(); wallS.moveTo(-4.3,0); wallS.lineTo(4.3,0); wallS.lineTo(4.3,3.3); wallS.lineTo(0,6.8); wallS.lineTo(-4.3,3.3); wallS.lineTo(-4.3,0);
  const wt=wovenTex(); wt.repeat.set(0.6,0.6);
  mesh(new THREE.ShapeGeometry(wallS),new THREE.MeshStandardMaterial({map:wt,roughness:0.95,side:THREE.DoubleSide}),0,1.5,-7.0);
  // shell-bead garlands along the front rafters, a sinahi crescent at the peak
  [-1,1].forEach(sd=>{ for(let i=0;i<=14;i++){ const u=i/14; const b=mesh(new THREE.SphereGeometry(0.13,10,8),std(i%2?'#e0613a':'#f4ead8',{roughness:0.35}),sd*4.9*(1-u),4.55+3.65*u,-0.86,null,false); } });
  const sin=new THREE.Shape(); sin.absarc(0,0,0.95,Math.PI*1.12,Math.PI*1.88,false); sin.absarc(0,0.3,0.78,Math.PI*1.84,Math.PI*1.16,true);
  isl.sinahiM=new THREE.MeshStandardMaterial({color:C('#f6efe2'),roughness:0.3,emissive:C('#bff3ff'),emissiveIntensity:0});
  mesh(new THREE.ExtrudeGeometry(sin,{depth:0.08,bevelEnabled:true,bevelThickness:0.03,bevelSize:0.03,bevelSegments:2}),isl.sinahiM,0,7.75,-0.95);
  // round screen on the woven back wall
  projTex=new THREE.CanvasTexture(projCanvas); projTex.encoding=THREE.sRGBEncoding;
  const scr=mesh(new THREE.CircleGeometry(1.55,64),new THREE.MeshBasicMaterial({map:projTex}),0,4.35,-6.9,null,false);
  mesh(new THREE.CircleGeometry(2.3,64),new THREE.MeshBasicMaterial({map:projTex,transparent:true,opacity:0.25,blending:THREE.AdditiveBlending,depthWrite:false}),0,4.35,-6.95,null,false);
  const ring=mesh(new THREE.TorusGeometry(1.6,0.1,12,64),new THREE.MeshBasicMaterial({color:0xffc93c}),0,4.35,-6.88,null,false); ledMats.push(ring.material);
  scr.userData.tap=()=>{ const keys=Object.keys(PATTERNS); show.pattern=keys[(keys.indexOf(show.pattern)+1)%keys.length]; saveShow(); syncPatternChips(); toast('Screen: '+PATTERNS[show.pattern]); };
  // carved wooden booth
  const Y=LIFT;
  mesh(rbox(2.9,1.8,1.0,0.3,0.05),woodM,0,0.6+Y,-3.04);
  for(let i=0;i<7;i++){ const d=mesh(new THREE.SphereGeometry(0.07,10,8),new THREE.MeshBasicMaterial({color:0xffffff}),-1.2+i*0.4,1.55+Y,-2.53,null,false); ledMats.push(d.material); }
  ['A','B'].forEach((id,i)=>{
    const x=i?0.76:-0.76;
    mesh(rbox(0.78,0.07,0.78,0.12),darkWoodM,x,2.4+Y,-3.08);
    const jog=new THREE.Group(); jog.position.set(x,2.5+Y,-3.08); inner.add(jog);
    jog.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.05,36),std('#2a1d16',{roughness:0.4})));
    jog.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.055,24),std(i?'#3fb2ea':'#ff5fa2')));
    const rr=new THREE.Mesh(new THREE.TorusGeometry(0.31,0.02,8,40),new THREE.MeshBasicMaterial({color:i?0x4fd8ff:0xff5fb8})); rr.rotation.x=Math.PI/2; rr.position.y=0.03; jog.add(rr);
    const mk=new THREE.Mesh(new THREE.BoxGeometry(0.035,0.02,0.17),new THREE.MeshBasicMaterial({color:0xffffff})); mk.position.set(0,0.04,-0.2); jog.add(mk);
    jogs[id]=jog; jog.userData.tap=()=>{ if(audioReady) togglePlay(decks[id]); };
  });
  mesh(rbox(0.62,0.09,0.78,0.1),darkWoodM,0,2.4+Y,-3.08);
  for(let c=0;c<2;c++) for(let k=0;k<4;k++) mesh(new THREE.CylinderGeometry(0.04,0.04,0.07,12),std(k===3?'#ffc93c':'#f3eadb'),-0.14+c*0.28,2.52+Y,-3.36+k*0.14,null,false);
  buildShigost(); buildPoof();
  // wooden speakers with woven grilles
  const wovenM=new THREE.MeshStandardMaterial({map:wovenTex(),roughness:0.95});
  [-6.5,6.5].forEach(x=>{
    mesh(rbox(1.5,2.7,1.3,0.3,0.05),woodM,x,0,-4.4);
    [[2.0,0.42],[1.0,0.3]].forEach(([y,r])=>{ const cone=mesh(new THREE.CircleGeometry(r,24),wovenM,x,y,-3.73,null,false); const rg=mesh(new THREE.TorusGeometry(r,0.04,8,28),new THREE.MeshBasicMaterial({color:0xff8fc0}),x,y,-3.72,null,false); ledMats.push(rg.material); });
  });
  // dance floor of woven mats that glow at night
  const TX=9, TZ=6; tiles.n=TX*TZ;
  tiles.mesh=new THREE.InstancedMesh(rbox(0.9,0.08,0.9,0.14),new THREE.MeshBasicMaterial({color:0xffffff}),tiles.n);
  const dm=new THREE.Object3D(); tiles.pos=[];
  for(let i=0;i<TX;i++) for(let j=0;j<TZ;j++){ const k=i*TZ+j; dm.position.set(-4+i,0.0,-0.4+j); dm.updateMatrix(); tiles.mesh.setMatrixAt(k,dm.matrix); tiles.mesh.setColorAt(k,new THREE.Color()); tiles.pos.push([i,j]); }
  inner.add(tiles.mesh);
  tiles.day=['#ead7a8','#dcc38e','#efe0b8','#d4b47c'].map(C);
  // lava vents (flame cannons)
  const tex=glowTexture();
  [[-5.3,-1.0],[5.3,-1.0],[-7.6,-1.8],[7.6,-1.8]].forEach(([x,z])=>{
    const rock=mesh(new THREE.DodecahedronGeometry(0.45,0),std('#2f2933',{roughness:0.95}),x,0.25,z); rock.scale.y=0.7;
    const rim=mesh(new THREE.TorusGeometry(0.22,0.07,8,18),isl.lavaM,x,0.52,z,null,false); rim.rotation.x=Math.PI/2;
    cannons.push({x,z,burst:0,acc:0}); rock.userData.tap=()=>fireFlames(true);
  });
  const FN=700; flame.n=FN; flame.pos=new Float32Array(FN*3); flame.col=new Float32Array(FN*3); flame.parts=[];
  for(let i=0;i<FN;i++){ flame.parts.push({x:0,y:-100,z:0,vx:0,vy:0,vz:0,life:1,max:1,alive:false}); flame.pos[i*3+1]=-100; }
  const fg=new THREE.BufferGeometry(); fg.setAttribute('position',new THREE.BufferAttribute(flame.pos,3)); fg.setAttribute('color',new THREE.BufferAttribute(flame.col,3));
  flame.geo=fg; flame.idx=0;
  const fp=new THREE.Points(fg,new THREE.PointsMaterial({size:0.95,map:tex,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})); fp.frustumCulled=false; inner.add(fp);
  // lasers fired from kulo' (triton shell trumpets) on the rafters
  laserRoot=new THREE.Group(); inner.add(laserRoot);
  const coreG=beamGeo(0.022,22), haloG=beamGeo(0.09,22), shellM=std('#f1e2c8',{roughness:0.4});
  [[-1,0.35],[-1,0.75],[0,1],[1,0.75],[1,0.35]].forEach(([sd,u])=>{
    const x=sd*4.9*(1-u), y=4.75+3.6*u+0.25;
    const k=mesh(new THREE.ConeGeometry(0.2,0.6,12),shellM,x,y,-0.95,null,false); k.rotation.x=-Math.PI/2;
    const em=new THREE.Group(); em.position.set(x,y,-0.7); em.rotation.order='YXZ';
    const coreM=new THREE.MeshBasicMaterial({color:0xff4fb0,vertexColors:true,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false});
    const haloM=coreM.clone(); haloM.opacity=0.16;
    const beams=[-1,0,1].map(o=>{ const bg=new THREE.Group(); bg.add(new THREE.Mesh(coreG,coreM)); bg.add(new THREE.Mesh(haloG,haloM)); bg.userData.o=o; em.add(bg); return bg; });
    laserRoot.add(em); lasers.push({em,beams,coreM,haloM,base:x});
  });
  // crowd of original Recklyss Studios characters: smooth matte bodies to match Shigost (glossy eyes stay glossy)
  const env=makeEnv(); crowd.env=env;
  const whiteM=softBodyMat(); updateBodyTint(whiteM,0);
  const blackM=new THREE.MeshPhysicalMaterial({color:C('#0b0b0d'),roughness:0.05,metalness:0,clearcoat:1,clearcoatRoughness:0.03,envMap:env,envMapIntensity:1.3});
  crowd.mats=[whiteM,blackM];
  const M=(x,y,z,sx,sy,sz,rx,ry,rz)=>new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0)),new THREE.Vector3(sx,sy,sz));
  const sph=new THREE.SphereGeometry(1,24,18);
  // tall bean character: stubby arms and legs, glossy eyes
  const bp=[[0.001,0.15],[0.21,0.16],[0.28,0.22],[0.305,0.36],[0.3,0.6],[0.285,0.8],[0.245,0.94],[0.15,1.02],[0.001,1.045]].map(p=>new THREE.Vector2(p[0],p[1]));
  const gWhite=mergeGeos([[new THREE.LatheGeometry(bp,32),M(0,0,0,1,1,0.86)],[sph,M(0.11,0.1,0.03,0.11,0.12,0.13)],[sph,M(-0.11,0.1,0.03,0.11,0.12,0.13)],[sph,M(0.31,0.45,0,0.07,0.17,0.08,0,0,0.1)],[sph,M(-0.31,0.45,0,0.07,0.17,0.08,0,0,-0.1)]]);
  bakeBodyAO(gWhite,[[0.31,0.45,0,0.12],[-0.31,0.45,0,0.12],[0.11,0.1,0.03,0.12],[-0.11,0.1,0.03,0.12]],(x,y)=>[0,Math.min(Math.max(y,0.2),0.95),0,0.27],1.05);
  const gBlack=mergeGeos([[sph,M(0.115,0.72,0.225,0.08,0.09,0.04,0,0.45,0)],[sph,M(-0.115,0.72,0.225,0.08,0.09,0.04,0,-0.45,0)]]);
  // Kiki: glossy egg, giant bezel eyes, little round feet with dark soles
  const bezel=new THREE.TorusGeometry(1,0.17,10,32), disc=new THREE.CylinderGeometry(1,1,1,24);
  const kWhite=mergeGeos([[sph,M(0,0.56,0,0.4,0.46,0.38)],[sph,M(0.15,0.09,0.03,0.12,0.075,0.135)],[sph,M(-0.15,0.09,0.03,0.12,0.075,0.135)]]);
  bakeBodyAO(kWhite,[[0.15,0.09,0.03,0.12],[-0.15,0.09,0.03,0.12]],()=>[0,0.56,0,0.36],1.02);
  const kBlack=mergeGeos([[sph,M(0.165,0.7,0.3,0.135,0.135,0.075,0,0.45,0)],[sph,M(-0.165,0.7,0.3,0.135,0.135,0.075,0,-0.45,0)],
    [bezel,M(0.17,0.7,0.297,0.145,0.145,0.12,0,0.45,0)],[bezel,M(-0.17,0.7,0.297,0.145,0.145,0.12,0,-0.45,0)],
    [disc,M(0.15,0.012,0.03,0.125,0.024,0.14)],[disc,M(-0.15,0.012,0.03,0.125,0.024,0.14)]]);
  // sized so every character's eyes match Shigost's; the tall bean characters stand about Shigost's shoulder height
  crowd.people=[]; crowd.n={g:0,k:0};
  const want=[...Array(10).fill('g'),...Array(14).fill('k')];
  want.forEach(type=>{
    const sc=(type==='g'?1.9:1.2)*(0.95+Math.random()*0.1), rad=(type==='g'?0.4:0.42)*sc;
    for(let tries=0;tries<500;tries++){
      let x=-4.2+Math.random()*8.4; const z=-0.2+Math.random()*5.2;
      if(type==='g'&&Math.abs(x)<1.4&&tries<300) continue;
      if(crowd.people.some(q=>Math.hypot(q.x-x,q.z-z)<q.rad+rad+0.06)) continue;
      crowd.people.push({type,idx:crowd.n[type]++,x,z,s:sc,rad,ph:Math.random()*6.28,j:0.5+Math.random(),off:(Math.random()-0.5)*0.5,yaw:Math.random()*6.28,wander:Math.random()*6.28,peek:0}); break;
    }
  });
  crowd.meshes={g:[new THREE.InstancedMesh(gWhite,whiteM,crowd.n.g),new THREE.InstancedMesh(gBlack,blackM,crowd.n.g)],k:[new THREE.InstancedMesh(kWhite,whiteM,crowd.n.k),new THREE.InstancedMesh(kBlack,blackM,crowd.n.k)]};
  const cheer=()=>{ crowdCheer=1; addVibe(2); toast('The crowd cheers for you 🙌'); };
  ['g','k'].forEach(t=>crowd.meshes[t].forEach((m,i)=>{ if(i===0){m.castShadow=true;} m.frustumCulled=false; m.userData.tap=cheer; inner.add(m); }));
  // soft contact shadows on the dance floor, one per character, shrinking and fading as they hop
  const ctex=canvasTex(64,64,(c,w,h)=>{ const g=c.createRadialGradient(32,32,2,32,32,32); g.addColorStop(0,'rgba(0,0,0,1)'); g.addColorStop(0.45,'rgba(0,0,0,.6)'); g.addColorStop(1,'rgba(0,0,0,0)'); c.fillStyle=g; c.fillRect(0,0,w,h); });
  const cg=new THREE.PlaneGeometry(1,1); cg.rotateX(-Math.PI/2);
  crowd.contact=new THREE.InstancedMesh(cg,new THREE.MeshBasicMaterial({map:ctex,color:C('#2a1f2a'),transparent:true,opacity:0.42,depthWrite:false}),crowd.people.length);
  crowd.contact.frustumCulled=false; crowd.contact.renderOrder=2; inner.add(crowd.contact);
  crowd.sn=Math.min(16,crowd.people.length); crowd.spos=new Float32Array(crowd.sn*3); const scol=new Float32Array(crowd.sn*3);
  const sc=[[1,0.45,0.8],[0.45,0.9,1],[0.75,0.55,1],[1,0.9,0.45]];
  for(let i=0;i<crowd.sn;i++) scol.set(sc[i%4],i*3);
  const sgeo=new THREE.BufferGeometry(); sgeo.setAttribute('position',new THREE.BufferAttribute(crowd.spos,3)); sgeo.setAttribute('color',new THREE.BufferAttribute(scol,3));
  crowd.sticks=new THREE.Points(sgeo,new THREE.PointsMaterial({size:0.42,map:tex,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})); crowd.sticks.frustumCulled=false; inner.add(crowd.sticks);
  crowd.dummy=new THREE.Object3D();
  // scenery: a lush island. Big trees at the back and sides, palms all around, shrubs, ferns, lilies, grass, and flowers
  [[-5.3,-1.0,0.9],[5.3,-1.0,0.9],[-7.6,-1.8,0.9],[7.6,-1.8,0.9],[-6.5,-4.4,1.3],[6.5,-4.4,1.3],[-7.9,5.6,0.8],[7.9,5.6,0.8],[-8.3,3.4,0.8],[5.3,-7.6,0.8],[6.0,-7.1,0.8],[-8.8,4.1,0.8]].forEach(b=>PLANT_BLOCK.push(b));
  for(let k=0;k<=12;k++){ const t=k/12; [-1,1].forEach(s=>PLANT_BLOCK.push([s*(7.9+(4.9-7.9)*t),5.6+(-1.0-5.6)*t,1.0])); }
  (isl.rivers||[]).forEach(r=>{ for(let k=0;k<=16;k++){ const p=r.curve.getPoint(k/16); PLANT_BLOCK.push([p.x,p.z,1.1]); } });
  const sways=[];
  [[-8.7,1.2,7.2,0.5],[8.6,2.6,7.8,-0.6],[8.4,-6.4,9.5,0.4],[2.6,-10.6,10.5,0.3],[6.6,-9.6,9,-0.4],[-8.0,5.2,6.2,0.7],[8.2,5.4,5.8,-0.5]].forEach(([x,z,h,l])=>{ PLANT_BLOCK.push([x,z,1.0]); sways.push(palm(x,z,h,l)); });
  pandanus(8.7,-2.6,1.35); pandanus(-8.6,-2.6,1.4); pandanus(-2.6,-10.4,1.25); [[8.7,-2.6],[-8.6,-2.6],[-2.6,-10.4]].forEach(([x,z])=>PLANT_BLOCK.push([x,z,1.2]));
  const back=(x,z)=>z<-6.5||Math.abs(x)>7.5;
  // size first, so the canopy radius passed to plantSpot is the real one (banyan 3.6s, breadfruit 2.4s, pågo 1.8s)
  for(let k=0;k<2;k++){ const s=0.9+Math.random()*0.2; let p=plantSpot(3.6*s,600,(x,z)=>z<-8||Math.abs(x)>9,3.2); if(!p) p=plantSpot(3.6*s,600,back,2.8); if(p) banyan(p[0],p[1],s); }
  for(let k=0;k<4;k++){ const s=0.95+Math.random()*0.25, p=plantSpot(2.4*s,500,back,2.1); if(p) breadfruit(p[0],p[1],s); }
  // a palm's fronds reach 0.42h from its crown, and the lean moves the crown up to 0.18h*|lean| off the trunk base
  for(let k=0;k<11;k++){ const h=7+Math.random()*4, lean=(Math.random()-0.5)*1.2, p=plantSpot(h*(0.42+0.18*Math.abs(lean)),400,(x,z)=>back(x,z)||Math.abs(x)>6.5,0.9); if(p) sways.push(palm(p[0],p[1],h,lean)); }
  const pagos=[]; for(let k=0;k<6;k++){ const s=0.9+Math.random()*0.3, p=plantSpot(1.8*s,400,null,1.6); if(p) pagos.push(pago(p[0],p[1],s)); }
  isl.isletMeshes=islets().map(o=>{ const m=buildIslet(o);
    const n=o.R>1?2:1; for(let k=0;k<n;k++){ const a=o.s*2+k*2.4, r=o.R*0.35, px=o.x+Math.cos(a)*r, pz=o.z+Math.sin(a)*r, p=palm(px,pz,2.6+hash1(o.s+k)*0.9,(hash1(o.s*2+k)-0.5)*0.8);
      p.position.y=isletH(px,pz)-0.02; sways.push(p); } return m; });
  isl.sways=sways;
  // instanced understory
  const dmp=new THREE.Object3D();
  const scatter=(geo,mat,n,r,s0,s1,where)=>{ const im=new THREE.InstancedMesh(geo,mat,n); let c=0;
    for(let i=0;i<n;i++){ const p=where?where():plantSpot(r,120); if(!p) continue; dmp.position.set(p[0],0,p[1]); dmp.rotation.set(0,Math.random()*6.28,0); dmp.scale.setScalar(s0+Math.random()*(s1-s0)); dmp.updateMatrix(); im.setMatrixAt(c++,dmp.matrix); }
    im.count=c; im.castShadow=true; im.receiveShadow=true; inner.add(im); return im; };
  scatter(bushGeo(0.8,'#2f7a35','#6cbf4f'),plantMat('leaf'),22,0.8,0.8,1.3);
  scatter(bushGeo(0.6,'#4a8f3c','#a7d86a'),plantMat('leaf'),16,0.6,0.8,1.2);
  scatter(strapClumpGeo(12,1.0,'#2e6e34','#7fc45a'),plantMat('frond',{side:THREE.DoubleSide,roughness:0.75}),26,0.5,0.8,1.4);
  scatter(strapClumpGeo(9,0.8,'#3f8a46','#b6e07a'),plantMat('frond',{side:THREE.DoubleSide,roughness:0.75}),18,0.45,0.9,1.3);
  scatter(bladeTuftGeo(9,0.45,'#4f9c3a','#a8dc6a'),plantMat('grass'),140,0.15,0.8,1.5,()=>{ for(let k=0;k<60;k++){ const x=(Math.random()-0.5)*34, z=OCZ+(Math.random()-0.5)*34; if(terrainH(x,z)>-0.02&&shoreD(x,z)<-0.4&&!(x>-5.2&&x<5.2&&z>-7.6&&z<5.6)&&Math.hypot(x-VOLC.x,z-VOLC.z)>VOLC.r) return [x,z]; } return null; });
  scatter(bladeTuftGeo(6,0.3,'#5aa04a','#d9e27a'),plantMat('grass'),60,0.15,0.8,1.3,beachSpot);
  // flowers: yellow pågo blossoms, pink beach morning glory, white spider lilies and naupaka, glowing softly at night
  const flM=glowify(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.55,side:THREE.DoubleSide})); isl.coralMats.push(flM);
  const flowers=new THREE.InstancedMesh(flowerGeo(),flM,420); let fc=0; const fcol=new THREE.Color();
  const addF=(x,y,z,col,sc,tilt)=>{ if(fc>=420) return; dmp.position.set(x,y,z); dmp.rotation.set(tilt||0,Math.random()*6.28,0); dmp.scale.setScalar(sc); dmp.updateMatrix(); flowers.setMatrixAt(fc,dmp.matrix); flowers.setColorAt(fc,fcol.set(col).convertSRGBToLinear()); fc++; };
  pagos.forEach(g=>g.userData.flowers.forEach(([fx,fy,fz])=>{ const v=new THREE.Vector3(fx,fy,fz).multiply(g.scale).applyAxisAngle(new THREE.Vector3(0,1,0),g.rotation.y).add(g.position); addF(v.x,v.y,v.z,'#ffd23f',1.4,(Math.random()-0.5)); }));
  for(let k=0;k<26;k++){ const p=beachSpot(); if(!p) continue; for(let j=0;j<5;j++) addF(p[0]+(Math.random()-0.5)*0.9,0.04,p[1]+(Math.random()-0.5)*0.9,j%3?'#ff7ac8':'#e05aa8',1.1+Math.random()*0.4,0); }
  for(let k=0;k<30;k++){ const p=plantSpot(0.35,120); if(!p) continue; const col=['#ffffff','#fff3c4','#ff9fd0','#ffd23f'][k%4]; for(let j=0;j<4;j++) addF(p[0]+(Math.random()-0.5)*0.6,0.2+Math.random()*0.35,p[1]+(Math.random()-0.5)*0.6,col,1+Math.random()*0.5,(Math.random()-0.5)*0.6); }
  flowers.count=fc; flowers.instanceColor.needsUpdate=true; inner.add(flowers);
  const lus=mesh(new THREE.CylinderGeometry(0.42,0.5,0.55,14),std('#d8cdb8',{roughness:0.95}),-8.3,0.27,3.4); const hole=mesh(new THREE.CircleGeometry(0.26,16),std('#8d8272'),-8.3,0.56,3.4,null,false); hole.rotation.x=-Math.PI/2;
  const potG=new THREE.LatheGeometry([[0.001,0],[0.3,0.04],[0.42,0.3],[0.38,0.55],[0.26,0.68],[0.3,0.74]].map(p=>new THREE.Vector2(p[0],p[1])),20);
  [[5.3,-7.6,1],[6.0,-7.1,0.75],[-8.8,4.1,0.7]].forEach(([x,z,s])=>{ const p=mesh(potG,std('#b4563a',{roughness:0.8,side:THREE.DoubleSide}),x,0,z); p.scale.setScalar(s); });
  duck=new THREE.Group(); inner.add(duck);
  const shellT=std('#5f7a3c',{roughness:0.6}), skin=std('#9fb07a',{roughness:0.8});
  const ts=new THREE.Mesh(new THREE.SphereGeometry(0.55,16,10),shellT); ts.scale.set(1,0.32,1.25); duck.add(ts);
  const th=new THREE.Mesh(new THREE.SphereGeometry(0.17,12,10),skin); th.position.set(0,0.02,0.78); duck.add(th);
  [[0.55,0.35],[-0.55,0.35],[0.4,-0.5],[-0.4,-0.5]].forEach(([x,z],i)=>{ const f=new THREE.Mesh(new THREE.SphereGeometry(0.22,10,8),skin); f.scale.set(1.4,0.18,0.55); f.position.set(x,-0.02,z); f.rotation.y=x>0?-0.5:0.5; f.userData.flip=i; duck.add(f); });
  duck.userData.tap=()=>{ duck.userData.spin=1; toast('The haggan says håfa adai 🐢'); addVibe(1); };
  balloon=proa(); balloon.scale.setScalar(2.7); balloon.rotation.order='YXZ'; inner.add(balloon);
  balloon.userData.tap=()=>{ toast('Kikis paddling a sakman 🛶'); balloon.userData.boost=2; };
  isl.wake=pointsSys(200,0.7); isl.wakeT=0;
  isl.sailTex=new THREE.CanvasTexture(sailCv); isl.sailTex.encoding=THREE.sRGBEncoding;
  isl.sailM=new THREE.MeshStandardMaterial({map:isl.sailTex,emissiveMap:isl.sailTex,emissive:0xffffff,emissiveIntensity:0.3,side:THREE.DoubleSide,roughness:0.9});
  balloon.userData.sail.material=isl.sailM;
  // Kikis paddling the sakman
  const padM=std('#7a4a2c',{roughness:0.8}); balloon.userData.rowers=[];
  [-0.7,-0.1,0.55].forEach((x,i)=>{ const k=new THREE.Group(); k.position.set(x,0.03,0.04); k.rotation.y=Math.PI/2; k.scale.setScalar(1.2/2.7); balloon.add(k);
    const kb=new THREE.Mesh(kWhite,crowd.mats[0]), ke=new THREE.Mesh(kBlack,crowd.mats[1]); kb.castShadow=true; k.add(kb,ke);
    const pad=new THREE.Group(); pad.position.set(0.42,0.55,0.05); k.add(pad);
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,1.6,6),padM); shaft.position.y=-0.6; pad.add(shaft);
    const blade=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.5,0.22),padM); blade.position.y=-1.35; pad.add(blade);
    balloon.userData.rowers.push({k,pad,i}); });
  // shell-bead light strings from bamboo poles to the eaves
  const bulbCols=['#ff9a4a','#6ff0ff','#ff8fc0','#c9a8ff'].map(C); bulbs.cols=bulbCols;
  bulbs.mats=bulbCols.map(c=>new THREE.MeshBasicMaterial({color:c.clone()}));
  [-1,1].forEach(s=>{
    const top=new THREE.Vector3(s*7.9,3.6,5.6);
    for(let i=0;i<6;i++) mesh(new THREE.CylinderGeometry(0.07,0.075,0.6,8),std(i%2?'#c9b37c':'#b39c64'),s*7.9,0.3+i*0.6,5.6);
    mesh(new THREE.SphereGeometry(0.16,10,8),std('#6f8a3a'),s*7.9,3.68,5.6);
    const pts=catenary(top,new THREE.Vector3(s*4.9,4.75,-1.0),1.2,18);
    inner.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x6d5a46})));
    pts.forEach((p,i)=>{ if(i===0||i===pts.length-1) return; const b=new THREE.Mesh(new THREE.SphereGeometry(0.085,10,8),bulbs.mats[i%4]); b.position.copy(p); b.position.y-=0.08; inner.add(b); });
  });
  cloudMat=std('#ffffff',{roughness:1});
  [[-9,11,-6,1.1],[4,12.5,-9,1.4],[12,10.5,-3,0.9]].forEach(([x,y,z,s])=>{ const c=new THREE.Group(); c.position.set(x,y,z); c.scale.setScalar(s); inner.add(c);
    [[0,0,0,1],[0.9,-0.1,0.1,0.75],[-0.9,-0.15,0,0.7],[0.3,0.45,0,0.7]].forEach(b=>{ const m=new THREE.Mesh(new THREE.SphereGeometry(b[3],16,12),cloudMat); m.position.set(b[0],b[1],b[2]); c.add(m); });
    c.userData.tap=()=>{ c.userData.boing=1; }; clouds.push(c); });
  // night stars
  const sp=new Float32Array(500*3);
  for(let i=0;i<500;i++){ const th=Math.random()*Math.PI*2, ph=Math.random()*1.45, r=700; sp[i*3]=r*Math.sin(ph)*Math.cos(th); sp[i*3+1]=r*Math.cos(ph)-10; sp[i*3+2]=r*Math.sin(ph)*Math.sin(th); }
  const sgm=new THREE.BufferGeometry(); sgm.setAttribute('position',new THREE.BufferAttribute(sp,3));
  starPts=new THREE.Points(sgm,new THREE.PointsMaterial({color:0xffffff,size:8.5,map:tex,transparent:true,opacity:0,depthWrite:false,fog:false})); scene.add(starPts);

  const resize=()=>{ const w=window.innerWidth,h=window.innerHeight; renderer.setPixelRatio(pixelRatio()); renderer.setSize(w,h,false); view.w=w; view.h=h; updateViewTargets(); };
  window.addEventListener('resize',resize); resize();
  setupPointer(canvas);
}

/* camera */
const cam={tx:0,ty:1.2,tz:-3,r:62,theta:0.6,phi:1.0,fov:30};
const camT=Object.assign({},cam);
const PRESETS={island:{tx:0,ty:1.2,tz:-3,r:62,theta:0.6,phi:1.0,fov:30},front:{tx:0,ty:3.3,tz:-3.6,r:12,theta:0.2,phi:1.46,fov:46},dj:{tx:-1.4,ty:1.2,tz:4.0,r:11.19,theta:3.112,phi:1.147,fov:52},reef:{tx:0,ty:-1.6,tz:13,r:4.5,theta:0,phi:1.42,fov:55}};
const view={w:1,h:1,c:0,s:0,cT:0,sT:0};
function updateViewTargets(){
  if(isMobile()){ view.cT=0; view.sT=$('#console').offsetHeight*0.92; }
  else { view.cT=Math.max(0,window.innerWidth-$('#console').getBoundingClientRect().left); view.sT=0; }
  document.documentElement.style.setProperty('--sheetH',(isMobile()?$('#console').offsetHeight:0)+'px');
}
// first-person POV from Shigost's eyes ("Shigost's view"); PRESETS.dj is the fallback if her model fails to load
const pov={on:false,yaw:0,pitch:0,fov:55,fovT:55,idle:0,enter:0,had:false,selfHide:0,pos:new THREE.Vector3(),q:new THREE.Quaternion(),anchor:new THREE.Vector3()};
const POV_YAW=100*Math.PI/180, POV_UP=40*Math.PI/180, POV_DOWN=-60*Math.PI/180;
const _pe=new THREE.Vector3(),_pf=new THREE.Vector3(),_pw=new THREE.Vector3(),_pq=new THREE.Quaternion(),_pl=new THREE.Quaternion(),_pEu=new THREE.Euler(0,0,0,'YXZ');
const _pUp=new THREE.Vector3(0,1,0), _pFlip=new THREE.Quaternion().setFromAxisAngle(_pUp,Math.PI);
function povActive(){ return pov.on&&sg.ready; }
function applyLens(fov,near){
  const fw=view.w+view.c, fh=view.h+view.s;
  camera.fov=fov*(view.w/view.h<1?1.25:1); camera.near=near; camera.aspect=fw/fh;
  camera.setViewOffset(fw,fh,view.c,view.s,view.w,view.h); camera.updateProjectionMatrix();
}
// leaving POV: rebuild the orbit from wherever the POV camera is looking, so the tween starts there
function orbitFromCamera(fov){
  const d=10; camera.getWorldDirection(_pf);
  cam.tx=camera.position.x+_pf.x*d; cam.ty=camera.position.y+_pf.y*d; cam.tz=camera.position.z+_pf.z*d;
  cam.r=d; cam.phi=Math.acos(clamp(-_pf.y,-1,1)); cam.theta=Math.atan2(-_pf.x,-_pf.z); cam.fov=fov===undefined?pov.fov:fov;
}
function updatePOV(dt){
  sg.root.updateMatrixWorld(true);
  _pe.set(0,0,0); sg.glows.forEach(g=>_pe.add(g.getWorldPosition(_pw))); _pe.multiplyScalar(1/sg.glows.length);
  sg.head.getWorldQuaternion(_pq).multiply(sg.headOff);
  _pf.set(0,0,1).applyQuaternion(_pq);
  _pe.addScaledVector(_pf,0.2);
  _pq.multiply(_pFlip); // cameras look down -z
  // the jump's crouch dips her face below the deck top; keep the eyes out of the booth
  const eyeY=_pe.y;
  if(Math.abs(_pe.x)<1.6&&_pe.z>-3.75&&_pe.z<-2.4) _pe.y=Math.max(_pe.y,2.65+LIFT);
  // her own nods only tip the view +-20 degrees, so a crouch doesn't fill the screen with the mixer
  // comfort mode keeps 30% of the bob and roll
  _pEu.setFromQuaternion(_pq,'YXZ'); const nod=Math.abs(_pEu.x)>0.35;
  _pEu.x=clamp(_pEu.x,-0.35,0.35); if(show.comfort) _pEu.z*=0.3; _pq.setFromEuler(_pEu);
  // while either limit kicks in the lens no longer matches her face, so her hood would fill it; hide her for that moment
  pov.selfHide=(nod||_pe.y-eyeY>0.02)?0.2:Math.max(0,pov.selfHide-dt);
  sg.gltfRoot.visible=pov.selfHide<=0;
  const poofed=pov.had&&pov.enter>=1&&_pe.distanceTo(pov.pos)>1.5;
  if(!pov.had||poofed) pov.anchor.copy(_pe); else pov.anchor.lerp(_pe,1-Math.exp(-dt*2.5));
  if(show.comfort) _pe.sub(pov.anchor).multiplyScalar(0.3).add(pov.anchor);
  // look-around offset, easing back to straight ahead after a few idle seconds
  pov.idle+=dt;
  if(pov.idle>3){ const d=Math.exp(-dt*1.8); pov.yaw*=d; pov.pitch*=d; }
  _pq.multiply(_pl.setFromEuler(_pEu.set(pov.pitch,pov.yaw,0)));
  if(!pov.had){ pov.pos.copy(camera.position); pov.q.copy(camera.quaternion); pov.fov=cam.fov; pov.had=true; }
  pov.enter=Math.min(1,pov.enter+dt*1.2);
  const k=1-Math.exp(-dt*lerp(2.5,14,pov.enter*pov.enter));
  if(poofed) pov.pos.copy(_pe); else pov.pos.lerp(_pe,k);
  pov.q.slerp(_pq,k);
  pov.fov+=(pov.fovT-pov.fov)*(1-Math.exp(-dt*8));
  camera.position.copy(pov.pos); camera.quaternion.copy(pov.q);
  applyLens(pov.fov,0.05);
}
/* ---------- Reef view: ride along with a reef fish ---------- */
// The ridden fish leaves its usual lap and swims a long loop: out over the upper drop-off weaving between coral heads,
// back along the deeper drop-off. The route is checked against coral, islets, the lava river mouths, the seabed, and the
// surface. Follow cam by default, fish-eye view as a toggle (not in Comfort mode). Tap another fish to hop onto it.
const FISH_NAMES={clown:'clownfish',idol:'Moorish idol',butterfly:'butterflyfish',parrot:'parrotfish'};
const RIDE_CEIL=-0.85, RIDE_SPEED=1.05;
const ride={on:false,set:-1,i:-1,f:null,mode:'follow',yaw:0,pitch:0,idle:0,fov:58,fovT:58,hop:0,enter:0,
  pos:new THREE.Vector3(),look:new THREE.Vector3(),h:new THREE.Vector3(0,0,1),fp:new THREE.Vector3(),fd:new THREE.Vector3(0,0,1)};
function rideActive(){ return ride.on&&!!(isl.fishSets&&ride.f); }
function rideObstacles(){ return isl.rideObs||(isl.rideObs=[
  ...(isl.coralPts||[]).map(([x,y,z,top,rad])=>({x,z,top:top===undefined?y+0.5:top,rad:rad===undefined?0.6:rad})),
  ...islets().map(o=>({x:o.x,z:o.z,top:1,rad:o.R*1.7+0.3})),
  ...(isl.rivers||[]).map(r=>({x:r.end.x,z:r.end.z,top:1,rad:2.3}))]); }
// the lowest a swimmer may go at (x,z) and still clear the seabed and anything standing on it within reach (Infinity: blocked)
function rideFloor(x,z,reach){ let y=terrainH(x,z)+0.45; for(const o of rideObstacles()){ const d=Math.hypot(x-o.x,z-o.z); if(d<o.rad+reach){ if(o.top+0.4>RIDE_CEIL) return Infinity; y=Math.max(y,o.top+0.4); } } return y; }
function rideRoute(){ if(isl.rideRoute) return isl.rideRoute;
  const aS=0.7, aE=2.45, N=12, at=(a,sd)=>{ const r=islandR(a)+sd; return [Math.cos(a)*r,OCZ+Math.sin(a)*r]; };
  let best=null;
  for(let tries=0;tries<40;tries++){
    const wps=[];
    const leg=(k,back)=>{ const u=k/(N-1), a=back?aE-(aE-aS)*u:aS+(aE-aS)*u, sd0=back?10.2:8.2, ty=back?-2.3-0.25*Math.sin(k*1.3):-1.05-0.18*Math.sin(k*1.9);
      let pick=null, pd=-1;
      for(let c=0;c<14;c++){ const sd=sd0+(c===0?0:(Math.random()-0.5)*1.6)+0.45*Math.sin(k*1.7+tries), da=c===0?0:(Math.random()-0.5)*0.05, [x,z]=at(a+da,sd), fl=rideFloor(x,z,0.6);
        if(fl>RIDE_CEIL) continue; let dmin=99; for(const o of rideObstacles()) if(o.top+0.4>RIDE_CEIL) dmin=Math.min(dmin,Math.hypot(x-o.x,z-o.z)-o.rad); if(dmin>pd){ pd=dmin; pick=new THREE.Vector3(x,Math.min(RIDE_CEIL,Math.max(ty,fl)),z); } }
      if(pick) wps.push(pick); };
    for(let k=0;k<N;k++) leg(k,false); for(let k=0;k<N;k++) leg(k,true);
    if(wps.length<N*2-2) continue;
    const curve=new THREE.CatmullRomCurve3(wps,true,'centripetal'), M=700, pts=[]; let bad=0;
    for(let j=0;j<M;j++){ const p=curve.getPoint(j/M), fl=rideFloor(p.x,p.z,0.35); if(fl>RIDE_CEIL){ bad++; } p.y=Math.min(RIDE_CEIL,Math.max(p.y,fl)); p.fl=fl; pts.push(p); }
    // smooth the depth (never below the floor, never above the ceiling) so climbs over coral are gentle
    for(let it=0;it<6;it++){ const ys=pts.map(p=>p.y); pts.forEach((p,j)=>{ const a=ys[(j+M-3)%M], b=ys[(j+3)%M]; p.y=Math.min(RIDE_CEIL,Math.max(p.fl,(a+b+ys[j]*2)/4)); }); }
    if(!best||bad<best.bad) best={pts,bad};
    if(bad===0) break;
  }
  const pts=best.pts, cum=[0]; for(let j=1;j<=pts.length;j++) cum.push(cum[j-1]+pts[j-1].distanceTo(pts[j%pts.length]));
  return isl.rideRoute={pts,cum,len:cum[pts.length],bad:best.bad};
}
const _rp=new THREE.Vector3(), _rq=new THREE.Vector3();
// position and unit heading at distance s along the loop
function routeAt(s,out,dir){ const R=rideRoute(), n=R.pts.length; s=((s%R.len)+R.len)%R.len;
  let lo=0, hi=n; while(hi-lo>1){ const m=(lo+hi)>>1; if(R.cum[m]<=s) lo=m; else hi=m; }
  const a=R.pts[lo], b=R.pts[(lo+1)%n], t=(s-R.cum[lo])/Math.max(1e-6,R.cum[lo+1]-R.cum[lo]); out.lerpVectors(a,b,t); if(dir) dir.subVectors(b,a).normalize(); return out; }
function routeNearest(p){ const R=rideRoute(); let bi=0, bd=1e9; R.pts.forEach((q,j)=>{ const d=q.distanceToSquared(p); if(d<bd){ bd=d; bi=j; } }); return R.cum[bi]; }
function fishWorld(set,i){ const im=isl.fishSets[set].im, m=new THREE.Matrix4(); im.getMatrixAt(i,m); return new THREE.Vector3().setFromMatrixPosition(m); }
function rideFish(set,i,hop){ const fs=isl.fishSets[set]; if(!fs) return; const f=fs.data[i]; if(!f||f===ride.f) return;
  if(ride.f) ride.f.riding=false;
  f.riding=true; if(!(f.rideW>0)) f.rs=routeNearest(fishWorld(set,i));
  ride.set=set; ride.i=i; ride.f=f; ride.hop=hop?1:0; ride.yaw=ride.pitch=0;
  rideUI(); }
function startRide(){ ride.enter=0; ride.pos.copy(camera.position); camera.getWorldDirection(_rq); ride.look.copy(camera.position).addScaledVector(_rq,6);
  if(!ride.f){ const k=Math.max(0,isl.fishSets.findIndex(x=>x.sp.name==='butterfly')), R=rideRoute(); let bi=0, bd=1e9;
    isl.fishSets[k].data.forEach((f,i)=>{ const d=fishWorld(k,i).distanceToSquared(R.pts[0]); if(d<bd){ bd=d; bi=i; } }); rideFish(k,bi,false); }
  ride.fov=ride.fovT=58; rideUI(); }
function stopRide(){ ride.on=false; rideUI(); }
let rideBar=null;
function rideUI(){
  if(!rideBar){ rideBar=document.createElement('div'); rideBar.className='reefBar';
    rideBar.innerHTML='<span class="glass reefLab"></span><button class="glass reefEye" type="button" aria-pressed="false">Fish eyes</button>';
    document.body.append(rideBar); rideBar.querySelector('.reefEye').addEventListener('click',()=>{ ride.mode=ride.mode==='eye'?'follow':'eye'; rideUI(); }); }
  const on=rideActive(), comfort=!!show.comfort; if(comfort) ride.mode='follow';
  rideBar.style.display=on?'flex':'none'; if(!on) return;
  const sp=isl.fishSets[ride.set].sp, name=FISH_NAMES[sp.name]||'fish';
  rideBar.querySelector('.reefLab').textContent='Riding a '+name+'. Tap another fish to hop on.';
  const b=rideBar.querySelector('.reefEye'); b.style.display=comfort?'none':''; b.textContent=ride.mode==='eye'?'Follow':'Fish eyes'; b.setAttribute('aria-pressed',ride.mode==='eye'?'true':'false');
  b.classList.toggle('on',ride.mode==='eye'); }
function updateRide(dt){
  const comfort=!!show.comfort, eye=ride.mode==='eye'&&!comfort, sp=isl.fishSets[ride.set].sp, L=sp.L;
  ride.enter=Math.min(1,ride.enter+dt*0.7); ride.hop=Math.max(0,ride.hop-dt*1.4);
  // heading turns smoothly (slower in Comfort mode); look offset eases back after a few idle seconds
  ride.h.lerp(ride.fd,1-Math.exp(-dt*(comfort?1.4:eye?4:2.6))).normalize();
  ride.idle+=dt; if(ride.idle>2.5){ const d=Math.exp(-dt*1.6); ride.yaw*=d; ride.pitch*=d; }
  const yaw=Math.atan2(ride.h.x,ride.h.z)+ride.yaw, hp=Math.asin(clamp(ride.h.y,-1,1))*(eye?1:0.4)+ride.pitch;
  _rq.set(Math.sin(yaw)*Math.cos(hp),Math.sin(hp),Math.cos(yaw)*Math.cos(hp));
  const sw=(comfort?0.3:1), want=new THREE.Vector3(), lookAt=new THREE.Vector3();
  if(eye){ want.copy(ride.fp).addScaledVector(ride.h,L*0.55); want.y+=L*0.05;
    const wig=Math.sin(T*10+ride.i)*0.025; lookAt.copy(want).add(new THREE.Vector3(Math.sin(yaw+wig)*Math.cos(hp),Math.sin(hp),Math.cos(yaw+wig)*Math.cos(hp)).multiplyScalar(6)); }
  else { // a three-quarter view from behind, above, and a little to one side: the back, flank, and tail all show
    const back=0.8+L*2.6, side=0.18+L*0.5; want.copy(ride.fp).addScaledVector(_rq,-back); want.y+=0.5+L*0.9; want.x+=Math.cos(yaw)*side; want.z-=Math.sin(yaw)*side; want.x+=Math.cos(yaw)*Math.sin(T*1.3)*0.05*sw; want.z-=Math.sin(yaw)*Math.sin(T*1.3)*0.05*sw;
    lookAt.copy(ride.fp).addScaledVector(_rq,2.4); lookAt.y=ride.fp.y; } // aim ahead: the fish sits low in frame with the reef it swims toward above it
  // damped follow: gentle on arrival and when hopping fish, tight once settled (looser in Comfort mode)
  const kPos=ride.enter<1||ride.hop>0?1.8:eye?14:comfort?2.6:4.2;
  ride.pos.lerp(want,1-Math.exp(-dt*kPos)); ride.look.lerp(lookAt,1-Math.exp(-dt*(eye?14:5)));
  // stay underwater and off the bottom
  ride.pos.y=Math.min(-0.5,Math.max(ride.pos.y,surfRaw(ride.pos.x,ride.pos.z)+0.25));
  camera.position.copy(ride.pos); camera.lookAt(ride.look);
  ride.fov+=(ride.fovT-ride.fov)*(1-Math.exp(-dt*6)); applyLens(ride.fov,eye?0.02:0.05);
}
function setPreset(name){
  if(rideActive()&&name!=='reef') orbitFromCamera(ride.fov);
  ride.on=name==='reef'; if(ride.on&&isl.fishSets) startRide(); else rideUI();
  if(povActive()&&name!=='dj') orbitFromCamera();
  pov.on=name==='dj';
  if(pov.on){ pov.yaw=pov.pitch=0; pov.idle=0; pov.enter=0; pov.had=false; pov.fovT=55; }
  const tw=Math.PI*2; cam.theta=((cam.theta+Math.PI)%tw+tw)%tw-Math.PI; camT.theta=cam.theta;
  Object.assign(camT,PRESETS[name]);
  $$('.cams button').forEach(b=>b.classList.toggle('on',b.dataset.cam===name));
}
const raycaster=new THREE.Raycaster(), ndc=new THREE.Vector2(); let tapHit=null;
const _fm=new THREE.Matrix4(), _fv=new THREE.Vector3();
function nearestFishOnScreen(px,py,maxPx){ let best=null, bd=maxPx*maxPx;
  isl.fishSets.forEach((fs,si)=>{ for(let i=0;i<fs.im.count;i++){ if(fs.data[i]===ride.f) continue; fs.im.getMatrixAt(i,_fm); _fv.setFromMatrixPosition(_fm).project(camera); if(_fv.z>1) continue;
    const sx=(_fv.x+1)/2*view.w, sy=(1-_fv.y)/2*view.h, d=(sx-px)*(sx-px)+(sy-py)*(sy-py); if(d<bd){ bd=d; best=[si,i]; } } });
  return best; }
function pick(x,y){
  ndc.set(x/view.w*2-1,-(y/view.h)*2+1); raycaster.setFromCamera(ndc,camera);
  // in the Reef view fish are small and quick, so a tap within about 36px of one hops onto it
  if(rideActive()){ const near=nearestFishOnScreen(x,y,36); if(near) return {userData:{tap:()=>rideFish(near[0],near[1],true)}}; }
  const hits=raycaster.intersectObjects(inner.children,true);
  for(const h of hits){ let o=h.object; while(o&&o!==inner){ if(o.userData.tap){ tapPt.copy(h.point); tapHit=h; return o; } o=o.parent; } }
  return null;
}
function setupPointer(canvas){
  const pts=new Map(); let pinch=0, down=null, hoverT=0;
  canvas.addEventListener('pointerdown',e=>{ canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(pts.size===1) down={x:e.clientX,y:e.clientY,t:performance.now(),moved:0}; else down=null; if(pts.size===2){ const a=[...pts.values()]; pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); } });
  canvas.addEventListener('pointermove',e=>{
    const p=pts.get(e.pointerId);
    if(!p){ const now=performance.now(); if(now-hoverT>90&&e.pointerType==='mouse'){ hoverT=now; canvas.style.cursor=pick(e.clientX,e.clientY)?'pointer':'grab'; } return; }
    const dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY;
    if(down) down.moved+=Math.abs(dx)+Math.abs(dy);
    if(rideActive()){
      if(pts.size===1&&(!down||down.moved>6)){ ride.yaw=clamp(ride.yaw-dx*0.004,-1,1); ride.pitch=clamp(ride.pitch-dy*0.004,-0.6,0.6); ride.idle=0; }
      else if(pts.size===2){ const a=[...pts.values()]; const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); if(pinch>0) ride.fovT=clamp(ride.fovT*pinch/d,40,75); pinch=d; ride.idle=0; }
      return;
    }
    if(povActive()){
      if(pts.size===1&&(!down||down.moved>6)){ pov.yaw=clamp(pov.yaw+dx*0.005,-POV_YAW,POV_YAW); pov.pitch=clamp(pov.pitch+dy*0.005,POV_DOWN,POV_UP); pov.idle=0; }
      else if(pts.size===2){ const a=[...pts.values()]; const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); if(pinch>0) pov.fovT=clamp(pov.fovT*pinch/d,35,70); pinch=d; pov.idle=0; }
      return;
    }
    if(pts.size===1&&(!down||down.moved>6)){ camT.theta-=dx*0.006; camT.phi=clamp(camT.phi-dy*0.005,0.3,camT.r<30?2.05:1.55); $$('.cams button').forEach(b=>b.classList.remove('on')); }
    else if(pts.size===2){ const a=[...pts.values()]; const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); if(pinch>0) camT.r=clamp(camT.r*pinch/d,7,95); pinch=d; }
  });
  const up=e=>{
    if(down&&pts.size===1&&down.moved<8&&performance.now()-down.t<450){ const o=pick(e.clientX,e.clientY); if(o) o.userData.tap(); }
    pts.delete(e.pointerId); pinch=0; if(pts.size===0) down=null;
  };
  canvas.addEventListener('pointerup',up);
  canvas.addEventListener('pointercancel',e=>{ pts.delete(e.pointerId); down=null; });
  canvas.addEventListener('wheel',e=>{ e.preventDefault(); if(rideActive()){ ride.fovT=clamp(ride.fovT*(1+e.deltaY*0.001),40,75); return; } if(povActive()){ pov.fovT=clamp(pov.fovT*(1+e.deltaY*0.001),35,70); return; } camT.r=clamp(camT.r*(1+e.deltaY*0.001),7,95); },{passive:false});
}

/* island reactions: the ground, sea, and seabed never deform. Beats nudge the camera and ripple the water off the stage;
   taps ripple and splash the water (scattering fish), sway and rustle plants (palms may drop a coconut), puff sand,
   and rumble the volcano. At night, taps on water or sand leave a little bioluminescent shimmer. */
const tapPt=new THREE.Vector3(), camFx={pulse:0,shake:0};
// all camera motion is calmer for players who asked for it: reduced motion, Comfort mode, or Reduce flashing lights
function motionK(){ return (prefersReduced||show.comfort||show.reduceFlash)?0.3:1; }
function squish(n){ camFx.pulse=Math.max(camFx.pulse,Math.min(1,n*0.55)); }
function rumble(s){ camFx.shake=Math.max(camFx.shake,s); }
// four ripple slots on the water shader; taps rotate through 0-2, the beat ripple keeps slot 3
let ripI=0;
function addRipple(x,z,str,glow,slot){ const u=isl.wu; if(!u) return; const i=slot===undefined?(ripI++%3):slot; u.uRip.value[i].set(x,z,T,str); u.uRipG.value[i]=glow?1:0; }
function fxPool(n,size,additive){
  const pos=new Float32Array(n*3).fill(-100), col=new Float32Array(n*3), g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('color',new THREE.BufferAttribute(col,3));
  const pts=new THREE.Points(g,new THREE.PointsMaterial({size,map:glowTexture(),vertexColors:true,transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending}));
  pts.frustumCulled=false; pts.renderOrder=3; inner.add(pts);
  const P=[...Array(n)].map((_,i)=>({i,life:0})); let k=0, live=false;
  return { add(x,y,z,vx,vy,vz,life,c,grav){ const p=P[k]; k=(k+1)%n; Object.assign(p,{x,y,z,vx,vy,vz,life,grav}); col[p.i*3]=c.r; col[p.i*3+1]=c.g; col[p.i*3+2]=c.b; live=true; },
    update(dt){ if(!live) return; live=false; for(const p of P){ if(p.life<=0) continue; p.life-=dt; const i=p.i*3; if(p.life<=0){ pos[i+1]=-100; continue; } live=true;
      p.vy-=p.grav*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; pos[i]=p.x; pos[i+1]=p.y; pos[i+2]=p.z; }
      g.attributes.position.needsUpdate=true; g.attributes.color.needsUpdate=true; } };
}
function islFx(){ return isl.fx||(isl.fx={spray:fxPool(90,0.13,false),glow:fxPool(70,0.32,true)}); }
let fxSnd=null;
/* A layered water splash: a soft "sploosh" of pink noise through a band-pass that sweeps down, a sine "bloop" gliding
   down with a few bubble blips after it, a tail of droplets falling back, and in deep water a low round thump.
   depth (metres of water under the tap) sets the character: shallow is a light, short, high splish; deep is a lower,
   rounder, longer plunk. Everything is varied a little on every tap, and two voice sets take turns so quick taps overlap.
   Only basic Tone nodes (no AudioWorklets); every synth is monophonic, so each trigger goes through monoAt. */
function makeSplash(dest){
  const out=new Tone.Gain(0.55).connect(dest);
  const voice=()=>{
    const bp=new Tone.Filter({type:'bandpass',frequency:1500,Q:1.1}).connect(out);
    const swish=new Tone.NoiseSynth({noise:{type:'pink'},envelope:{attack:0.012,decay:0.24,sustain:0,release:0.05}}).connect(bp);
    const bloop=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:0.004,decay:0.13,sustain:0,release:0.03}}).connect(out);
    const blip=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:0.002,decay:0.035,sustain:0,release:0.01}}).connect(out);
    const drop=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:0.002,decay:0.05,sustain:0,release:0.01}}).connect(out);
    const thump=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:0.01,decay:0.3,sustain:0,release:0.05}}).connect(out);
    swish.volume.value=-8; bloop.volume.value=-12; blip.volume.value=-22; drop.volume.value=-24; thump.volume.value=-16;
    return {bp,swish,bloop,blip,drop,thump}; };
  const V=[voice(),voice()]; let k=0;
  return (t,depth,level)=>{
    const v=V[k++%2], r=(a,b)=>a+Math.random()*(b-a), d=clamp((depth-0.15)/2.5,0,1), lv=(level===undefined?1:level)*r(0.8,1)*lerp(1,0.7,d);
    // sploosh: soft attack, the band-pass sweeping downward, lower and longer when deep
    const t0=monoAt(v.swish,t,0.2), f0=lerp(3600,1700,d)*r(0.88,1.12), f1=lerp(900,320,d)*r(0.88,1.12), len=lerp(0.2,0.32,d);
    v.bp.frequency.cancelScheduledValues(t0); v.bp.frequency.setValueAtTime(f0,t0); v.bp.frequency.exponentialRampToValueAtTime(f1,t0+len);
    v.bp.Q.setValueAtTime(lerp(0.9,1.6,d),t0); v.swish.triggerAttackRelease(len,t0,0.7*lv);
    // bloop: a fast downward glide, a little after the hit
    const tb=monoAt(v.bloop,t0+r(0.015,0.035),0.12), b0=lerp(760,480,d)*r(0.9,1.1), b1=lerp(220,130,d)*r(0.9,1.1);
    v.bloop.triggerAttackRelease(b0,0.12,tb,lerp(0.55,0.8,d)*lv); v.bloop.frequency.exponentialRampToValueAtTime(b1,tb+0.12);
    // 2 to 4 bubble blips, rising slightly as bubbles do
    let tt=tb+0.09; for(let i=0,n=2+Math.floor(Math.random()*3);i<n;i++){ tt=monoAt(v.blip,tt+r(0.025,0.07),0.04);
      const p=r(700,1300)*lerp(1.15,0.8,d); v.blip.triggerAttackRelease(p,0.03,tt,r(0.25,0.55)*lv); v.blip.frequency.exponentialRampToValueAtTime(p*1.35,tt+0.03); }
    // droplets falling back over the next 300-600 ms (fewer and later when deep)
    let td=t0+r(0.25,0.35); for(let i=0,n=Math.round(lerp(5,3,d))+Math.floor(Math.random()*2);i<n;i++){ td=monoAt(v.drop,td+r(0.04,0.12),0.05);
      const p=r(1800,3200)*lerp(1.1,0.85,d); v.drop.triggerAttackRelease(p,0.03,td,r(0.15,0.4)*lv); v.drop.frequency.exponentialRampToValueAtTime(p*0.8,td+0.04); }
    // deep water: a gentle low round thump (100-150 Hz)
    if(d>0.25){ const th=monoAt(v.thump,t0+0.005,0.3), p=r(115,150); v.thump.triggerAttackRelease(p,0.3,th,(d-0.2)*0.9*lv); v.thump.frequency.exponentialRampToValueAtTime(p*0.75,th+0.3); }
  }; }
let splashFx=null;
function splashSound(depth,level){ if(!audioReady||!amb) return; if(!splashFx) splashFx=makeSplash(amb); splashFx(Tone.now()+0.02,depth,level); }
function fxSound(kind){ if(!audioReady||!amb) return;
  if(!fxSnd){ const bp=new Tone.Filter({type:'bandpass',frequency:3800,Q:0.8}).connect(amb);
    fxSnd={rustle:new Tone.NoiseSynth({noise:{type:'pink'},envelope:{attack:0.03,decay:0.4,sustain:0}}).connect(bp)}; fxSnd.rustle.volume.value=-12; }
  const s=fxSnd[kind]; s.triggerAttackRelease(0.05,monoAt(s,Tone.now()+0.01,0.05)); }
const CYAN=C('#5ff4ff');
function nightShimmer(x,y,z,n){ if(night<0.5) return; const f=islFx(); for(let k=0;k<n;k++){ const a=Math.random()*6.28, r=Math.random()*0.7; f.glow.add(x+Math.cos(a)*r,y+0.04,z+Math.sin(a)*r,0,0.15+Math.random()*0.2,0,0.9+Math.random()*0.8,CYAN,0); } }
function waterTap(){ const x=tapPt.x, z=tapPt.z, f=islFx(), wc=C('#eafcff');
  addRipple(x,z,1.2,night>0.5); isl.scare={x,z,t:T}; addVibe(1); splashSound(Math.max(0,-0.31-terrainH(x,z)));
  for(let k=0;k<16;k++){ const a=Math.random()*6.28, s=0.4+Math.random()*0.9; f.spray.add(x,-0.27,z,Math.cos(a)*s,1.8+Math.random()*2.2,Math.sin(a)*s,0.45+Math.random()*0.35,wc,9.8); }
  nightShimmer(x,-0.31,z,10); }
function groundTap(){ const x=tapPt.x, y=tapPt.y, z=tapPt.z;
  if(y<-0.25){ waterTap(); return; }
  const f=islFx(), sc=C('#e3cc98'); addVibe(1);
  for(let k=0;k<18;k++){ const a=Math.random()*6.28, s=0.3+Math.random()*0.8; f.spray.add(x,y+0.05,z,Math.cos(a)*s,0.7+Math.random()*1.2,Math.sin(a)*s,0.4+Math.random()*0.3,sc,6); }
  nightShimmer(x,y,z,8); }
function plantTap(g){ g.userData.boing=1; const a=Math.random()*6.28; g.userData.sdx=Math.cos(a); g.userData.sdz=Math.sin(a); fxSound('rustle');
  if(g.userData.top&&Math.random()<0.3) dropCoconut(g); }
// coconuts: fall from the crown, bounce, roll down slopes, or bob on the water, then fade (at most three at once)
const nuts=[], _nv=new THREE.Vector3();
function dropCoconut(g){ let c=nuts.find(n=>n.life<=0);
  if(!c){ if(nuts.length>=3) return; const m=new THREE.Mesh(new THREE.SphereGeometry(0.13,12,10),std('#5a4026',{roughness:0.8})); m.castShadow=true; inner.add(m); c={m,v:new THREE.Vector3(),life:0}; nuts.push(c); }
  g.updateWorldMatrix(true,false); g.localToWorld(_nv.copy(g.userData.top)); c.m.position.copy(_nv); c.v.set((Math.random()-0.5)*1.4,0.4,(Math.random()-0.5)*1.4); c.life=6; c.wet=false; c.m.visible=true; c.m.scale.setScalar(1); }
function updateNuts(dt){ nuts.forEach(c=>{ if(c.life<=0) return; c.life-=dt; const p=c.m.position, r=0.13, sea=-0.31;
  if(surfRaw(p.x,p.z)<sea-0.08&&p.y<=sea+0.02){
    if(!c.wet){ c.wet=true; addRipple(p.x,p.z,0.6,night>0.5); splashSound(Math.max(0,-0.31-terrainH(p.x,p.z)),0.6); }
    p.y+=(sea+waveHjs(p.x,p.z,T)-0.03-p.y)*Math.min(1,dt*6); c.v.y=0; c.v.x*=1-dt*0.6; c.v.z*=1-dt*0.6; p.x+=c.v.x*dt; p.z+=c.v.z*dt;
  } else {
    c.v.y-=9.8*dt; p.addScaledVector(c.v,dt); const gy=surfRaw(p.x,p.z);
    if(p.y-r<gy){ p.y=gy+r; c.v.y=c.v.y<-0.8?-c.v.y*0.35:0;
      const gx=(surfRaw(p.x+0.1,p.z)-surfRaw(p.x-0.1,p.z))/0.2, gz=(surfRaw(p.x,p.z+0.1)-surfRaw(p.x,p.z-0.1))/0.2;
      c.v.x-=gx*6*dt; c.v.z-=gz*6*dt; c.v.x*=1-dt*1.2; c.v.z*=1-dt*1.2; } }
  c.m.rotation.x+=c.v.z*dt/r; c.m.rotation.z-=c.v.x*dt/r;
  if(c.life<1) c.m.scale.setScalar(Math.max(0.01,c.life)); if(c.life<=0) c.m.visible=false; }); }

const dayHemi=C('#fff6fb'), nightHemi=C('#7d6bd6'), dayGround=C('#c4b4e0'), nightGround=C('#2a2050');
const tmpC=new THREE.Color(), laserCol=new THREE.Color(), dmy2=new THREE.Object3D();
let camColR=1e9;
function update3D(dt,T){
  const k=1-Math.exp(-dt*3.2);
  for(const key in cam) cam[key]+=(camT[key]-cam[key])*k;
  view.c+=(view.cT-view.c)*k; view.s+=(view.sT-view.s)*k;
  const e=vibe/100, inPOV=povActive(), inRide=rideActive();
  if(!inPOV&&!inRide){
    camera.position.set(cam.tx+cam.r*Math.sin(cam.phi)*Math.sin(cam.theta),cam.ty+cam.r*Math.cos(cam.phi),cam.tz+cam.r*Math.sin(cam.phi)*Math.cos(cam.theta));
    // collision: if the line from the target out to the camera dips into the island or seabed, pull the camera in
    // (quickly when closing in, gently when it can move back out), then keep it at least 0.3 above the surface
    { const p=camera.position; let lim=cam.r;
      if(cam.ty>surfRaw(cam.tx,cam.tz)+0.3) for(let s=1;s<=12;s++){ const f=s/12, x=cam.tx+(p.x-cam.tx)*f, y=cam.ty+(p.y-cam.ty)*f, z=cam.tz+(p.z-cam.tz)*f; if(y<surfRaw(x,z)+0.3){ lim=cam.r*Math.max(0.12,(s-1)/12); break; } }
      camColR+=(lim-camColR)*Math.min(1,dt*(lim<camColR?25:3)); const rr=Math.min(cam.r,camColR);
      p.set(cam.tx+(p.x-cam.tx)*rr/cam.r,cam.ty+(p.y-cam.ty)*rr/cam.r,cam.tz+(p.z-cam.tz)*rr/cam.r);
      p.y=Math.max(p.y,surfRaw(p.x,p.z)+0.3); }
    camera.lookAt(cam.tx,cam.ty,cam.tz);
    // beat pulse and volcano rumble: small camera offsets, scaled by motionK()
    camFx.pulse=Math.max(0,camFx.pulse-dt*5); camFx.shake=Math.max(0,camFx.shake-dt*0.8);
    { const k=motionK(), p=camFx.pulse*camFx.pulse*0.15*k, sh=camFx.shake*0.16*k; camera.position.y+=-p+Math.sin(T*23)*sh*0.6; camera.position.x+=Math.sin(T*31)*sh; camera.position.z+=Math.cos(T*27)*sh*0.8; }
    applyLens(cam.fov,0.1);
  }
  if(sg.ready){ sg.hp.visible=!inPOV; sg.glows.forEach(g=>g.visible=!inPOV); if(!inPOV) sg.gltfRoot.visible=true; }

  // day to night
  const nT=show.sky==='day'?0:show.sky==='night'?1:(anyPlaying()?1:0);
  night+=(nT-night)*(1-Math.exp(-dt*0.9));
  updateFarWorld(T);
  sun.intensity=lerp(1.0,0.05,night);
  hemi.intensity=lerp(0.72,0.32,night);
  hemi.color.copy(dayHemi).lerp(nightHemi,night); hemi.groundColor.copy(dayGround).lerp(nightGround,night);
  const wash=night*(0.7+beatPulse*1.8*(0.35+e));
  washL.intensity=wash; washR.intensity=wash;
  washL.position.x=-4+Math.sin(T*0.7)*2.5; washR.position.x=4-Math.sin(T*0.7)*2.5;
  flameGlow=Math.max(0,flameGlow-dt*1.3); flameLight.intensity=flameGlow*4.5;
  strobeT=Math.max(0,strobeT-dt);
  if((strobeHold||strobeT>0)&&!show.reduceFlash) hemi.intensity=(Math.floor(T*18)%2)?2.6:0.1;
  starPts.material.opacity=night*0.9;
  cloudMat.color.copy(C('#ffffff')).lerp(C('#5d4f8f'),night*0.85);

  // jelly wobble

  // LEDs, bulbs, tiles
  const hue=(T*0.05)%1;
  ledMats.forEach((m,i)=>{ m.color.setHSL((hue+i*0.07)%1,0.85,lerp(0.72,0.6,night)+beatPulse*0.12*night); m.color.convertSRGBToLinear(); });
  bulbs.mats.forEach((m,i)=>{ const tw=0.8+0.2*Math.sin(T*3+i*1.7); m.color.copy(bulbs.cols[i]).multiplyScalar(lerp(0.55,1.25,night)*tw); });
  for(let k2=0;k2<tiles.n;k2++){
    const [i,j]=tiles.pos[k2];
    if(night<0.05){ tiles.mesh.setColorAt(k2,tiles.day[(i+j)%4]); continue; }
    const wave=Math.sin(i*0.7+j*0.9-T*3+beatCount*0.6);
    tmpC.setHSL((hue*2+i*0.04+j*0.05)%1,0.85,0.45+0.25*wave*0.5+beatPulse*0.15); tmpC.convertSRGBToLinear();
    tmpC.lerp(tiles.day[(i+j)%4],1-night); tiles.mesh.setColorAt(k2,tmpC);
  }
  tiles.mesh.instanceColor.needsUpdate=true;

  // decks
  if(decks.A){ if(decks.A.playing) jogs.A.rotation.y-=dt*3.5; if(decks.B.playing) jogs.B.rotation.y-=dt*3.5; }

  // Shigost
  const playing=anyPlaying();
  updateShigost(dt,T,e,playing);
  if(inPOV) updatePOV(dt);
  updatePoof(dt);

  // scenery bounce
  // tapped plants sway and settle (rotating about their base); props and clouds keep their springy bounce
  inner.children.forEach(o=>{ if(o.userData.boing){ const pl=o.userData.plant; o.userData.boing=Math.max(0,o.userData.boing-dt*(pl?1.3:2)); const b=o.userData.boing;
    if(pl){ const w=Math.sin((1-b)*22)*0.07*b; o.userData.tx=w*(o.userData.sdx||1); o.userData.tz=w*(o.userData.sdz||0); if(!o.userData.sway){ o.rotation.x=o.userData.tx; o.rotation.z=o.userData.tz; } }
    else { const s=o.userData.baseS||(o.userData.baseS=o.scale.x); o.scale.set(s*(1+Math.sin(b*14)*0.12*b),s*(1-Math.sin(b*14)*0.15*b),s*(1+Math.sin(b*14)*0.12*b)); } } });
  if(isl.fx){ isl.fx.spray.update(dt); isl.fx.glow.update(dt); } updateNuts(dt);
  (isl.sways||[]).forEach(g=>{ g.rotation.z=Math.sin(T*0.7+g.userData.sway.ph)*0.012*(1+lv.bass*0.6)+(g.userData.tz||0); g.rotation.x=Math.cos(T*0.55+g.userData.sway.ph)*0.008+(g.userData.tx||0); });
  clouds.forEach((c,i)=>{ if(!c.isGroup) return; c.position.x+=dt*0.25*(i%2?1:0.7); if(c.position.x>SLAB.w/2-3) c.position.x=-(SLAB.w/2-3); });
  // ocean life: haggan turtle and a sakman proa circling the island
  { const tf=(a)=>{ const r=islandR(a)+shelfD(2.0); return [Math.cos(a)*r,OCZ+Math.sin(a)*r]; }; const ta=T*0.05, [tx,tz]=tf(ta), [nx,nz]=tf(ta+0.02);
    duck.position.set(tx,-0.48+Math.max(0,Math.sin(T*0.5))*0.1,tz); duck.rotation.y=Math.atan2(nx-tx,nz-tz); }
  duck.children.forEach(f=>{ if(f.userData.flip!==undefined) f.rotation.z=Math.sin(T*3+f.userData.flip*1.6)*0.35; });
  if(duck.userData.spin){ duck.userData.spin=Math.max(0,duck.userData.spin-dt); duck.rotation.y+=duck.userData.spin*12; duck.position.y+=Math.sin(duck.userData.spin*Math.PI)*0.4; }
  balloon.userData.a=(balloon.userData.a||2)-dt*(0.04+(balloon.userData.boost||0)*0.06); balloon.userData.boost=Math.max(0,(balloon.userData.boost||0)-dt);
  { const bp=(a)=>{ const r=islandR(a)+shelfD(4.2)+7; return [Math.cos(a)*r,OCZ+Math.sin(a)*r]; };
    const a=balloon.userData.a, [bx,bz]=bp(a), [nx,nz]=bp(a-0.015), h=waveHjs(bx,bz,T), hx=(waveHjs(bx+0.6,bz,T)-h)/0.6, hz=(waveHjs(bx,bz+0.6,T)-h)/0.6;
    balloon.userData.yaw=balloon.userData.yaw===undefined?Math.atan2(-(nz-bz),nx-bx):balloon.userData.yaw;
    let ty=Math.atan2(-(nz-bz),nx-bx), dy=((ty-balloon.userData.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI; balloon.userData.yaw+=dy*Math.min(1,dt*2);
    const yaw=balloon.userData.yaw, fx=Math.cos(yaw), fz=-Math.sin(yaw), sx=Math.sin(yaw), sz=Math.cos(yaw);
    balloon.position.set(bx,-0.31+h+0.03,bz); balloon.rotation.set(-Math.atan((hx*sx+hz*sz)*3)-0.05,yaw,Math.atan((hx*fx+hz*fz)*3));
    balloon.userData.rowers.forEach(r=>{ const ph=T*3.4+r.i*0.3; r.pad.rotation.x=Math.sin(ph)*0.65; r.pad.rotation.z=0.5+0.18*Math.cos(ph); r.k.position.y=0.03+Math.max(0,Math.sin(ph))*0.012; r.k.rotation.z=Math.sin(ph)*0.05; }); }
  // lava, magma, and bioluminescent water pulse with the music
  isl.erupt=Math.max(0,(isl.erupt||0)-dt);
  isl.lavaTex.offset.x-=dt*(0.18+lv.bass*0.5);
  UWU.uUwT.value=T; UWU.uUwDay.value=1-night*0.85;
  isl.lavaS.u.uTime.value=T; isl.lavaS.u.uBass.value=lv.bass; isl.lavaS.u.uBoost.value=isl.erupt||0;
  isl.wu.uTime.value=T; isl.wu.uNight.value=night; isl.wu.uBass.value=lv.bass;
  isl.coralMats.forEach(m=>{ if(m.userData.u) m.userData.u.uGlow.value=night*(0.2+lv.bass*0.9)+0.03; });
  isl.heatM.opacity=0.3+lv.bass*0.35+(isl.erupt||0)*0.2+night*0.25;
  updateEdges(dt,T);
  drawSail(dt); isl.sailM.emissiveIntensity=show.sail==='off'?0:0.25+night*0.85+lv.bass*0.3;
  const lk=0.85+lv.bass*0.5+Math.sin(T*2.3)*0.08+isl.erupt*0.3; isl.lavaM.color.setRGB(lk,lk,lk);
  isl.lavaLight.intensity=1.0+lv.bass*2.5+night*1.2+isl.erupt*3;
  isl.sinahiM.emissiveIntensity=night*(0.4+lv.high*0.8);
  isl.smokeT-=dt;
  if(isl.smokeT<=0){ isl.smokeT=isl.erupt>0?0.08:0.32; const sp=isl.smoke.find(s=>s.userData.life>=1); if(sp){ sp.userData.life=0; sp.userData.dur=4+Math.random()*3; sp.position.set(isl.top.x+(Math.random()-0.5)*0.6,isl.top.y+0.4,isl.top.z+(Math.random()-0.5)*0.6); sp.userData.drift=0.25+Math.random()*0.35; } }
  isl.smoke.forEach(sp=>{ const u=sp.userData; if(u.life>=1){ sp.material.opacity=0; return; } u.life+=dt/u.dur; sp.position.y+=dt*(1.0+(isl.erupt>0?1.2:0)); sp.position.x+=dt*u.drift; const s=1.2+u.life*5.5; sp.scale.set(s,s,1);
    sp.material.opacity=Math.sin(Math.PI*Math.min(1,u.life))*(0.38+(isl.erupt>0?0.2:0)); sp.material.color.setRGB(lerp(0.85,0.55,night)+(1-u.life)*0.35*night,lerp(0.8,0.38,night)+(1-u.life)*0.12*night,lerp(0.86,0.45,night)); });
  if(isl.erupt>0&&Math.random()<dt*9){ const b=isl.bombs.find(o=>!o.userData.live); if(b){ b.userData.live=true; b.visible=true; b.position.copy(isl.top); const a=Math.random()*6.28, sp=2+Math.random()*2.5; b.userData.v.set(Math.cos(a)*sp,7+Math.random()*4,Math.sin(a)*sp); } }
  isl.bombs.forEach(b=>{ if(!b.userData.live) return; b.userData.v.y-=9.8*dt; b.position.addScaledVector(b.userData.v,dt); if(b.position.y<surfRaw(b.position.x,b.position.z)+0.1){ b.userData.live=false; b.visible=false; spark(b.position,[[1,0.5,0.1],[1,0.8,0.3]],5,2); } });
  isl.emberT=(isl.emberT||0)-dt;
  if(isl.emberT<=0){ isl.emberT=isl.erupt>0?0.03:0.14; spark(isl.top,[[1,0.45,0.08],[1,0.72,0.2],[1,0.3,0.05]],isl.erupt>0?8:2,isl.erupt>0?6:1.8); if(isl.vent2&&Math.random()<0.4) spark(isl.vent2,[[1,0.5,0.1]],1,1.2);
    if(Math.random()<0.35) isl.rivers.forEach(r=>spark(r.end,[[0.92,0.96,1],[0.8,0.85,0.9]],2,0.7)); }
  { const dmf=crowd.dummy; isl.fishM.userData.u.uTime.value=T; isl.fishM.userData.u.uGlow.value=night*(0.15+lv.bass*0.6);
    isl.fishSets.forEach(({im,data},si)=>{ data.forEach((f,i)=>{ let x,y,z,vx,vz,vy=0;
        if(f.home){ f.a+=dt*f.sp; x=f.home.x+Math.cos(f.a)*f.r; z=f.home.z+Math.sin(f.a)*f.r; y=Math.min(-0.65,f.home.y+f.y+Math.sin(T*2+i)*0.04); vx=-Math.sin(f.a); vz=Math.cos(f.a); }
        else { f.a+=f.sp*dt; const p=(a)=>{ const r=islandR(a)+shelfD(f.off)+Math.sin(T*0.4+f.ph)*0.5; return [Math.cos(a)*r,OCZ+Math.sin(a)*r]; };
          [x,z]=p(f.a); const [nx,nz]=p(f.a+Math.sign(f.sp)*0.01); vx=nx-x; vz=nz-z;
          y=Math.min(-0.65,Math.max(terrainH(x,z)+0.3,-0.31-f.depth+Math.sin(T*0.8+f.ph)*0.12)); }
        if(f.home&&!(f.rideW>0)) vy=0;
        if(isl.scare){ const age=T-isl.scare.t, dx=x-isl.scare.x, dz=z-isl.scare.z, dd=Math.hypot(dx,dz);
          if(age<2.5&&dd<3.5){ const k=(1-age/2.5)*(3.5-dd)*0.9/(dd+0.3); x+=dx*k; z+=dz*k; y=Math.min(-0.65,Math.max(terrainH(x,z)+0.25,y-(3.5-dd)*0.25*(1-age/2.5))); } }
        if(f.riding) f.rideW=Math.min(1,(f.rideW||0)+dt/1.2); else if(f.rideW>0) f.rideW=Math.max(0,f.rideW-dt/1.6);
        if(f.rideW>0){ f.rs+=dt*RIDE_SPEED; routeAt(f.rs,_rp,_rq); const w=sstep(0,1,f.rideW), hl=Math.hypot(vx,vz)||1;
          x+=(_rp.x-x)*w; y+=(_rp.y-y)*w; z+=(_rp.z-z)*w; vx=vx/hl+(_rq.x-vx/hl)*w; vz=vz/hl+(_rq.z-vz/hl)*w; vy=_rq.y*w; }
        const pitch=Math.atan2(vy,Math.hypot(vx,vz)||1);
        dmf.position.set(x,y,z); dmf.rotation.set(0,Math.atan2(-vz,vx),pitch+Math.sin(T*1.5+i)*0.08);
        // in the fish-eye view the ridden fish is hidden, so the camera never sees the inside of its own head
        dmf.scale.setScalar(f===ride.f&&ride.on&&ride.mode==='eye'&&!show.comfort?0.001:1); dmf.updateMatrix(); im.setMatrixAt(i,dmf.matrix);
        if(f===ride.f){ ride.fp.set(x,y,z); ride.fd.set(vx,vy,vz).normalize(); } });
      im.instanceMatrix.needsUpdate=true; }); }

  if(inRide) updateRide(dt);

  // lasers
  laserBurst=Math.max(0,laserBurst-dt);
  const on=(show.laserAuto&&playing)||laserBurst>0;
  laserRoot.visible=on;
  if(on){
    const n=lasers.length, rainbow=show.laserColor==='rainbow', sp=buildHype?2.4:1;
    const vis=lerp(0.35,1,night)*(show.reduceFlash?0.85:(0.6+0.3*lv.high+beatPulse*0.3));
    lasers.forEach((L,i)=>{
      let yaw=0,pitch=0.32,spread=1,show_=true; const m=show.laserMode;
      if(m==='fan'){ yaw=(i-(n-1)/2)*0.2+Math.sin(T*0.8*sp)*0.15; pitch=0.28+Math.sin(T*1.3*sp+i)*0.06; }
      else if(m==='sweep'){ yaw=Math.sin(T*1.6*sp)*0.7; pitch=0.25+0.1*Math.sin(T*0.7*sp); spread=0.6; }
      else if(m==='chase'){ const c=beatCount%n; show_=(c===i||c===n-1-i); yaw=(i-(n-1)/2)*0.22; pitch=0.3; spread=1.5; }
      else { const a=T*2*sp+i*(Math.PI*2/n); yaw=Math.cos(a)*0.4; pitch=0.4+Math.sin(a)*0.22; spread=0.3; }
      L.em.visible=show_; L.em.rotation.set(pitch,yaw,0);
      L.beams.forEach(b=>b.rotation.y=b.userData.o*0.22*spread);
      if(rainbow) laserCol.setHSL((hue*3+i/n)%1,1,0.55); else laserCol.set(show.laserColor);
      laserCol.convertSRGBToLinear();
      L.coreM.color.copy(laserCol); L.haloM.color.copy(laserCol);
      L.coreM.opacity=0.95*vis; L.haloM.opacity=0.17*vis;
    });
  }

  // flames
  cannons.forEach(c=>{
    if(c.burst<=0) return; c.burst-=dt; c.acc+=dt*230;
    while(c.acc>=1){ c.acc--; const p=flame.parts[flame.idx]; flame.idx=(flame.idx+1)%flame.n;
      p.alive=true; p.x=c.x+(Math.random()-0.5)*0.25; p.y=0.55; p.z=c.z+(Math.random()-0.5)*0.25;
      p.vx=(Math.random()-0.5)*0.8; p.vy=6.5+Math.random()*4; p.vz=(Math.random()-0.5)*0.8; p.life=0; p.max=0.55+Math.random()*0.35; }
  });
  let any=false;
  for(let i=0;i<flame.n;i++){
    const p=flame.parts[i]; if(!p.alive) continue; any=true;
    p.life+=dt; const t=p.life/p.max;
    if(t>=1){ p.alive=false; flame.pos[i*3+1]=-100; flame.col.fill(0,i*3,i*3+3); continue; }
    p.vy*=0.975; p.vx*=0.98; p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt;
    flame.pos[i*3]=p.x; flame.pos[i*3+1]=p.y; flame.pos[i*3+2]=p.z;
    let r,g,b; if(t<0.18){r=1;g=0.95;b=0.75;} else if(t<0.5){r=1;g=0.55;b=0.12;} else {const f=(1-t)*1.6;r=f;g=0.22*f;b=0.05*f;}
    flame.col[i*3]=r; flame.col[i*3+1]=g; flame.col[i*3+2]=b;
  }
  if(any||flame.dirty){ flame.geo.attributes.position.needsUpdate=true; flame.geo.attributes.color.needsUpdate=true; }
  flame.dirty=any;

  // crowd
  crowdCheer=Math.max(0,crowdCheer-dt*0.9);
  const d=crowd.dummy, hop=beatPulse*beatPulse, TW=Math.PI*2;
  const wrapA=a=>((a+Math.PI)%TW+TW)%TW-Math.PI;
  updateBodyTint(crowd.mats[0],night); crowd.mats[1].envMapIntensity=lerp(1.3,0.5,night);
  crowd.people.forEach((p,i)=>{
    const camYaw=Math.atan2(camera.position.x-p.x,camera.position.z-p.z);
    if(playing&&p.peek<=0&&Math.random()<dt*0.035) p.peek=1.2+Math.random()*2;
    if(!playing&&Math.random()<dt*0.25) p.wander=camYaw+(Math.random()-0.5)*2.2;
    p.peek=Math.max(0,p.peek-dt);
    const tgt=crowdCheer>0.35?camYaw:playing?(p.peek>0?camYaw:Math.PI+p.off):p.wander;
    p.yaw+=wrapA(tgt-p.yaw)*Math.min(1,dt*4);
    const air=(hop*0.38*(0.25+e)*p.j+Math.max(0,Math.sin(T*9+p.ph))*0.45*crowdCheer+Math.max(0,Math.sin(T*3+p.ph))*0.03*(0.3+e))*(0.5+0.4*p.s);
    const sq=Math.max(0,beatPulse-0.75)*0.5*(0.3+e);
    d.position.set(p.x,air,p.z); d.rotation.set(0,p.yaw,Math.sin(T*2+p.ph)*0.08*e);
    d.scale.set(p.s*(1+sq*0.5),p.s*(1-sq),p.s*(1+sq*0.5)); d.updateMatrix();
    crowd.meshes[p.type][0].setMatrixAt(p.idx,d.matrix); crowd.meshes[p.type][1].setMatrixAt(p.idx,d.matrix);
    { const cs=p.s*(p.type==='g'?0.78:0.82)/(1+air*1.6); d.position.set(p.x,0.085,p.z); d.rotation.set(0,0,0); d.scale.set(cs,1,cs); d.updateMatrix(); crowd.contact.setMatrixAt(i,d.matrix); }
    if(i<crowd.sn){ crowd.spos[i*3]=p.x+0.32*p.s*Math.cos(p.yaw)+Math.sin(T*3+p.ph)*0.2*(0.2+e); crowd.spos[i*3+1]=air+p.s*1.15+e*0.3; crowd.spos[i*3+2]=p.z-0.32*p.s*Math.sin(p.yaw); }
  });
  ['g','k'].forEach(t=>crowd.meshes[t].forEach(m=>m.instanceMatrix.needsUpdate=true)); crowd.contact.instanceMatrix.needsUpdate=true;
  crowd.sticks.geometry.attributes.position.needsUpdate=true;
  crowd.sticks.material.opacity=night*(0.3+0.7*e);

  projAcc+=dt; if(projAcc>=SCREEN_DT()){ drawProj(projAcc); projTex.needsUpdate=true; projAcc=0; }
}

/* ================= MAIN LOOP ================= */
const SKY={d1:[245,240,248],d2:[231,223,240],n1:[44,34,92],n2:[16,10,36],i0:[43,29,58],i1:[248,240,252]};
const mixRGB=(a,b,t)=>'rgb('+a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')+')';
let last=performance.now(), T=0, uiT=0;
/* Each part of the frame runs on its own, so one failing part can't freeze the rest: the first error from each part is
   logged once (with its stack) and kept in window.vibeBoothErrors, and the scene keeps rendering. Add ?debug to the URL
   to see these, plus the GPU and audio details, on screen (handy on a phone with no console). */
const DEBUG=/[?&]debug\b/.test(location.search), frameErr={};
window.vibeBoothErrors=[];
function reportErr(part,e){ if(frameErr[part]) return; frameErr[part]=true; const msg=part+': '+(e&&e.stack?e.stack:String(e));
  window.vibeBoothErrors.push(msg); console.error('[Vibe Booth] '+msg); if(DEBUG) debugPanel(); }
function guarded(part,fn){ try{ fn(); }catch(e){ reportErr(part,e); } }
let dbgEl=null, dbgFrames=0, dbgFps=0, dbgT=0;
function debugPanel(){ if(!DEBUG) return; if(!dbgEl){ dbgEl=document.createElement('pre'); dbgEl.style.cssText='position:fixed;left:8px;bottom:8px;z-index:99;max-width:92vw;max-height:40vh;overflow:auto;margin:0;padding:8px;font:11px/1.35 monospace;white-space:pre-wrap;background:rgba(10,8,20,.82);color:#e8f6ff;border-radius:8px;pointer-events:auto'; document.body.append(dbgEl); }
  let gpu='?', gl=renderer&&renderer.getContext(); try{ const x=gl.getExtension('WEBGL_debug_renderer_info'); gpu=x?gl.getParameter(x.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER); }catch(_){}
  const bad=renderer?renderer.info.programs.filter(p=>p.diagnostics&&!p.diagnostics.runnable).map(p=>p.name):[];
  let ctx=null; try{ ctx=Tone.getContext(); }catch(_){}
  dbgEl.textContent=['fps '+dbgFps+'  WebGL'+(renderer&&renderer.capabilities.isWebGL2?'2':'1')+'  '+gpu,
    'audio '+(ctx?ctx.state+' '+ctx.sampleRate+'Hz':'?')+'  muffle '+(uwLP?Math.round(uwLP.frequency.value)+'Hz':'-')+'  underwater '+uwK.toFixed(2)+'  bass '+lv.bass.toFixed(2),
    bad.length?'shader failed: '+bad.join(', '):'shaders ok ('+(renderer?renderer.info.programs.length:0)+')',
    ...window.vibeBoothErrors].join('\n'); }
window.addEventListener('error',e=>reportErr('page',e.error||e.message));
window.addEventListener('unhandledrejection',e=>reportErr('promise',e.reason));
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(0.05,(now-last)/1000); last=now; T+=dt;
  guarded('audio levels',()=>{ if(analyser){
    fft=analyser.getValue();
    let b=0,m=0,h=0; for(let i=0;i<2;i++) b+=nrm(fft[i]); for(let i=2;i<12;i++) m+=nrm(fft[i]); for(let i=12;i<40;i++) h+=nrm(fft[i]);
    lv.bass+=(b/2-lv.bass)*0.5; lv.mid+=(m/10-lv.mid)*0.4; lv.high+=(h/28-lv.high)*0.4;
  } });
  beatPulse=Math.max(0,beatPulse-dt*3.5);
  vibe=Math.max(0,vibe-dt*(anyPlaying()?0.35:1.5));
  guarded('scene update',()=>update3D(dt,T));
  guarded('render',()=>renderer.render(scene,camera));
  guarded('deck hints',updateDeckBubble);
  if(DEBUG){ dbgFrames++; dbgT+=dt; if(dbgT>=1){ dbgFps=dbgFrames; dbgFrames=0; dbgT=0; guarded('debug',debugPanel); } }
  uiT+=dt;
  if(uiT>0.1) guarded('ui',()=>{ uiT=0; if(amb){ const al=ambLevel*(anyPlaying()?0.45:1); amb.gain.rampTo(al,0.4); if(ambVerb) ambVerb.gain.rampTo(al*0.8,0.4); }
    // the muffle only follows a valid underwater reading; anything else leaves the music fully open
    updatePlayNudge();
    if(uwLP){ const k=Number.isFinite(uwK)?clamp(uwK,0,1):0; uwLP.frequency.rampTo(20000*Math.pow(650/20000,k),0.25); }
    $('#vibeFill').style.width=vibe+'%'; $('#vibeVal').textContent=Math.round(vibe);
    const rs=document.documentElement.style;
    rs.setProperty('--sky1',mixRGB(SKY.d1,SKY.n1,night)); rs.setProperty('--sky2',mixRGB(SKY.d2,SKY.n2,night));
    rs.setProperty('--stageInk',mixRGB(SKY.i0,SKY.i1,night));
    rs.setProperty('--stageGlass',night>0.5?'rgba(40,28,70,.55)':'rgba(255,255,255,.62)');
    rs.setProperty('--stageLine',night>0.5?'rgba(255,255,255,.16)':'rgba(43,29,58,.12)');
  });
}

/* ================= KNOBS ================= */
function arcPath(cx,cy,r,a0,a1){ const p=a=>[cx+r*Math.sin(a),cy-r*Math.cos(a)]; const [x0,y0]=p(a0),[x1,y1]=p(a1); const large=Math.abs(a1-a0)>Math.PI?1:0, sweep=a1>a0?1:0; return 'M'+x0.toFixed(2)+' '+y0.toFixed(2)+' A'+r+' '+r+' 0 '+large+' '+sweep+' '+x1.toFixed(2)+' '+y1.toFixed(2); }
const ARC=0.75*Math.PI;
class Knob{
  constructor(host,o){
    this.o=o; this.v=0;
    const k=el('div','knob'); k.dataset.k=o.key; k.tabIndex=0; k.setAttribute('role','slider'); k.setAttribute('aria-label',o.aria);
    k.setAttribute('aria-valuemin','-1'); k.setAttribute('aria-valuemax','1');
    k.innerHTML='<svg viewBox="0 0 48 48" width="46" height="46"><circle class="kBody" cx="24" cy="24" r="14"/><path class="kTrack" d="'+arcPath(24,24,20,-ARC,ARC)+'"/><path class="kVal"/><line class="kPtr" x1="24" y1="24" x2="24" y2="13"/></svg>';
    k.append(el('span','kLab',o.label)); host.append(k); this.el=k;
    this.val=k.querySelector('.kVal'); this.ptr=k.querySelector('.kPtr');
    let sy=0,sv=0,dragging=false,lastTap=0;
    k.addEventListener('pointerdown',e=>{ k.setPointerCapture(e.pointerId); dragging=true; sy=e.clientY; sv=this.v; e.preventDefault();
      const now=performance.now(); if(now-lastTap<300){ this.set(0); dragging=false; } lastTap=now; });
    k.addEventListener('pointermove',e=>{ if(!dragging) return; this.set(sv+(sy-e.clientY)/110); });
    const end=()=>{ dragging=false; };
    k.addEventListener('pointerup',end); k.addEventListener('pointercancel',end);
    k.addEventListener('wheel',e=>{ e.preventDefault(); this.set(this.v-e.deltaY*0.002); },{passive:false});
    k.addEventListener('keydown',e=>{ if(e.key==='ArrowUp'||e.key==='ArrowRight'){this.set(this.v+0.05);e.preventDefault();} if(e.key==='ArrowDown'||e.key==='ArrowLeft'){this.set(this.v-0.05);e.preventDefault();} if(e.key==='0'||e.key==='Home') this.set(0); });
    this.render();
  }
  set(v,silent){ v=clamp(v,-1,1); if(Math.abs(v)<0.035) v=0; this.v=v; this.render(); if(!silent) this.o.onChange(v); }
  render(){
    const a=this.v*ARC;
    this.val.setAttribute('d',Math.abs(a)<0.01?'':arcPath(24,24,20,Math.min(0,a),Math.max(0,a)));
    this.ptr.setAttribute('transform','rotate('+(a*180/Math.PI).toFixed(1)+' 24 24)');
    this.el.setAttribute('aria-valuenow',this.v.toFixed(2));
  }
}

/* ================= UI BUILD ================= */
const knobs={A:{},B:{}};
const eqDb=p=>p<0?p*30:p*6;
function buildChannels(){
  ['A','B'].forEach(id=>{
    const ch=$('#chan'+id); ch.innerHTML='';
    const head=el('div','chanHead'); head.append(el('span','chanTag',id));
    const sel=el('select','trackSel'); sel.dataset.deck=id; sel.setAttribute('aria-label','Track on deck '+id); head.append(sel); ch.append(head);
    sel.addEventListener('change',e=>{ if(audioReady) loadTrackToDeck(decks[id],e.target.value); });
    const row=el('div','knobs'); ch.append(row);
    [['high','Hi'],['mid','Mid'],['low','Low']].forEach(([band,lab])=>{ knobs[id][band]=new Knob(row,{key:band,label:lab,aria:lab+' EQ, deck '+id,onChange:p=>{ if(decks[id]) setEQ(decks[id],band,eqDb(p)); }}); });
    knobs[id].filter=new Knob(row,{key:'filter',label:'Filter',aria:'Filter, deck '+id,onChange:p=>{ if(decks[id]) setFilter(decks[id],p); }});
    const kill=el('button','kill','Cut low'); kill.setAttribute('aria-label','Cut low on deck '+id); row.append(kill);
    kill.addEventListener('click',()=>{ const d=decks[id]; if(!d) return; const k=knobs[id].low; k.set(d.lowVal<=-29?0:-1); });
    const foot=el('div','chanFoot'); const lb=el('label',null,'Volume'); const vol=el('input'); vol.type='range'; vol.min=0; vol.max=1; vol.step=0.01; vol.value=0.8; vol.setAttribute('aria-label','Volume deck '+id);
    vol.addEventListener('input',()=>{ const d=decks[id]; if(d){ d.fader.gain.rampTo(+vol.value,0.03); d.revFader.gain.rampTo(+vol.value,0.03); } });
    foot.append(lb,vol); ch.append(foot);
    const cr=el('div','cueRow');
    ['Intro','Build','Drop','Break'].forEach(n=>{ const b=el('button','cue',n); b.dataset.s=n; b.setAttribute('aria-label','Hot cue '+n+' on deck '+id); b.addEventListener('click',()=>hotCue(id,n)); cr.append(b); });
    const lb2=el('button','loopBtn','Loop 4'); lb2.addEventListener('click',()=>toggleLoop(id)); const rb=el('button','rollBtn','Roll');
    rb.addEventListener('pointerdown',e=>{ e.preventDefault(); rollOn(id,true); }); ['pointerup','pointerleave','pointercancel'].forEach(ev=>rb.addEventListener(ev,()=>rollOn(id,false)));
    cr.append(lb2,rb); ch.append(cr);
  });
  refreshSelects();
}
function refreshSelects(){
  $$('.trackSel').forEach(sel=>{
    const id=sel.dataset.deck, d=decks[id];
    const cur=d&&d.trackVal?d.trackVal:(id==='A'?'b:0':'b:2');
    sel.innerHTML='';
    const g1=document.createElement('optgroup'); g1.label='Crate';
    BUILTINS.forEach((t,i)=>g1.append(new Option(t.name+' ('+t.style+')','b:'+i)));
    const g2=document.createElement('optgroup'); g2.label='Studio';
    g2.append(new Option(myTrack.name+' (live from Studio)','my'));
    sel.append(g1,g2);
    if(crate.length){ const g3=document.createElement('optgroup'); g3.label='Saved'; crate.forEach((t,i)=>g3.append(new Option(t.name+' ('+t.bpm+' bpm)','c:'+i))); sel.append(g3); }
    sel.value=cur;
  });
}
let cellCols=[...Array(16)].map(()=>[]);
function buildGrid(){
  const g=$('#grid'); g.innerHTML=''; cellCols=[...Array(16)].map(()=>[]);
  g.append(el('div'));
  for(let s=0;s<16;s++) g.append(el('div','stepNum'+(s%4===0?' beat':''),String(s+1)));
  ROWS.forEach(r=>{
    const lab=el('button','gLabel',r.label); lab.addEventListener('click',()=>{$('#studioHint').textContent=r.hint;}); g.append(lab);
    for(let s=0;s<16;s++){
      const b=el('button','cell'+(Math.floor(s/4)%2?' alt':'')); b.dataset.row=r.k; b.dataset.step=s; b.setAttribute('aria-label',r.label+' step '+(s+1));
      b.addEventListener('click',()=>cellTap(r.k,s,b)); g.append(b); cellCols[s].push(b);
    }
  });
  paintGrid();
}
function paintCell(b){ const v=myTrack[b.dataset.row][+b.dataset.step]; b.classList.toggle('on',!!v); b.textContent=b.dataset.row==='vox'?(v?String(v):''):(v===2?'↑':''); b.setAttribute('aria-pressed',v?'true':'false'); }
function paintGrid(){ $$('#grid .cell').forEach(paintCell); }
function cellTap(row,s,b){
  const arr=myTrack[row]; arr[s]=row==='bass'?(arr[s]+1)%3:row==='vox'?(arr[s]+1)%5:(arr[s]?0:1);
  paintCell(b); saveMy();
  const t=myTrack;
  if([0,4,8,12].every(i=>t.kick[i])) complete('four');
  if(t.clap[4]&&t.clap[12]) complete('clap');
  if(t.bass.includes(1)&&t.bass.includes(2)) complete('bassline');
}
function syncStudioControls(){
  $('#trackName').value=myTrack.name; $('#keySel').value=myTrack.key; $('#progSel').value=myTrack.prog; $('#kitSel').value=myTrack.kit; $('#trackSwing').value=myTrack.swing; $('#trackSwingVal').textContent=Math.round(myTrack.swing*100)+'%';
  $('#trackBpm').value=myTrack.bpm; $('#trackBpmVal').textContent=myTrack.bpm;
}
function myChanged(){
  saveMy(); if(!audioReady) return;
  ['A','B'].forEach(id=>{ const d=decks[id]; if(d.trackVal==='my'){ refreshDeckInfo(d); if(d.playing&&!otherDeck(d).playing) setBPM(myTrack.bpm); } });
}
function buildStudio(){
  const tpl=$('#tplSel'); tpl.append(new Option('Pick a template','')); BUILTINS.forEach((t,i)=>tpl.append(new Option(t.style+' ('+t.name+')',String(i))));
  Object.keys(KEYROOT).forEach(k=>$('#keySel').append(new Option(k+' minor',k)));
  Object.keys(PROGS).forEach(k=>$('#progSel').append(new Option(PROGS[k].name,k)));
  syncStudioControls(); buildGrid();
  $('#trackName').addEventListener('input',e=>{ myTrack.name=e.target.value||'Untitled'; saveMy(); });
  $('#trackName').addEventListener('change',()=>{ refreshSelects(); if(audioReady) ['A','B'].forEach(id=>{ if(decks[id].trackVal==='my') refreshDeckInfo(decks[id]); }); });
  tpl.addEventListener('change',e=>{
    if(e.target.value==='') return; const src=BUILTINS[+e.target.value];
    ['style','bpm','key','prog','kit','swing'].forEach(k=>myTrack[k]=src[k]);
    ['kick','clap','hat','ohat','bass','stab','vox'].forEach(k=>myTrack[k]=src[k].slice());
    syncStudioControls(); paintGrid(); myChanged(); e.target.value='';
    toast('Loaded the '+src.style+' template. Now make it yours.');
  });
  $('#keySel').addEventListener('change',e=>{myTrack.key=e.target.value;myChanged();});
  $('#progSel').addEventListener('change',e=>{myTrack.prog=e.target.value;myChanged();});
  Object.keys(KITS).forEach(k=>$('#kitSel').append(new Option(KITS[k].name,k)));
  $('#kitSel').addEventListener('change',e=>{myTrack.kit=e.target.value; if(audioReady) ['A','B'].forEach(id=>{ if(decks[id].trackVal==='my') decks[id].prepare(myTrack); }); myChanged();});
  $('#trackSwing').addEventListener('input',e=>{myTrack.swing=+e.target.value; $('#trackSwingVal').textContent=Math.round(myTrack.swing*100)+'%'; myChanged();});
  $('#trackBpm').addEventListener('input',e=>{myTrack.bpm=+e.target.value;$('#trackBpmVal').textContent=myTrack.bpm;myChanged();});
  const playOn=id=>{ if(!audioReady) return; const d=decks[id]; loadTrackToDeck(d,'my'); d.loop={start:CUES.Drop,len:4}; $('#chan'+id+' .loopBtn').classList.add('on'); if(d.playing) d.jump=CUES.Drop; else { d.startBar=CUES.Drop; if(!d.pending) togglePlay(d); } toast('Looping the drop of your track so you can hear edits'); };
  $('#playOnA').addEventListener('click',()=>playOn('A'));
  $('#playOnB').addEventListener('click',()=>playOn('B'));
  $('#inspire').addEventListener('click',()=>{
    const pick=a=>a[Math.floor(Math.random()*a.length)];
    Object.keys(POOLS).forEach(k=>myTrack[k]=P(pick(POOLS[k])));
    myTrack.key=pick(Object.keys(KEYROOT)); myTrack.prog=pick(Object.keys(PROGS)); myTrack.kit=pick(Object.keys(KITS)); myTrack.swing=pick([0,0,0.08,0.18,0.22]); if(audioReady) ['A','B'].forEach(id=>{ if(decks[id].trackVal==='my') decks[id].prepare(myTrack); });
    syncStudioControls(); paintGrid(); myChanged(); toast('Fresh idea loaded. Tweak it till it slaps.');
  });
  $('#clearTrack').addEventListener('click',()=>{ ['kick','clap','hat','ohat','bass','stab','vox'].forEach(k=>myTrack[k]=Array(16).fill(0)); paintGrid(); myChanged(); });
  $('#saveTrack').addEventListener('click',()=>{
    crate.push(JSON.parse(JSON.stringify(myTrack))); store.set('crate',crate);
    refreshSelects(); complete('save'); toast('Saved "'+myTrack.name+'" to your crate','good');
  });
}
function chipGroup(container,options,getCur,onPick){
  const box=$(container); box.innerHTML='';
  Object.keys(options).forEach(k=>{ const b=el('button','chipBtn'+(getCur()===k?' on':''),options[k]); b.dataset.k=k; b.addEventListener('click',()=>{ onPick(k); box.querySelectorAll('.chipBtn').forEach(x=>x.classList.toggle('on',x===b)); }); box.append(b); });
}
function syncPatternChips(){ $$('#patternChips .chipBtn').forEach(b=>b.classList.toggle('on',b.dataset.k===show.pattern)); }
function buildShow(){
  $('#projPreview').append(projCanvas);
  chipGroup('#patternChips',PATTERNS,()=>show.pattern,k=>{ show.pattern=k; show.paintPattern=true; saveShow(); checkPaint(); });
  chipGroup('#paletteChips',PAL_NAMES,()=>show.palette,k=>{ show.palette=k; saveShow(); });
  chipGroup('#sailChips',SAIL_MODES,()=>show.sail,k=>{ show.sail=k; saveShow(); });
  chipGroup('#skyChips',{auto:'Night when music plays',day:'Always day',night:'Always night'},()=>show.sky,k=>{ show.sky=k; saveShow(); });
  chipGroup('#laserModes',{fan:'Fan',sweep:'Sweep',chase:'Chase',cone:'Cone'},()=>show.laserMode,k=>{ show.laserMode=k; saveShow(); laserBurst=Math.max(laserBurst,2.5); });
  const sw=$('#laserSwatches');
  ['#ff4fb0','#3fd8ff','#4dff8a','#a35bff','#ffd23f','rainbow'].forEach(c=>{
    const b=el('button','swatch'+(show.laserColor===c?' on':'')); b.setAttribute('aria-label',c==='rainbow'?'Rainbow lasers':'Laser color '+c);
    b.style.background=c==='rainbow'?'conic-gradient(#ff3b3b,#ffd84d,#3dff7a,#2ee6ff,#a35bff,#ff3fb4,#ff3b3b)':c;
    b.addEventListener('click',()=>{ show.laserColor=c; saveShow(); laserBurst=Math.max(laserBurst,2.5); sw.querySelectorAll('.swatch').forEach(x=>x.classList.toggle('on',x===b)); });
    sw.append(b);
  });
  $('#projText').value=show.text;
  $('#projText').addEventListener('input',e=>{ show.text=e.target.value; if(show.text.trim()) show.paintText=true; saveShow(); checkPaint(); });
  $('#projSpeed').value=show.speed; $('#projSpeed').addEventListener('input',e=>{ show.speed=+e.target.value; saveShow(); });
  const tog=(id,key)=>{ const i=$(id); i.checked=!!show[key]; i.addEventListener('change',()=>{ show[key]=i.checked; saveShow(); }); };
  tog('#tLaserAuto','laserAuto'); tog('#tFlameAuto','flameAuto'); tog('#tBass','bassReact'); tog('#tBeatStrobe','beatStrobe'); tog('#tReduce','reduceFlash'); tog('#tComfort','comfort'); $('#tComfort').addEventListener('change',()=>rideUI());
  const sb=$('#sStrobe');
  sb.addEventListener('pointerdown',()=>{strobeHold=true;});
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>sb.addEventListener(ev,()=>{strobeHold=false;}));
}
function checkPaint(){ if(show.paintPattern&&show.paintText) complete('paint'); }
function setTab(tab){
  curTab=tab;
  $$('.tabs button').forEach(x=>x.classList.toggle('on',x.dataset.tab===tab));
  $$('.tabBody').forEach(t=>t.hidden=t.id!=='tab-'+tab);
}
function setSheet(open){
  const c=$('#console'); c.classList.toggle('open',open); document.body.classList.toggle('sheet-open',open&&isMobile());
  $('#handle').setAttribute('aria-label',open?'Show fewer controls':'Show more controls');
  requestAnimationFrame(()=>{ updateViewTargets(); applyCoach(); });
}
function bindGlobal(){
  $$('.tabs button').forEach(b=>b.addEventListener('click',()=>{
    const c=$('#console');
    if(isMobile()){ if(c.classList.contains('open')&&curTab===b.dataset.tab){ setSheet(false); return; } setTab(b.dataset.tab); setSheet(true); }
    else { setTab(b.dataset.tab); applyCoach(); }
  }));
  $('#handle').addEventListener('click',()=>setSheet(!$('#console').classList.contains('open')));
  $$('.cams button').forEach(b=>b.addEventListener('click',()=>setPreset(b.dataset.cam)));
  let camIdx=0; const camOrder=['island','front','dj','reef'], camNames={island:'Island view',front:'Front row',dj:"Shigost's view",reef:'Reef view'};
  // help sheet: copies the How to play text, offers the camera views, and closes on Got it, Escape, a view, or a tap outside
  { const sheet=$('#helpSheet'); let back=null;
    $('#helpText').innerHTML=[...$$('.howto p')].filter(p=>!p.classList.contains('howTitle')).map(p=>p.outerHTML).join('');
    const close=()=>{ sheet.hidden=true; if(back&&back.focus) back.focus(); };
    $('#helpBtn').addEventListener('click',()=>{ back=document.activeElement; sheet.hidden=false; $('#helpClose').focus(); });
    $('#helpClose').addEventListener('click',close);
    sheet.addEventListener('click',e=>{ if(e.target===sheet) close(); });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!sheet.hidden) close(); });
    $$('.helpCams button').forEach(b=>b.addEventListener('click',close)); }
  $('#camCycle').addEventListener('click',()=>{ camIdx=(camIdx+1)%camOrder.length; setPreset(camOrder[camIdx]); toast(camNames[camOrder[camIdx]]); });
  $('#pA').addEventListener('click',()=>{ if(audioReady) togglePlay(decks.A); });
  $('#pB').addEventListener('click',()=>{ if(audioReady) togglePlay(decks.B); });
  $('#aBuild').addEventListener('click',()=>{ if(audioReady) startRiser(); });
  $('#aDrop').addEventListener('click',()=>{ if(audioReady) doDrop(); });
  $('#aFire').addEventListener('click',()=>fireFlames(true));
  $('#aLaser').addEventListener('click',()=>{ laserBurst=4; addVibe(2); });
  $('#xfader').addEventListener('input',e=>setXF(+e.target.value));
  $('#xfader').addEventListener('dblclick',e=>{ e.target.value=0.5; setXF(0.5); });
  $('#tempo').addEventListener('input',e=>setBPM(+e.target.value));
  $('#fxEcho').addEventListener('click',()=>{ if(!audioReady) return; echoOn=!echoOn; echo.wet.rampTo(echoOn?0.35:0,0.1); $('#fxEcho').classList.toggle('on',echoOn); });
  $('#fxPhaser').addEventListener('click',()=>{ if(!audioReady) return; phaserOn=!phaserOn; phaser.wet.rampTo(phaserOn?0.6:0,0.2); $('#fxPhaser').classList.toggle('on',phaserOn); });
  $('#fxGate').addEventListener('click',()=>{ if(!audioReady) return; gateOn=!gateOn; if(!gateOn) gateG.gain.cancelScheduledValues(0), gateG.gain.rampTo(1,0.02); $('#fxGate').classList.toggle('on',gateOn); });
  $('#ambVol').addEventListener('input',e=>{ ambLevel=+e.target.value; });
  $('#fxVerb').addEventListener('click',()=>{ if(!audioReady) return; verbOn=!verbOn; verbSend.gain.rampTo(verbOn?0.45:0,0.2); $('#fxVerb').classList.toggle('on',verbOn); });
  $('#coachPill').addEventListener('click',()=>{ setTab('learn'); if(isMobile()) setSheet(true); else applyCoach(); });
  $('#resetProgress').addEventListener('click',()=>{ if(confirm('Reset all quests and XP? Your saved tracks stay.')){ progress={xp:0,done:{}}; store.set('progress',progress); show.paintPattern=false; show.paintText=false; saveShow(); renderMissions(); } });
  window.addEventListener('resize',()=>{ document.body.classList.toggle('sheet-open',isMobile()&&$('#console').classList.contains('open')); });
  if(window.ResizeObserver) new ResizeObserver(()=>updateViewTargets()).observe($('#console'));
  /* Phones: iPhones mute web audio while the ring/silent switch is on, unless the page says it is media playback.
     audioSession (Safari 17+) does that directly; on older iPhones a silent looping <audio> element started from the tap
     moves the page into the media channel. Mobile browsers also suspend audio when the tab goes to the background or a
     call comes in, so any later tap, or coming back to the tab, wakes it again. */
  const unlockPhoneAudio=()=>{
    try{ if(navigator.audioSession) navigator.audioSession.type='playback'; }catch(_){}
    try{ if(!window.__silentEl){ const a=document.createElement('audio'); a.setAttribute('playsinline',''); a.loop=true; a.volume=0.01;
        // 0.1s of silence as a tiny WAV
        const n=4410, b=new ArrayBuffer(44+n*2), v=new DataView(b), w=(o,t)=>{ for(let i=0;i<t.length;i++) v.setUint8(o+i,t.charCodeAt(i)); };
        w(0,'RIFF'); v.setUint32(4,36+n*2,true); w(8,'WAVE'); w(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true); v.setUint32(24,44100,true); v.setUint32(28,88200,true); v.setUint16(32,2,true); v.setUint16(34,16,true); w(36,'data'); v.setUint32(40,n*2,true);
        a.src=URL.createObjectURL(new Blob([b],{type:'audio/wav'})); window.__silentEl=a; }
      const p=window.__silentEl.play(); if(p&&p.catch) p.catch(()=>{}); }catch(_){}
  };
  const wakeAudio=()=>{ if(!audioReady) return; try{ const c=Tone.getContext(); if(c.state!=='running'){ unlockPhoneAudio(); c.resume(); } }catch(_){} };
  ['pointerdown','touchend','keydown'].forEach(ev=>document.addEventListener(ev,wakeAudio,{passive:true}));
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) wakeAudio(); });
  $('#enterBtn').addEventListener('click',async()=>{
    unlockPhoneAudio();
    // a 'playback' context uses bigger audio buffers, which trades a little latency for no crackle under load.
    // Tone's Transport/Draw/Destination exports stay bound to the load-time context, so app code uses Tone.getTransport() etc.
    try{ const old=Tone.getContext(); Tone.setContext(new Tone.Context({latencyHint:'playback',lookAhead:0.2})); old.dispose(); }catch(e){ console.warn('audio context',e); }
    try{ await Tone.start(); }catch(e){}
    try{ const c=Tone.getContext(); if(c.state!=='running') await c.resume(); }catch(e){}
    try{ initAudio(); }catch(e){ console.error(e); toast('Audio could not start in this browser. The visuals still work.','warn'); }
    $('#gate').remove();
    showStartMusic();
    setTimeout(()=>{ if(!startEl) toast('Tip: tap Shigost, the flame cannons, or the round screen'); },1600);
  });
}

/* ================= BOOT ================= */
buildChannels(); buildStudio(); buildShow(); bindGlobal(); renderMissions();
try{ init3D(); requestAnimationFrame(frame); }
catch(e){ console.error(e); toast('3D needs WebGL, which this browser has turned off.','warn'); }
})();
