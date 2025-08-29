(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Resize canvas to device pixels based on CSS size
  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    CELL = Math.floor(canvas.width / COLS);
  }

  const COLS = 10, ROWS = 20;
  let CELL = 24;
  fitCanvas();
  new ResizeObserver(fitCanvas).observe(canvas);

  // Colors
  const COLORS = [null, '#00ffff', '#4169e1', '#ffa500', '#ffd700', '#32cd32', '#ba55d3', '#ff4d4d'];
  const TYPES = 'IJLOSTZ';

  // Shapes indexed to COLORS 1..7
  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // 1
    J: [[2,0,0],[2,2,2],[0,0,0]],                 // 2
    L: [[0,0,3],[3,3,3],[0,0,0]],                 // 3
    O: [[4,4],[4,4]],                             // 4
    S: [[0,5,5],[5,5,0],[0,0,0]],                 // 5
    T: [[0,6,0],[6,6,6],[0,0,0]],                 // 6
    Z: [[7,7,0],[0,7,7],[0,0,0]],                 // 7
  };

  const state = {
    arena: createMatrix(COLS, ROWS),
    bag: [],
    active: null,
    score: 0,
    dropInterval: 1000,
    lastTime: 0,
    lastDrop: 0,
    over: false
  };

  function createMatrix(w,h){ return Array.from({length:h},()=>Array(w).fill(0)); }

  function clone(m){ return m.map(r=>r.slice()); }

  function pad4(m){
    const n = 4; const res = Array.from({length:n},()=>Array(n).fill(0));
    for (let y=0;y<m.length;y++) for (let x=0;x<m[y].length;x++) res[y][x]=m[y][x];
    return res;
  }

  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }

  function nextType(){
    if (state.bag.length===0) state.bag = shuffle(TYPES.split(''));
    return state.bag.pop();
  }

  function spawn(){
    const type = nextType();
    const shape = pad4(clone(SHAPES[type]));
    state.active = { x: 3, y: -1, m: shape };
    if (collides(0,0,state.active.m)) {
      state.over = true;
    }
  }

  function rotateCW(m){
    const n=m.length, r=Array.from({length:n},()=>Array(n).fill(0));
    for(let y=0;y<n;y++) for(let x=0;x<n;x++) r[x][n-1-y]=m[y][x];
    return r;
  }

  function collides(dx,dy,mat){
    const {x,y}=state.active;
    for(let r=0;r<4;r++) for(let c=0;c<4;c++){
      const v=mat[r][c]; if(!v) continue;
      const nx=x+c+dx, ny=y+r+dy;
      if (nx<0 || nx>=COLS || ny>=ROWS) return true;
      if (ny>=0 && state.arena[ny][nx]) return true;
    }
    return false;
  }

  function lock(){
    const {x,y,m}=state.active;
    for(let r=0;r<4;r++) for(let c=0;c<4;c++){
      const v=m[r][c]; if(!v) continue;
      const nx=x+c, ny=y+r; if (ny>=0) state.arena[ny][nx]=v;
    }
    const cleared = sweep();
    // Classic scoring
    const scoreTable = {0:0,1:100,2:300,3:500,4:800};
    state.score += scoreTable[cleared] || 0;
    updateHUD();
    spawn();
  }

  function sweep(){
    let cleared=0;
    for(let r=ROWS-1;r>=0;r--){
      if (state.arena[r].every(v=>v)){
        state.arena.splice(r,1);
        state.arena.unshift(Array(COLS).fill(0));
        cleared++; r++;
      }
    }
    return cleared;
  }

  function softDrop(){
    if (!collides(0,1,state.active.m)) state.active.y++;
    else lock();
  }

  function hardDrop(){
    let steps=0;
    while(!collides(0,1,state.active.m)){ state.active.y++; steps++; }
    state.score += steps; // kleine Bonuspunkte
    lock();
  }

  function move(dx){ if(!collides(dx,0,state.active.m)) state.active.x+=dx; }

  function rotate(){ 
    const n = rotateCW(state.active.m);
    // einfache Kicks
    const kicks = [0,-1,1,-2,2];
    for(const k of kicks){
      if (!collides(k,0,n)){ state.active.m=n; state.active.x+=k; return; }
    }
  }

  function drawCell(x,y,color){
    const px=x*CELL, py=y*CELL;
    ctx.fillStyle=color;
    ctx.fillRect(px,py,CELL,CELL);
    ctx.strokeStyle='#00000033';
    ctx.strokeRect(px+0.5,py+0.5,CELL-1,CELL-1);
  }

  function draw(){
    ctx.fillStyle='#0b0c10';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    // board
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
      const v=state.arena[y][x];
      if(v) drawCell(x,y,COLORS[v]);
      else {
        ctx.fillStyle='#0f1116';
        ctx.fillRect(x*CELL,y*CELL,CELL,CELL);
      }
    }
    // ghost
    const g={x:state.active.x,y:state.active.y,m:state.active.m};
    while(!collides(0,1,g.m)) g.y++;
    for(let r=0;r<4;r++) for(let c=0;c<4;c++){
      const v=g.m[r][c]; if(!v) continue;
      const gx=g.x+c, gy=g.y+r; if(gy>=0){
        ctx.globalAlpha=0.25; drawCell(gx,gy,'#ffffff'); ctx.globalAlpha=1;
      }
    }
    // active
    for(let r=0;r<4;r++) for(let c=0;c<4;c++){
      const v=state.active.m[r][c]; if(!v) continue;
      const nx=state.active.x+c, ny=state.active.y+r;
      if(ny>=0) drawCell(nx,ny,COLORS[v]);
    }
    if (state.over){
      ctx.fillStyle='rgba(0,0,0,.6)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#fff'; ctx.textAlign='center';
      ctx.font='bold 28px system-ui, sans-serif';
      ctx.fillText('Game Over', canvas.width/2, canvas.height/2);
    }
  }

  function update(time=0){
    const dt=time-state.lastTime; state.lastTime=time;
    if (dt>0 && !state.over){
      state.lastDrop += dt;
      if (state.lastDrop > state.dropInterval){ softDrop(); state.lastDrop=0; }
      draw();
    }
    requestAnimationFrame(update);
  }

  function updateHUD(){ document.getElementById('score').textContent = state.score; }

  // Input: keyboard
  window.addEventListener('keydown', e => {
    if (state.over) return;
    if (e.key==='ArrowLeft') move(-1);
    else if (e.key==='ArrowRight') move(1);
    else if (e.key==='ArrowDown') softDrop();
    else if (e.key==='ArrowUp' || e.key==='x' || e.key==='X') rotate();
    else if (e.key===' ') { e.preventDefault(); hardDrop(); }
  });

  // Input: touch buttons with hold
  function hold(id, fn, interval=120, delay=220){
    const el=document.getElementById(id);
    let t1=null, t2=null, down=false;
    const start=(ev)=>{ ev.preventDefault(); if(state.over) return; down=true; fn();
      t1=setTimeout(()=>{ t2=setInterval(()=>{ if(down) fn(); else clearInterval(t2); }, interval); }, delay);
    };
    const end=()=>{ down=false; clearTimeout(t1); clearInterval(t2); };
    el.addEventListener('pointerdown', start);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('pointerleave', end);
  }
  hold('left', ()=> move(-1));
  hold('right', ()=> move(1));
  hold('soft', ()=> softDrop(), 70, 120);
  document.getElementById('rotate').addEventListener('click', ()=> rotate());
  document.getElementById('hard').addEventListener('click', ()=> hardDrop());

  // Start
  spawn();
  updateHUD();
  requestAnimationFrame(update);
})();