const ALPHA='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const CELL=34, ORIGIN=450;
let dict=new Set(), dictWords=[], board=new Map(), players=[], turn=0, moveHistory=[], placements=[], altIndex=0, gameOver=false, mode='bot', strategyStats={humanMoves:0,nonGreedy:0,totalGain:0,bestGain:0};
const $=id=>document.getElementById(id);
const key=(x,y)=>`${x},${y}`;
const get=(x,y)=>board.get(key(x,y));

Promise.all([
  fetch('https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt').then(r=>{if(!r.ok)throw new Error('ENABLE1 failed');return r.text()}),
  fetch('https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english.txt').then(r=>{if(!r.ok)throw new Error('common list failed');return r.text()})
]).then(([allText,commonText])=>{
  const allWords=allText.split(/\r?\n/).map(w=>w.trim()).filter(w=>/^[a-z]+$/i.test(w)&&w.length>=3&&w.length<=16).map(w=>w.toUpperCase());
  const commonWords=commonText.split(/\r?\n/).map(w=>w.trim()).filter(w=>/^[a-z]+$/i.test(w)&&w.length>=3&&w.length<=16).map(w=>w.toUpperCase());
  dict=new Set(allWords);
  dictWords=[...new Set(commonWords.concat(allWords.filter(w=>/[JQXZVK]/.test(w)&&w.length<=9)))];
  reset();
  msg('ENABLE1 dictionary loaded.');
}).catch(()=>{
  dictWords=['CAT','CATS','DOG','DOGS','SIX','SIXES','WORD','WORDS','GAME','GAMES','QUIZ','QUARTZ','WATER','LETTER','LETTERS','CROSS','CROSSWORD'];
  dict=new Set(dictWords);reset();msg('Dictionary fallback loaded.');
});

function reset(){board=new Map();players=[{got:new Set()},{got:new Set()}];turn=0;moveHistory=[];placements=[];strategyStats={humanMoves:0,nonGreedy:0,totalGain:0,bestGain:0};gameOver=false;render();$('wordInput').disabled=false;$('playBtn').disabled=false;$('wordInput').focus();}
function lockedLetters(){const s=new Set();for(const m of moveHistory.slice(-2))for(const l of m.newLetters)s.add(l);return s;}
function current(){return players[turn%2]}
function other(){return players[(turn+1)%2]}

function wordAt(x,y,dx,dy, pending){
  let sx=x,sy=y;
  const charAt=(a,b)=>pending.get(key(a,b))||get(a,b);
  while(charAt(sx-dx,sy-dy)){sx-=dx;sy-=dy}
  let w='',cells=[],cx=sx,cy=sy;
  while(charAt(cx,cy)){w+=charAt(cx,cy);cells.push([cx,cy]);cx+=dx;cy+=dy}
  return {w,cells};
}
function placementFor(word,x,y,dx,dy){
  const locked=lockedLetters(), pending=new Map();let overlaps=0,newCells=[];
  for(let i=0;i<word.length;i++){
    const cx=x+dx*i,cy=y+dy*i,old=get(cx,cy),ch=word[i];
    if(old&&old!==ch)return null;
    if(old)overlaps++; else {if(locked.has(ch))return null;pending.set(key(cx,cy),ch);newCells.push([cx,cy,ch]);}
  }
  if(newCells.length<2||newCells.length>7)return null;
  if(get(x-dx,y-dy)||get(x+dx*word.length,y+dy*word.length))return null;
  if(board.size && overlaps===0){
    let touches=false;
    for(const [cx,cy] of newCells) if(get(cx+1,cy)||get(cx-1,cy)||get(cx,cy+1)||get(cx,cy-1)){touches=true;break}
    if(!touches)return null;
  }
  const created=[]; const seen=new Set();
  const main=wordAt(x,y,dx,dy,pending);
  if(main.w!==word || !dict.has(main.w))return null;
  created.push(main.w);seen.add(main.w);
  for(const [cx,cy] of newCells){
    const cross=wordAt(cx,cy,dy,dx,pending);
    if(cross.w.length>1){
      if(cross.w.length<3||!dict.has(cross.w))return null;
      if(!seen.has(cross.w)){created.push(cross.w);seen.add(cross.w)}
    }
  }
  const gained=new Set();for(const w of created)for(const ch of w)if(!current().got.has(ch))gained.add(ch);
  const allLetters=new Set(created.join('').split(''));
  return {word,x,y,dx,dy,newCells,created,gained,allLetters,overlaps};
}
function findPlacements(word){
  if(!dict.has(word))return [];
  const out=[];
  if(board.size===0){const p=placementFor(word,0,0,1,0);if(p)out.push(p);return out}
  const seen=new Set();
  for(const [k,ch] of board){const [bx,by]=k.split(',').map(Number);for(let i=0;i<word.length;i++)if(word[i]===ch){
    for(const [dx,dy] of [[1,0],[0,1]]){const x=bx-dx*i,y=by-dy*i,id=`${x},${y},${dx},${dy}`;if(seen.has(id))continue;seen.add(id);const p=placementFor(word,x,y,dx,dy);if(p)out.push(p)}
  }}
  for(const [k] of board){const [bx,by]=k.split(',').map(Number);for(const [dx,dy] of [[1,0],[0,1]])for(let i=0;i<word.length;i++){
    for(const side of [-1,1]){const x=bx-dx*i + dy*side, y=by-dy*i + dx*side, id=`${x},${y},${dx},${dy}`;if(seen.has(id))continue;seen.add(id);const p=placementFor(word,x,y,dx,dy);if(p)out.push(p)}
  }}
  return out.sort((a,b)=>b.gained.size-a.gained.size||b.created.length-a.created.length||b.overlaps-a.overlaps||a.x-b.x||a.y-b.y);
}
function play(){if(gameOver)return;const word=$('wordInput').value.toUpperCase().replace(/[^A-Z]/g,'');if(word.length<3){msg('Words must be at least 3 letters.');return}placements=findPlacements(word);altIndex=0;if(!placements.length){msg(dict.has(word)?'No legal placement for that word.':'Word not in prototype dictionary.');return}commit(placements[0]);}
function commit(p,source='human'){
  const actor=turn%2;
  if(source==='human' && mode==='bot' && actor===0) assessHumanMove(p);
  for(const [x,y,ch] of p.newCells)board.set(key(x,y),ch);
  for(const ch of p.allLetters)current().got.add(ch);
  moveHistory.push({player:actor,word:p.word,newLetters:new Set(p.newCells.map(c=>c[2])),created:p.created,gained:[...p.gained],source});
  $('wordInput').value='';
  if(current().got.size===26){gameOver=true;render();showWinner(actor);return}
  turn++;render();
  if(mode==='bot' && turn%2===1 && !gameOver){$('wordInput').disabled=true;$('playBtn').disabled=true;msg('Bot is thinking…');setTimeout(botMove,180)}
}
function candidateWordsFor(player){
  const need=ALPHA.filter(l=>!player.got.has(l));
  const common=dictWords.slice(0,700);
  const targeted=[];
  for(const w of dictWords){
    if(targeted.length>=650)break;
    let hits=0;for(const l of need)if(w.includes(l))hits++;
    if(hits>=2 || need.some(l=>'JQXZVK'.includes(l)&&w.includes(l)))targeted.push(w);
  }
  return [...new Set(common.concat(targeted))];
}
function moveScore(p,actor){
  const rare={Q:2.6,Z:2.2,X:2.0,J:2.0,K:1.35,V:1.25};
  let rareGain=0;for(const l of p.gained)rareGain+=rare[l]||1;
  const opp=players[1-actor];let freeze=0;for(const [, ,ch] of p.newCells)if(!opp.got.has(ch))freeze++;
  return p.gained.size*5 + rareGain*1.6 + (p.created.length-1)*2.4 + p.overlaps*.35 + freeze*1.15;
}
function bestBotMove(){
  let best=null,bestScore=-Infinity;
  for(const w of candidateWordsFor(current())){
    const ps=findPlacements(w); if(!ps.length)continue;
    for(const p of ps.slice(0,3)){const s=moveScore(p,1);if(s>bestScore){bestScore=s;best=p}}
  }
  return best;
}
function botMove(){
  if(gameOver||mode!=='bot'||turn%2!==1)return;
  const p=bestBotMove();
  if(!p){msg('Bot passes — no move found.');turn++;render();$('wordInput').disabled=false;$('playBtn').disabled=false;return}
  commit(p,'bot');
  if(!gameOver){$('wordInput').disabled=false;$('playBtn').disabled=false;$('wordInput').focus()}
}
function sampledBestCoverage(){
  let best=0,checked=0;
  const pool=candidateWordsFor(current());
  for(let i=0;i<pool.length && checked<420;i++){
    const ps=findPlacements(pool[i]); if(!ps.length)continue; checked++;
    if(ps[0].gained.size>best)best=ps[0].gained.size;
  }
  return best;
}
function assessHumanMove(p){
  const best=sampledBestCoverage();
  strategyStats.humanMoves++;
  strategyStats.totalGain+=p.gained.size;
  strategyStats.bestGain+=best;
  if(best>p.gained.size)strategyStats.nonGreedy++;
}
function tryAlt(){if(placements.length<2)return;altIndex=(altIndex+1)%placements.length;msg(`Placement ${altIndex+1} of ${placements.length}: ${placements[altIndex].created.join(' + ')}`)}
function winChance(){
  const lock=lockedLetters();
  const score=players.map((p,i)=>{let rem=26-p.got.size, lockedNeed=0;for(const l of lock)if(!p.got.has(l))lockedNeed++;return (26-rem)*1.0-lockedNeed*0.55 + (i===turn%2?.35:0)});
  const d=score[0]-score[1],p1=1/(1+Math.exp(-d/3.2));return [Math.round(p1*100),100-Math.round(p1*100)];
}
function render(){renderBoard();renderUI();}
function renderBoard(){const el=$('board');el.innerHTML='';for(const [k,ch] of board){const [x,y]=k.split(',').map(Number),d=document.createElement('div');d.className='tile';d.textContent=ch;d.style.left=(ORIGIN+x*CELL)+'px';d.style.top=(330+y*CELL)+'px';el.appendChild(d)}if(board.size){setTimeout(()=>{const xs=[...board.keys()].map(k=>+k.split(',')[0]),ys=[...board.keys()].map(k=>+k.split(',')[1]);el.parentElement.scrollLeft=Math.max(0,ORIGIN+((Math.min(...xs)+Math.max(...xs))/2)*CELL-el.parentElement.clientWidth/2);el.parentElement.scrollTop=Math.max(0,330+((Math.min(...ys)+Math.max(...ys))/2)*CELL-el.parentElement.clientHeight/2)},0)}}
function renderUI(){const me=current(),lock=lockedLetters();$('turnName').textContent=`PLAYER ${turn%2+1}`;$('status').textContent=`${lock.size?lock.size+' letters locked':'Opening move'}`;
  players.forEach((p,i)=>{$(`p${i+1}count`).textContent=`${p.got.size}/26`;$(`p${i+1}bar`).style.width=(p.got.size/26*100)+'%'});const [a,b]=winChance();$('p1chance').textContent=a+'%';$('p2chance').textContent=b+'%';
  const alph=$('alphabet');alph.innerHTML='';for(const l of ALPHA){const d=document.createElement('div');d.className='a'+(me.got.has(l)?' got':'');d.textContent=l;alph.appendChild(d)}
  const rows=['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];const kb=$('keyboard');kb.innerHTML='';for(const row of rows){const r=document.createElement('div');r.className='row';for(const l of row){const d=document.createElement('div');const need=!me.got.has(l),locked=lock.has(l);d.className='key '+(need?(locked?'lockedNeed':'need'):(locked?'locked':'earned'));d.textContent=l;r.appendChild(d)}kb.appendChild(r)}
  const st=$('strategyStats');if(st){const n=strategyStats.humanMoves;st.innerHTML=n?`<strong>${strategyStats.nonGreedy}/${n}</strong> of your moves chose less raw coverage than the sampled maximum · avg gain <strong>${(strategyStats.totalGain/n).toFixed(1)}</strong> vs sampled best <strong>${(strategyStats.bestGain/n).toFixed(1)}</strong>`:'Play a few turns to compare your choices with raw letter coverage.';}
  $('history').innerHTML=moveHistory.slice(-6).reverse().map(m=>`<div class='move'><strong>P${m.player+1} · ${m.word}</strong> → ${m.created.join(' + ')} ${m.gained.length?`· gained ${m.gained.join('')}`:''}</div>`).join('')||`<div class='move'>No moves yet.</div>`;
  $('altBtn').classList.toggle('hidden',placements.length<2)
}
function msg(t){$('help').textContent=t;setTimeout(()=>{$('help').textContent='Place 2–7 new letters. Existing letters may be reused.'},2600)}
function showWinner(i){const d=document.createElement('div');d.className='winner';d.innerHTML=`<div class='winnerBox'><div class='sub'>ALPHABET COMPLETE</div><h2>PLAYER ${i+1} WINS</h2><p>First to use all 26 letters.</p><button>PLAY AGAIN</button></div>`;d.querySelector('button').onclick=()=>{d.remove();reset()};document.body.appendChild(d)}
$('playBtn').onclick=play;$('wordInput').addEventListener('keydown',e=>{if(e.key==='Enter')play()});$('newGame').onclick=reset;$('altBtn').onclick=tryAlt;$('modeBtn').onclick=()=>{mode=mode==='bot'?'local':'bot';$('modeBtn').textContent=mode==='bot'?'VS BOT':'2 PLAYER';reset()};