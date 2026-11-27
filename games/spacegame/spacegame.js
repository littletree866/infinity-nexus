(function () {
"use strict";

/* ============================================================
   CONFIG — tune the game here
   ============================================================ */
const CONFIG = {
  W: 900, H: 640,
  player: {
    w: 24, h: 28,
    speed: 5.8,
    baseShootDelay: 280,
    rapidShootDelay: 120,
    invulnMs: 1200,
  },
  lives: { start: 5, max: 5 },
  enemies: {
    basePerWave: 8,
    perWaveGain: 1.5,
    types: [
      { w: 22, h: 22, hp: 1, pts: 20, speed: 1.2 },
      { w: 30, h: 30, hp: 2, pts: 40, speed: 0.9 },
      { w: 38, h: 38, hp: 3, pts: 70, speed: 0.7 },
    ],
    waveHpBonus: (wave) => Math.floor((wave - 1) / 2),
    waveSpeedBonus: (wave) => 1 + (wave - 1) * 0.04,
    shot: { w: 6, h: 14, vy: 3.8 },
    dropChance: { normal: 0.28, swarm: 0.6 },
    healthShare: 0.35,
  },
  boss: {
    baseHp: 9,
    hpPerCycle: 3,        // +3 HP every completed boss cycle
    w: 70, h: 60,
    speed: 1.8,
    pts: 500,
    shotSpeed: 3.2,
    spread: [-0.3, -0.15, 0, 0.15, 0.3],
    shootDelay: 800,
    minionDelay: 2000,
    minionHp: 1,
    minionPts: 15,
  },
  bullets: {
    player: { w: 4, h: 16, vy: -9 },
    rapidSide: { w: 3, h: 14, vy: -9, vx: 0.4 },
  },
  bonus: { minDelay: 8000, maxDelay: 16000, firstDelay: 2000, ptsMin: 150, ptsMax: 250 },
  waveBreakMs: 1200,
  waveClearDelayMs: 800,
  startDelayMs: 400,
  bossDefeatDelayMs: 1500,
  messageMs: 2200,
  comboDecayMs: 2500,
  powerupDur: { shield: 4500, rapid: 4000, freeze: 3500 },
};

const W = CONFIG.W, H = CONFIG.H;
const TAU = Math.PI * 2;

/* ============================================================
   DOM cache
   ============================================================ */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const el = {
  score:        document.getElementById('scoreDisplay'),
  level:        document.getElementById('levelDisplay'),
  lives:        document.getElementById('livesDisplay'),
  finalScore:   document.getElementById('finalScore'),
  comboCounter: document.getElementById('comboCounter'),
  comboValue:   document.getElementById('comboValue'),
  comboBig:     document.getElementById('comboBig'),
  comboDisplay: document.getElementById('comboDisplay'),
  msg:          document.getElementById('messageCenter'),
  start:        document.getElementById('startScreen'),
  gameOver:     document.getElementById('gameOver'),
  pause:        document.getElementById('pauseScreen'),
  startBtn:     document.getElementById('startButton'),
  restartBtn:   document.getElementById('restartButton'),
  resumeBtn:    document.getElementById('resumeButton'),
};

/* ============================================================
   HiDPI canvas — keep backing store crisp on retina
   ============================================================ */
(function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  if (dpr === 1) return;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
})();

/* ============================================================
   Deterministic, pausable timer queue (replaces setTimeout)
   ============================================================ */
class Scheduler {
  constructor() { this.queue = []; this.now = 0; }
  schedule(delayMs, fn) {
    this.queue.push({ fireAt: this.now + delayMs, fn });
  }
  tick(dt) {
    this.now += dt;
    if (!this.queue.length) return;
    // Stable, sorted tick — safe to add while iterating
    const due = [];
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].fireAt <= this.now) due.push(...this.queue.splice(i, 1));
    }
    due.sort((a, b) => a.fireAt - b.fireAt);
    for (const t of due) t.fn();
  }
  clear() { this.queue.length = 0; }
}

/* ============================================================
   State
   ============================================================ */
const state = {
  running: false, paused: false, gameOver: false,
  score: 0,
  lives: CONFIG.lives.start, maxLives: CONFIG.lives.max,
  wave: 0, waveCount: 0,
  combo: 0, maxCombo: 0, comboTimer: 0,
  enemies: [], bullets: [], powerups: [], healthPickups: [],
  stars: [], planets: [], bonusShips: [], explosions: [],
  enemiesSpawned: 0,
  isSwarm: false,
  bossActive: false, boss: null,
  waveClearPending: false,
  effects: { shield: 0, rapid: 0, freeze: 0 },
  lastTime: 0,
  messageTimer: 0,
  generation: 0,
  scheduler: new Scheduler(),
};

const player = {
  x: W / 2, y: H - 70,
  w: CONFIG.player.w, h: CONFIG.player.h,
  speed: CONFIG.player.speed,
  shootDelay: CONFIG.player.baseShootDelay,
  lastShot: 0,
  invulnUntil: 0,
};

/* ============================================================
   Input
   ============================================================ */
const keys = Object.freeze({ left: false, right: false, up: false, down: false, fire: false });
const keyState = { left: false, right: false, up: false, down: false, fire: false };

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    if (state.running && !state.gameOver) togglePause();
    else if (!state.running) window.location.href = '../../index.html';
    return;
  }
  if (e.key === ' ') {
    e.preventDefault();
    if (state.running && !state.paused && !state.gameOver) keyState.fire = true;
    return;
  }
  const k = mapArrow(e.key);
  if (k) { e.preventDefault(); keyState[k] = true; }
});
window.addEventListener('keyup', (e) => {
  if (e.key === ' ') { e.preventDefault(); keyState.fire = false; return; }
  const k = mapArrow(e.key);
  if (k) keyState[k] = false;
});
function mapArrow(key) {
  switch (key) {
    case 'ArrowLeft':  return 'left';
    case 'ArrowRight': return 'right';
    case 'ArrowUp':    return 'up';
    case 'ArrowDown':  return 'down';
    default: return null;
  }
}

/* ============================================================
   Helpers
   ============================================================ */
const rand    = (a, b) => Math.random() * (b - a) + a;
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const now = () => performance.now();

/** Axis-aligned box overlap. Entities may be {x,y,w,h}. */
function hits(a, b) {
  return Math.abs(a.x - b.x) * 2 < (a.w + b.w) &&
         Math.abs(a.y - b.y) * 2 < (a.h + b.h);
}
/** Normalize dt to a 60fps step so speeds are frame-rate independent. */
const norm = (dt) => dt / 16;

/* ============================================================
   Background — stars + planets
   ============================================================ */
function initStars() {
  state.stars = Array.from({ length: 280 }, () => ({
    x: rand(0, W), y: rand(0, H),
    size: rand(0.8, 2.8),
    speed: rand(0.5, 3.5),
    bright: rand(0.3, 1),
  }));
}
function updateStars(dt) {
  const s = norm(dt);
  for (const st of state.stars) {
    st.y += st.speed * s;
    if (st.y > H) { st.y = -2; st.x = rand(0, W); }
  }
}
function drawStars() {
  const prev = ctx.fillStyle;
  for (const st of state.stars) {
    ctx.globalAlpha = st.bright;
    ctx.fillStyle = '#cceeff';
    ctx.beginPath(); ctx.arc(st.x, st.y, st.size, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = prev;
}

function planetsOverlap(p) {
  for (const o of state.planets) {
    const dx = o.x - p.x, dy = o.y - p.y;
    if (Math.hypot(dx, dy) < o.size / 2 + p.size / 2 + 40) return true;
  }
  return false;
}
function makePlanet() {
  const size = rand(50, 120);
  return {
    x: rand(50, W - 50), y: -size - 20, size,
    speed: rand(0.3, 1.2),
    color: `hsl(${randInt(200, 260)}, 50%, ${randInt(15, 35)}%)`,
    ring: Math.random() > 0.55,
    ringColor: `hsla(${randInt(180, 280)}, 70%, 60%, 0.3)`,
  };
}
function spawnPlanet() {
  for (let i = 0; i < 20; i++) {
    const p = makePlanet();
    if (!planetsOverlap(p)) { state.planets.push(p); return; }
  }
}
function updatePlanets(dt) {
  const s = norm(dt);
  for (const p of state.planets) {
    p.y += p.speed * s;
    if (p.y > H + p.size) {
      p.y = -p.size - 20;
      p.x = rand(50, W - 50);
    }
  }
}
function drawPlanets() {
  for (const p of state.planets) {
    ctx.shadowColor = '#0af3'; ctx.shadowBlur = 40;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, TAU); ctx.fill();
    if (p.ring) {
      ctx.shadowBlur = 10;
      ctx.strokeStyle = p.ringColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2 + 10, 0, TAU); ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
}

/* ============================================================
   Drawing helpers — cut boilerplate
   ============================================================ */
function glowFill(color, blur) {
  ctx.shadowColor = color; ctx.shadowBlur = blur;
  ctx.fillStyle = color;
}
function poly(points) {
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}
function hexPoints(cx, cy, r, rot = -Math.PI / 6) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + rot;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/* ============================================================
   Player
   ============================================================ */
function drawPlayer() {
  if (state.paused || state.gameOver) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  glowFill('#0af', 30);
  poly([
    [0, -player.h / 2 - 4],
    [-player.w / 2, player.h / 2 - 2],
    [-player.w / 4, player.h / 2 - 6],
    [0, player.h / 2 + 2],
    [player.w / 4, player.h / 2 - 6],
    [player.w / 2, player.h / 2 - 2],
  ]);
  ctx.fill();

  ctx.shadowBlur = 10;
  ctx.fillStyle = '#8cf';
  ctx.beginPath(); ctx.arc(0, -2, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(2, -4, 3, 0, TAU); ctx.fill();

  const moving = keyState.up || keyState.down || keyState.left || keyState.right;
  if (moving) {
    glowFill('#f80', 30);
    poly([
      [-8, player.h / 2 - 4],
      [0, player.h / 2 + 14],
      [8, player.h / 2 - 4],
    ]);
    ctx.fill();
  }
  ctx.restore();
  ctx.shadowBlur = 0;
}

function updatePlayer(dt, t) {
  const s = player.speed * norm(dt);
  if (keyState.left)  player.x -= s;
  if (keyState.right) player.x += s;
  if (keyState.up)    player.y -= s;
  if (keyState.down)  player.y += s;
  player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));
  player.y = Math.max(player.h / 2, Math.min(H - player.h / 2, player.y));

  if (keyState.fire && t - player.lastShot > player.shootDelay) {
    player.lastShot = t;
    firePlayerBullet();
    if (state.effects.rapid > 0) fireRapidSides();
  }
}

function firePlayerBullet() {
  const b = CONFIG.bullets.player;
  state.bullets.push({
    x: player.x, y: player.y - player.h / 2 - 4,
    w: b.w, h: b.h, vx: 0, vy: b.vy, enemy: false, color: '#8cf',
  });
}
function fireRapidSides() {
  const b = CONFIG.bullets.rapidSide;
  for (const sign of [-1, 1]) {
    state.bullets.push({
      x: player.x + sign * 8, y: player.y - player.h / 2,
      w: b.w, h: b.h, vx: sign * b.vx, vy: b.vy, enemy: false, color: '#8cf',
    });
  }
}

/* ============================================================
   Enemies
   ============================================================ */
function spawnEnemy() {
  if (!state.running || state.gameOver || state.paused || state.bossActive) return;
  const types = CONFIG.enemies.types;
  const t = { ...types[randInt(0, types.length - 1)] };
  const hpBonus = CONFIG.enemies.waveHpBonus(state.wave);
  const speedMul = CONFIG.enemies.waveSpeedBonus(state.wave);
  if (state.isSwarm) { t.hp = Math.ceil(t.hp * 1.25); t.pts = Math.ceil(t.pts * 1.3); }
  state.enemies.push({
    x: rand(t.w / 2 + 10, W - t.w / 2 - 10),
    y: -t.h,
    w: t.w, h: t.h,
    hp: t.hp + hpBonus, maxHp: t.hp + hpBonus,
    pts: t.pts,
    speed: t.speed * speedMul,
    pattern: randInt(0, 2),
    step: rand(0, 100),
    color: state.isSwarm
      ? `hsl(${randInt(280, 320)}, 80%, 55%)`
      : `hsl(${randInt(0, 40)}, 80%, 55%)`,
    shootTimer: 0,
    shootDelay: rand(1200, 2800),
    isSwarm: state.isSwarm,
  });
  state.enemiesSpawned++;
}

function updateEnemies(dt, t) {
  const s = norm(dt);
  const freezeMul = state.effects.freeze > 0 ? 0.45 : 1;   // no permanent mutation
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    e.y += e.speed * s * freezeMul;
    if (e.pattern === 1)      e.x += Math.sin(e.step * 0.04) * 1.2;
    else if (e.pattern === 2) e.x += Math.cos(e.step * 0.05) * 1.2;
    e.step++;

    e.shootTimer += dt;
    if (e.shootTimer > e.shootDelay && e.y > 40 && e.y < H * 0.7) {
      e.shootTimer = 0;
      const sh = CONFIG.enemies.shot;
      state.bullets.push({
        x: e.x, y: e.y + e.h / 2,
        w: sh.w, h: sh.h, vx: 0, vy: sh.vy, enemy: true, color: '#ff6644',
      });
    }

    if (e.y > H + 30) { state.enemies.splice(i, 1); continue; }

    if (hits(player, e)) {
      damagePlayer(state.isSwarm ? 2 : 1, t);
      createExplosion(e.x, e.y, 40);
      state.enemies.splice(i, 1);
    }
  }
}

function drawEnemies() {
  for (const e of state.enemies) {
    glowFill(e.color, 20);
    poly(hexPoints(e.x, e.y, e.w / 2));
    ctx.fill();

    ctx.shadowBlur = 5;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(e.x - 4, e.y - 2, 5, 0, TAU);
    ctx.arc(e.x + 4, e.y - 2, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(e.x - 5, e.y - 4, 2.5, 0, TAU);
    ctx.arc(e.x + 3, e.y - 4, 2.5, 0, TAU);
    ctx.fill();

    if (e.hp < e.maxHp) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#333';
      ctx.fillRect(e.x - 16, e.y - e.h / 2 - 10, 32, 4);
      ctx.fillStyle = '#0f0';
      ctx.fillRect(e.x - 16, e.y - e.h / 2 - 10, 32 * (e.hp / e.maxHp), 4);
    }
  }
  ctx.shadowBlur = 0;
}

/* ============================================================
   Boss
   ============================================================ */
function spawnBoss() {
  const c = CONFIG.boss;
  const cycles = Math.max(0, Math.floor(state.waveCount / 4) - 1);
  const hp = c.baseHp + cycles * c.hpPerCycle;
  state.bossActive = true;
  state.boss = {
    x: W / 2, y: 80, w: c.w, h: c.h,
    hp, maxHp: hp,
    speed: c.speed, pts: c.pts,
    color: '#ff2255',
    shootTimer: 0, shootDelay: c.shootDelay,
    moveTimer: 0, moveDir: 1,
    minionTimer: 0, minionDelay: c.minionDelay,
  };
  showMessage('👾 BOSS APPROACHING!');
}

function updateBoss(dt, t) {
  if (!state.boss) return;
  const b = state.boss;
  const c = CONFIG.boss;
  const s = norm(dt);
  const freezeMul = state.effects.freeze > 0 ? 0.45 : 1;

  b.moveTimer += dt;
  if (b.moveTimer > 2000) { b.moveDir *= -1; b.moveTimer = 0; }
  b.x += b.speed * b.moveDir * s * freezeMul;
  b.x = Math.max(b.w / 2 + 20, Math.min(W - b.w / 2 - 20, b.x));
  b.y += Math.sin(b.moveTimer * 0.002) * 0.3;

  b.shootTimer += dt;
  if (b.shootTimer > b.shootDelay) {
    b.shootTimer = 0;
    const dx = player.x - b.x;
    const dy = player.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    for (const a of c.spread) {
      state.bullets.push({
        x: b.x, y: b.y + b.h / 2,
        w: 6, h: 12,
        vx: (dx / d) * c.shotSpeed + a * 1.5,
        vy: (dy / d) * c.shotSpeed,
        enemy: true, color: '#ff4488',
      });
    }
  }

  b.minionTimer += dt;
  if (b.minionTimer > b.minionDelay) {
    b.minionTimer = 0;
    const side = Math.random() > 0.5 ? 1 : -1;
    state.enemies.push({
      x: b.x + side * 60, y: b.y + 30,
      w: 18, h: 18,
      hp: c.minionHp, maxHp: c.minionHp,
      pts: c.minionPts,
      speed: 1.5 + Math.random() * 0.5,
      pattern: 1, step: 0,
      color: '#ff6699',
      shootTimer: 0, shootDelay: rand(2000, 3000),
      isSwarm: false, isMinion: true,
    });
  }

  if (hits(player, b)) {
    if (!isInvuln(t)) {
      state.lives -= 2;
      player.invulnUntil = t + CONFIG.player.invulnMs;
      if (state.lives <= 0) { gameOver(); return; }
    }
    createExplosion(b.x, b.y, 50);
    b.hp -= 2;
  }

  if (b.hp <= 0) bossDefeated();
}

function bossDefeated() {
  if (!state.boss) return;              // guard against double-fire
  const b = state.boss;
  state.boss = null;                    // clear first
  state.bossActive = false;
  state.isSwarm = false;
  state.score += b.pts;
  createExplosion(b.x, b.y, 80);

  const gen = state.generation;
  for (let i = 0; i < 3; i++) {
    state.scheduler.schedule(i * 200, () => {
      if (gen !== state.generation) return;
      const px = b.x + rand(-40, 40), py = b.y + rand(-20, 20);
      Math.random() < 0.5 ? spawnPowerup(px, py) : spawnHealthPickup(px, py);
    });
  }
  showMessage('💥 BOSS DEFEATED!');
  state.scheduler.schedule(CONFIG.bossDefeatDelayMs, () => {
    if (gen === state.generation && state.running) startWave();
  });
}

function drawBoss() {
  const b = state.boss;
  if (!b) return;
  glowFill(b.color, 50);
  poly([
    [b.x, b.y - b.h / 2],
    [b.x - b.w / 2, b.y - b.h / 4],
    [b.x - b.w / 2 - 10, b.y + b.h / 4],
    [b.x - b.w / 3, b.y + b.h / 2],
    [b.x, b.y + b.h / 2 - 6],
    [b.x + b.w / 3, b.y + b.h / 2],
    [b.x + b.w / 2 + 10, b.y + b.h / 4],
    [b.x + b.w / 2, b.y - b.h / 4],
  ]);
  ctx.fill();

  ctx.shadowBlur = 5;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(b.x - 12, b.y - 6, 8, 0, TAU);
  ctx.arc(b.x + 12, b.y - 6, 8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f00';
  ctx.beginPath();
  ctx.arc(b.x - 14, b.y - 8, 4, 0, TAU);
  ctx.arc(b.x + 10, b.y - 8, 4, 0, TAU);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#333';
  ctx.fillRect(b.x - 40, b.y - b.h / 2 - 16, 80, 8);
  ctx.fillStyle = '#ff2255';
  ctx.fillRect(b.x - 40, b.y - b.h / 2 - 16, 80 * (b.hp / b.maxHp), 8);
}

/* ============================================================
   Bullets
   ============================================================ */
function updateBullets(dt, t) {
  const s = norm(dt);
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * s;
    b.y += b.vy * s;

    if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) {
      state.bullets.splice(i, 1); continue;
    }

    if (b.enemy) {
      if (hits(player, b)) {
        if (!isInvuln(t)) damagePlayer(state.isSwarm ? 2 : 1, t);
        state.bullets.splice(i, 1);
      }
      continue;
    }

    if (state.boss && hits(b, state.boss)) {
      state.boss.hp--;
      state.bullets.splice(i, 1);
      if (state.boss.hp <= 0) bossDefeated();
      continue;
    }

    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const e = state.enemies[j];
      if (!hits(b, e)) continue;
      e.hp--;
      state.bullets.splice(i, 1);
      if (e.hp <= 0) killEnemy(e, j);
      break;
    }
  }
}

function killEnemy(e, index) {
  state.score += e.pts;
  state.combo++;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.comboTimer = CONFIG.comboDecayMs;
  createExplosion(e.x, e.y, 30);
  state.enemies.splice(index, 1);

  const chance = state.isSwarm ? CONFIG.enemies.dropChance.swarm : CONFIG.enemies.dropChance.normal;
  if (Math.random() < chance) {
    if (Math.random() < CONFIG.enemies.healthShare && state.lives < state.maxLives) {
      spawnHealthPickup(e.x, e.y);
    } else {
      spawnPowerup(e.x, e.y);
    }
  }
}

function drawBullets() {
  for (const b of state.bullets) {
    glowFill(b.color || (b.enemy ? '#ff6644' : '#ffd866'), 20);
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  }
  ctx.shadowBlur = 0;
}

/* ============================================================
   Powerups & health
   ============================================================ */
const POWERUP_DEFS = {
  shield: { color: '#2af', icon: '🛡️' },
  rapid:  { color: '#ffbb33', icon: '⚡' },
  freeze: { color: '#4df', icon: '❄️' },
  bomb:   { color: '#f55', icon: '💥' },
};
const POWERUP_KEYS = Object.keys(POWERUP_DEFS);

function spawnPowerup(x, y) {
  const type = POWERUP_KEYS[randInt(0, POWERUP_KEYS.length - 1)];
  const def = POWERUP_DEFS[type];
  state.powerups.push({ x, y, w: 28, h: 28, type, color: def.color, icon: def.icon, vy: 1.8 });
}
function updatePowerups(dt) {
  const s = norm(dt);
  for (let i = state.powerups.length - 1; i >= 0; i--) {
    const p = state.powerups[i];
    p.y += p.vy * s;
    if (p.y > H + 30) { state.powerups.splice(i, 1); continue; }
    if (hits(player, p)) { applyPowerup(p); state.powerups.splice(i, 1); }
  }
}
function drawPowerups() {
  for (const p of state.powerups) {
    ctx.shadowColor = p.color; ctx.shadowBlur = 30;
    ctx.fillStyle = p.color + '60';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.w / 2 + 4, 0, TAU); ctx.fill();

    ctx.shadowBlur = 10;
    ctx.fillStyle = '#fff';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.icon, p.x, p.y + 1);
  }
  ctx.shadowBlur = 0;
}
function applyPowerup(p) {
  const t = now();
  const dur = CONFIG.powerupDur;
  switch (p.type) {
    case 'shield': state.effects.shield = t + dur.shield; break;
    case 'rapid':
      state.effects.rapid = t + dur.rapid;
      player.shootDelay = CONFIG.player.rapidShootDelay;
      break;
    case 'freeze': state.effects.freeze = t + dur.freeze; break;
    case 'bomb':
      for (const e of state.enemies) createExplosion(e.x, e.y, 45);
      state.enemies.length = 0;
      if (state.boss) {
        state.boss.hp -= 3;
        createExplosion(state.boss.x, state.boss.y, 60);
        if (state.boss.hp <= 0) bossDefeated();
      }
      break;
  }
  showMessage(`${p.icon} ${p.type.toUpperCase()}!`);
}

function spawnHealthPickup(x, y) {
  state.healthPickups.push({ x, y, w: 26, h: 26, vy: 1.5, icon: '❤️' });
}
function updateHealthPickups(dt) {
  const s = norm(dt);
  for (let i = state.healthPickups.length - 1; i >= 0; i--) {
    const h = state.healthPickups[i];
    h.y += h.vy * s;
    if (h.y > H + 30) { state.healthPickups.splice(i, 1); continue; }
    if (hits(player, h)) {
      state.lives = Math.min(state.maxLives, state.lives + 1);
      showMessage('❤️ +1 life');
      state.healthPickups.splice(i, 1);
    }
  }
}
function drawHealthPickups() {
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const h of state.healthPickups) {
    ctx.shadowColor = '#f44'; ctx.shadowBlur = 25;
    ctx.fillText(h.icon, h.x, h.y);
  }
  ctx.shadowBlur = 0;
}

/* ============================================================
   Bonus ships
   ============================================================ */
function spawnBonus() {
  if (!state.running || state.gameOver) return;
  state.bonusShips.push({
    x: rand(40, W - 40), y: -30, w: 28, h: 28,
    speed: rand(1.2, 2.2),
    pts: randInt(CONFIG.bonus.ptsMin, CONFIG.bonus.ptsMax),
    color: `hsl(${randInt(180, 240)}, 90%, 65%)`,
  });
  const gen = state.generation;
  state.scheduler.schedule(
    rand(CONFIG.bonus.minDelay, CONFIG.bonus.maxDelay),
    () => { if (gen === state.generation) spawnBonus(); }
  );
}
function updateBonus(dt) {
  const s = norm(dt);
  for (let i = state.bonusShips.length - 1; i >= 0; i--) {
    const b = state.bonusShips[i];
    b.y += b.speed * s;
    if (b.y > H + 30) { state.bonusShips.splice(i, 1); continue; }
    if (hits(player, b)) {
      state.score += b.pts;
      showMessage(`✦ +${b.pts} BONUS`);
      createExplosion(b.x, b.y, 25);
      state.bonusShips.splice(i, 1);
    }
  }
}
function drawBonus() {
  for (const b of state.bonusShips) {
    glowFill(b.color, 40);
    poly([
      [b.x, b.y - b.h / 2],
      [b.x - b.w / 2, b.y + b.h / 2],
      [b.x, b.y + b.h / 3],
      [b.x + b.w / 2, b.y + b.h / 2],
    ]);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★', b.x, b.y - 2);
  }
  ctx.shadowBlur = 0;
}

/* ============================================================
   Explosions
   ============================================================ */
function createExplosion(x, y, size) {
  state.explosions.push({ x, y, maxR: size, r: 4, life: 1, decay: 0.025 + rand(0.01, 0.03) });
}
function updateExplosions(dt) {
  const s = norm(dt);
  for (let i = state.explosions.length - 1; i >= 0; i--) {
    const e = state.explosions[i];
    e.life -= e.decay * s;
    e.r += (e.maxR - e.r) * 0.12;
    if (e.life <= 0) state.explosions.splice(i, 1);
  }
}
function drawExplosions() {
  for (const e of state.explosions) {
    ctx.globalAlpha = e.life * 0.9;
    ctx.shadowColor = '#f80'; ctx.shadowBlur = 50;
    ctx.fillStyle = `hsl(30, 100%, ${60 + 30 * e.life}%)`;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'hsl(60, 100%, 70%)';
    ctx.beginPath(); ctx.arc(e.x - 6, e.y - 6, e.r * 0.5, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

/* ============================================================
   Damage / invulnerability
   ============================================================ */
function isInvuln(t) { return t < player.invulnUntil; }
function damagePlayer(amount, t) {
  if (state.effects.shield > t || isInvuln(t)) return;
  state.lives -= amount;
  player.invulnUntil = t + CONFIG.player.invulnMs;
  if (state.lives <= 0) gameOver();
}

/* ============================================================
   Waves
   ============================================================ */
function startWave() {
  if (!state.running || state.gameOver) return;
  state.wave++;
  state.waveCount++;
  state.enemiesSpawned = 0;

  const isBossBreak = state.waveCount > 0 && state.waveCount % 3 === 0;
  if (isBossBreak) {
    for (const e of state.enemies) createExplosion(e.x, e.y, 30);
    state.enemies.length = 0;
    if (state.boss) { createExplosion(state.boss.x, state.boss.y, 60); state.boss = null; state.bossActive = false; }
    showMessage('💥 ENEMIES CLEARED!');
    const gen = state.generation;
    state.scheduler.schedule(CONFIG.waveBreakMs, () => {
      if (gen !== state.generation) return;
      state.waveCount % 4 === 0 ? startSwarmWave() : startNormalWave();
    });
    return;
  }

  state.waveCount % 4 === 0 ? startSwarmWave() : startNormalWave();
}

function waveEnemyCount() {
  return CONFIG.enemies.basePerWave + Math.floor((state.wave - 1) * CONFIG.enemies.perWaveGain);
}

function startNormalWave() {
  state.isSwarm = false;
  const count = waveEnemyCount();
  const delay = Math.max(180, 800 - state.wave * 20);
  const gen = state.generation;
  for (let i = 0; i < count; i++) {
    state.scheduler.schedule(i * delay, () => {
      if (gen === state.generation && state.running) spawnEnemy();
    });
  }
  showMessage(`◈ WAVE ${state.wave}`);
}

function startSwarmWave() {
  state.isSwarm = true;
  const count = Math.floor(waveEnemyCount() * 1.3);
  const delay = Math.max(120, 600 - state.wave * 15);
  const gen = state.generation;
  for (let i = 0; i < count; i++) {
    state.scheduler.schedule(i * delay, () => {
      if (gen === state.generation && state.running) spawnEnemy();
    });
  }
  showMessage('SWARM!');
  state.scheduler.schedule(count * delay + 2000, () => {
    if (gen === state.generation && state.running && !state.gameOver) spawnBoss();
  });
}

function checkWaveComplete() {
  if (state.bossActive || state.waveClearPending) return;
  if (state.enemies.length > 0 || state.enemiesSpawned === 0) return;

  const expected = state.isSwarm
    ? Math.floor(waveEnemyCount() * 1.3)
    : waveEnemyCount();
  if (state.enemiesSpawned < expected) return;   // still spawning

  state.waveClearPending = true;
  const gen = state.generation;
  state.scheduler.schedule(CONFIG.waveClearDelayMs, () => {
    state.waveClearPending = false;
    if (gen === state.generation && state.running && !state.gameOver && !state.bossActive) {
      startWave();
    }
  });
}

/* ============================================================
   HUD (only writes when values change — avoids layout thrash)
   ============================================================ */
const hudCache = { score: null, level: null, lives: null, combo: null };
function updateHUD() {
  if (state.score !== hudCache.score) {
    el.score.textContent = state.score;
    hudCache.score = state.score;
  }
  if (state.wave !== hudCache.level) {
    el.level.textContent = state.wave || 1;
    hudCache.level = state.wave;
  }
  if (state.lives !== hudCache.lives) {
    el.lives.textContent = '❤️'.repeat(Math.max(0, state.lives))
                         + '🩶'.repeat(Math.max(0, state.maxLives - state.lives));
    hudCache.lives = state.lives;
  }
  const showCombo = state.combo > 1;
  if (showCombo !== hudCache.combo) {
    el.comboCounter.style.display = showCombo ? 'inline' : 'none';
    el.comboDisplay.classList.toggle('show', showCombo);
    hudCache.combo = showCombo;
  }
  if (showCombo) {
    el.comboValue.textContent = state.combo;
    el.comboBig.textContent = state.combo;
  }
}

function showMessage(text) {
  state.messageTimer = CONFIG.messageMs;
  el.msg.textContent = text;
  el.msg.style.opacity = 1;
}

/* ============================================================
   Game over / pause
   ============================================================ */
function gameOver() {
  state.running = false;
  state.gameOver = true;
  state.scheduler.clear();
  el.finalScore.textContent = state.score;
  el.gameOver.classList.remove('hidden');
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
  el.pause.style.display = state.paused ? 'flex' : 'none';
  if (!state.paused) {
    state.lastTime = now();
    requestAnimationFrame(gameLoop);
  }
}

/* ============================================================
   Main loop
   ============================================================ */
function gameLoop(timestamp) {
  if (!state.running || state.paused || state.gameOver) return;

  const dt = Math.min(32, timestamp - (state.lastTime || timestamp));
  state.lastTime = timestamp;
  const t = now();

  // Timers first so scheduled spawns land before updates this frame
  state.scheduler.tick(dt);

  // Effect expiry
  if (state.effects.shield && t > state.effects.shield) state.effects.shield = 0;
  if (state.effects.freeze && t > state.effects.freeze) state.effects.freeze = 0;
  if (state.effects.rapid && t > state.effects.rapid) {
    state.effects.rapid = 0;
    player.shootDelay = CONFIG.player.baseShootDelay;
  }

  // Combo decay
  if (state.combo > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) { state.combo = 0; state.comboTimer = 0; }
  }

  updateStars(dt);
  updatePlanets(dt);
  updatePlayer(dt, t);
  updateEnemies(dt, t);
  if (state.bossActive) updateBoss(dt, t);
  updateBullets(dt, t);
  updatePowerups(dt);
  updateHealthPickups(dt);
  updateBonus(dt);
  updateExplosions(dt);
  checkWaveComplete();

  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) el.msg.style.opacity = 0;
  }
  updateHUD();
  render(t);

  if (state.running && !state.paused && !state.gameOver) {
    requestAnimationFrame(gameLoop);
  }
}

function render(t) {
  ctx.clearRect(0, 0, W, H);
  drawStars();
  drawPlanets();
  drawEnemies();
  drawBoss();
  drawBullets();
  drawPowerups();
  drawHealthPickups();
  drawBonus();
  drawExplosions();

  // Invuln flicker
  if (isInvuln(t) && Math.floor(t / 80) % 2 === 0) {
    // draw at reduced alpha
    ctx.globalAlpha = 0.35;
  }
  drawPlayer();
  ctx.globalAlpha = 1;

  if (state.effects.shield > t) {
    ctx.strokeStyle = '#0af8'; ctx.lineWidth = 3;
    ctx.shadowColor = '#0af'; ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.w * 1.2, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (state.isSwarm) {
    ctx.fillStyle = 'rgba(255, 0, 100, 0.08)';
    ctx.fillRect(0, 0, W, H);
  }

  // Reticle near player (canvas cursor is hidden while playing)
  drawReticle();
}

function drawReticle() {
  // Minimal crosshair just above the ship — gives a sense of aim.
  const y = player.y - player.h / 2 - 10;
  ctx.strokeStyle = 'rgba(140, 200, 255, .55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(player.x - 6, y); ctx.lineTo(player.x - 2, y);
  ctx.moveTo(player.x + 2, y); ctx.lineTo(player.x + 6, y);
  ctx.moveTo(player.x, y - 6); ctx.lineTo(player.x, y - 2);
  ctx.stroke();
}

/* ============================================================
   Reset
   ============================================================ */
function resetGame() {
  state.generation++;                    // invalidate any stale scheduled callbacks
  state.scheduler.clear();

  Object.assign(state, {
    running: true, paused: false, gameOver: false,
    score: 0, lives: CONFIG.lives.start,
    wave: 0, waveCount: 0,
    combo: 0, maxCombo: 0, comboTimer: 0,
    enemiesSpawned: 0,
    isSwarm: false,
    bossActive: false, boss: null,
    waveClearPending: false,
    messageTimer: 0,
    enemies: [], bullets: [], powerups: [], healthPickups: [],
    bonusShips: [], explosions: [],
    effects: { shield: 0, rapid: 0, freeze: 0 },
  });

  player.x = W / 2;
  player.y = H - 70;
  player.shootDelay = CONFIG.player.baseShootDelay;
  player.lastShot = 0;
  player.invulnUntil = 0;

  // Reset HUD cache so it redraws
  Object.keys(hudCache).forEach((k) => (hudCache[k] = null));

  el.gameOver.classList.add('hidden');
  el.pause.style.display = 'none';
  el.start.classList.add('hidden');
  el.msg.style.opacity = 0;

  initStars();
  state.planets = [];
  spawnPlanet(); spawnPlanet();

  state.lastTime = now();
  const gen = state.generation;
  state.scheduler.schedule(CONFIG.bonus.firstDelay, () => {
    if (gen === state.generation) spawnBonus();
  });
  state.scheduler.schedule(CONFIG.startDelayMs, () => {
    if (gen === state.generation) startWave();
  });

  updateHUD();
  requestAnimationFrame(gameLoop);
}

/* ============================================================
   Menu background loop
   ============================================================ */
function menuLoop(timestamp) {
  if (state.running) return;
  const dt = Math.min(32, timestamp - (state.lastTime || timestamp));
  state.lastTime = timestamp;
  updateStars(dt);
  updatePlanets(dt);
  ctx.clearRect(0, 0, W, H);
  drawStars();
  drawPlanets();
  requestAnimationFrame(menuLoop);
}

/* ============================================================
   Boot
   ============================================================ */
el.startBtn.addEventListener('click', resetGame);
el.restartBtn.addEventListener('click', resetGame);
el.resumeBtn.addEventListener('click', togglePause);

el.start.classList.remove('hidden');
el.gameOver.classList.add('hidden');

initStars();
spawnPlanet(); spawnPlanet();
requestAnimationFrame(menuLoop);

})();