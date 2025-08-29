(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 10, H = 20, SIZE = Math.floor(canvas.width / W);
  canvas.height = SIZE * H;

  // Colors per tetromino type
  const COLORS = {
    I: '#00ffff', J: '#4169e1', L: '#ffa500', O: '#ffd700',
    S: '#32cd32', T: '#ba55d3', Z: '#ff4d4d', GHOST: 'rgba(255,255,255,.25)'
  };

  // Shapes (4x4 matrices)
  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]],
    O: [[1,1],[1,1]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]]
  };
  const TYPES = Object.keys(SHAPES);

  // Game state
  const state = {
    grid: createGrid(W, H),
    active: null,
    nextBag: [],
    score: 0, lines: 0, level: 1,
    dropInterval: 1000,
    lastDrop: 0,
    paused: false,
    over: false
  };

  // Init
  spawn();
  updateHUD();
  let lastTime = 0;
  function loop(time) {
    if (!state.paused && !state.over) {
      if (time - state.lastDrop > state.dropInterval) {
        softDrop();
        state.lastDrop = time;
      }
      draw();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Helpers
  function createGrid(w, h) {
    return Array.from({length:h},() => Array(w).fill(null));
  }
  function clone(m) { return m.map(r => r.slice()); }
  function rotate(mat, dir=1) {
    // transpose + reverse rows (dir=1 clockwise, -1 ccw)
    const N = mat.length;
    const res = Array.from({length:N},()=>Array(N).fill(0));
    for (let y=0;y<N;y++) for(let x=0;x<N;x++) res[x][N-1-y]=mat[y][x];
    if (dir<0) {
      // rotate 3 times CW == CCW
      return rotate(res,1); // do one more CW then mirror twice
    }
    return res;
  }
  function bagNext() {
    if (state.nextBag.length === 0) {
      state.nextBag = shuffle(TYPES.slice());
    }
    return state.nextBag.pop();
  }
  function shuffle(arr) {
    for (let i=arr.length-1;i>0;i--) {
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }
  function spawn() {
    const type = bagNext();
    const shape = padTo4(clone(SHAPES[type]));
    state.active = { type, shape, x: 3, y: -1 };
    // game over if immediate collision
    if (collides(0,0,state.active.shape)) {
      state.over = true;
      showGameOver();
    }
  }
  function padTo4(m) {
    const n = 4;
    const res = Array.from({length:n},()=>Array(n).fill(0));
    for (let y=0;y<m.length;y++) for (let x=0;x<m[y].length;x++) res[y][x]=m[y][x];
    return res;
  }
  function collides(dx, dy, shape) {
    const {x,y} = state.active;
    for (let r=0;r<4;r++) {
      for (let c=0;c<4;c++) {
        if (!shape[r][c]) continue;
        const nx = x + c + dx;
        const ny = y + r + dy;
        if (nx < 0 || nx >= W || ny >= H) return true;
        if (ny >= 0 && state.grid[ny][nx]) return true;
      }
    }
    return false;
  }
  function lockPiece() {
    const {x,y,shape,type} = state.active;
    for (let r=0;r<4;r++) for (let c=0;c<4;c++) {
      if (!shape[r][c]) continue;
      const nx = x + c, ny = y + r;
      if (ny >= 0) state.grid[ny][nx] = type;
    }
    clearLines();
    spawn();
  }
  function clearLines() {
    let cleared = 0;
    for (let r=H-1;r>=0;r--) {
      if (state.grid[r].every(cell => cell)) {
        state.grid.splice(r,1);
        state.grid.unshift(Array(W).fill(null));
        cleared++; r++;
      }
    }
    if (cleared>0) {
      const pts = [0,40,100,300,1200][cleared] * state.level;
      state.score += pts;
      state.lines += cleared;
      const newLevel = 1 + Math.floor(state.lines / 10);
      if (newLevel !== state.level) {
        state.level = newLevel;
        state.dropInterval = Math.max(100, 1000 - (state.level-1)*75);
      }
      updateHUD();
    }
  }
  function softDrop() {
    if (!collides(0,1,state.active.shape)) {
      state.active.y++;
    } else {
      lockPiece();
    }
  }
  function hardDrop() {
    while (!collides(0,1,state.active.shape)) {
      state.active.y++;
      state.score += 2;
    }
    lockPiece();
    updateHUD();
  }
  function move(dx) {
    if (!collides(dx,0,state.active.shape)) state.active.x += dx;
  }
  function rotateActive(dir=1) {
    let next = rotate(state.active.shape, dir);
    // naive wall-kicks
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (!collides(k,0,next)) {
        state.active.shape = next;
        state.active.x += k;
        return;
      }
    }
  }

  // Rendering
  function drawCell(x,y,color,ghost=false) {
    const px = x*SIZE, py = y*SIZE;
    ctx.fillStyle = ghost ? COLORS.GHOST : color;
    ctx.fillRect(px, py, SIZE, SIZE);
    ctx.strokeStyle = '#00000033';
    ctx.lineWidth = 1;
    ctx.strokeRect(px+0.5, py+0.5, SIZE-1, SIZE-1);
  }
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // board
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
      const cell = state.grid[y][x];
      if (cell) drawCell(x,y,COLORS[cell]);
      else {
        ctx.fillStyle = '#0f0f0f';
        ctx.fillRect(x*SIZE, y*SIZE, SIZE, SIZE);
      }
    }
    // ghost
    const g = { ...state.active };
    while (!collides(0,1,g.shape)) g.y++;
    for (let r=0;r<4;r++) for (let c=0;c<4;c++) {
      if (g.shape[r][c]) {
        const gx = g.x+c, gy = g.y+r;
        if (gy>=0) drawCell(gx,gy,COLORS.GHOST,true);
      }
    }
    // active
    const {x,y,shape,type} = state.active;
    for (let r=0;r<4;r++) for (let c=0;c<4;c++) {
      if (shape[r][c]) {
        const nx = x+c, ny = y+r;
        if (ny>=0) drawCell(nx,ny,COLORS[type]);
      }
    }
    if (state.over) showGameOver();
  }
  function showGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width/2, canvas.height/2 - 10);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Neu starten: R-Taste', canvas.width/2, canvas.height/2 + 18);
  }
  function updateHUD() {
    document.getElementById('score').textContent = state.score;
    document.getElementById('level').textContent = state.level;
    document.getElementById('lines').textContent = state.lines;
  }

  // Controls
  function setPause(p) {
    state.paused = p;
    document.getElementById('pauseBtn').setAttribute('aria-pressed', p ? 'true' : 'false');
  }
  document.getElementById('pauseBtn').addEventListener('click', ()=> setPause(!state.paused));

  window.addEventListener('keydown', (e) => {
    if (state.over) return;
    switch(e.key) {
      case 'ArrowLeft': move(-1); break;
      case 'ArrowRight': move(1); break;
      case 'ArrowDown': state.score++; softDrop(); updateHUD(); break;
      case 'ArrowUp': case 'x': case 'X': rotateActive(1); break;
      case 'z': case 'Z': rotateActive(-1); break;
      case ' ': e.preventDefault(); hardDrop(); break;
      case 'p': case 'P': setPause(!state.paused); break;
      case 'r': case 'R': if (state.over) reset(); break;
    }
  });

  // Touch buttons with auto-repeat
  function hold(btnId, onPress, interval=120, delay=220) {
    const el = document.getElementById(btnId);
    let t1=null, t2=null, down=false;
    const start = (ev)=>{
      ev.preventDefault();
      if (state.over) return;
      down = true; onPress();
      t1 = setTimeout(()=> {
        t2 = setInterval(()=> { if (down) onPress(); else clearInterval(t2); }, interval);
      }, delay);
    };
    const end = ()=>{ down=false; clearTimeout(t1); clearInterval(t2); };
    el.addEventListener('pointerdown', start);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('pointerleave', end);
  }
  hold('left', ()=> move(-1));
  hold('right', ()=> move(1));
  hold('soft', ()=> { state.score++; softDrop(); updateHUD(); }, 60, 120);
  document.getElementById('rotate').addEventListener('click', ()=> rotateActive(1));
  document.getElementById('hard').addEventListener('click', ()=> hardDrop());

  // Reset
  function reset() {
    state.grid = createGrid(W,H);
    state.nextBag = [];
    state.score = 0; state.lines = 0; state.level = 1;
    state.dropInterval = 1000; state.lastDrop = 0; state.paused = false; state.over=false;
    spawn(); updateHUD();
  }

  // Prevent two-finger zoom while holding controls
  document.addEventListener('gesturestart', e => e.preventDefault());

  // Resize canvas if CSS size changes
  const ro = new ResizeObserver(()=>{
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    // recompute SIZE
  });
  ro.observe(canvas);
})();