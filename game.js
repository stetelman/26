const ALPHA='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let dict=new Set(), allWords=[], commonWords=[], openingWords=[], commonWordSet=new Set(), players=[], playerCount=2, turn=0, moveHistory=[], lockUntil=new Map(), gameOver=false, mode='bot', typedWord='', passWait=false;
const BOT_HISTORY_KEY='typesetBotRecentGames';
const BOT_UNLOCK_KEY='typesetUnlockedBotRank';
const BOT_STREAK_KEY='typesetBotStreak';
const BOT_BEST_STREAK_KEY='typesetBotBestStreak';
const BOT_RANKS=[
 {name:'Dabbler',icon:'⌨',sample:140,shortlist:28,pick:18,noise:4.2,defense:.25},
 {name:'Typist',icon:'T',sample:220,shortlist:24,pick:14,noise:3.2,defense:.45},
 {name:'Copy Clerk',icon:'C',sample:320,shortlist:20,pick:11,noise:2.4,defense:.7},
 {name:'Stenographer',icon:'S',sample:440,shortlist:16,pick:8,noise:1.7,defense:.95},
 {name:'Typesetter',icon:'TS',sample:600,shortlist:12,pick:6,noise:1.2,defense:1.2},
 {name:'Proofreader',icon:'✓',sample:760,shortlist:10,pick:4,noise:.8,defense:1.4},
 {name:'Court Reporter',icon:'CR',sample:950,shortlist:8,pick:3,noise:.5,defense:1.6},
 {name:'Wordsmith',icon:'W',sample:1200,shortlist:6,pick:2,noise:.25,defense:1.8}
];
let botRank=0;
const $=id=>document.getElementById(id);

Promise.all([
 fetch('https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt').then(r=>r.ok?r.text():Promise.reject()),
 fetch('https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english.txt').then(r=>r.ok?r.text():Promise.reject())
]).then(([allText,commonText])=>{
 const all=allText.split(/\r?\n/).map(w=>w.trim().toUpperCase()).filter(w=>/^[A-Z]+$/.test(w)&&w.length>=3&&w.length<=7);
 const common=commonText.split(/\r?\n/).map(w=>w.trim().toUpperCase()).filter(w=>/^[A-Z]+$/.test(w)&&w.length>=3&&w.length<=7);
 allWords=[...new Set(all)];dict=new Set(allWords);commonWords=[...new Set(common.filter(w=>dict.has(w)))];
 commonWordSet=new Set(commonWords);const extras=allWords.filter(w=>!commonWordSet.has(w)&&new Set(w).size>=3&&/[AEIOUY]/.test(w));
 for(let i=extras.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[extras[i],extras[j]]=[extras[j],extras[i]]}
 openingWords=[...commonWords,...extras].slice(0,10000);reset();msg('Dictionary loaded.');
}).catch(()=>{
 commonWords=['CAT','DOG','SIX','WORD','GAME','QUIZ','WATER','LETTER','CROSS','ZEBRA','JUMP','VEX','QUICK'];allWords=[...commonWords];openingWords=[...commonWords];commonWordSet=new Set(commonWords);dict=new Set(commonWords);reset();msg('Dictionary fallback loaded.');
});

function unlockedBotRank(){const n=parseInt(localStorage.getItem(BOT_UNLOCK_KEY)||'0',10);return Math.max(0,Math.min(BOT_RANKS.length-1,isNaN(n)?0:n))}
function botStreak(){return Math.max(0,parseInt(localStorage.getItem(BOT_STREAK_KEY)||'0',10)||0)}
function botBestStreak(){return Math.max(0,parseInt(localStorage.getItem(BOT_BEST_STREAK_KEY)||'0',10)||0)}
function reset(){const n=mode==='bot'?2:playerCount;players=Array.from({length:n},()=>({got:new Set()}));turn=0;moveHistory=[];lockUntil=new Map();gameOver=false;typedWord='';passWait=false;document.body.classList.remove('showPass');render()}
function current(){return players[turn%players.length]}
function activePlayer(){return turn%players.length}
function lockedLetters(){const s=new Set();for(const [ch,until] of lockUntil)if(turn<until)s.add(ch);return s}
function gainedBy(word,p=current()){const lock=lockedLetters();return [...new Set(word)].filter(ch=>!p.got.has(ch)&&!lock.has(ch))}
function legalWord(word){
 if(word.length<3||word.length>7)return {ok:false,msg:'Use a 3–7 letter word.'};
 if(!dict.has(word))return {ok:false,msg:'That word is not in the dictionary.'};
 if(moveHistory.some(m=>m.word===word))return {ok:false,msg:'That word has already been played.'};
 const lock=lockedLetters();
 if([...new Set(word)].some(ch=>lock.has(ch)))return {ok:false,msg:'That word uses a locked letter.'};
 return {ok:true};
}
function play(){
 if(gameOver||(mode==='bot'&&activePlayer()===1))return;
 const word=typedWord.toUpperCase().replace(/[^A-Z]/g,'');
 const check=legalWord(word);if(!check.ok){msg(check.msg);return}
 commit(word,'human');
}
function commit(word,source){
 const actor=activePlayer();const lock=lockedLetters();const gained=turn===0?[]:gainedBy(word,current());
 for(const ch of gained)current().got.add(ch);
 for(const ch of new Set(word))if(!lock.has(ch))lockUntil.set(ch,turn+2);
 moveHistory.push({player:actor,word,gained,source});
 typedWord='';
 if(current().got.size===26){gameOver=true;render();showWinner(actor);return}
 turn++;
 if(mode==='local'){passWait=true;render();showPass();return}
 render();
 if(mode==='bot'&&activePlayer()===1&&!gameOver){msg('Bot is thinking…');setTimeout(botMove,160)}
}
function getBotHistory(){try{return JSON.parse(localStorage.getItem(BOT_HISTORY_KEY)||'[]')}catch{return []}}
function saveBotGameWords(words){
 const history=getBotHistory();
 history.push([...new Set(words)]);
 while(history.length>5)history.shift();
 localStorage.setItem(BOT_HISTORY_KEY,JSON.stringify(history));
}
function recentBotWords(){return new Set(getBotHistory().flat())}
function botMove(){
 if(gameOver||mode!=='bot'||activePlayer()!==1)return;
 const rank=BOT_RANKS[botRank],recent=recentBotWords(),usedThisGame=new Set(moveHistory.map(m=>m.word));
 const candidates=[];
 const source=turn===1?openingWords:commonWords.slice(0,5000);
 const shuffled=[...source];
 for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}
 const pool=shuffled.slice(0,Math.min(rank.sample,shuffled.length));
 const opp=players[0],oppNeed=new Set(ALPHA.filter(ch=>!opp.got.has(ch)));
 for(const w of pool){
   if(recent.has(w)||usedThisGame.has(w))continue;
   const unique=[...new Set(w)];
   if(unique.some(ch=>lockedLetters().has(ch)))continue;
   const gain=gainedBy(w,current());let rare=0;
   for(const ch of gain)rare+=({Q:3,Z:2.6,X:2.3,J:2.2,K:1.4,V:1.3}[ch]||1);
   const blockValue=unique.filter(ch=>oppNeed.has(ch)).length;
   const commonBoost=commonWordSet.has(w)?1.6:0;
   const score=gain.length*6.2+rare*.95+blockValue*rank.defense+w.length*.12+commonBoost+Math.random()*rank.noise;
   candidates.push({w,score});
 }
 candidates.sort((a,b)=>b.score-a.score);
 const top=candidates.slice(0,rank.shortlist);
 const pick=top.length?top[Math.floor(Math.random()*Math.min(rank.pick,top.length))]:null;
 if(!pick){msg('Bot passes.');turn++;render();return}
 commit(pick.w,'bot');
}
function winChance(){
 const lock=lockedLetters();const scores=players.map((p,i)=>p.got.size-[...lock].filter(l=>!p.got.has(l)).length*.22+(i===turn%2?.25:0));
 const p1=1/(1+Math.exp(-(scores[0]-scores[1])/3.4));const a=Math.round(p1*100);return[a,100-a]
}
function render(){renderUI();renderWords()}
function renderWords(){
 const el=$('wordStream');if(!moveHistory.length){el.className='wordStream';el.innerHTML='<div class="emptyStage">PLAY A WORD</div>';return}
 const lock=lockedLetters(),recent=moveHistory.slice(-10);
 if(players.length<=2){
   el.className='wordStream';
   const lanes=[0,1].map(player=>{
     const words=recent.filter(m=>m.player===player);
     return `<div class="wordLane p${player+1}Lane"><div class="laneLabel">PLAYER ${player+1}</div><div class="laneWords">${words.map((m,i)=>{
       const age=words.length-1-i;
       const cls=age===0?'current':age===1?'prev1':age===2?'prev2':'older';
       const isNewest=m===moveHistory[moveHistory.length-1];
       const letters=[...m.word].map((ch,j)=>`<span class="${lock.has(ch)?'lockedChar ':''}${isNewest?'typedChar':''}"${isNewest?` style="animation-delay:${j*70}ms"`:''}>${ch}</span>`).join('');
       return `<div class="playedWord ${cls}">${letters}</div>`;
     }).join('')||'<div class="laneEmpty">—</div>'}</div></div>`;
   }).join('<div class="laneDivider"></div>');
   el.innerHTML=lanes;return;
 }
 el.className='wordStream multiStream';
 el.innerHTML=recent.map((m,i)=>{
   const isNewest=i===recent.length-1;
   const letters=[...m.word].map((ch,j)=>`<span class="${lock.has(ch)?'lockedChar ':''}${isNewest?'typedChar':''}"${isNewest?` style="animation-delay:${j*70}ms"`:''}>${ch}</span>`).join('');
   return `<div class="multiMove ${isNewest?'current':''}"><span class="multiPlayer">P${m.player+1}</span><span class="multiWord">${letters}</span></div>`;
 }).join('');
}
function renderUI(){
 const me=current(),lock=lockedLetters();
 const meter=$('meter');
 meter.className='meter'+(players.length>2?' multi':'');
 if(players.length===2){
   const ch=winChance();
   meter.innerHTML=players.map((p,i)=>{
     const need=ALPHA.filter(l=>!p.got.has(l)).join(' ');
     const label=mode==='bot'?(i===0?'YOU':BOT_RANKS[botRank].name.toUpperCase()):'PLAYER '+(i+1); return `<div class="player ${i===1?'p2':''}"><div class="label">${label} <span>${p.got.size}/26</span></div><div class="bar"><i style="width:${p.got.size/26*100}%"></i></div><div class="chance">${ch[i]}%</div><div class="needLine">NEED <span>${need||'COMPLETE'}</span></div></div>${i===0?'<div class="vs">WIN CHANCE</div>':''}`;
   }).join('');
 }else{
   meter.innerHTML=players.map((p,i)=>{
     const need=ALPHA.filter(l=>!p.got.has(l)).join(' ');
     return `<div class="player multiPlayerCard ${i===activePlayer()?'active':''}"><div class="label">PLAYER ${i+1} <span>${p.got.size}/26</span></div><div class="bar"><i style="width:${p.got.size/26*100}%"></i></div><div class="needLine">NEED <span>${need||'COMPLETE'}</span></div></div>`;
   }).join('');
 }
 $('turnName').textContent=mode==='bot'?(activePlayer()===0?'YOU':BOT_RANKS[botRank].name.toUpperCase()):'PLAYER '+(activePlayer()+1);
 const blocked=gameOver||passWait||(mode==='bot'&&activePlayer()===1);
 $('status').textContent=blocked?(mode==='bot'?'Bot turn':'Pass device'):'Your turn';
 const display=$('wordDisplay');display.innerHTML=(typedWord?typedWord:'TYPE A WORD')+'<span class="cursor">|</span>';display.classList.toggle('empty',!typedWord);
 const kb=$('keyboard');kb.innerHTML='';
 for(const row of ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM']){
   const r=document.createElement('div');r.className='row';
   for(const l of row){
     const d=document.createElement('div'),need=!me.got.has(l),locked=lock.has(l);
     d.className='key '+(need?(locked?'lockedNeed':'need'):(locked?'locked':'earned'))+((blocked||locked)?' disabled':'');
     d.innerHTML=l+(locked?'<small>LOCK</small>':'');if(!blocked&&!locked)d.onclick=()=>{if(typedWord.length<7){typedWord+=l;haptic(8);tone(360,.025,.015);renderUI()}};
     r.appendChild(d)
   }kb.appendChild(r)
 }
}
function del(){if(gameOver||passWait||(mode==='bot'&&activePlayer()===1))return;typedWord=typedWord.slice(0,-1);renderUI()}
function msg(t){$('help').textContent=t;clearTimeout(msg.t);msg.t=setTimeout(()=>{$('help').textContent='Letters in the previous word are unavailable this turn.'},2200)}
function haptic(pattern){try{if(navigator.vibrate)navigator.vibrate(pattern)}catch{}}
function tone(freq=520,duration=.05,volume=.035){
 try{
   const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
   const c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=freq;o.type='sine';g.gain.value=volume;o.connect(g);g.connect(c.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);o.stop(c.currentTime+duration);
 }catch{}
}
function showWinner(i){
 const botWords=moveHistory.filter(m=>m.source==='bot').map(m=>m.word);if(botWords.length)saveBotGameWords(botWords);
 let unlockedNext=null;
 let streakNow=botStreak(),bestNow=botBestStreak();
 if(mode==='bot'){
   if(i===0){streakNow++;localStorage.setItem(BOT_STREAK_KEY,String(streakNow));if(streakNow>bestNow){bestNow=streakNow;localStorage.setItem(BOT_BEST_STREAK_KEY,String(bestNow))}}
   else{streakNow=0;localStorage.setItem(BOT_STREAK_KEY,'0')}
 }
 if(mode==='bot'&&i===0){
   const unlocked=unlockedBotRank();
   if(botRank===unlocked&&unlocked<BOT_RANKS.length-1){
     unlockedNext=unlocked+1;
     localStorage.setItem(BOT_UNLOCK_KEY,String(unlockedNext));
   }
 }
 const winnerName=mode==='bot'?(i===0?'YOU':BOT_RANKS[botRank].name.toUpperCase()):'PLAYER '+(i+1);
 const winnerMoves=moveHistory.filter(m=>m.player===i);
 const biggest=winnerMoves.reduce((best,m)=>m.gained.length>(best?.gained?.length||-1)?m:best,null);
 const finisher=winnerMoves[winnerMoves.length-1]||null;
 let bestBlock=null,bestBlockCount=-1;
 for(let k=0;k<moveHistory.length;k++){
   const m=moveHistory[k];if(m.player!==i)continue;
   const oppIndex=players.length===2?1-i:null;if(oppIndex===null)continue;
   const oppBefore=new Set();
   for(const ch of ALPHA)oppBefore.add(ch);
   for(let q=0;q<k;q++)if(moveHistory[q].player===oppIndex)for(const ch of moveHistory[q].gained)oppBefore.delete(ch);
   const count=[...new Set(m.word)].filter(ch=>oppBefore.has(ch)).length;
   if(count>bestBlockCount){bestBlockCount=count;bestBlock=m}
 }
 const rareOrder=['Q','X','J','Z','V','K'];
 const rareHits=rareOrder.filter(ch=>players[i].got.has(ch));
 const awards=[
   {icon:'＋',label:'BIGGEST HAUL',value:biggest?`${biggest.word} (+${biggest.gained.length})`:'—'},
   players.length===2&&bestBlock?{icon:'▣',label:'BEST BLOCK',value:`${bestBlock.word} (${bestBlockCount} needed letters)`}:{icon:'★',label:'RARE HIT',value:rareHits.length?rareHits.join(' · '):'NONE'},
   {icon:'↵',label:'CLUTCH WORD',value:finisher?finisher.word:'—'}
 ];
 const rankLine=mode==='bot'?BOT_RANKS[botRank].name.toUpperCase():'PASS & PLAY';
 const botBadge=mode==='bot'?`<span class="botBadge badge-${botRank}">${BOT_RANKS[botRank].icon}</span>`:'';
 const unlockText=unlockedNext!==null?`<div class="unlockText"><span>UNLOCKED</span><strong><span class="botBadge badge-${unlockedNext} small">${BOT_RANKS[unlockedNext].icon}</span>${BOT_RANKS[unlockedNext].name.toUpperCase()}</strong></div>`:'';
 const streakText=mode==='bot'?`<div class="streakStrip"><span>STREAK <strong>${streakNow}</strong></span><span>BEST <strong>${bestNow}</strong></span></div>`:'';
 haptic([40,35,70]);tone(620,.08,.04);setTimeout(()=>tone(820,.1,.04),85);
 const d=document.createElement('div');d.className='winner';
 d.innerHTML=`<div class="winnerBox statsWinner"><div class="sub">${botBadge}${rankLine}</div><h2>${winnerName} WIN${i===0&&mode==='bot'?'':'S'}</h2>${unlockText}${streakText}<div class="awardList">${awards.map(a=>`<div class="awardCard"><span class="awardIcon">${a.icon}</span><div><span class="awardLabel">${a.label}</span><strong>${a.value}</strong></div></div>`).join('')}</div><div class="winnerActions"><button class="secondaryBtn" data-action="rematch">REMATCH</button>${unlockedNext!==null?`<button class="nextRankBtn" data-action="next">NEXT RANK</button>`:''}</div></div>`;
 d.querySelector('[data-action="rematch"]').onclick=()=>{d.remove();renderRanks();reset()};
 const next=d.querySelector('[data-action="next"]');if(next)next.onclick=()=>{botRank=unlockedNext;d.remove();renderRanks();reset()};
 document.body.appendChild(d)
}
$('newGame').onclick=reset;
$('inlineDelete').onclick=()=>{haptic(7);del()};
$('inlinePlay').onclick=()=>{haptic(14);tone(460,.035,.02);play()};
$('modeBtn').onclick=()=>document.body.classList.add('showMode');
$('closeMode').onclick=()=>document.body.classList.remove('showMode');
$('modeModal').onclick=e=>{if(e.target.id==='modeModal')document.body.classList.remove('showMode')};
[...document.querySelectorAll('.modeChoice')].forEach(b=>b.onclick=()=>{
 const v=b.dataset.mode;
 if(v==='bot'){mode='bot';playerCount=2}else{mode='local';playerCount=+v}
 $('modeBtn').textContent=mode==='bot'?'VS BOT':playerCount+' PLAYERS';
 $('rankBtn').style.display=mode==='bot'?'inline-flex':'none';
 document.body.classList.remove('showMode');
 reset();
});
document.addEventListener('keydown',e=>{
 if(gameOver||passWait||(mode==='bot'&&activePlayer()===1))return;
 if(/^[a-z]$/i.test(e.key)&&typedWord.length<7){
   const ch=e.key.toUpperCase();
   if(lockedLetters().has(ch)){msg(ch+' is locked this turn.');return}
   typedWord+=ch;renderUI();
 }else if(e.key==='Backspace')del();
 else if(e.key==='Enter'){tone(460,.035,.02);play()}
});

$('rulesBtn').onclick=()=>document.body.classList.add('showRules');
$('closeRules').onclick=()=>document.body.classList.remove('showRules');
$('rulesModal').onclick=e=>{if(e.target.id==='rulesModal')document.body.classList.remove('showRules')};

function showPass(){
 if(mode!=='local'||gameOver)return;
 $('passPlayer').textContent='PLAYER '+(activePlayer()+1);
 document.body.classList.add('showPass');
}
$('passReady').onclick=()=>{passWait=false;document.body.classList.remove('showPass');render()};

function renderRanks(){
 const unlocked=unlockedBotRank();
 if(botRank>unlocked)botRank=unlocked;
 $('rankBtn').innerHTML='<span class="botBadge badge-'+botRank+' tiny">'+BOT_RANKS[botRank].icon+'</span>'+BOT_RANKS[botRank].name.toUpperCase();
 $('rankList').innerHTML=`<div class="ladderStats"><span>STREAK <strong>${botStreak()}</strong></span><span>BEST <strong>${botBestStreak()}</strong></span></div>`+BOT_RANKS.map((r,i)=>{
   const locked=i>unlocked;
   return `<button class="rankOption ${i===botRank?'selected':''} ${locked?'lockedRank':''}" data-rank="${i}" ${locked?'disabled':''}><span class="rankNumber botBadge badge-${i}">${r.icon}</span><span class="rankName">${r.name}</span><span class="rankState">${locked?'LOCKED':i===botRank?'SELECTED':'PLAY'}</span></button>`;
 }).join('');
 [...document.querySelectorAll('.rankOption:not([disabled])')].forEach(b=>b.onclick=()=>{botRank=+b.dataset.rank;document.body.classList.remove('showRanks');renderRanks();reset()});
}
$('rankBtn').onclick=()=>{renderRanks();document.body.classList.add('showRanks')};
$('closeRanks').onclick=()=>document.body.classList.remove('showRanks');
$('rankModal').onclick=e=>{if(e.target.id==='rankModal')document.body.classList.remove('showRanks')};
renderRanks();
