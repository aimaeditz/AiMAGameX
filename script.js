(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const LS = 'aimagamex_';

document.getElementById('year').textContent = new Date().getFullYear();

/* Safety polyfill: some mobile browsers lack ctx.roundRect, which would
   otherwise throw mid-draw and silently blank out a game's canvas. */
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
    this.moveTo(x + r.tl, y);
    this.lineTo(x + w - r.tr, y);
    this.arcTo(x + w, y, x + w, y + r.tr, r.tr);
    this.lineTo(x + w, y + h - r.br);
    this.arcTo(x + w, y + h, x + w - r.br, y + h, r.br);
    this.lineTo(x + r.bl, y + h);
    this.arcTo(x, y + h, x, y + h - r.bl, r.bl);
    this.lineTo(x, y + r.tl);
    this.arcTo(x, y, x + r.tl, y, r.tl);
    return this;
  };
}

/* ================= THEME ================= */
(function initTheme(){
  const saved = localStorage.getItem(LS+'theme');
  if(saved==='light') document.documentElement.setAttribute('data-theme','light');
  $('themeBtn').addEventListener('click', ()=>{
    const isLight = document.documentElement.getAttribute('data-theme')==='light';
    if(isLight){ document.documentElement.removeAttribute('data-theme'); localStorage.setItem(LS+'theme','dark'); $('themeBtn').textContent='☾'; }
    else { document.documentElement.setAttribute('data-theme','light'); localStorage.setItem(LS+'theme','light'); $('themeBtn').textContent='☼'; }
  });
  $('themeBtn').textContent = saved==='light' ? '☼' : '☾';
})();

/* ================= SCREEN FLOW ================= */
const screens = { loading:$('screen-loading'), ready:$('screen-ready'), menu:$('screen-menu'), play:$('screen-play') };
function showScreen(name){ Object.values(screens).forEach(s=>s.classList.remove('active')); screens[name].classList.add('active'); }

const loadMsgs = ['Booting arcade core','Syncing input drivers','Compiling shaders','Calibrating physics','Indexing game library','Warming up neon tubes'];
function runLoading(){
  const fill=$('loadFill'), pct=$('loadPct'), status=$('loadStatus');
  let p=0, msgIdx=0;
  status.textContent=loadMsgs[0];
  const timer=setInterval(()=>{
    p += Math.random()*14+7;
    if(p>100) p=100;
    fill.style.width=p+'%';
    pct.textContent=Math.floor(p)+'%';
    const stage=Math.min(loadMsgs.length-1, Math.floor((p/100)*loadMsgs.length));
    if(stage!==msgIdx){ msgIdx=stage; status.textContent=loadMsgs[msgIdx]; }
    if(p>=100){
      clearInterval(timer);
      status.textContent='Ready';
      setTimeout(()=>showScreen('ready'), 300);
    }
  }, 150);
}
runLoading();

$('btnReady').addEventListener('click', ()=>{ showScreen('menu'); refreshGate(); });

/* ================= MENU GATE + HUB ================= */
function hasSaves(){
  return Object.keys(localStorage).some(k=>k.startsWith(LS+'best_'));
}
function refreshGate(){
  const has = hasSaves();
  $('btnContinue').disabled = !has;
  $('gateHint').textContent = has ? 'Saved best scores found — continue where you left off.' : 'No saved progress yet — start a New Game.';
}
$('btnNew').addEventListener('click', ()=>{
  if(hasSaves() && !confirm('Start fresh? This clears all saved best scores.')) return;
  Object.keys(localStorage).filter(k=>k.startsWith(LS+'best_')).forEach(k=>localStorage.removeItem(k));
  enterHub();
});
$('btnContinue').addEventListener('click', enterHub);
$('btnBackToGate').addEventListener('click', ()=>{ $('menu-hub').classList.add('hidden'); $('menu-gate').classList.remove('hidden'); refreshGate(); });

function enterHub(){
  $('menu-gate').classList.add('hidden');
  $('menu-hub').classList.remove('hidden');
  renderHub();
}
function renderHub(){
  const grid=$('gameGrid');
  grid.innerHTML='';
  Games.forEach(g=>{
    const best = Number(localStorage.getItem(LS+'best_'+g.id)||0);
    const card=document.createElement('article');
    card.className='game-card';
    card.innerHTML = `
      <div class="g-icon">${g.icon}</div>
      <h3>${g.title}</h3>
      <p>${g.desc}</p>
      <div class="g-meta"><span>${g.type}</span><span>BEST <b>${best}</b></span></div>
      <button type="button">PLAY ↗</button>`;
    card.querySelector('button').addEventListener('click', ()=>openGame(g.id));
    grid.appendChild(card);
  });
}

/* ================= PLAY SCREEN CONTROLLER ================= */
const stageEl = document.querySelector('.stage');
const state = { score:0, best:0, extra:0 };
let currentGame=null, instance=null;

function updateHud(){
  $('hudScore').textContent=state.score;
  $('hudBest').textContent=state.best;
  $('hudExtra').textContent=state.extra;
}
function showOverlay(name){
  ['ovStart','ovPause','ovOver'].forEach(id=>$(id).classList.add('hidden'));
  $('ov'+name.charAt(0).toUpperCase()+name.slice(1)).classList.remove('hidden');
}
function hideOverlays(){ ['ovStart','ovPause','ovOver'].forEach(id=>$(id).classList.add('hidden')); }

const api = {
  addScore(n){ state.score += n; updateHud(); },
  setScore(n){ state.score = n; updateHud(); },
  setExtra(n){ state.extra = n; updateHud(); },
  flash(){ stageEl.classList.remove('shake'); void stageEl.offsetWidth; stageEl.classList.add('shake'); },
  gameOver(){
    const best = Math.max(state.score, state.best);
    localStorage.setItem(LS+'best_'+currentGame.id, best);
    state.best = best;
    $('ovFinalScore').textContent = state.score;
    $('ovFinalBest').textContent = best;
    $('ovOverTitle').textContent = 'Run Complete';
    showOverlay('over');
  }
};

function openGame(id){
  const game = Games.find(g=>g.id===id);
  currentGame = game;
  started = false;
  state.score = 0;
  state.best = Number(localStorage.getItem(LS+'best_'+id)||0);
  state.extra = game.extraStart!=null ? game.extraStart : 0;
  $('playType').textContent = game.type;
  $('playTitle').textContent = game.title;
  $('hudExtraLabel').textContent = game.extraLabel || 'LIVES';
  updateHud();
  $('gameArea').innerHTML = '';
  $('touchControls').innerHTML = '';
  $('touchControls').classList.toggle('hidden', !game.touch);
  $('ovStartKicker').textContent = 'READY';
  $('ovStartTitle').textContent = game.title;
  $('ovStartHelp').textContent = game.help;
  showOverlay('start');
  showScreen('play');
  instance = game.build($('gameArea'), $('touchControls'), api);
}

let started = false;
$('btnGameStart').addEventListener('click', ()=>{ hideOverlays(); started=true; instance && instance.start(); });
$('btnPause').addEventListener('click', ()=>{ if(instance && started){ instance.pause(); showOverlay('pause'); } });
$('btnResume').addEventListener('click', ()=>{ hideOverlays(); instance && instance.resume(); });
$('btnQuitToMenu').addEventListener('click', backToHub);
$('btnBackMenu').addEventListener('click', backToHub);
$('btnBackToHub').addEventListener('click', backToHub);
$('btnPlayAgain').addEventListener('click', ()=>{ if(currentGame) openGame(currentGame.id); });

function backToHub(){
  if(instance){ instance.destroy(); instance=null; }
  showScreen('menu');
  $('menu-gate').classList.add('hidden');
  $('menu-hub').classList.remove('hidden');
  renderHub();
}

/* ================= INPUT HELPERS ================= */
function addTapButtons(container, defs){
  defs.forEach(d=>{
    const b=document.createElement('button');
    b.type='button'; b.textContent=d.label;
    b.addEventListener('click', (e)=>{ e.preventDefault(); d.onTap(); });
    container.appendChild(b);
  });
}
function addHoldButtons(container, defs){
  defs.forEach(d=>{
    const b=document.createElement('button');
    b.type='button'; b.textContent=d.label;
    const down=(e)=>{ e.preventDefault(); d.onDown(); };
    const up=(e)=>{ e.preventDefault(); d.onUp(); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('pointercancel', up);
    container.appendChild(b);
  });
}
function addSwipe(el, onSwipe){
  let sx=0, sy=0, tracking=false;
  el.addEventListener('touchstart', e=>{ const t=e.touches[0]; sx=t.clientX; sy=t.clientY; tracking=true; }, {passive:true});
  el.addEventListener('touchend', e=>{
    if(!tracking) return; tracking=false;
    const t=e.changedTouches[0];
    const dx=t.clientX-sx, dy=t.clientY-sy;
    if(Math.max(Math.abs(dx),Math.abs(dy))<22) return;
    onSwipe(Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up'));
  }, {passive:true});
}
function makeCanvas(w,h){
  const c=document.createElement('canvas');
  c.width=w; c.height=h;
  return c;
}
function loop(cb){
  let raf, last=performance.now();
  function frame(t){ const dt=Math.min((t-last)/1000,0.05); last=t; cb(dt); raf=requestAnimationFrame(frame); }
  raf=requestAnimationFrame(frame);
  return ()=>cancelAnimationFrame(raf);
}
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function rectHit(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }

/* ================= GAME 1 — NEON RUSH (racing) ================= */
function buildNeonRush(container, touch, api){
  const W=480,H=800;
  const canvas=makeCanvas(W,H); const ctx=canvas.getContext('2d');
  container.appendChild(canvas);
  const roadX=40, roadW=400, laneW=roadW/3;
  const laneCx = i => roadX + laneW*(i+0.5);
  let player = { lane:1, x:laneCx(1), y:660, w:44, h:74, inv:0 };
  let obstacles=[]; let spawnT=0, speed=260, dist=0, running=false, stopLoop=null, roadScroll=0, lives=3;
  const keys={};
  function onKey(e){
    if(!running) return;
    if(e.key==='ArrowLeft'||e.key==='a') moveLane(-1);
    if(e.key==='ArrowRight'||e.key==='d') moveLane(1);
  }
  document.addEventListener('keydown', onKey);
  function moveLane(dir){ player.lane = clamp(player.lane+dir,0,2); }
  addTapButtons(touch, [
    {label:'←', onTap:()=>moveLane(-1)},
    {label:'⚡', onTap:()=>{}},
    {label:'→', onTap:()=>moveLane(1)},
  ]);

  function spawn(){
    const lane=Math.floor(Math.random()*3);
    const isOrb = Math.random()<0.3;
    obstacles.push({ lane, y:-60, type:isOrb?'orb':'car', w:isOrb?26:42, h:isOrb?26:66 });
  }
  function reset(){
    player.lane=1; player.inv=1.2; obstacles=[]; spawnT=0; speed=260; dist=0; lives=3; api.setExtra(lives); api.setScore(0);
  }
  function update(dt){
    if(!running) return;
    dist += speed*dt;
    speed = Math.min(620, 260 + dist*0.02);
    roadScroll = (roadScroll + speed*dt) % 40;
    player.x += (laneCx(player.lane) - player.x) * Math.min(1, dt*10);
    if(player.inv>0) player.inv -= dt;
    spawnT -= dt;
    if(spawnT<=0){ spawn(); spawnT = clamp(0.85 - dist*0.00015, 0.32, 0.85); }
    for(let i=obstacles.length-1;i>=0;i--){
      const o=obstacles[i];
      o.y += speed*dt;
      const ox = laneCx(o.lane) - o.w/2;
      if(o.y>H+80){ obstacles.splice(i,1); continue; }
      const hit = rectHit(player.x-player.w/2, player.y-player.h/2, player.w, player.h, ox, o.y-o.h/2, o.w, o.h);
      if(hit){
        if(o.type==='orb'){ api.addScore(15); obstacles.splice(i,1); }
        else if(player.inv<=0){
          obstacles.splice(i,1); lives--; api.setExtra(lives); player.inv=1.4; api.flash();
          if(lives<=0){ endRun(); return; }
        }
      }
    }
    api.setScore(Math.max(state_score(), Math.floor(dist*0.1)));
  }
  function state_score(){ return state.score; }
  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#05060c'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#0d1120'; ctx.fillRect(roadX,0,roadW,H);
    ctx.strokeStyle='#1b2140'; ctx.lineWidth=6;
    ctx.beginPath(); ctx.moveTo(roadX,0); ctx.lineTo(roadX,H); ctx.moveTo(roadX+roadW,0); ctx.lineTo(roadX+roadW,H); ctx.stroke();
    ctx.strokeStyle='#233056'; ctx.setLineDash([26,22]); ctx.lineWidth=4;
    for(let i=1;i<3;i++){ const x=roadX+laneW*i; ctx.beginPath(); ctx.moveTo(x, roadScroll-40); ctx.lineTo(x, H); ctx.stroke(); }
    ctx.setLineDash([]);
    obstacles.forEach(o=>{
      const ox=laneCx(o.lane);
      if(o.type==='orb'){
        ctx.save(); ctx.shadowColor='#ffb020'; ctx.shadowBlur=18; ctx.fillStyle='#ffb020';
        ctx.beginPath(); ctx.arc(ox,o.y,o.w/2,0,Math.PI*2); ctx.fill(); ctx.restore();
      } else {
        ctx.save(); ctx.shadowColor='#ff2f9e'; ctx.shadowBlur=14; ctx.fillStyle='#241234';
        ctx.strokeStyle='#ff2f9e'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.roundRect(ox-o.w/2,o.y-o.h/2,o.w,o.h,8); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    });
    const flick = player.inv>0 && Math.floor(player.inv*10)%2===0;
    if(!flick){
      ctx.save(); ctx.shadowColor='#00e6d0'; ctx.shadowBlur=18; ctx.fillStyle='#0c2b28';
      ctx.strokeStyle='#00e6d0'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.roundRect(player.x-player.w/2, player.y-player.h/2, player.w, player.h, 10); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  function endRun(){ running=false; if(stopLoop) stopLoop(); api.gameOver(); }
  return {
    start(){ reset(); running=true; stopLoop && stopLoop(); stopLoop = loop(dt=>{ update(dt); draw(); }); },
    pause(){ running=false; if(stopLoop){ stopLoop(); stopLoop=null; } },
    resume(){ if(!running){ running=true; stopLoop = loop(dt=>{ update(dt); draw(); }); } },
    destroy(){ running=false; if(stopLoop) stopLoop(); document.removeEventListener('keydown', onKey); }
  };
}

/* ================= GAME 2 — BLOCKADE BREAKER ================= */
function buildBreaker(container, touch, api){
  const W=480,H=640;
  const canvas=makeCanvas(W,H); const ctx=canvas.getContext('2d');
  container.appendChild(canvas);
  const paddle={ w:90,h:14,x:W/2-45,y:H-36,speed:520 };
  let ball={x:W/2,y:H-60,vx:180,vy:-260,r:8};
  let bricks=[], running=false, stopLoop=null, lives=3, held={left:false,right:false};
  function onKey(e){ if(e.key==='ArrowLeft'||e.key==='a') held.left=true; if(e.key==='ArrowRight'||e.key==='d') held.right=true; }
  function onKeyUp(e){ if(e.key==='ArrowLeft'||e.key==='a') held.left=false; if(e.key==='ArrowRight'||e.key==='d') held.right=false; }
  document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKeyUp);
  addHoldButtons(touch, [
    {label:'←', onDown:()=>held.left=true, onUp:()=>held.left=false},
    {label:'→', onDown:()=>held.right=true, onUp:()=>held.right=false},
  ]);
  let dragging=false;
  canvas.addEventListener('pointerdown', ()=>dragging=true);
  window.addEventListener('pointerup', ()=>dragging=false);
  canvas.addEventListener('pointermove', e=>{
    if(!dragging) return;
    const rect=canvas.getBoundingClientRect();
    const relX=(e.clientX-rect.left)/rect.width*W;
    paddle.x = clamp(relX-paddle.w/2, 0, W-paddle.w);
  });

  const cols=8, rows=5, bw=(W-40)/cols, bh=22, colors=['#00e6d0','#00b7ff','#7c6bff','#ff2f9e','#ffb020'];
  function buildBricks(){
    bricks=[];
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      bricks.push({x:20+c*bw, y:60+r*(bh+8), w:bw-6, h:bh, alive:true, color:colors[r%colors.length]});
    }
  }
  function resetBall(){ ball.x=paddle.x+paddle.w/2; ball.y=paddle.y-16; ball.vx=(Math.random()<0.5?-1:1)*180; ball.vy=-260; }
  function reset(){ lives=3; api.setExtra(lives); api.setScore(0); paddle.x=W/2-45; buildBricks(); resetBall(); }

  function update(dt){
    if(!running) return;
    if(held.left) paddle.x -= paddle.speed*dt;
    if(held.right) paddle.x += paddle.speed*dt;
    paddle.x = clamp(paddle.x,0,W-paddle.w);
    ball.x += ball.vx*dt; ball.y += ball.vy*dt;
    if(ball.x<ball.r || ball.x>W-ball.r) ball.vx*=-1;
    if(ball.y<ball.r) ball.vy*=-1;
    if(rectHit(ball.x-ball.r,ball.y-ball.r,ball.r*2,ball.r*2, paddle.x,paddle.y,paddle.w,paddle.h) && ball.vy>0){
      const rel=(ball.x-(paddle.x+paddle.w/2))/(paddle.w/2);
      ball.vy=-Math.abs(ball.vy); ball.vx = rel*260;
    }
    if(ball.y>H+30){
      lives--; api.setExtra(lives); api.flash();
      if(lives<=0){ endRun(); return; }
      resetBall();
    }
    let aliveCount=0;
    for(const b of bricks){
      if(!b.alive) continue;
      aliveCount++;
      if(rectHit(ball.x-ball.r,ball.y-ball.r,ball.r*2,ball.r*2,b.x,b.y,b.w,b.h)){
        b.alive=false; ball.vy*=-1; api.addScore(20);
      }
    }
    if(aliveCount===0) buildBricks();
  }
  function draw(){
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#05060c'; ctx.fillRect(0,0,W,H);
    bricks.forEach(b=>{ if(!b.alive) return; ctx.save(); ctx.shadowColor=b.color; ctx.shadowBlur=8; ctx.fillStyle=b.color; ctx.fillRect(b.x,b.y,b.w,b.h); ctx.restore(); });
    ctx.save(); ctx.shadowColor='#00e6d0'; ctx.shadowBlur=14; ctx.fillStyle='#00e6d0';
    ctx.beginPath(); ctx.roundRect(paddle.x,paddle.y,paddle.w,paddle.h,7); ctx.fill(); ctx.restore();
    ctx.save(); ctx.shadowColor='#fff'; ctx.shadowBlur=12; ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
  function endRun(){ running=false; if(stopLoop) stopLoop(); api.gameOver(); }
  return {
    start(){ reset(); running=true; stopLoop = loop(dt=>{ update(dt); draw(); }); },
    pause(){ running=false; if(stopLoop){ stopLoop(); stopLoop=null; } },
    resume(){ if(!running){ running=true; stopLoop = loop(dt=>{ update(dt); draw(); }); } },
    destroy(){ running=false; if(stopLoop) stopLoop(); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKeyUp); }
  };
}

/* ================= GAME 3 — SERPENT PROTOCOL (snake) ================= */
function buildSnake(container, touch, api){
  const cell=24, cols=20, rows=20, W=cell*cols, H=cell*rows;
  const canvas=makeCanvas(W,H); const ctx=canvas.getContext('2d');
  container.appendChild(canvas);
  let snake, dir, nextDir, food, running=false, stopLoop=null, acc=0, stepTime=0.14;
  function onKey(e){
    if(e.key==='ArrowLeft'||e.key==='a') setDir(-1,0);
    else if(e.key==='ArrowRight'||e.key==='d') setDir(1,0);
    else if(e.key==='ArrowUp'||e.key==='w') setDir(0,-1);
    else if(e.key==='ArrowDown'||e.key==='s') setDir(0,1);
  }
  document.addEventListener('keydown', onKey);
  addSwipe(canvas, dirName=>{
    if(dirName==='left') setDir(-1,0); else if(dirName==='right') setDir(1,0);
    else if(dirName==='up') setDir(0,-1); else setDir(0,1);
  });
  function setDir(x,y){ if(dir.x===-x && dir.y===-y) return; nextDir={x,y}; }
  function placeFood(){
    let p;
    do { p={x:Math.floor(Math.random()*cols), y:Math.floor(Math.random()*rows)}; }
    while(snake.some(s=>s.x===p.x&&s.y===p.y));
    food=p;
  }
  function reset(){
    snake=[{x:9,y:10},{x:8,y:10},{x:7,y:10}];
    dir={x:1,y:0}; nextDir=dir; stepTime=0.14; acc=0;
    api.setScore(0); api.setExtra(snake.length);
    placeFood();
  }
  function step(){
    dir=nextDir;
    const head={x:snake[0].x+dir.x, y:snake[0].y+dir.y};
    if(head.x<0||head.x>=cols||head.y<0||head.y>=rows||snake.some(s=>s.x===head.x&&s.y===head.y)){ endRun(); return; }
    snake.unshift(head);
    if(head.x===food.x && head.y===food.y){
      api.addScore(25); api.setExtra(snake.length);
      stepTime=Math.max(0.06, stepTime-0.003);
      placeFood();
    } else snake.pop();
  }
  function update(dt){
    if(!running) return;
    acc+=dt;
    while(acc>=stepTime){ acc-=stepTime; step(); if(!running) return; }
  }
  function draw(){
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#05060c'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#12172a'; for(let i=0;i<=cols;i++){ ctx.beginPath(); ctx.moveTo(i*cell,0); ctx.lineTo(i*cell,H); ctx.stroke(); }
    ctx.save(); ctx.shadowColor='#ffb020'; ctx.shadowBlur=14; ctx.fillStyle='#ffb020';
    ctx.beginPath(); ctx.arc(food.x*cell+cell/2, food.y*cell+cell/2, cell/2.6, 0, Math.PI*2); ctx.fill(); ctx.restore();
    snake.forEach((s,i)=>{
      ctx.save(); ctx.shadowColor='#00e6d0'; ctx.shadowBlur=i===0?14:6;
      ctx.fillStyle= i===0 ? '#00e6d0' : '#0d3b36';
      ctx.beginPath(); ctx.roundRect(s.x*cell+2, s.y*cell+2, cell-4, cell-4, 5); ctx.fill(); ctx.restore();
    });
  }
  function endRun(){ running=false; if(stopLoop) stopLoop(); api.gameOver(); }
  return {
    start(){ reset(); running=true; stopLoop = loop(dt=>{ update(dt); draw(); }); },
    pause(){ running=false; if(stopLoop){ stopLoop(); stopLoop=null; } },
    resume(){ if(!running){ running=true; stopLoop = loop(dt=>{ update(dt); draw(); }); } },
    destroy(){ running=false; if(stopLoop) stopLoop(); document.removeEventListener('keydown', onKey); }
  };
}

/* ================= GAME 4 — VOID STRIKE (shooter) ================= */
function buildVoidStrike(container, touch, api){
  const W=480,H=800;
  const canvas=makeCanvas(W,H); const ctx=canvas.getContext('2d');
  container.appendChild(canvas);
  const ship={x:W/2,w:40,h:34,y:H-56,speed:420};
  let bullets=[], rocks=[], running=false, stopLoop=null, lives=3, held={left:false,right:false}, spawnT=0, fireT=0, dist=0;
  function onKey(e){ if(e.key==='ArrowLeft'||e.key==='a') held.left=true; if(e.key==='ArrowRight'||e.key==='d') held.right=true; }
  function onKeyUp(e){ if(e.key==='ArrowLeft'||e.key==='a') held.left=false; if(e.key==='ArrowRight'||e.key==='d') held.right=false; }
  document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKeyUp);
  addHoldButtons(touch, [
    {label:'←', onDown:()=>held.left=true, onUp:()=>held.left=false},
    {label:'→', onDown:()=>held.right=true, onUp:()=>held.right=false},
  ]);
  function reset(){ ship.x=W/2; bullets=[]; rocks=[]; lives=3; api.setExtra(lives); api.setScore(0); spawnT=0; fireT=0; dist=0; }
  function spawnRock(){ rocks.push({x:30+Math.random()*(W-60), y:-30, r:14+Math.random()*16, vy:120+Math.random()*80}); }
  function update(dt){
    if(!running) return;
    dist += dt;
    if(held.left) ship.x -= ship.speed*dt;
    if(held.right) ship.x += ship.speed*dt;
    ship.x = clamp(ship.x, 24, W-24);
    fireT -= dt;
    if(fireT<=0){ bullets.push({x:ship.x, y:ship.y-20, vy:-560}); fireT=0.26; }
    spawnT -= dt;
    if(spawnT<=0){ spawnRock(); spawnT = clamp(0.9 - dist*0.01, 0.28, 0.9); }
    for(let i=bullets.length-1;i>=0;i--){ bullets[i].y += bullets[i].vy*dt; if(bullets[i].y<-20) bullets.splice(i,1); }
    for(let i=rocks.length-1;i>=0;i--){
      const r=rocks[i]; r.y += r.vy*dt;
      if(r.y>H+40){ rocks.splice(i,1); continue; }
      const shipHit = Math.hypot(r.x-ship.x, r.y-(ship.y-10)) < r.r+16;
      if(shipHit){ rocks.splice(i,1); lives--; api.setExtra(lives); api.flash(); if(lives<=0){ endRun(); return; } continue; }
      for(let j=bullets.length-1;j>=0;j--){
        const b=bullets[j];
        if(Math.hypot(r.x-b.x, r.y-b.y) < r.r+4){ rocks.splice(i,1); bullets.splice(j,1); api.addScore(30); break; }
      }
    }
  }
  function draw(){
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#05060c'; ctx.fillRect(0,0,W,H);
    ctx.save(); ctx.shadowColor='#00b7ff'; ctx.shadowBlur=10; ctx.fillStyle='#00b7ff';
    bullets.forEach(b=>{ ctx.fillRect(b.x-2,b.y-10,4,14); }); ctx.restore();
    rocks.forEach(r=>{
      ctx.save(); ctx.shadowColor='#ff4d5e'; ctx.shadowBlur=10; ctx.fillStyle='#301019'; ctx.strokeStyle='#ff4d5e'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore();
    });
    ctx.save(); ctx.shadowColor='#00e6d0'; ctx.shadowBlur=16; ctx.fillStyle='#0c2b28'; ctx.strokeStyle='#00e6d0'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(ship.x, ship.y-ship.h/2); ctx.lineTo(ship.x-ship.w/2, ship.y+ship.h/2); ctx.lineTo(ship.x+ship.w/2, ship.y+ship.h/2); ctx.closePath();
    ctx.fill(); ctx.stroke(); ctx.restore();
  }
  function endRun(){ running=false; if(stopLoop) stopLoop(); api.gameOver(); }
  return {
    start(){ reset(); running=true; stopLoop = loop(dt=>{ update(dt); draw(); }); },
    pause(){ running=false; if(stopLoop){ stopLoop(); stopLoop=null; } },
    resume(){ if(!running){ running=true; stopLoop = loop(dt=>{ update(dt); draw(); }); } },
    destroy(){ running=false; if(stopLoop) stopLoop(); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKeyUp); }
  };
}

/* ================= GAME 5 — FUSION 2048 ================= */
function buildFusion(container, touch, api){
  const wrap=document.createElement('div'); wrap.className='dom-game';
  const grid=document.createElement('div');
  grid.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:100%;aspect-ratio:1;background:#0f1220;padding:8px;border-radius:14px;border:1px solid #262c4a;';
  wrap.appendChild(grid);
  const hint=document.createElement('p'); hint.style.cssText='color:#8891ac;font-size:12px;text-align:center;';
  hint.textContent='Swipe or use arrow keys to merge tiles.';
  wrap.appendChild(hint);
  container.appendChild(wrap);

  let board, running=false, best=0;
  const tileColors={2:'#12162a',4:'#171c34',8:'#0d3b36',16:'#0f5148',32:'#136357',64:'#00795c',128:'#00b7ff',256:'#7c6bff',512:'#ff2f9e',1024:'#ffb020',2048:'#ff4d5e'};
  function newBoard(){ board=Array.from({length:4},()=>[0,0,0,0]); addTile(); addTile(); }
  function addTile(){
    const empty=[]; for(let r=0;r<4;r++) for(let c=0;c<4;c++) if(!board[r][c]) empty.push([r,c]);
    if(!empty.length) return;
    const [r,c]=empty[Math.floor(Math.random()*empty.length)];
    board[r][c]=Math.random()<0.9?2:4;
  }
  function render(){
    grid.innerHTML='';
    let maxTile=0, sum=0;
    for(let r=0;r<4;r++) for(let c=0;c<4;c++){
      const v=board[r][c]; if(v>maxTile) maxTile=v; sum+=v;
      const cell=document.createElement('div');
      cell.style.cssText=`border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:${v>512?18:22}px;background:${v?tileColors[v]||'#ff4d5e':'#171b30'};color:${v?'#fff':'transparent'};`;
      cell.textContent=v||'';
      grid.appendChild(cell);
    }
    api.setExtra(maxTile);
  }
  function slideRow(row){
    const vals=row.filter(v=>v);
    let gained=0;
    for(let i=0;i<vals.length-1;i++){
      if(vals[i]===vals[i+1]){ vals[i]*=2; gained+=vals[i]; vals.splice(i+1,1); }
    }
    while(vals.length<4) vals.push(0);
    return {row:vals, gained};
  }
  function getLine(dir,i){
    if(dir==='left') return [board[i][0],board[i][1],board[i][2],board[i][3]];
    if(dir==='right') return [board[i][3],board[i][2],board[i][1],board[i][0]];
    if(dir==='up') return [board[0][i],board[1][i],board[2][i],board[3][i]];
    return [board[3][i],board[2][i],board[1][i],board[0][i]]; // down
  }
  function setLine(dir,i,vals){
    if(dir==='left'){ for(let k=0;k<4;k++) board[i][k]=vals[k]; }
    else if(dir==='right'){ for(let k=0;k<4;k++) board[i][3-k]=vals[k]; }
    else if(dir==='up'){ for(let k=0;k<4;k++) board[k][i]=vals[k]; }
    else { for(let k=0;k<4;k++) board[3-k][i]=vals[k]; } // down
  }
  function move(dir){
    if(!running) return;
    const before = JSON.stringify(board);
    let gained=0;
    for(let i=0;i<4;i++){
      const {row, gained:g} = slideRow(getLine(dir,i));
      gained += g;
      setLine(dir,i,row);
    }
    const moved = JSON.stringify(board)!==before;
    if(moved){
      if(gained) api.addScore(gained);
      addTile(); render();
      if(!hasMoves()){ running=false; api.gameOver(); }
    }
  }
  function hasMoves(){
    for(let r=0;r<4;r++) for(let c=0;c<4;c++){
      if(!board[r][c]) return true;
      if(c<3 && board[r][c]===board[r][c+1]) return true;
      if(r<3 && board[r][c]===board[r+1][c]) return true;
    }
    return false;
  }
  function onKey(e){
    const map={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'};
    if(map[e.key]){ e.preventDefault(); move(map[e.key]); }
  }
  document.addEventListener('keydown', onKey);
  addSwipe(wrap, move);

  return {
    start(){ running=true; api.setScore(0); newBoard(); render(); },
    pause(){ running=false; },
    resume(){ running=true; },
    destroy(){ running=false; document.removeEventListener('keydown', onKey); }
  };
}

/* ================= GAME 6 — MEMORY GRID ================= */
function buildMemory(container, touch, api){
  const wrap=document.createElement('div'); wrap.className='dom-game';
  const grid=document.createElement('div');
  grid.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:100%;';
  wrap.appendChild(grid);
  container.appendChild(wrap);
  const symbols=['⚡','✦','◆','☾','⬡','✺','◈','☍'];
  let cards, flipped, matches, moves, running=false, lock=false;
  function build(){
    const deck=[...symbols,...symbols].sort(()=>Math.random()-0.5);
    cards=deck.map((s,i)=>({id:i, sym:s, open:false, matched:false}));
    flipped=[]; matches=0; moves=0; api.setExtra(0); api.setScore(0);
  }
  function render(){
    grid.innerHTML='';
    cards.forEach(c=>{
      const el=document.createElement('button');
      el.type='button';
      const shown = c.open||c.matched;
      el.style.cssText=`aspect-ratio:1;border-radius:10px;border:1px solid ${c.matched?'#00e6d0':'#262c4a'};
        background:${shown?'#171c34':'#12162a'};color:#fff;font-size:22px;display:flex;align-items:center;justify-content:center;
        transition:transform .15s ease;`;
      el.textContent = shown ? c.sym : '';
      el.addEventListener('click', ()=>flip(c.id));
      grid.appendChild(el);
    });
  }
  function flip(id){
    if(!running||lock) return;
    const c=cards.find(x=>x.id===id);
    if(!c||c.open||c.matched) return;
    c.open=true; flipped.push(c); render();
    if(flipped.length===2){
      moves++; api.setExtra(moves); lock=true;
      const [a,b]=flipped;
      if(a.sym===b.sym){
        a.matched=b.matched=true; matches++; api.addScore(100); flipped=[]; lock=false;
        render();
        if(matches===symbols.length){ running=false; setTimeout(()=>api.gameOver(),300); }
      } else {
        setTimeout(()=>{ a.open=b.open=false; flipped=[]; lock=false; render(); }, 650);
      }
    }
  }
  return {
    start(){ running=true; build(); render(); },
    pause(){ running=false; },
    resume(){ running=true; },
    destroy(){ running=false; }
  };
}

/* ================= GAME REGISTRY ================= */
const Games = [
  { id:'neon-rush', title:'Neon Rush', type:'RACING', icon:'🏁', extraLabel:'LIVES', extraStart:3,
    desc:'Weave through three lanes of traffic and bank energy orbs before you run out of lives.',
    help:'Arrow keys / A-D to change lanes, or use the on-screen arrows. Avoid cars, grab orbs.',
    touch:true, build: buildNeonRush },
  { id:'blockade-breaker', title:'Blockade Breaker', type:'ARCADE', icon:'🧱', extraLabel:'LIVES', extraStart:3,
    desc:'Classic brick-breaking action with a drifting paddle and an endless brick supply.',
    help:'Drag on the board, use arrow keys, or hold the on-screen arrows to move the paddle.',
    touch:true, build: buildBreaker },
  { id:'serpent-protocol', title:'Serpent Protocol', type:'CLASSIC', icon:'🐍', extraLabel:'LENGTH', extraStart:3,
    desc:'Grow your serpent, avoid the walls and your own tail, chase an ever-rising high score.',
    help:'Arrow keys / WASD to steer, or swipe on mobile. Eat the orb, don\u2019t hit yourself.',
    touch:true, build: buildSnake },
  { id:'void-strike', title:'Void Strike', type:'SHOOTER', icon:'🚀', extraLabel:'LIVES', extraStart:3,
    desc:'Auto-firing starfighter dodges and destroys an incoming asteroid field.',
    help:'Arrow keys / A-D or the on-screen arrows to move. Your ship fires automatically.',
    touch:true, build: buildVoidStrike },
  { id:'fusion-2048', title:'Fusion 2048', type:'PUZZLE', icon:'◆', extraLabel:'BEST TILE', extraStart:0,
    desc:'Slide and merge numbered tiles to build the highest value block on the grid.',
    help:'Arrow keys / WASD, or swipe on the board. Matching tiles fuse into the next value.',
    touch:false, build: buildFusion },
  { id:'memory-grid', title:'Memory Grid', type:'PUZZLE', icon:'⬡', extraLabel:'MOVES', extraStart:0,
    desc:'Flip cards, find every matching pair, and clear the board in as few moves as possible.',
    help:'Tap two cards to reveal them. Match all pairs to complete the run.',
    touch:false, build: buildMemory },
];

})();
