const ALPHA='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let dict=new Set(), allWords=[], commonWords=[], openingWords=[], commonWordSet=new Set(), players=[], playerCount=2, turn=0, moveHistory=[], lockUntil=new Map(), gameOver=false, mode='bot', typedWord='', passWait=false;
const BOT_HISTORY_KEY='typesetBotRecentGames';
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

function reset(){const n=mode==='bot'?2:playerCount;players=Array.from({length:n},()=>({got:new Set()}));turn=0;moveHistory=[];lockUntil=new Map();gameOver=false;typedWord='';passWait=false;document.body.classList.remove('showPass');render()}
function current(){return players[turn%players.length]}
function activePlayer(){return turn%players.length}
function lockedLetters(){const s=new Set();for(const [ch,until] of lockUntil)if(turn<until)s.add(ch);return s}
function gainedBy(word,p=current()){const lock=lockedLetters();return [...new Set(word)].filter(ch=>!p.got.has(ch)&&!lock.has(ch))}
function legalWord(word){
 if(word.length<3||word.length>7)return {ok:false,msg:'Use a 3–7 letter word.'};
 if(!dict.has(word))return {ok:false,msg:'That word is not in the dictionary.'};
 if(moveHistory.some(m=>m.word===word))return {ok:false,msg:'That word has already been played.'};
 return {ok:true};
}
function play(){
 if(gameOver||(mode==='bot'&&activePlayer()===1))return;
 const word=typedWord.toUpperCase().replace(/[^A-Z]/g,'');
 const check=legalWord(word);if(!check.ok){msg(check.msg);return}
 commit(word,'human');
}
function commit(word,source){
 const actor=activePlayer();const lock=lockedLetters();const gained=gainedBy(word,current());
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
 const recent=recentBotWords(),usedThisGame=new Set(moveHistory.map(m=>m.word));
 const candidates=[];
 let pool;
 if(turn===1){const shuffled=[...openingWords];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}pool=shuffled.slice(0,320)}else pool=commonWords.slice(0,5000);
 for(const w of pool){
   if(recent.has(w)||usedThisGame.has(w))continue;
   const gain=gainedBy(w,current());let rare=0;for(const ch of gain)rare+=({Q:3,Z:2.6,X:2.3,J:2.2,K:1.4,V:1.3}[ch]||1);
   const style=Math.floor(Math.random()*4);
   const lockImpact=[...new Set(w)].filter(ch=>!current().got.has(ch)).length;
   const commonBoost=commonWordSet.has(w)?1.8:0;
   const score=gain.length*(style===0?7:style===1?5.5:6)+rare*(style===2?1.8:1)+(style===3?lockImpact*1.2:0)+w.length*.15+commonBoost+Math.random()*(turn===1?3.5:.9);
   candidates.push({w,score});
 }
 candidates.sort((a,b)=>b.score-a.score);
 const top=candidates.slice(0,32);
 const pick=top.length?top[Math.floor(Math.random()*Math.min(turn<4?18:12,top.length))]:null;
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
     return `<div class="player ${i===1?'p2':''}"><div class="label">PLAYER ${i+1} <span>${p.got.size}/26</span></div><div class="bar"><i style="width:${p.got.size/26*100}%"></i></div><div class="chance">${ch[i]}%</div><div class="needLine">NEED <span>${need||'COMPLETE'}</span></div></div>${i===0?'<div class="vs">WIN CHANCE</div>':''}`;
   }).join('');
 }else{
   meter.innerHTML=players.map((p,i)=>{
     const need=ALPHA.filter(l=>!p.got.has(l)).join(' ');
     return `<div class="player multiPlayerCard ${i===activePlayer()?'active':''}"><div class="label">PLAYER ${i+1} <span>${p.got.size}/26</span></div><div class="bar"><i style="width:${p.got.size/26*100}%"></i></div><div class="needLine">NEED <span>${need||'COMPLETE'}</span></div></div>`;
   }).join('');
 }
 $('turnName').textContent='PLAYER '+(activePlayer()+1);
 const blocked=gameOver||passWait||(mode==='bot'&&activePlayer()===1);
 $('status').textContent=blocked?(mode==='bot'?'Bot turn':'Pass device'):'Your turn';
 const display=$('wordDisplay');display.innerHTML=(typedWord?typedWord:'TYPE A WORD')+'<span class="cursor">|</span>';display.classList.toggle('empty',!typedWord);
 const kb=$('keyboard');kb.innerHTML='';
 for(const row of ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM']){
   const r=document.createElement('div');r.className='row';
   for(const l of row){
     const d=document.createElement('div'),need=!me.got.has(l),locked=lock.has(l);
     d.className='key '+(need?(locked?'lockedNeed':'need'):(locked?'locked':'earned'))+(blocked?' disabled':'');
     d.innerHTML=l+(locked?'<small>1</small>':'');if(!blocked)d.onclick=()=>{if(typedWord.length<7){typedWord+=l;renderUI()}};
     r.appendChild(d)
   }kb.appendChild(r)
 }
 const actions=document.createElement('div');actions.className='row';
 const back=document.createElement('div');back.className='key action'+(blocked?' disabled':'');back.textContent='⌫';if(!blocked)back.onclick=del;
 const enter=document.createElement('div');enter.className='key action playKey'+(blocked?' disabled':'');enter.textContent='PLAY';if(!blocked)enter.onclick=play;
 actions.append(back,enter);kb.appendChild(actions)
}
function del(){if(gameOver||passWait||(mode==='bot'&&activePlayer()===1))return;typedWord=typedWord.slice(0,-1);renderUI()}
function msg(t){$('help').textContent=t;clearTimeout(msg.t);msg.t=setTimeout(()=>{$('help').textContent='Only the previous word is locked. Locked letters may be used but do not score.'},2200)}
function showWinner(i){const botWords=moveHistory.filter(m=>m.source==='bot').map(m=>m.word);if(botWords.length)saveBotGameWords(botWords);const d=document.createElement('div');d.className='winner';d.innerHTML=`<div class="winnerBox"><div class="sub">ALPHABET COMPLETE</div><h2>PLAYER ${i+1} WINS</h2><p>First to use all 26 letters.</p><button>PLAY AGAIN</button></div>`;d.querySelector('button').onclick=()=>{d.remove();reset()};document.body.appendChild(d)}
$('newGame').onclick=reset;
$('inlineDelete').onclick=del;
$('inlinePlay').onclick=play;
$('modeBtn').onclick=()=>{
 if(mode==='bot'){mode='local';playerCount=2}
 else if(playerCount<4)playerCount++;
 else{mode='bot';playerCount=2}
 $('modeBtn').textContent=mode==='bot'?'VS BOT':playerCount+' PLAYERS';
 reset()
};
document.addEventListener('keydown',e=>{if(gameOver||passWait||(mode==='bot'&&activePlayer()===1))return;if(/^[a-z]$/i.test(e.key)&&typedWord.length<7){typedWord+=e.key.toUpperCase();renderUI()}else if(e.key==='Backspace')del();else if(e.key==='Enter')play()});

$('rulesBtn').onclick=()=>document.body.classList.add('showRules');
$('closeRules').onclick=()=>document.body.classList.remove('showRules');
$('rulesModal').onclick=e=>{if(e.target.id==='rulesModal')document.body.classList.remove('showRules')};

function showPass(){
 if(mode!=='local'||gameOver)return;
 $('passPlayer').textContent='PLAYER '+(activePlayer()+1);
 document.body.classList.add('showPass');
}
$('passReady').onclick=()=>{passWait=false;document.body.classList.remove('showPass');render()};
