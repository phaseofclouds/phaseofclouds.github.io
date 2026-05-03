// 小球模拟器 - 含互相万有引力, 无重力
const MAX_BALLS = 99;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const sim = document.getElementById('sim');
const addBtn = document.getElementById('addBtn');
const clearBtn = document.getElementById('clearBtn');
const nameInput = document.getElementById('name');
const radiusInput = document.getElementById('radius');
const massInput = document.getElementById('mass');
const colorInput = document.getElementById('color');
const countEl = document.getElementById('count');

let DPR = window.devicePixelRatio || 1;
function resize(){
  canvas.width = sim.clientWidth * DPR;
  canvas.height = sim.clientHeight * DPR;
  canvas.style.width = sim.clientWidth + 'px';
  canvas.style.height = sim.clientHeight + 'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', resize);
resize();

let balls = [];
let ghost = null; // ghost DOM element when adding
let aimingBall = null; // ball being aimed (placed but waiting for velocity)
let tempPos = null; // origin position for arrow (ball center)
let simulationRunning = false;

function updateCount(){ countEl.textContent = `当前小球: ${balls.length} / ${MAX_BALLS}` }
updateCount();

function createGhost(x,y,r,color){
  removeGhost();
  const el = document.createElement('div');
  el.className = 'ghost-ball';
  el.style.width = el.style.height = (r*2) + 'px';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.background = color;
  document.body.appendChild(el);
  ghost = el;
}
function removeGhost(){ if(ghost){ ghost.remove(); ghost=null } }

function screenToSim(x,y){
  const rect = canvas.getBoundingClientRect();
  return {x: x - rect.left, y: y - rect.top};
}

addBtn.addEventListener('click', ()=>{
  if(balls.length >= MAX_BALLS) return;
  const r = Math.max(2, Math.min(80, +radiusInput.value || 16));
  const mass = Math.max(1, +massInput.value || 100);
  const name = (nameInput.value || 'Ball').slice(0,12);
  const color = colorInput.value || '#ff8844';
  // create ghost that follows mouse
  function move(e){
    createGhost(e.clientX, e.clientY, r, color);
  }
  move({clientX: window.innerWidth/2, clientY: window.innerHeight/2});
  window.addEventListener('mousemove', move);
  // when move into sim and click -> place
  function onSimClick(ev){
    const p = screenToSim(ev.clientX, ev.clientY);
    // create placed ball in scene and enter aiming mode (pause simulation)
    const placed = {r, mass, color, name, x: p.x, y: p.y, vx:0, vy:0};
    balls.push(placed);
    updateCount();
    aimingBall = placed;
    tempPos = {x: placed.x, y: placed.y};
    simulationRunning = false; // pause simulation while aiming
    removeGhost();
    window.removeEventListener('mousemove', move);
    sim.removeEventListener('click', onSimClick);
    // start listening for mouse move and click to set velocity on the sim area
    sim.addEventListener('mousemove', showVelocityPreview);
    sim.addEventListener('click', placeWithVelocity);
  }
  sim.addEventListener('click', onSimClick);
});

// Clear all balls
clearBtn.addEventListener('click', ()=>{
  balls.length = 0;
  // stop any placement/aiming
  aimingBall = null;
  tempPos = null;
  removeGhost();
  sim.removeEventListener('mousemove', showVelocityPreview);
  sim.removeEventListener('click', placeWithVelocity);
  simulationRunning = false;
  updateCount();
});

function showVelocityPreview(ev){
  if(!aimingBall) return;
  const p = screenToSim(ev.clientX, ev.clientY);
  // store preview position on aimingBall for render
  aimingBall.preview = {mx: p.x, my: p.y};
}

function placeWithVelocity(ev){
  if(!aimingBall) return;
  const p = screenToSim(ev.clientX, ev.clientY);
  const dx = p.x - aimingBall.x;
  const dy = p.y - aimingBall.y;
  // velocity proportional to arrow vector
  const scale = 0.2; // tweakable
  aimingBall.vx = dx * scale;
  aimingBall.vy = dy * scale;
  // clear aiming state and resume simulation
  aimingBall.preview = null;
  aimingBall = null;
  tempPos = null;
  sim.removeEventListener('mousemove', showVelocityPreview);
  sim.removeEventListener('click', placeWithVelocity);
  simulationRunning = true;
}

// Physics
const G = 500; // gravitational constant (tweakable)

function step(dt){
  // dt in seconds
  // compute pairwise gravity
  for(let i=0;i<balls.length;i++){
    const a = balls[i];
    a.ax = a.ay = 0;
  }
  for(let i=0;i<balls.length;i++){
    for(let j=i+1;j<balls.length;j++){
      const A = balls[i], B = balls[j];
      const dx = B.x - A.x, dy = B.y - A.y;
      const dist2 = dx*dx + dy*dy;
      const dist = Math.sqrt(Math.max(dist2, (A.r+B.r)* (A.r+B.r) ));
      const force = G * (A.mass * B.mass) / (dist*dist);
      const fx = force * dx / dist;
      const fy = force * dy / dist;
      A.ax += fx / A.mass;
      A.ay += fy / A.mass;
      B.ax -= fx / B.mass;
      B.ay -= fy / B.mass;
    }
  }
  // integrate velocities and positions
  for(const b of balls){
    b.vx += b.ax * dt;
    b.vy += b.ay * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
}

let last = performance.now();
function loop(t){
  const now = t || performance.now();
  const dt = Math.min(0.05, (now - last)/1000);
  last = now;
  if(simulationRunning){
    step(dt);
  }
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function render(){
  // clear
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // draw black background
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,canvas.width/DPR,canvas.height/DPR);
  // draw balls
  for(const b of balls){
    // soft glow
    const g = ctx.createRadialGradient(b.x, b.y, Math.max(1,b.r*0.2), b.x, b.y, b.r*2.8);
    g.addColorStop(0, b.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r*2.8, 0, Math.PI*2);
    ctx.fill();
    // core
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fill();
    // draw name inside the ball, auto-scale and auto-contrast
    if(b.name){
      // helper to convert hex to rgb
      function hexToRgb(hex){
        const h = hex.replace('#','');
        const bigint = parseInt(h.length===3? h.split('').map(c=>c+c).join(''): h, 16);
        return {r: (bigint>>16)&255, g: (bigint>>8)&255, b: bigint&255};
      }
      const rgb = hexToRgb(b.color || '#ffffff');
      // relative luminance approximation
      const lum = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
      const textColor = lum > 150 ? '#000' : '#fff';
      // choose base font size from radius
      let fontSize = Math.max(8, Math.floor(b.r * 0.9));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = textColor;
      ctx.font = fontSize + 'px sans-serif';
      // shrink font until it fits within ~75% of diameter
      const maxWidth = b.r * 1.6;
      let nameText = String(b.name || '');
      while(fontSize > 6 && ctx.measureText(nameText).width > maxWidth){
        fontSize -= 1;
        ctx.font = fontSize + 'px sans-serif';
      }
      ctx.fillText(nameText, b.x, b.y);
    }
  }
  // draw preview arrow & speed text if in aiming mode
  if(aimingBall && aimingBall.preview){
    const ox = aimingBall.x, oy = aimingBall.y;
    const mx = aimingBall.preview.mx, my = aimingBall.preview.my;
    // arrow
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(mx, my);
    ctx.stroke();
    // arrow head
    const ax = mx - ox, ay = my - oy;
    const ang = Math.atan2(ay,ax);
    const ah = 10;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx - ah*Math.cos(ang-0.4), my - ah*Math.sin(ang-0.4));
    ctx.lineTo(mx - ah*Math.cos(ang+0.4), my - ah*Math.sin(ang+0.4));
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    // speed text
    const dx = mx - ox, dy = my - oy;
    const speed = Math.hypot(dx,dy) * 0.2;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '14px sans-serif';
    ctx.fillText(`v: ${speed.toFixed(1)}`, mx + 8, my - 8);
  }
}

// Toggle simulation on canvas click when not placing a ball
canvas.addEventListener('click', (e)=>{
  // if currently in aiming mode do nothing
  if(aimingBall) return;
  // toggle simulationRunning
  simulationRunning = !simulationRunning;
});

// Prevent context menu on canvas for convenience
canvas.addEventListener('contextmenu', e=>e.preventDefault());
