const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const TILE = 40;
const COLS = Math.floor(canvas.width / TILE);
const ROWS = Math.floor(canvas.height / TILE);

const pathTiles1 = [
  {x:0,y:2},{x:1,y:2},{x:2,y:2},{x:3,y:2},{x:4,y:2},{x:5,y:2},{x:6,y:2},{x:7,y:2},{x:8,y:2},{x:9,y:2},
  {x:9,y:3},{x:10,y:3},{x:11,y:3},{x:12,y:3},{x:13,y:3},{x:14,y:3},{x:15,y:3},{x:16,y:3},{x:17,y:3},
  {x:17,y:4},{x:17,y:5},{x:17,y:6},{x:17,y:7},
  {x:18,y:7},{x:19,y:7},{x:20,y:7},{x:21,y:7},{x:22,y:7},{x:23,y:7},{x:24,y:7},{x:25,y:7},{x:26,y:7},{x:27,y:7},
  {x:27,y:6},{x:27,y:5},{x:27,y:4},{x:27,y:3},
  {x:28,y:3},{x:29,y:3},{x:30,y:3}
];
const pathTiles2 = [
  {x:0,y:11},{x:1,y:11},{x:2,y:11},{x:3,y:11},{x:4,y:11},{x:5,y:11},{x:6,y:11},{x:7,y:11},{x:8,y:11},{x:9,y:11},
  {x:9,y:10},{x:10,y:10},{x:11,y:10},{x:12,y:10},{x:13,y:10},{x:14,y:10},{x:15,y:10},{x:16,y:10},{x:17,y:10},
  {x:17,y:9},{x:17,y:8},{x:17,y:7},
  {x:18,y:7},{x:19,y:7},{x:20,y:7},{x:21,y:7},{x:22,y:7},{x:23,y:7},{x:24,y:7},{x:25,y:7},{x:26,y:7},{x:27,y:7},
  {x:27,y:8},{x:27,y:9},{x:27,y:10},
  {x:28,y:10},{x:29,y:10},{x:30,y:10}
];
const path1 = pathTiles1.map(t => ({x:t.x*TILE+TILE/2, y:t.y*TILE+TILE/2}));
const path2 = pathTiles2.map(t => ({x:t.x*TILE+TILE/2, y:t.y*TILE+TILE/2}));

const DIFFICULTY = {
  easy:   { towerCostMult: 0.75, enemyHpMult: 0.7, enemySpeedMult: 0.85, spawnRateMult: 0.75, startMoney: 150, bombWave: 30 },
  normal: { towerCostMult: 1.0,  enemyHpMult: 1.0, enemySpeedMult: 1.0,  spawnRateMult: 1.0,  startMoney: 100, bombWave: 20 },
  hard:   { towerCostMult: 1.3,  enemyHpMult: 1.5, enemySpeedMult: 1.2,  spawnRateMult: 1.3,  startMoney: 75,  bombWave: 1 }
};

const game = {
  wave:1, money:100, health:20, enemies:[], towers:[], projectiles:[], particles:[],
  placing:null, selectedTower:null, toSpawn:0, spawnTimer:0, waveInProgress:false,
  paused:false, autoNext:false, spawnInterval:1.0, totalWaves:50,
  gameOver:false, victory:false, placingPos:{x:0,y:0},
  enemiesDefeated:0, totalMoneyEarned:0, currentMap:'forest',
  difficulty:'normal',
  mapStyles: {
    forest: { grassPatterns:[['#1f4a2a','#2f6a3a','#3f7a4a'],['#1a3f22','#2a5a32','#3a6a42']], pathPatterns:['#5a4a2a','#6a5a3a','#7a6a4a','#8a7a5a'], bgColor:'#0e1f16', tileBorder:'#1f3a2544', pathOutline:'#5a4a2a66' },
    desert: { grassPatterns:[['#b8985a','#c9a86a','#ddc08a'],['#a8884a','#b8985a','#c9a86a']], pathPatterns:['#9a8060','#aa9070','#baa080','#cab090'], bgColor:'#d6b88a', tileBorder:'#8a6a4a66', pathOutline:'#9a7a5a66' },
    arctic: { grassPatterns:[['#6a9aaa','#7ab0c0','#9ac8d8'],['#5a8a9a','#6a9aaa','#7ab0c0']], pathPatterns:['#90b0c8','#a0c0d8','#b0d0e8','#c0e0f0'], bgColor:'#a0c8d8', tileBorder:'#6a8a9a66', pathOutline:'#6a8a9a66' },
    volcano: { grassPatterns:[['#4a0a0a','#6a1a1a','#8a2a2a'],['#3a0a0a','#5a0a0a','#7a1a1a']], pathPatterns:['#5a3a2a','#6a4a3a','#7a5a4a','#8a6a5a'], bgColor:'#2a0a0a', tileBorder:'#6a2a2a66', pathOutline:'#5a2a1a66' }
  }
};

let tileMap = [];
function initTileMap() {
  tileMap = Array.from({length:ROWS}, (_,y) => Array.from({length:COLS}, (_,x) => ({type:'grass', walkable:true, decoration:null, grassVariant: (x+y)%4 })));
  [...pathTiles1, ...pathTiles2].forEach(t => { if(tileMap[t.y]?.[t.x]) tileMap[t.y][t.x] = {type:'path', walkable:false}; });
}
initTileMap();

const TOWER_STATS = {
  basic: [
    { range:140, dmg:12, firerate:1.0, cost:30, color:'#b0c4de' },
    { range:160, dmg:20, firerate:1.15, cost:35, color:'#c0d4ee' },
    { range:180, dmg:32, firerate:1.3, cost:45, color:'#d0e4ff' }
  ],
  sniper: [
    { range:280, dmg:45, firerate:0.7, cost:70, color:'#8a9aaa' },
    { range:320, dmg:75, firerate:0.8, cost:80, color:'#9aaaba' },
    { range:360, dmg:120, firerate:0.9, cost:100, color:'#aabbcc' }
  ],
  frost: [
    { range:160, dmg:9, firerate:1.2, slow:0.45, cost:70, color:'#b0e8f0' },
    { range:180, dmg:14, firerate:1.35, slow:0.55, cost:80, color:'#c0f0ff' },
    { range:200, dmg:22, firerate:1.5, slow:0.65, cost:100, color:'#d0f8ff' }
  ],
  bomb: [
    { range:130, dmg:28, firerate:1.0, aoe:75, cost:125, color:'#ffd966' },
    { range:150, dmg:45, firerate:1.1, aoe:90, cost:140, color:'#ffe97a' },
    { range:170, dmg:70, firerate:1.2, aoe:110, cost:170, color:'#fff08a' }
  ],
  flame: [
    { range:135, dmg:11, firerate:1.4, dot:6, dotDuration:3.0, cost:160, color:'#ff6a3a' },
    { range:155, dmg:18, firerate:1.55, dot:10, dotDuration:3.5, cost:180, color:'#ff7a4a' },
    { range:175, dmg:28, firerate:1.7, dot:16, dotDuration:4.0, cost:210, color:'#ff8a5a' }
  ],
  tesla: [
    { range:145, dmg:12, firerate:1.8, chain:4, chainRange:80, cost:200, color:'#b080d0' },
    { range:165, dmg:20, firerate:2.0, chain:5, chainRange:95, cost:220, color:'#c090e0' },
    { range:185, dmg:32, firerate:2.2, chain:6, chainRange:110, cost:260, color:'#d0a0f0' }
  ]
};

function getTowerCost(type) {
  const base = TOWER_STATS[type][0].cost;
  return Math.round(base * DIFFICULTY[game.difficulty].towerCostMult);
}

class Enemy {
  constructor(type, pathIdx=0) {
    const base = { normal:{hp:40,speed:80,gold:5,color:'#c99a6a',size:16},
                    runner:{hp:35,speed:150,gold:8,color:'#e05a5a',size:13},
                    tank:{hp:120,speed:50,gold:10,color:'#5a7a7a',size:18},
                    healer:{hp:60,speed:55,gold:15,color:'#6ad06a',size:16,heal:10,healRange:90},
                    boss:{hp:550,speed:90,gold:35,color:'#c04a4a',size:20},
                    flyer:{hp:55,speed:175,gold:20,color:'#c090e0',size:13,airborne:true},
                    bomb:{hp:30,speed:380,gold:25,color:'#ff8800',size:18,bomb:true} };
    const st = {...base[type]};
    const w = game.wave;
    const diff = DIFFICULTY[game.difficulty];
    if(type==='normal'){ st.hp += w*1.5; st.gold += Math.floor(w/3); }
    else if(type==='runner'){ st.hp += w*1.2; st.gold += Math.floor(w/3); }
    else if(type==='tank'){ st.hp += w*5; st.gold += Math.floor(w/2); }
    else if(type==='healer'){ st.hp += w*1.3; st.gold += Math.floor(w/2); st.heal += Math.floor(w/5); }
    else if(type==='boss'){ st.hp += w*20; st.gold += w*2; }
    else if(type==='flyer'){ st.hp += w*1.4; st.gold += Math.floor(w/2); }
    else if(type==='bomb'){ st.hp += w*2; st.gold += Math.floor(w/2); }
    st.hp = Math.round(st.hp * diff.enemyHpMult);
    st.speed = Math.round(st.speed * diff.enemySpeedMult);
    st.gold = Math.round(st.gold * (game.difficulty==='easy'?0.8:game.difficulty==='hard'?1.3:1));
    this.type=type; this.pathIndex=pathIdx;
    const p = pathIdx===0 ? path1 : path2;
    this.x=p[0].x; this.y=p[0].y;
    this.hp=st.hp; this.maxHp=st.hp; this.baseSpeed=st.speed; this.speed=st.speed;
    this.index=0; this.dead=false; this.reachedEnd=false; this.gold=st.gold;
    this.color=st.color; this.size=st.size; this.healAmount=st.heal||0; this.healRange=st.healRange||0;
    this.airborne=st.airborne||false; this.slowEffects=[]; this.animation=0; this.rotation=0;
    this.bomb=st.bomb||false; this.exploded=false;
    this.path=p; this._dots=[];
  }
  update(dt) {
    if(this.dead) return;
    this.animation += dt;
    if(this.type==='healer') this.healNearby();
    let mult=1;
    for(let i=this.slowEffects.length-1;i>=0;i--){ const s=this.slowEffects[i]; s.time-=dt; if(s.time<=0) this.slowEffects.splice(i,1); else mult*=(1-s.mult); }
    this.speed = this.baseSpeed * mult;
    if(this.bomb && !this.exploded) {
      let nearestTower = null, nearestDist = Infinity;
      for(const t of game.towers) {
        const d = Math.hypot(t.x-this.x, t.y-this.y);
        if(d < nearestDist) { nearestDist = d; nearestTower = t; }
      }
      if(nearestTower && nearestDist < 40) { this.explode(); return; }
    }
    const next = this.path[this.index+1];
    if(!next){ this.reachedEnd=true; this.dead=true; game.health = Math.max(0, game.health - (this.type==='boss'?5:1)); spawnParticles(this.x,this.y,'#ff7b7b',18); return; }
    const dx=next.x-this.x, dy=next.y-this.y, dist=Math.hypot(dx,dy);
    this.rotation=Math.atan2(dy,dx);
    if(dist<4){ this.index++; return; }
    this.x += (dx/dist)*this.speed*dt; this.y += (dy/dist)*this.speed*dt;
    if(this.hp<=0){ this.dead=true; spawnParticles(this.x,this.y,'#ffef9e',20); game.money += this.gold; game.totalMoneyEarned += this.gold; game.enemiesDefeated++; }
    for(let i=this._dots.length-1;i>=0;i--){ const d=this._dots[i]; d.tickTimer-=dt; d.time-=dt; if(d.tickTimer<=0){ this.hp-=d.amt; d.tickTimer=d.tickInterval; spawnParticles(this.x,this.y-8,'#ff8f66',3); } if(d.time<=0) this._dots.splice(i,1); }
  }
  explode() {
    if(this.exploded) return;
    this.exploded = true;
    this.dead = true;
    const blastRadius = 5 * TILE / 2;
    spawnParticles(this.x, this.y, '#ff6600', 50);
    spawnParticles(this.x, this.y, '#ffaa00', 30);
    spawnParticles(this.x, this.y, '#ff4400', 20);
    for(let i=game.towers.length-1; i>=0; i--) {
      const t = game.towers[i];
      if(Math.hypot(t.x-this.x, t.y-this.y) < blastRadius) {
        spawnParticles(t.x, t.y, '#ff4444', 22);
        const tx = Math.floor(t.x/TILE), ty = Math.floor(t.y/TILE);
        if(tileMap[ty]?.[tx]) tileMap[ty][tx] = {type:'grass', walkable:true, grassVariant:(tx+ty)%4};
        game.towers.splice(i,1);
      }
    }
    for(let i=game.enemies.length-1; i>=0; i--) {
      const e = game.enemies[i];
      if(e === this || e.dead) continue;
      if(Math.hypot(e.x-this.x, e.y-this.y) < blastRadius) {
        e.hp -= 150;
        if(e.hp <= 0) { e.dead = true; game.money += e.gold; game.enemiesDefeated++; spawnParticles(e.x, e.y, '#ffaa00', 14); }
      }
    }
    game.projectiles = game.projectiles.filter(p => Math.hypot(p.x-this.x, p.y-this.y) > blastRadius);
    if(game.selectedTower && !game.towers.includes(game.selectedTower)) {
      game.selectedTower = null;
      updateTowerActionPanel();
    }
  }
  healNearby(){
    for(const e of game.enemies){
      if(e===this || e.dead) continue;
      if(Math.hypot(e.x-this.x, e.y-this.y) < this.healRange){ e.hp = Math.min(e.maxHp, e.hp + this.healAmount*0.05); if(Math.random()<0.3) spawnParticles(e.x,e.y-8,'#a6f7c5',2); }
    }
  }
  progressScore(){ const n=this.path[this.index+1]||this.path[this.path.length-1]; return this.index*10000 - Math.hypot(n.x-this.x, n.y-this.y); }
  
  draw(){
    ctx.save();
    ctx.translate(this.x, this.y);
    if(!this.airborne) {
      ctx.beginPath();
      ctx.ellipse(2, 4, this.size*0.9, this.size*0.5, 0, 0, Math.PI*2);
      ctx.fillStyle = '#00000055';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(4, 12, this.size*0.6, this.size*0.3, 0, 0, Math.PI*2);
      ctx.fillStyle = '#00000033';
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    if(this.type === 'boss') {
      ctx.shadowColor = '#ff4444aa';
      ctx.shadowBlur = 30;
    } else if(this.type === 'bomb') {
      ctx.shadowColor = '#ff8800aa';
      ctx.shadowBlur = 24;
      const pulse = 1 + Math.sin(this.animation*8)*0.1;
      ctx.scale(pulse, pulse);
    } else if(this.type === 'healer') {
      ctx.shadowColor = '#6ad06aaa';
      ctx.shadowBlur = 20;
    } else if(this.type === 'flyer') {
      ctx.shadowColor = '#c090e0aa';
      ctx.shadowBlur = 18;
    }
    if(this.type==='runner'){
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(this.size, 0);
      ctx.quadraticCurveTo(this.size*0.4, -this.size*0.9, -this.size*0.8, -this.size*0.5);
      ctx.quadraticCurveTo(-this.size*1.1, 0, -this.size*0.8, this.size*0.5);
      ctx.quadraticCurveTo(this.size*0.4, this.size*0.9, this.size, 0);
      ctx.fill();
      ctx.fillStyle = '#ff4500';
      ctx.beginPath(); ctx.ellipse(-this.size*0.1, 0, this.size*0.45, this.size*0.25, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff99';
      ctx.beginPath(); ctx.arc(this.size*0.35, -this.size*0.2, 2.5, 0, Math.PI*2); ctx.fill();
    }
    else if(this.type==='tank'){
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.roundRect(-this.size*1.1, -this.size*0.8, this.size*2.2, this.size*1.6, 4);
      ctx.fill();
      ctx.fillStyle = '#3a4a4a';
      ctx.beginPath();
      ctx.ellipse(0, -this.size*0.6, this.size*0.7, this.size*0.45, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#1a2a2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-this.size*0.4, -this.size*0.95); ctx.lineTo(-this.size*0.4, -this.size*0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this.size*0.4, -this.size*0.95); ctx.lineTo(this.size*0.4, -this.size*0.2); ctx.stroke();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.roundRect(-this.size*1.1, this.size*0.5, this.size*2.2, this.size*0.35, 3); ctx.fill();
      ctx.fillStyle = '#8a8a8a';
      for(let i=-1;i<=1;i+=2) { ctx.beginPath(); ctx.arc(i*this.size*0.55, this.size*0.65, 2.5, 0, Math.PI*2); ctx.fill(); }
    }
    else if(this.type==='healer'){
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size*0.9, this.size*1.1, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-this.size*0.2, -this.size*0.85, this.size*0.4, this.size*1.7, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-this.size*0.75, -this.size*0.25, this.size*1.5, this.size*0.5, 3);
      ctx.fill();
      ctx.strokeStyle = '#a6f7c5'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, this.size+5, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#a6f7c5';
      ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI*2); ctx.fill();
    }
    else if(this.type==='boss'){
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(0, 0, this.size+6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffd700';
      ctx.beginPath(); ctx.arc(-this.size*0.5, -this.size*0.5, this.size*0.35, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(this.size*0.5, -this.size*0.5, this.size*0.35, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#6a1a1a';
      ctx.beginPath();
      ctx.moveTo(-this.size*0.9, -this.size*0.9);
      ctx.lineTo(-this.size*1.5, -this.size*2.0);
      ctx.lineTo(-this.size*0.4, -this.size*1.0);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(this.size*0.9, -this.size*0.9);
      ctx.lineTo(this.size*1.5, -this.size*2.0);
      ctx.lineTo(this.size*0.4, -this.size*1.0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff0000';
      ctx.beginPath(); ctx.arc(-this.size*0.4, -this.size*0.3, 4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(this.size*0.4, -this.size*0.3, 4, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, this.size+10, 0, Math.PI*2); ctx.stroke();
    }
    else if(this.type==='flyer'){
      const wy = Math.sin(this.animation*10)*4;
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.ellipse(0, 0, this.size*0.8, this.size, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#dda0dd';
      ctx.beginPath();
      ctx.ellipse(-this.size*0.8, wy-2, this.size*0.9, this.size*0.3, -0.3, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(this.size*0.8, wy-2, this.size*0.9, this.size*0.3, 0.3, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#ffffff44';
      ctx.beginPath();
      ctx.ellipse(-this.size*1.2, wy-4, this.size*0.4, this.size*0.15, -0.3, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-this.size*0.25, -this.size*0.3, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(this.size*0.25, -this.size*0.3, 2, 0, Math.PI*2); ctx.fill();
    }
    else if(this.type==='bomb'){
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ff2200';
      ctx.beginPath(); ctx.arc(0, 0, this.size*0.45, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffcc00';
      for(let i=0;i<8;i++){
        const a = i*Math.PI/4 + this.animation*8;
        ctx.beginPath();
        ctx.arc(Math.cos(a)*this.size*0.85, Math.sin(a)*this.size*0.85, 2.5, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, this.size*0.7, 0, Math.PI*2); ctx.stroke();
    }
    else {
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.ellipse(0, 0, this.size*0.9, this.size, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#a0522d';
      ctx.beginPath(); ctx.ellipse(0, this.size*0.1, this.size*0.5, this.size*0.55, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff33';
      ctx.beginPath(); ctx.arc(-this.size*0.3, -this.size*0.3, this.size*0.25, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-this.size*0.2, -this.size*0.25, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(this.size*0.2, -this.size*0.25, 2, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();

    const bw=38, bh=6, by=this.y-this.size-14;
    ctx.fillStyle='#00000099'; ctx.fillRect(this.x-bw/2-2, by-2, bw+4, bh+4);
    const hp = this.hp/this.maxHp;
    const grad = ctx.createLinearGradient(this.x-bw/2, by, this.x+bw/2, by);
    if(hp>0.5) { grad.addColorStop(0,'#4caf50'); grad.addColorStop(1,'#8bc34a'); }
    else if(hp>0.25) { grad.addColorStop(0,'#ffb300'); grad.addColorStop(1,'#ffca28'); }
    else { grad.addColorStop(0,'#e53935'); grad.addColorStop(1,'#ef5350'); }
    ctx.fillStyle = grad;
    ctx.fillRect(this.x-bw/2, by, bw*hp, bh);
    ctx.strokeStyle = '#ffffff33'; ctx.lineWidth = 1; ctx.strokeRect(this.x-bw/2, by, bw, bh);
    if(this.type==='boss'){ ctx.fillStyle='#fff'; ctx.font='bold 13px Inter'; ctx.textAlign='center'; ctx.shadowColor='#000'; ctx.shadowBlur=8; ctx.fillText(`BOSS ${Math.ceil(this.hp)}`, this.x, by-8); ctx.shadowBlur=0; }
    if(this.type==='bomb'){ ctx.fillStyle='#ffaa00'; ctx.font='bold 12px Inter'; ctx.textAlign='center'; ctx.shadowColor='#000'; ctx.shadowBlur=8; ctx.fillText(`💣 BOMB`, this.x, by-8); ctx.shadowBlur=0; }
  }
}

class Tower {
  constructor(x,y,type, level=0){ this.x=x; this.y=y; this.type=type; this.level=level; this.totalSpent=getTowerCost(type); this.applyStats(); this.cooldown=0; this.deleted=false; this.animation=0; this.lastShot=0; }
  applyStats(){ const s=TOWER_STATS[this.type][this.level]; this.range=s.range; this.dmg=s.dmg; this.firerate=s.firerate; this.slow=s.slow||0; this.aoe=s.aoe||0; this.dot=s.dot||0; this.dotDuration=s.dotDuration||0; this.chain=s.chain||0; this.chainRange=s.chainRange||0; this.color=s.color; }
  upgrade(){ if(this.level < 2){ this.level++; this.applyStats(); return true; } return false; }
  sellValue(){ return Math.floor(this.totalSpent * 0.6); }
  update(dt){
    this.animation+=dt; this.lastShot+=dt;
    if(this.cooldown>0){ this.cooldown-=dt; return; }
    let best=null, bestScore=-Infinity;
    for(const e of game.enemies){
      if(e.dead||e.reachedEnd) continue;
      const d=Math.hypot(e.x-this.x, e.y-this.y);
      if(d<=this.range){ const sc=e.progressScore(); if(sc>bestScore){ bestScore=sc; best=e; } }
    }
    if(!best) return;
    if(this.cooldown<=0){ game.projectiles.push(new Projectile(this,best)); this.cooldown=1/this.firerate; this.lastShot=0; }
  }
  draw(){
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(this.x+3, this.y+6, 22, 11, 0, 0, Math.PI*2);
    ctx.fillStyle = '#00000055';
    ctx.fill();
    ctx.restore();

    ctx.save(); ctx.translate(this.x,this.y);

    const baseGrd = ctx.createRadialGradient(-6,-6,4, 0,0,24);
    baseGrd.addColorStop(0, '#7a6a5a');
    baseGrd.addColorStop(0.6, '#4a3a2a');
    baseGrd.addColorStop(1, '#1a0e0a');
    ctx.fillStyle = baseGrd;
    ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#a09080'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0,0,16,0,Math.PI*2); ctx.stroke();

    const off = Math.sin(this.animation*4)*1.5;
    const time = this.animation;

    if(this.type === 'basic') {
      const bodyGrd = ctx.createLinearGradient(-12,-30, 12,-10);
      bodyGrd.addColorStop(0, '#c0d4ee');
      bodyGrd.addColorStop(0.5, '#a0b8d4');
      bodyGrd.addColorStop(1, '#8098b4');
      ctx.fillStyle = bodyGrd;
      ctx.beginPath();
      ctx.moveTo(-12, -10);
      ctx.lineTo(-10, -32);
      ctx.quadraticCurveTo(0, -40, 10, -32);
      ctx.lineTo(12, -10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff33';
      ctx.beginPath();
      ctx.moveTo(-8, -12);
      ctx.lineTo(-6, -30);
      ctx.quadraticCurveTo(0, -34, 2, -30);
      ctx.lineTo(2, -12);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.rotate(Math.sin(time*0.5)*0.3);
      const barrelGrd = ctx.createLinearGradient(0,-28, 18,-28);
      barrelGrd.addColorStop(0, '#5a6a7a');
      barrelGrd.addColorStop(1, '#2a3a4a');
      ctx.fillStyle = barrelGrd;
      ctx.fillRect(2, -26, 18+off, 8);
      ctx.fillStyle = '#8a9aaa';
      ctx.beginPath(); ctx.arc(20+off, -22, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffd966';
      ctx.beginPath(); ctx.arc(20+off, -22, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#6a5a4a';
      ctx.beginPath(); ctx.arc(0, -34, 8, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#8a7a6a';
      ctx.beginPath(); ctx.arc(0, -34, 5, 0, Math.PI); ctx.fill();
    }
    else if(this.type === 'sniper') {
      const pillarGrd = ctx.createLinearGradient(-8,-48, 8,-16);
      pillarGrd.addColorStop(0, '#b0c0d0');
      pillarGrd.addColorStop(0.5, '#8a9aaa');
      pillarGrd.addColorStop(1, '#5a6a7a');
      ctx.fillStyle = pillarGrd;
      ctx.beginPath();
      ctx.moveTo(-8, -16);
      ctx.lineTo(-6, -44);
      ctx.quadraticCurveTo(0, -50, 6, -44);
      ctx.lineTo(8, -16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff22';
      ctx.fillRect(-4, -42, 3, 26);
      ctx.strokeStyle = '#4a5a6a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(6, -30); ctx.stroke();
      ctx.fillStyle = '#2a3a4a';
      ctx.beginPath(); ctx.arc(0, -40, 7, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1a1a2a';
      ctx.beginPath(); ctx.arc(0, -40, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ff4444';
      ctx.beginPath(); ctx.arc(0, -40, 1.5, 0, Math.PI*2); ctx.fill();
      ctx.save();
      ctx.rotate(Math.sin(time*0.4)*0.2);
      const barrelGrd2 = ctx.createLinearGradient(2,-38, 30,-38);
      barrelGrd2.addColorStop(0, '#3a4a5a');
      barrelGrd2.addColorStop(1, '#1a2a3a');
      ctx.fillStyle = barrelGrd2;
      ctx.fillRect(2, -38, 28+off, 6);
      ctx.fillStyle = '#6a7a8a';
      ctx.beginPath(); ctx.arc(30+off, -35, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffd966';
      ctx.beginPath(); ctx.arc(30+off, -35, 2, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    else if(this.type === 'frost') {
      const crystalGrd = ctx.createLinearGradient(-10,-40, 10,-10);
      crystalGrd.addColorStop(0, '#e0f8ff');
      crystalGrd.addColorStop(0.5, '#b0e8f0');
      crystalGrd.addColorStop(1, '#80c8d8');
      ctx.fillStyle = crystalGrd;
      ctx.beginPath();
      ctx.moveTo(0, -42);
      ctx.lineTo(12, -24);
      ctx.lineTo(8, -10);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-12, -24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff55';
      ctx.beginPath();
      ctx.moveTo(0, -42);
      ctx.lineTo(6, -24);
      ctx.lineTo(0, -14);
      ctx.lineTo(-6, -24);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.rotate(time*0.8);
      for(let i=0;i<6;i++){
        const a = i*Math.PI/3;
        const sx = Math.cos(a)*14, sy = Math.sin(a)*14 - 8;
        ctx.fillStyle = '#d0f0ff';
        ctx.beginPath();
        ctx.moveTo(sx, sy-6);
        ctx.lineTo(sx+4, sy);
        ctx.lineTo(sx, sy+6);
        ctx.lineTo(sx-4, sy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.shadowColor = '#b0e8f0'; ctx.shadowBlur = 25;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, -24, 6, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff88';
      for(let i=0;i<4;i++){
        const a = time*3 + i*Math.PI/2;
        ctx.beginPath();
        ctx.arc(Math.cos(a)*18, -20+Math.sin(a)*10, 2.5, 0, Math.PI*2);
        ctx.fill();
      }
    }
    else if(this.type === 'bomb') {
      const bombGrd = ctx.createRadialGradient(-6,-30,4, 0,-24,20);
      bombGrd.addColorStop(0, '#ffe97a');
      bombGrd.addColorStop(0.5, '#ffd966');
      bombGrd.addColorStop(1, '#cc9900');
      ctx.fillStyle = bombGrd;
      ctx.beginPath(); ctx.arc(0, -24, 19, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -24, 14, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#a08a5a';
      for(let i=0;i<8;i++){
        const a = i*Math.PI/4;
        ctx.beginPath(); ctx.arc(Math.cos(a)*14, -24+Math.sin(a)*14, 2, 0, Math.PI*2); ctx.fill();
      }
      ctx.save();
      ctx.rotate(Math.sin(time*0.6)*0.15);
      const mortarGrd = ctx.createLinearGradient(0,-38, 20,-38);
      mortarGrd.addColorStop(0, '#6a5a4a');
      mortarGrd.addColorStop(1, '#3a2a1a');
      ctx.fillStyle = mortarGrd;
      ctx.beginPath();
      ctx.moveTo(4, -36);
      ctx.lineTo(20+off, -34);
      ctx.lineTo(22+off, -28);
      ctx.lineTo(4, -30);
      ctx.closePath();
      ctx.fill();
      if(this.lastShot < 0.12){
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath(); ctx.arc(22+off, -31, 6, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffdd66';
        ctx.beginPath(); ctx.arc(22+off, -31, 3, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -42);
      ctx.quadraticCurveTo(8, -52, 12, -48);
      ctx.stroke();
      if(Math.random() < 0.4){
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.arc(12 + Math.random()*4, -48 + Math.random()*4, 2.5, 0, Math.PI*2); ctx.fill();
      }
    }
    else if(this.type === 'flame') {
      const flameGrd = ctx.createLinearGradient(-16,-30, 16,-6);
      flameGrd.addColorStop(0, '#ff8a5a');
      flameGrd.addColorStop(0.5, '#e05a2a');
      flameGrd.addColorStop(1, '#a03a1a');
      ctx.fillStyle = flameGrd;
      ctx.beginPath();
      ctx.moveTo(-16, -8);
      ctx.lineTo(-12, -30);
      ctx.quadraticCurveTo(0, -38, 12, -30);
      ctx.lineTo(16, -8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3a1a0a';
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(-6, -22);
      ctx.quadraticCurveTo(0, -26, 6, -22);
      ctx.lineTo(8, -8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.ellipse(0, -16, 5, 4 + Math.sin(time*6)*1.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(0, -16, 2, 2, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#4a2a1a';
      ctx.fillRect(-5, -36, 10, 8);
      ctx.fillStyle = '#88888866';
      for(let i=0;i<3;i++){
        const smokeY = -40 - i*8 - (time*20 % 24);
        ctx.beginPath(); ctx.arc(Math.sin(time*2+i)*6, smokeY, 4+i, 0, Math.PI*2); ctx.fill();
      }
    }
    else if(this.type === 'tesla') {
      const teslaGrd = ctx.createLinearGradient(-10,-40, 10,-10);
      teslaGrd.addColorStop(0, '#d0a0f0');
      teslaGrd.addColorStop(0.5, '#b080d0');
      teslaGrd.addColorStop(1, '#8050a0');
      ctx.fillStyle = teslaGrd;
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(-8, -36);
      ctx.quadraticCurveTo(0, -44, 8, -36);
      ctx.lineTo(10, -10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e0c0ff'; ctx.lineWidth = 2.5;
      for(let i=0;i<5;i++){
        const y = -16 - i*6;
        ctx.beginPath();
        ctx.ellipse(0, y, 12 - i*0.8, 4, 0, 0, Math.PI*2);
        ctx.stroke();
      }
      const orbGrd = ctx.createRadialGradient(-2,-38,2, 0,-38,10);
      orbGrd.addColorStop(0, '#ffffff');
      orbGrd.addColorStop(0.5, '#d0a0f0');
      orbGrd.addColorStop(1, '#8050a0');
      ctx.fillStyle = orbGrd;
      ctx.beginPath(); ctx.arc(0, -38, 9, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#e0c0ff'; ctx.lineWidth = 1.5;
      for(let i=0;i<3;i++){
        const a = time*4 + i*2.1;
        const r1 = 12, r2 = 22;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a)*r1, -38+Math.sin(a)*r1);
        ctx.lineTo(Math.cos(a+0.5)*r2 + (Math.random()-0.5)*6, -38+Math.sin(a+0.5)*r2 + (Math.random()-0.5)*6);
        ctx.stroke();
      }
      if(Math.random() < 0.5){
        ctx.fillStyle = '#ffffff';
        const a = Math.random()*Math.PI*2;
        ctx.beginPath(); ctx.arc(Math.cos(a)*20, -38+Math.sin(a)*20, 2, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    if(game.selectedTower===this){ 
      ctx.beginPath(); ctx.strokeStyle='#ffd966cc'; ctx.lineWidth=3; 
      ctx.arc(this.x,this.y,this.range,0,Math.PI*2); ctx.stroke(); 
      ctx.beginPath(); ctx.strokeStyle='#ffd96644'; ctx.lineWidth=1; 
      ctx.arc(this.x,this.y,this.range+4,0,Math.PI*2); ctx.stroke(); 
    }
    ctx.fillStyle='#ffd966'; ctx.font='bold 12px Inter'; ctx.textAlign='center'; 
    ctx.shadowColor='#000'; ctx.shadowBlur=6; 
    ctx.fillText(`L${this.level+1}`, this.x, this.y+38); 
    ctx.shadowBlur=0;
  }
}

class Projectile {
  constructor(tower,target){
    this.x=tower.x; this.y=tower.y; this.target=target; this.tower=tower;
    this.dmg=tower.dmg; this.slow=tower.slow; this.aoe=tower.aoe; this.dot=tower.dot; this.dotDuration=tower.dotDuration;
    this.chain=tower.chain; this.chainRange=tower.chainRange; this.speed=480; this.dead=false;
    this.color=this.aoe?'#ffd700':this.slow?'#87ceeb':this.dot?'#ff6a3a':this.chain?'#b080d0':'#ffffff';
    this.size=this.aoe?9:this.chain?7:6; this.trail=[];
  }
  update(dt){
    this.trail.push({x:this.x,y:this.y}); if(this.trail.length>6) this.trail.shift();
    if(this.target.dead||this.target.reachedEnd){ this.dead=true; return; }
    const dx=this.target.x-this.x, dy=this.target.y-this.y, dist=Math.hypot(dx,dy);
    if(dist<10){ this.hit(); this.dead=true; return; }
    this.x += (dx/dist)*this.speed*dt; this.y += (dy/dist)*this.speed*dt;
  }
  hit(){
    if(this.aoe>0){
      for(const e of game.enemies){ if(e.dead||e.reachedEnd) continue; if(Math.hypot(e.x-this.x, e.y-this.y)<this.aoe){ e.hp-=this.dmg; if(this.dot) applyDot(e,this.dot,this.dotDuration); } }
      spawnParticles(this.x,this.y,'#ffd700',28);
    } else if(this.chain>0){
      let current=this.target, left=this.chain, chained=new Set([current]);
      while(left>0 && current){
        if(current && !current.dead&&!current.reachedEnd){ current.hp-=this.dmg; if(left===this.chain) drawLightningFromTower(this.tower,current); }
        let next=null, close=Infinity;
        for(const e of game.enemies){ if(!chained.has(e)&&!e.dead&&!e.reachedEnd){ const d=current?Math.hypot(e.x-current.x,e.y-current.y):Infinity; if(d<this.chainRange && d<close){ close=d; next=e; } } }
        if(next){ if(current && next) drawLightning(current,next); chained.add(next); current=next; left--; } else break;
      }
      spawnParticles(this.x,this.y,'#b080d0',12);
    } else {
      if(this.target && !this.target.dead&&!this.target.reachedEnd){
        this.target.hp-=this.dmg;
        if(this.slow>0) this.target.slowEffects.push({mult:this.slow, time:1.5});
        if(this.dot) applyDot(this.target,this.dot,this.dotDuration);
        spawnParticles(this.target.x,this.target.y,this.color,10);
      }
    }
    showDamageNumber(this.x, this.y-18, this.dmg);
  }
  draw(){
    for(let i=0;i<this.trail.length;i++){ const p=this.trail[i]; const alpha = i/this.trail.length*0.6; ctx.fillStyle=`rgba(255,255,255,${alpha})`; ctx.beginPath(); ctx.arc(p.x,p.y,this.size*(i/this.trail.length)*1.2,0,Math.PI*2); ctx.fill(); }
    ctx.shadowColor=this.color; ctx.shadowBlur=18;
    ctx.fillStyle=this.color; ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(this.x,this.y,this.size*0.4,0,Math.PI*2); ctx.fill();
  }
}

function applyDot(enemy, amt, dur){ enemy._dots.push({amt, time:dur, tickInterval:0.3, tickTimer:0}); }
function drawLightningFromTower(tower, target){ if(!tower||!target) return; const pts=[{x:tower.x,y:tower.y}]; for(let i=1;i<6;i++){ const t=i/6; pts.push({x:tower.x+(target.x-tower.x)*t+(Math.random()-0.5)*8, y:tower.y+(target.y-tower.y)*t+(Math.random()-0.5)*8}); } pts.push({x:target.x,y:target.y}); ctx.strokeStyle='#b080d0'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y); ctx.stroke(); ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y); ctx.stroke(); }
function drawLightning(a,b){ const pts=[{x:a.x,y:a.y}]; for(let i=1;i<6;i++){ const t=i/6; pts.push({x:a.x+(b.x-a.x)*t+(Math.random()-0.5)*10, y:a.y+(b.y-a.y)*t+(Math.random()-0.5)*10}); } pts.push({x:b.x,y:b.y}); ctx.strokeStyle='#b080d0'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y); ctx.stroke(); ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y); ctx.stroke(); }

const damageNumbers=[];
function showDamageNumber(x,y,amount,color=null){ damageNumbers.push({x,y,value:amount,life:1.2,velocity:{x:(Math.random()-0.5)*40,y:-60},color:color||(amount>40?'#ff6b6b':amount>20?'#ffb347':'#ffffff')}); }
function updateDamageNumbers(dt){ for(let i=damageNumbers.length-1;i>=0;i--){ const n=damageNumbers[i]; n.x+=n.velocity.x*dt; n.y+=n.velocity.y*dt; n.life-=dt; n.velocity.y+=90*dt; if(n.life<=0) damageNumbers.splice(i,1); } }
function drawDamageNumbers(){ for(const n of damageNumbers){ ctx.save(); ctx.globalAlpha=n.life; ctx.fillStyle=n.color; ctx.font=`bold ${18+(1-n.life)*8}px Inter`; ctx.textAlign='center'; ctx.shadowColor='#000000cc'; ctx.shadowBlur=8; ctx.fillText(`-${Math.round(n.value)}`, n.x, n.y); ctx.restore(); } }

function spawnParticles(x,y,color,count=12){ for(let i=0;i<count;i++){ const a=Math.random()*Math.PI*2, sp=2+Math.random()*8; game.particles.push({x,y,dx:Math.cos(a)*sp,dy:Math.sin(a)*sp,life:0.4+Math.random()*0.8,color,size:3+Math.random()*5,rotation:Math.random()*Math.PI*2,rotationSpeed:(Math.random()-0.5)*12}); } }
function updateParticles(dt){ for(const p of game.particles){ p.x+=p.dx; p.y+=p.dy; p.life-=dt; p.rotation+=p.rotationSpeed*dt; p.dy+=110*dt; } game.particles=game.particles.filter(p=>p.life>0); }
function drawParticles(){ for(const p of game.particles){ ctx.save(); ctx.globalAlpha=p.life; ctx.fillStyle=p.color; ctx.shadowColor=p.color; ctx.shadowBlur=10; ctx.translate(p.x,p.y); ctx.rotate(p.rotation); ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size); ctx.restore(); } ctx.globalAlpha=1; ctx.shadowBlur=0; }

function getCurrentMapStyle(){ return game.mapStyles[game.currentMap] || game.mapStyles.forest; }
function drawTiles(){
  const style=getCurrentMapStyle();
  ctx.fillStyle=style.bgColor; ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
    const tile=tileMap[y][x], xp=x*TILE, yp=y*TILE;
    if(tile.type==='grass'){
      const v=tile.grassVariant||0;
      const grd = ctx.createLinearGradient(xp,yp,xp+TILE,yp+TILE);
      const base = style.grassPatterns[v%2];
      grd.addColorStop(0, base[0]);
      grd.addColorStop(0.5, base[1]);
      grd.addColorStop(1, base[2]);
      ctx.fillStyle = grd;
    } else {
      const grd = ctx.createLinearGradient(xp,yp,xp+TILE,yp+TILE);
      const base = style.pathPatterns;
      grd.addColorStop(0, base[0]);
      grd.addColorStop(0.4, base[1]);
      grd.addColorStop(0.7, base[2]);
      grd.addColorStop(1, base[3]);
      ctx.fillStyle = grd;
    }
    ctx.fillRect(xp,yp,TILE,TILE);
    if(tile.type==='grass'){
      ctx.fillStyle='rgba(255,255,255,0.06)';
      for(let i=0;i<4;i++){ const tx=xp+ (Math.sin(x*7+y*3+i)*16+16)%TILE, ty=yp+ (Math.cos(x*5+y*7+i)*16+16)%TILE; ctx.fillRect(tx,ty,2,2); }
    } else {
      ctx.fillStyle='rgba(0,0,0,0.1)';
      for(let sy=0;sy<TILE;sy+=10) for(let sx=0;sx<TILE;sx+=10) if((x+y+Math.floor(sx/10)+Math.floor(sy/10))%2===0) ctx.fillRect(xp+sx+2,yp+sy+2,8,8);
    }
    ctx.strokeStyle=style.tileBorder; ctx.lineWidth=0.8; ctx.strokeRect(xp,yp,TILE,TILE);
  }
  ctx.strokeStyle=style.pathOutline; ctx.lineWidth=2;
  [pathTiles1,pathTiles2].forEach(path=>{ path.forEach(t=>{ const xp=t.x*TILE, yp=t.y*TILE; ctx.strokeRect(xp,yp,TILE,TILE); }); });
}

function startWave(){
  if(game.waveInProgress||game.gameOver||game.victory) return;
  let base=8+Math.floor(game.wave*0.8);
  const diff = DIFFICULTY[game.difficulty];
  game.toSpawn=Math.min(base,40); game.spawnTimer=0; game.waveInProgress=true;
  game.spawnInterval = 1.0 / diff.spawnRateMult;
}
function spawnEnemy(){
  let type='normal'; const r=Math.random(), w=game.wave;
  const diff = DIFFICULTY[game.difficulty];
  if(w >= diff.bombWave && r < 0.08) type='bomb';
  else if(w>=15 && r<0.05) type='boss';
  else if(w>=12 && r<0.15) type='flyer';
  else if(w>=8 && r<0.30) type='healer';
  else if(w>=4 && r<0.50) type='tank';
  else if(r<0.70) type='runner';
  const pathIdx=Math.random()<0.5?0:1;
  game.enemies.push(new Enemy(type,pathIdx));
}

function togglePause(){ if(game.gameOver||game.victory) return; game.paused=!game.paused; document.getElementById('pauseBtn').textContent=game.paused?'▶ RESUME':'⏸ PAUSE'; }

function showHomeScreen(){
  document.getElementById('homeScreen').style.display='flex';
  document.getElementById('mapSelection').style.display='none';
  document.getElementById('difficultyScreen').style.display='none';
  document.getElementById('gameContainer').style.display='none';
  document.getElementById('ui').style.display='none';
  restartGame();
}
function showDifficultySelection(){
  document.getElementById('homeScreen').style.display='none';
  document.getElementById('difficultyScreen').style.display='flex';
  document.getElementById('mapSelection').style.display='none';
  document.getElementById('gameContainer').style.display='none';
  document.getElementById('ui').style.display='none';
}
function showMapSelectionFromDiff(){
  document.getElementById('difficultyScreen').style.display='none';
  document.getElementById('mapSelection').style.display='flex';
}
function selectDifficulty(diff, ev){
  game.difficulty = diff;
  document.querySelectorAll('.diff-option').forEach(o=>o.classList.remove('active'));
  if(ev?.currentTarget) ev.currentTarget.classList.add('active');
  document.getElementById('currentDiffName').textContent = diff.charAt(0).toUpperCase()+diff.slice(1);
}
function showMapSelection(){
  document.getElementById('homeScreen').style.display='none';
  document.getElementById('difficultyScreen').style.display='none';
  document.getElementById('mapSelection').style.display='flex';
  document.getElementById('gameContainer').style.display='none';
  document.getElementById('ui').style.display='none';
}
function selectMap(name, ev){
  game.currentMap=name;
  document.querySelectorAll('.map-option').forEach(o=>o.classList.remove('active'));
  if(ev?.currentTarget) ev.currentTarget.classList.add('active');
  document.getElementById('currentMapName').textContent=name.charAt(0).toUpperCase()+name.slice(1);
}
function startGameWithMap(){
  document.getElementById('homeScreen').style.display='none';
  document.getElementById('mapSelection').style.display='none';
  document.getElementById('difficultyScreen').style.display='none';
  document.getElementById('gameContainer').style.display='inline-block';
  document.getElementById('ui').style.display='block';
  const name=game.currentMap;
  document.getElementById('currentMapName').textContent=name.charAt(0).toUpperCase()+name.slice(1);
  document.getElementById('currentDiffName').textContent = game.difficulty.charAt(0).toUpperCase()+game.difficulty.slice(1);
  initTileMap();
  restartGame();
  updateTowerCostsDisplay();
}
function showInstructions(){ alert("Tower Defense\n\n 1. Click a tower → click grass to build\n 2. Click a built tower to upgrade or sell\n 3. P to pause, ESC to cancel\n 4. Start waves manually or auto\n 5. 50 waves · difficulty changes costs & enemies\n 6. Bombs may destroy your towers."); }

function updateTowerCostsDisplay() {
  for(const type of Object.keys(TOWER_STATS)) {
    const el = document.getElementById('cost-'+type);
    if(el) el.textContent = '$' + getTowerCost(type);
  }
}

function restartGame(){
  const diff = DIFFICULTY[game.difficulty];
  game.wave=1; game.money=diff.startMoney; game.health=20; game.enemies=[]; game.towers=[]; game.projectiles=[]; game.particles=[]; game.placing=null; game.selectedTower=null; game.toSpawn=0; game.waveInProgress=false; game.paused=false; game.gameOver=false; game.victory=false; game.enemiesDefeated=0; game.totalMoneyEarned=0;
  game.spawnInterval = 1.0 / diff.spawnRateMult;
  initTileMap();
  damageNumbers.length=0;
  document.getElementById('gameOver').style.display='none';
  document.getElementById('victoryScreen').style.display='none';
  updateTowerButtons();
  document.getElementById('pauseBtn').textContent='⏸ PAUSE';
  updateTowerActionPanel();
  updateTowerCostsDisplay();
}

function selectTower(type){ game.placing=type; game.selectedTower=null; updateTowerButtons(); updateTowerActionPanel(); }
function updateTowerButtons(){
  document.querySelectorAll('.towerButton').forEach(b=>b.classList.remove('tower-button-active'));
  if(game.placing){ const b=document.getElementById(`towerBtn-${game.placing}`); if(b) b.classList.add('tower-button-active'); }
}

function updateTowerActionPanel() {
  const panel = document.getElementById('towerActionPanel');
  const sel = game.selectedTower;
  if(!sel || !game.towers.includes(sel)) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  document.getElementById('selectedTowerType').textContent = sel.type.charAt(0).toUpperCase()+sel.type.slice(1);
  document.getElementById('selLevel').textContent = sel.level + 1;
  document.getElementById('selDmg').textContent = sel.dmg;
  document.getElementById('selRange').textContent = sel.range;
  const upgradeBtn = document.getElementById('upgradeBtn');
  const sellBtn = document.getElementById('sellBtn');
  const upgradeCostSpan = document.getElementById('upgradeCost');
  const sellValueSpan = document.getElementById('sellValue');
  if(sel.level >= 2) { upgradeBtn.disabled = true; upgradeBtn.style.opacity = 0.5; upgradeCostSpan.textContent = 'MAX'; }
  else { upgradeBtn.disabled = false; upgradeBtn.style.opacity = 1; const nextCost = Math.round(TOWER_STATS[sel.type][sel.level+1].cost * DIFFICULTY[game.difficulty].towerCostMult); upgradeCostSpan.textContent = nextCost; }
  sellValueSpan.textContent = sel.sellValue();
}

function upgradeSelectedTower() {
  const sel = game.selectedTower;
  if(!sel || sel.level >= 2) return;
  const cost = Math.round(TOWER_STATS[sel.type][sel.level+1].cost * DIFFICULTY[game.difficulty].towerCostMult);
  if(game.money < cost) return;
  game.money -= cost; sel.totalSpent += cost; sel.upgrade();
  spawnParticles(sel.x, sel.y, '#7ae9d6', 22);
  updateTowerActionPanel();
}

function sellSelectedTower() {
  const sel = game.selectedTower;
  if(!sel) return;
  const value = sel.sellValue(); game.money += value;
  const idx = game.towers.indexOf(sel);
  if(idx !== -1) {
    const tx = Math.floor(sel.x/TILE), ty = Math.floor(sel.y/TILE);
    if(tileMap[ty]?.[tx]) tileMap[ty][tx] = {type:'grass', walkable:true, grassVariant:(tx+ty)%4};
    game.towers.splice(idx,1);
    spawnParticles(sel.x, sel.y, '#ffaa44', 26);
  }
  game.selectedTower = null;
  updateTowerActionPanel();
}

canvas.addEventListener('click', e=>{
  if(game.gameOver||game.victory) return;
  const rect=canvas.getBoundingClientRect(), x=e.clientX-rect.left, y=e.clientY-rect.top;
  if(game.placing){ placeTower(x,y); return; }
  for(const t of game.towers){ if(Math.hypot(x-t.x,y-t.y)<28){ game.selectedTower=t; game.placing=null; updateTowerButtons(); updateTowerActionPanel(); return; } }
  game.selectedTower=null; updateTowerActionPanel();
});
canvas.addEventListener('mousemove', e=>{
  const rect=canvas.getBoundingClientRect(), x=e.clientX-rect.left, y=e.clientY-rect.top;
  game.placingPos={x,y};
  const tx=Math.floor(x/TILE), ty=Math.floor(y/TILE);
  const sel=game.selectedTower?` | Selected: ${game.selectedTower.type} L${game.selectedTower.level+1}`:'';
  document.getElementById('tileInfo').textContent=` (${tx},${ty})${sel}`;
});

function placeTower(x,y){
  const tx=Math.floor(x/TILE), ty=Math.floor(y/TILE);
  if(ty>=ROWS||tx>=COLS||ty<0||tx<0){ spawnParticles(x,y,'#ff6666',12); return; }
  const tile=tileMap[ty]?.[tx];
  if(!tile || tile.type!=='grass' || !tile.walkable){ spawnParticles(x,y,'#ff6666',12); return; }
  const baseCost=getTowerCost(game.placing);
  if(game.money<baseCost){ game.placing=null; updateTowerButtons(); spawnParticles(x,y,'#ff6666',6); return; }
  const px=tx*TILE+TILE/2, py=ty*TILE+TILE/2;
  const t=new Tower(px,py,game.placing);
  game.towers.push(t); game.money-=baseCost; t.totalSpent=baseCost; game.placing=null; updateTowerButtons();
  tile.walkable=false; tile.type='tower';
  spawnParticles(px,py,'#7ae9d6',22);
}

let lastTime=performance.now();
function loop(now){
  const dt=Math.min((now-lastTime)/1000, 0.033); lastTime=now;
  if(!game.paused && !game.gameOver && !game.victory){
    if(game.toSpawn>0){ game.spawnTimer-=dt; if(game.spawnTimer<=0){ game.spawnTimer=game.spawnInterval; spawnEnemy(); game.toSpawn--; } }
    for(const e of game.enemies) e.update(dt);
    game.enemies=game.enemies.filter(e=>!e.dead&&!e.reachedEnd);
    for(const t of game.towers) t.update(dt);
    game.towers=game.towers.filter(t=>!t.deleted);
    for(const p of game.projectiles) p.update(dt);
    game.projectiles=game.projectiles.filter(p=>!p.dead);
    updateParticles(dt); updateDamageNumbers(dt);
    if(game.waveInProgress && game.enemies.length===0 && game.toSpawn===0){
      game.waveInProgress=false;
      const bonus=30+game.wave*5;
      game.money+=bonus; game.totalMoneyEarned+=bonus; game.wave++;
      showDamageNumber(canvas.width/2, canvas.height/2-60, `+$${bonus}`, '#7ae9d6');
      if(game.autoNext && game.wave<=game.totalWaves) setTimeout(()=>startWave(), 1200);
    }
    if(game.health<=0 && !game.gameOver){ game.gameOver=true; document.getElementById('finalScore').textContent=`Wave ${game.wave}`; document.getElementById('finalEnemies').textContent=game.enemiesDefeated; document.getElementById('finalMoney').textContent=game.totalMoneyEarned; document.getElementById('gameOver').style.display='block'; }
    if(game.wave>game.totalWaves && !game.victory){ game.victory=true; const score=game.wave*100+game.enemiesDefeated+game.totalMoneyEarned; document.getElementById('finalScoreVictory').textContent=score; document.getElementById('victoryScreen').style.display='block'; }
    if(game.selectedTower && !game.towers.includes(game.selectedTower)) { game.selectedTower = null; updateTowerActionPanel(); }
  }
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawTiles();
  for(const t of game.towers) t.draw();
  for(const p of game.projectiles) p.draw();
  for(const e of game.enemies) e.draw();
  drawParticles(); drawDamageNumbers();
  if(game.placing){
    const pos=game.placingPos, tx=Math.floor(pos.x/TILE), ty=Math.floor(pos.y/TILE);
    const valid=ty<ROWS&&tx<COLS&&tileMap[ty]?.[tx]?.type==='grass'&&tileMap[ty][tx].walkable;
    ctx.globalAlpha=0.7;
    ctx.fillStyle=valid?'rgba(100,255,140,0.4)':'rgba(255,80,80,0.4)';
    ctx.beginPath(); ctx.arc(tx*TILE+TILE/2, ty*TILE+TILE/2, 22, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.strokeStyle=valid?'rgba(100,255,140,0.5)':'rgba(255,80,80,0.5)'; ctx.lineWidth=3;
    ctx.arc(tx*TILE+TILE/2, ty*TILE+TILE/2, TOWER_STATS[game.placing][0].range, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha=1;
  }
  document.getElementById('waveDisp').textContent=game.wave;
  document.getElementById('enemyDisp').textContent=`${game.enemies.length} +${game.toSpawn}`;
  document.getElementById('moneyDisp').textContent=`$${game.money}`;
  document.getElementById('healthDisp').textContent=game.health;
  requestAnimationFrame(loop);
}

document.addEventListener('keydown', e=>{
  if(e.key==='p'||e.key==='P') togglePause();
  if(e.key==='Escape'){ game.placing=null; game.selectedTower=null; updateTowerButtons(); updateTowerActionPanel(); }
  const map={1:'basic',2:'sniper',3:'frost',4:'bomb',5:'flame',6:'tesla'};
  if(e.key>='1'&&e.key<='6'){ const t=map[e.key]; if(t) selectTower(t); }
});
document.getElementById('autoNext').addEventListener('change', e=>game.autoNext=e.target.checked);

selectMap('forest', {currentTarget:document.querySelector('.map-option')});
selectDifficulty('normal', {currentTarget:document.querySelector('.diff-option.active')});
loop(performance.now());
document.getElementById('play-btn')?.addEventListener('click', showDifficultySelection);
document.getElementById('info-btn')?.addEventListener('click', showInstructions);
document.getElementById('difficulty-next')?.addEventListener('click', showMapSelectionFromDiff);
document.getElementById('difficulty-back')?.addEventListener('click', showHomeScreen);
document.getElementById('start-map-btn')?.addEventListener('click', startGameWithMap);
document.getElementById('map-back')?.addEventListener('click', showDifficultySelection);
document.getElementById('startWaveBtn')?.addEventListener('click', startWave);
document.getElementById('pauseBtn')?.addEventListener('click', togglePause);
document.getElementById('upgradeBtn')?.addEventListener('click', upgradeSelectedTower);
document.getElementById('sellBtn')?.addEventListener('click', sellSelectedTower);
document.querySelectorAll('#quit-btn, #difficulty-back, #gameover-back').forEach(el => el?.addEventListener('click', showHomeScreen));
document.querySelectorAll('.diff-option').forEach(el=>el.addEventListener('click',event=>selectDifficulty(el.dataset.diff,event)));
document.querySelectorAll('.map-option').forEach(el=>el.addEventListener('click',event=>selectMap(el.dataset.map,event)));
document.querySelectorAll('[data-tower]').forEach(el=>el.addEventListener('click',()=>selectTower(el.dataset.tower)));
