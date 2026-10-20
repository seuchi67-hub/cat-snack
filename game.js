(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const W = 420, H = 700, ROUND = 60, STORAGE_KEY = 'cat-snack.best.v1';
  const cat = { x: W / 2, y: 588, width: 88, height: 72 };
  let state = 'start', score = 0, remaining = ROUND, best = readBest();
  let items = [], effects = [], spawnIn = 0, lastTime = null, pointerId = null;
  const keys = new Set();

  function readBest() {
    try {
      const value = Number(localStorage.getItem(STORAGE_KEY));
      return Number.isSafeInteger(value) && value >= 0 ? value : 0;
    } catch { return 0; }
  }
  function saveBest() {
    try { localStorage.setItem(STORAGE_KEY, String(best)); } catch { /* Storage is optional. */ }
  }
  function showScreen(next) {
    state = next;
    $('start-screen').hidden = next !== 'start';
    $('result-screen').hidden = next !== 'result';
    $('pause-screen').hidden = next !== 'paused';
    $('hud').hidden = next !== 'playing' && next !== 'paused';
    $('play-hint').hidden = next !== 'playing';
    $('start-best').textContent = best;
    keys.clear();
    pointerId = null;
    lastTime = null;
  }
  function updateHud() {
    $('score').textContent = score;
    $('time').textContent = Math.ceil(remaining);
  }
  function start() {
    score = 0; remaining = ROUND; items = []; effects = []; spawnIn = 0.35;
    cat.x = W / 2;
    showScreen('playing'); updateHud();
  }
  function finish() {
    const record = score > best;
    best = Math.max(best, score); saveBest();
    $('final-score').textContent = score;
    $('result-best').textContent = best;
    $('record-message').textContent = record ? '新纪录！小猫为你骄傲。' : '再来收集一些美味吧。';
    showScreen('result');
  }
  function moveTo(x) { cat.x = Math.max(cat.width / 2 + 6, Math.min(W - cat.width / 2 - 6, x)); }
  function update(dt) {
    const step = Math.min(dt, remaining);
    remaining = Math.max(0, remaining - step);
    moveTo(cat.x + ((keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0)) * 340 * step);
    spawnIn -= step;
    if (spawnIn <= 0) {
      const obstacle = Math.random() < 0.24;
      items.push({x: 22 + Math.random() * (W - 44), y: -24, r: obstacle ? 19 : 17,
        speed: 155 + (ROUND - remaining) * 1.6 + Math.random() * 55, obstacle,
        angle: Math.random() * Math.PI, spin: Math.random() * 2 - 1});
      spawnIn += Math.max(0.36, 0.68 - (ROUND - remaining) * 0.004);
    }
    items = items.filter((item) => {
      item.y += item.speed * step; item.angle += item.spin * step;
      const closestX = Math.max(cat.x - 37, Math.min(cat.x + 37, item.x));
      const closestY = Math.max(cat.y - 28, Math.min(cat.y + 32, item.y));
      if ((item.x - closestX) ** 2 + (item.y - closestY) ** 2 <= item.r ** 2) {
        const before = score;
        score = Math.max(0, score + (item.obstacle ? -15 : 10));
        effects.push({x:item.x,y:cat.y-45,text:item.obstacle ? `−${before-score}` : '+10',bad:item.obstacle,life:0.8});
        return false;
      }
      return item.y < H + item.r;
    });
    effects = effects.filter((effect) => { effect.life -= step; effect.y -= step * 38; return effect.life > 0; });
    updateHud();
    if (remaining <= 0) finish();
  }
  function ellipse(x,y,rx,ry,color) {
    ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();
  }
  function triangle(ax,ay,bx,by,cx,cy,color) {
    ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.lineTo(cx,cy);ctx.closePath();ctx.fill();
  }
  function drawCat(x,y,scale=1) {
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    ellipse(0,46,60,10,'#ad835b18');
    ctx.strokeStyle='#d99857';ctx.lineWidth=13;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(26,25);ctx.quadraticCurveTo(65,38,54,3);ctx.stroke();
    ellipse(0,23,35,31,'#eab574');
    triangle(-39,-15,-35,-56,-9,-34,'#eab574');triangle(39,-15,35,-56,9,-34,'#eab574');
    triangle(-32,-27,-30,-45,-18,-31,'#e6a091');triangle(32,-27,30,-45,18,-31,'#e6a091');
    ellipse(0,-10,44,35,'#f0c082');ellipse(0,4,26,19,'#fff0d3');
    ctx.strokeStyle='#78513d';ctx.lineWidth=3;
    for (const sign of [-1,1]) {ctx.beginPath();ctx.arc(sign*17,-12,5,Math.PI,Math.PI*2);ctx.stroke();}
    ellipse(-28,0,7,4,'#e9a18b');ellipse(28,0,7,4,'#e9a18b');
    triangle(-4,-2,4,-2,0,3,'#aa6b57');
    ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,3);ctx.quadraticCurveTo(-2,10,-8,6);ctx.moveTo(0,3);ctx.quadraticCurveTo(2,10,8,6);ctx.stroke();
    ctx.strokeStyle='#d49452';ctx.lineWidth=4;
    for(const offset of [-10,0,10]){ctx.beginPath();ctx.moveTo(offset,-40);ctx.lineTo(offset,-31);ctx.stroke();}
    ellipse(-22,42,14,8,'#fff0d3');ellipse(22,42,14,8,'#fff0d3');
    ctx.restore();
  }
  function drawItem(item) {
    ctx.save();ctx.translate(item.x,item.y);ctx.rotate(item.angle);
    if (item.obstacle) {
      ellipse(0,0,item.r,item.r,'#879499');ctx.strokeStyle='#65767f';ctx.lineWidth=2;
      for(let i=-10;i<=10;i+=7){ctx.beginPath();ctx.ellipse(0,0,item.r-3,Math.max(3,Math.abs(i)),i/12,0,Math.PI*2);ctx.stroke();}
    } else {
      ellipse(0,2,item.r,item.r,'#c8904c');ellipse(0,-1,item.r,item.r,'#edbf79');
      for(const [x,y] of [[-6,-7],[7,-4],[-8,5],[3,8],[1,0]])ellipse(x,y,2.6,2.6,'#a36c43');
    }
    ctx.restore();
  }
  function draw() {
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#fff9ed';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#eddcc2';ctx.lineWidth=1;
    for(let x=22;x<W;x+=46)for(let y=110;y<620;y+=46){ctx.beginPath();ctx.moveTo(x-2,y);ctx.lineTo(x+2,y);ctx.moveTo(x,y-2);ctx.lineTo(x,y+2);ctx.stroke();}
    ctx.fillStyle='#f2e3c9';ctx.fillRect(0,640,W,60);ctx.fillStyle='#e8d4b2';ctx.fillRect(0,640,W,2);
    if(state==='start') {
      drawCat(W/2,370,1.65);
      drawItem({x:95,y:295,r:18,angle:-0.3,obstacle:false});
      drawItem({x:330,y:355,r:16,angle:0.5,obstacle:false});
    } else {
      items.forEach(drawItem);drawCat(cat.x,cat.y);
      effects.forEach((effect)=>{ctx.globalAlpha=effect.life/0.8;ctx.fillStyle=effect.bad?'#9c6671':'#b47a33';ctx.font='bold 23px sans-serif';ctx.textAlign='center';ctx.fillText(effect.text,effect.x,effect.y);});
      ctx.globalAlpha=1;
    }
  }
  function frame(now) {
    if(state==='playing' && lastTime!==null) {
      // Keep the clock accurate on slow frames; small physics steps avoid missed catches.
      let elapsed = Math.min(Math.max(0,(now-lastTime)/1000),remaining);
      while(elapsed > 0 && state==='playing') {
        const step = Math.min(elapsed,0.05);
        update(step); elapsed -= step;
      }
    }
    lastTime=now;draw();requestAnimationFrame(frame);
  }
  $('start-button').addEventListener('click',start);
  $('restart-button').addEventListener('click',start);
  $('home-button').addEventListener('click',()=>showScreen('start'));
  $('pause-button').addEventListener('click',()=>showScreen('paused'));
  $('resume-button').addEventListener('click',()=>showScreen('playing'));
  window.addEventListener('keydown',(event)=>{
    if(state==='playing' && ['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();keys.add(event.key);}
  });
  window.addEventListener('keyup',(event)=>keys.delete(event.key));
  function pauseIfPlaying(){if(state==='playing')showScreen('paused');}
  window.addEventListener('blur',pauseIfPlaying);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseIfPlaying();});
  function drag(event) {
    const rect=canvas.getBoundingClientRect();moveTo((event.clientX-rect.left)*W/rect.width);
  }
  canvas.addEventListener('pointerdown',(event)=>{
    if(state!=='playing'||pointerId!==null)return;
    event.preventDefault();pointerId=event.pointerId;canvas.setPointerCapture(pointerId);drag(event);
  });
  canvas.addEventListener('pointermove',(event)=>{if(state==='playing'&&event.pointerId===pointerId)drag(event);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,(event)=>{if(event.pointerId===pointerId)pointerId=null;});
  function resize() {
    const ratio=Math.min(window.devicePixelRatio||1,3);
    canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);draw();
  }
  window.addEventListener('resize',resize);
  showScreen('start');resize();requestAnimationFrame(frame);
})();
