const ALPHA='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let dict=new Set(), commonWords=[], players=[], turn=0, moveHistory=[], gameOver=false, mode='bot', typedWord='';
const $=id=>document.getElementById(id);

Promise.all([
 fetch('https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt').then(r=>r.ok?r.text():Promise.reject()),
 fetch('https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english.txt').then(r=>r.ok?r.text():Promise.reject())
]).then(([allText,commonText])=>{
 const all=allText.split(/\r?\n/).map(w=>w.trim().toUpperCase()).filter(w=>/^[A-Z]+$/.test(w)&&w.length>=3&&w.length<=7);
 const common=commonText.split(/\r?\n/).map(w=>w.trim().toUpperCase()).filter(w=>/^[A-Z]+$/.test(w)&&w.length>=3&&w.length<=7);
 dict=new Set(all);commonWords=[...new Set(common.filter(w=>dict.has(w)))];reset();msg('Dictionary loaded.');
}).catch(()=>{
 commonWords=['CAT','DOG','SIX','WORD','GAME','QUIZ','WATER','LETTER','CROSS','ZEBRA','JUMP','VEX','QUICK'];dict=new Set(commonWords);reset();msg('Dictionary fallback loaded.');
});

function reset(){players=[{got:new Set()},{got:new Set()}];turn=0;moveHistory=[];gameOver=false;typedWord='';render()}
function current(){return players[turn%2]}
function lockedLetters(){const s=new Set();for(const m of moveHistory.slice(-2))for(const ch of new Set(m.word))s.add(ch);return s}
function gainedBy(word,p=current()){const lock=lockedLetters();return [...new Set(word)].filter(ch=>!p.got.has(ch)&&!lock.has(ch))}
function legalWord(word){
 if(word.length<3||word.length>7)return {ok:false,msg:'Use a 3–7 letter word.'};
 if(!dict.has(word))return {ok:false,msg:'That word is not in the dictionary.'};
 return {ok:true};
}
function play(){
 if(gameOver||(mode==='bot'&&turn%2===1))return;
 const word=typedWord.toUpperCase().replace(/[^A-Z]/g,'');
 const check=legalWord(word);if(!check.ok){msg(check.msg);return}
 commit(word,'human');
}
function commit(word,source){
 const actor=turn%2;const gained=gainedBy(word,current());
 for(const ch of gained)current().got.add(ch);
 moveHistory.push({player:actor,word,gained,source});
 typedWord='';
 if(current().got.size===26){gameOver=true;render();showWinner(actor);return}
 turn++;render();
 if(mode==='bot'&&turn%2===1&&!gameOver){msg('Bot is thinking…');setTimeout(botMove,160)}
}
function botMove(){
 if(gameOver||mode!=='bot'||turn%2!==1)return;
 const lock=lockedLetters();let best=null,bestScore=-1e9;
 const pool=commonWords.slice(0,2400);
 for(const w of pool){
   if([...new Set(w)].some(ch=>lock.has(ch)))continue;
   const gain=gainedBy(w,current());let rare=0;for(const ch of gain)rare+=({Q:3,Z:2.6,X:2.3,J:2.2,K:1.4,V:1.3}[ch]||1);
   const score=gain.length*6+rare+w.length*.15;
   if(score>bestScore){bestScore=score;best=w}
 }
 if(!best){msg('Bot passes.');turn++;render();return}
 commit(best,'bot');
}
function winChance(){
 const lock=lockedLetters();
 const scores=players.map((p,i)=>p.got.size-[...lock].filter(l=>!p.got.has(l)).length*.22+(i===turn%2?.25:0));
 const p1=1/(1+Math.exp(-(scores[0]-scores[1])/3.4));const a=Math.round(p1*100);return[a,100-a]
}
function render(){renderUI();renderWords()}
function renderWords(){
 const el=$('wordStream');if(!moveHistory.length){el.innerHTML='<div class="emptyStage">PLAY A WORD</div>';return}
 const recent=moveHistory.slice(-5).reverse();
 el.innerHTML=recent.map((m,i)=>`<div class="playedWord ${i===0?'current':i===1?'prev1':i===2?'prev2':'older'}"><span class="who">P${m.player+1}</span>${m.word}</div>`).join('');
}
function renderUI(){
 const me=current(),lock=lockedLetters(),ch=winChance();
 $('p1count').textContent=players[0].got.size+'/26';$('p2count').textContent=players[1].got.size+'/26';
 $('p1bar').style.width=(players[0].got.size/26*100)+'%';$('p2bar').style.width=(players[1].got.size/26*100)+'%';
 $('p1chance').textContent=ch[0]+'%';$('p2chance').textContent=ch[1]+'%';
 $('turnName').textContent='PLAYER '+(turn%2+1);
 const blocked=gameOver||(mode==='bot'&&turn%2===1);
 $('status').textContent=blocked?'Bot turn':'Your turn';
 const display=$('wordDisplay');display.textContent=typedWord||'TYPE A WORD';display.classList.toggle('empty',!typedWord);
 const kb=$('keyboard');kb.innerHTML='';
 for(const row of ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM']){
   const r=document.createElement('div');r.className='row';
   for(const l of row){
     const d=document.createElement('div'),need=!me.got.has(l),locked=lock.has(l);
     d.className='key '+(need?(locked?'lockedNeed':'need'):(locked?'locked':'earned'))+(blocked?' disabled':'');
     d.textContent=l;if(!blocked&&!locked)d.onclick=()=>{if(typedWord.length<7){typedWord+=l;renderUI()}};
     r.appendChild(d)
   }kb.appendChild(r)
 }
 const actions=document.createElement('div');actions.className='row';
 const back=document.createElement('div');back.className='key action'+(blocked?' disabled':'');back.textContent='⌫';if(!blocked)back.onclick=del;
 const enter=document.createElement('div');enter.className='key action playKey'+(blocked?' disabled':'');enter.textContent='PLAY';if(!blocked)enter.onclick=play;
 actions.append(back,enter);kb.appendChild(actions)
}
function del(){if(gameOver||(mode==='bot'&&turn%2===1))return;typedWord=typedWord.slice(0,-1);renderUI()}
function msg(t){$('help').textContent=t;clearTimeout(msg.t);msg.t=setTimeout(()=>{$('help').textContent='Use a 3–7 letter word. Letters from the last two plays are locked.'},2200)}
function showWinner(i){const d=document.createElement('div');d.className='winner';d.innerHTML=`<div class="winnerBox"><div class="sub">ALPHABET COMPLETE</div><h2>PLAYER ${i+1} WINS</h2><p>First to use all 26 letters.</p><button>PLAY AGAIN</button></div>`;d.querySelector('button').onclick=()=>{d.remove();reset()};document.body.appendChild(d)}
$('newGame').onclick=reset;
$('inlineDelete').onclick=del;
$('modeBtn').onclick=()=>{mode=mode==='bot'?'local':'bot';$('modeBtn').textContent=mode==='bot'?'VS BOT':'2 PLAYER';reset()};
document.addEventListener('keydown',e=>{if(gameOver||(mode==='bot'&&turn%2===1))return;if(/^[a-z]$/i.test(e.key)&&typedWord.length<7&&!lockedLetters().has(e.key.toUpperCase())){typedWord+=e.key.toUpperCase();renderUI()}else if(e.key==='Backspace')del();else if(e.key==='Enter')play()});
