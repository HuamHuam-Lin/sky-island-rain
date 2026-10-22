export const WORLD_SIZE = 24;
export const PLAYER_RADIUS = 0.28;
export const PLAYER_HEIGHT = 1.72;
export const EYE_HEIGHT = 1.58;
export const TYPES = ['grass', 'dirt', 'stone', 'log', 'leaves', 'planks', 'sand', 'brick'];
export const NAMES = {grass:'草地', dirt:'泥土', stone:'石頭', log:'原木', leaves:'樹葉', planks:'木板', sand:'沙子', brick:'磚塊'};
export const key = (x, y, z) => `${x},${y},${z}`;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class World {
  constructor() { this.size = WORLD_SIZE; this.blocks = new Map(); this.version = 0; }
  inside(x, y, z) { return [x,y,z].every(v => Number.isInteger(v) && v >= 0 && v < this.size); }
  get(x, y, z) { return this.blocks.get(key(x,y,z)) ?? null; }
  set(x, y, z, type) {
    if (!this.inside(x,y,z) || (type !== null && !TYPES.includes(type))) return false;
    if (type === null) this.blocks.delete(key(x,y,z));
    else this.blocks.set(key(x,y,z), type);
    this.version++;
    return true;
  }
}

export function createIsland() {
  const w = new World();
  for (let x = 2; x < 23; x++) for (let z = 2; z < 23; z++) {
    const r = Math.hypot((x - 12) / 10, (z - 12) / 9.5);
    const edge = 0.97 + 0.035 * Math.sin(x * 1.8 + z * 1.4);
    if (r > edge) continue;
    const bottom = Math.floor(1 + r * 3.8);
    for (let y = bottom; y <= 6; y++) w.set(x,y,z,y === 6 ? 'grass' : y >= 5 ? 'dirt' : 'stone');
  }
  for (let x = 7; x <= 9; x++) for (let z = 15; z <= 17; z++) if (w.get(x,6,z)) w.set(x,6,z,'sand');
  for (let x = 8; x <= 10; x++) for (let z = 7; z <= 9; z++) w.set(x,6,z,'stone');
  for (const [tx,tz] of [[6,10],[11,6],[20,15]]) {
    for (let y = 7; y <= 10; y++) w.set(tx,y,tz,'log');
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let y = 10; y <= 12; y++) {
      if (Math.abs(dx) + Math.abs(dz) > (y === 12 ? 2 : 3)) continue;
      if (!w.get(tx+dx,y,tz+dz)) w.set(tx+dx,y,tz+dz,'leaves');
    }
  }
  // 開放式木棚：內部可走進去，屋頂可拆補並作為雨滴遮擋面。
  for (const x of [15,19]) for (const z of [9,13]) for (let y = 7; y < 11; y++) w.set(x,y,z,'log');
  for (let x = 14; x <= 20; x++) for (let z = 8; z <= 14; z++) w.set(x,11,z,'planks');
  for (let x = 15; x <= 19; x++) for (let z = 9; z <= 13; z++) w.set(x,6,z,'planks');
  for (let x = 5; x <= 7; x++) w.set(x,7,16,'brick');
  return w;
}

export function createPlayer(position = {}) {
  return {x:11.5, y:7, z:17.5, vy:0, yaw:0, pitch:-0.5, grounded:false, jumpHeld:false, ...position};
}

export function overlapsBlock(p, x, y, z) {
  const e = 1e-6;
  return p.x + PLAYER_RADIUS > x + e && p.x - PLAYER_RADIUS < x+1-e &&
    p.z + PLAYER_RADIUS > z + e && p.z - PLAYER_RADIUS < z+1-e &&
    p.y + PLAYER_HEIGHT > y + e && p.y < y+1-e;
}

export function playerIntersectsWorld(w, p) {
  for (let x = Math.floor(p.x-PLAYER_RADIUS); x <= Math.floor(p.x+PLAYER_RADIUS); x++)
    for (let z = Math.floor(p.z-PLAYER_RADIUS); z <= Math.floor(p.z+PLAYER_RADIUS); z++)
      for (let y = Math.floor(p.y); y <= Math.floor(p.y+PLAYER_HEIGHT); y++)
        if (w.get(x,y,z) && overlapsBlock(p,x,y,z)) return true;
  return false;
}

function safeSpawn(w) {
  for (let radius = 0; radius < 10; radius++) for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
    for (let y = 7; y < 22; y++) {
      const p = createPlayer({x:11.5+dx, y, z:17.5+dz});
      if (w.get(Math.floor(p.x),y-1,Math.floor(p.z)) && !playerIntersectsWorld(w,p)) return p;
    }
  }
  return createPlayer({y:24});
}

function moveAxis(w, p, axis, amount) {
  if (!amount) return false;
  const start = p[axis];
  p[axis] = start + amount;
  if (!playerIntersectsWorld(w,p)) return false;
  let lo = 0, hi = 1;
  for (let i = 0; i < 18; i++) {
    const m = (lo+hi)/2;
    p[axis] = start + amount*m;
    if (playerIntersectsWorld(w,p)) hi = m; else lo = m;
  }
  p[axis] = start + amount*lo;
  return true;
}

export function movePlayer(w, p, input, dt) {
  if (input.paused) return;
  if (p.y < -10) { Object.assign(p,safeSpawn(w)); return; }
  dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
  let forward = input.forward || 0, right = input.right || 0;
  const mag = Math.hypot(forward,right);
  if (mag > 1) {forward /= mag; right /= mag;}
  const vx = (right*Math.cos(p.yaw) - forward*Math.sin(p.yaw))*4.4;
  const vz = (-forward*Math.cos(p.yaw) - right*Math.sin(p.yaw))*4.4;
  if (input.jump && !p.jumpHeld && p.grounded) {p.vy = 7.8; p.grounded = false;}
  p.jumpHeld = !!input.jump;
  const parts = Math.max(1,Math.ceil(dt/0.012));
  for (let i = 0; i < parts; i++) {
    const h = dt/parts;
    moveAxis(w,p,'x',vx*h);
    moveAxis(w,p,'z',vz*h);
    p.vy = Math.max(-24,p.vy-24*h);
    p.grounded = false;
    if (moveAxis(w,p,'y',p.vy*h)) {
      p.grounded = p.vy < 0;
      p.vy = 0;
    }
  }
}

export const FACE_DIRECTIONS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
export function exposedFaces(w) {
  const faces = [];
  for (const [k,type] of w.blocks) {
    const [x,y,z] = k.split(',').map(Number);
    for (let side = 0; side < 6; side++) {
      const normal = FACE_DIRECTIONS[side];
      if (!w.get(x+normal[0],y+normal[1],z+normal[2])) faces.push({x,y,z,type,normal,side});
    }
  }
  return faces;
}

export const BREAK_SECONDS = {grass:.72,dirt:.72,stone:2,log:1.2,leaves:.45,planks:1,sand:.6,brick:1.8};
export class MiningSession {
  constructor() {this.reset();}
  reset() {this.targetKey=null;this.elapsed=0;this.progress=0;}
  update(w,target,held,dt) {
    const type = target ? w.get(target.x,target.y,target.z) : null;
    if (!held || !type) {this.reset();return {progress:0,stage:-1,broken:null};}
    const k=key(target.x,target.y,target.z);
    if (k!==this.targetKey) {this.reset();this.targetKey=k;}
    this.elapsed+=Math.max(0,Number.isFinite(dt)?dt:0);
    this.progress=this.elapsed/BREAK_SECONDS[type];
    if (this.progress+1e-9>=1) {
      w.set(target.x,target.y,target.z,null);
      const broken={x:target.x,y:target.y,z:target.z,type};this.reset();
      return {progress:1,stage:9,broken};
    }
    return {progress:this.progress,stage:Math.min(9,Math.floor(this.progress*10)),broken:null};
  }
}

// 逐格穿越的射線，直接讀取方塊資料，無需對每顆方塊逐一做碰撞。
export function raycast(w,origin,direction,maxDistance=6) {
  const len=Math.hypot(direction.x,direction.y,direction.z);
  if(!len||!Number.isFinite(len))return null;
  const d=[direction.x/len,direction.y/len,direction.z/len];
  const o=[origin.x,origin.y,origin.z], cell=o.map(Math.floor);
  const step=d.map(v=>Math.sign(v));
  const delta=d.map(v=>v===0?Infinity:Math.abs(1/v));
  const next=d.map((v,i)=>v===0?Infinity:((v>0?cell[i]+1:cell[i])-o[i])/v);
  let distance=0,normal=[0,0,0];
  for(let i=0;i<200&&distance<=maxDistance;i++) {
    const type=w.get(...cell);
    if(type)return {x:cell[0],y:cell[1],z:cell[2],type,distance,normal};
    let axis=0;
    if(next[1]<next[axis])axis=1;
    if(next[2]<next[axis])axis=2;
    distance=next[axis];cell[axis]+=step[axis];next[axis]+=delta[axis];
    normal=[0,0,0];normal[axis]=-step[axis];
  }
  return null;
}
