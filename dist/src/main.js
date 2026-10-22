import * as THREE from '../vendor/three.module.js';
import {createIsland, createPlayer, movePlayer, exposedFaces, TYPES, NAMES, EYE_HEIGHT, clamp, MiningSession, raycast, createDrop, updateDrop, createInventory, collectDrop} from './core.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
let renderer;
try {renderer = new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'low-power'});}
catch { $('fatal').hidden = false; $('fatal').textContent = '無法啟用 3D 畫面。\n請使用支援 WebGL 2 的桌面版瀏覽器，並啟用硬體加速。只有 CPU 的電腦需由瀏覽器提供軟體 WebGL。'; throw new Error('WebGL 2 unavailable'); }
renderer.setPixelRatio(1);
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0xcadfdc);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcadfdc,38,85);
const camera = new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.08,100);
scene.add(new THREE.HemisphereLight(0xfff4d6,0x879a80,2.3));
const sun = new THREE.DirectionalLight(0xffe9be,2.3); sun.position.set(-12,24,10); scene.add(sun);
const world = createIsland();
const player = createPlayer();
const keys = new Set();
const mining = new MiningSession();
let leftHeld=false, currentTarget=null;
let playing = false, started = false, selected = 0, quality = '省電', lastVersion = -1, frameCount = 0, fps = 0, frameStart = performance.now(), toastUntil = 0;
const counts = createInventory();
const textures = {};
const loader = new THREE.TextureLoader();
const textureNames = ['grass_top','grass_side','dirt','stone','log_side','log_top','leaves','planks','sand','brick',...Array.from({length:10},(_,i)=>`destroy_stage_${i}`)];
const materials = {};
const terrain = new THREE.Group(); scene.add(terrain);
const corners = [
  [[1,0,0],[1,1,0],[1,1,1],[1,0,1]],
  [[0,0,1],[0,1,1],[0,1,0],[0,0,0]],
  [[0,1,1],[1,1,1],[1,1,0],[0,1,0]],
  [[0,0,0],[1,0,0],[1,0,1],[0,0,1]],
  [[1,0,1],[1,1,1],[0,1,1],[0,0,1]],
  [[0,0,0],[0,1,0],[1,1,0],[1,0,0]],
];
function textureFor(type,side) {
  if (type==='grass') return side===2?'grass_top':side===3?'dirt':'grass_side';
  if (type==='log') return side===2||side===3?'log_top':'log_side';
  return type;
}
function rebuildTerrain() {
  while (terrain.children.length) {const mesh = terrain.children[0]; terrain.remove(mesh); mesh.geometry.dispose();}
  const groups = new Map();
  for (const face of exposedFaces(world)) {
    const name = textureFor(face.type,face.side);
    if (!groups.has(name)) groups.set(name,{p:[],n:[],uv:[],index:[]});
    const g = groups.get(name), base = g.p.length/3;
    for (const [x,y,z] of corners[face.side]) {g.p.push(face.x+x,face.y+y,face.z+z); g.n.push(...face.normal);}
    g.uv.push(0,0,0,1,1,1,1,0);
    g.index.push(base,base+1,base+2,base,base+2,base+3);
  }
  for (const [name,g] of groups) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(g.p,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(g.n,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(g.uv,2));
    geometry.setIndex(g.index);
    terrain.add(new THREE.Mesh(geometry,materials[name]));
  }
  lastVersion = world.version;
}
const cubeGeometry = new THREE.BoxGeometry(1,1,1);
const selection = new THREE.LineSegments(new THREE.EdgesGeometry(cubeGeometry),new THREE.LineBasicMaterial({color:0xfff4cb,transparent:true,opacity:.75}));
selection.scale.setScalar(1.004); selection.visible = false; scene.add(selection);
const crackMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:.85,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
const cracks=new THREE.Mesh(cubeGeometry,crackMaterial);cracks.scale.setScalar(1.008);cracks.visible=false;scene.add(cracks);
const lookDirection=new THREE.Vector3();
const drops=[];
const dropMeshes=new Map();
const dropMaterials={};
function addDrop(block){
  const drop=createDrop(block);drops.push(drop);
  const mesh=new THREE.Mesh(cubeGeometry,dropMaterials[drop.type]);mesh.scale.setScalar(.32);scene.add(mesh);dropMeshes.set(drop.id,mesh);
}
function updateDrops(dt){
  for(let i=drops.length-1;i>=0;i--){
    const d=drops[i];updateDrop(world,d,dt);
    if(collectDrop(world,d,player,counts,dt)){updateInventory();toast(`收到了${NAMES[d.type]} +1`);}
    const mesh=dropMeshes.get(d.id);
    if(d.removed){scene.remove(mesh);dropMeshes.delete(d.id);drops.splice(i,1);continue;}
    mesh.position.set(d.x,d.y,d.z);mesh.rotation.y=d.rotation;
  }
}
function cancelMining(){leftHeld=false;mining.reset();cracks.visible=false;$('mining').hidden=true;}
function updateMining(dt) {
  camera.getWorldDirection(lookDirection);
  currentTarget=raycast(world,camera.position,lookDirection);
  selection.visible=!!currentTarget;
  $('target-label').textContent=currentTarget?NAMES[currentTarget.type]:'';
  if(currentTarget)selection.position.set(currentTarget.x+.5,currentTarget.y+.5,currentTarget.z+.5);
  const result=mining.update(world,currentTarget,leftHeld||keys.has('KeyE'),dt);
  cracks.visible=result.stage>=0&&!result.broken;
  $('mining').hidden=!cracks.visible;
  if(cracks.visible&&currentTarget){
    cracks.position.copy(selection.position);
    crackMaterial.map=textures[`destroy_stage_${result.stage}`];crackMaterial.needsUpdate=true;
    $('mining-fill').style.width=`${result.progress*100}%`;
  }
  if(result.broken){addDrop(result.broken);toast(`挖掉了${NAMES[result.broken.type]}，走近收集`);}
}

function updateInventory() {
  $('inventory').replaceChildren(...TYPES.map((t,i)=>{
    const button = document.createElement('button'); button.className = 'slot'+(i===selected?' selected':'');
    button.setAttribute('aria-label',`${i+1} ${NAMES[t]} ${counts[t]} 個`);
    button.setAttribute('aria-pressed',String(i===selected));
    button.innerHTML = `<span class="key">${i+1}</span><img src="assets/icons/${t}.png" alt=""><span class="count">${counts[t]}</span>`;
    button.addEventListener('click',()=>{selected=i; updateInventory();});
    return button;
  }));
  $('selected-name').textContent = NAMES[TYPES[selected]];
}
updateInventory();
function toast(message) {$('toast').textContent=message; $('toast').classList.add('visible'); toastUntil=performance.now()+2500;}

function pause() {
  if (!started) return;
  playing=false; keys.clear();cancelMining();
  if (document.pointerLockElement) document.exitPointerLock();
  $('menu').hidden=false; document.body.classList.remove('playing');
}
async function start() {
  started=true; playing=true; keys.clear(); $('welcome').hidden=true; $('menu').hidden=true; $('hud').hidden=false; $('pause').hidden=false;
  document.body.classList.add('playing');
  try {await canvas.requestPointerLock();} catch {toast('可用方向鍵看四周，E 挖掘、Q 放置');}
}
$('start').addEventListener('click',start);
$('resume').addEventListener('click',start);
$('pause').addEventListener('click',pause);
canvas.addEventListener('click',()=>{if(playing&&!document.pointerLockElement) canvas.requestPointerLock()?.catch(()=>{});});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen();}catch{toast('瀏覽器目前無法進入全螢幕');}});
$('quality').addEventListener('click',()=>{quality=quality==='省電'?'細緻':'省電'; renderer.setPixelRatio(quality==='省電'?1:Math.min(devicePixelRatio,1.75)); renderer.setSize(innerWidth,innerHeight); $('quality').textContent=`畫質：${quality}`;});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&playing) pause();});
document.addEventListener('keydown',e=>{
  if (e.code==='Escape') {pause();return;}
  if (e.code==='F3') {e.preventDefault(); $('debug').hidden=!$('debug').hidden;return;}
  if (!playing) return;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (/^Digit[1-8]$/.test(e.code)) {selected=+e.code.slice(-1)-1;updateInventory();}
});
document.addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('mousedown',e=>{if(playing&&e.button===0)leftHeld=true;});
document.addEventListener('mouseup',e=>{if(e.button===0){leftHeld=false;mining.reset();cracks.visible=false;$('mining').hidden=true;}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('mousemove',e=>{
  if(playing&&document.pointerLockElement===canvas) {player.yaw-=e.movementX*.0023;player.pitch=clamp(player.pitch-e.movementY*.0023,-1.5,1.5);}
});
canvas.addEventListener('wheel',e=>{if(!playing)return;e.preventDefault();selected=(selected+Math.sign(e.deltaY)+8)%8;updateInventory();},{passive:false});
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now-last)/1000,0,.05); last=now;
  if (playing) {
    player.yaw+=((keys.has('ArrowLeft')?1:0)-(keys.has('ArrowRight')?1:0))*dt*1.6;
    player.pitch=clamp(player.pitch+((keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0))*dt*1.3,-1.5,1.5);
    movePlayer(world,player,{forward:(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),right:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),jump:keys.has('Space')},dt);
  }
  if (started) {
    camera.position.set(player.x,player.y+EYE_HEIGHT,player.z);
    camera.rotation.order='YXZ';camera.rotation.set(player.pitch,player.yaw,0);
  } else {
    const t=now*.000035;
    camera.position.set(33+Math.sin(t)*1.5,22,33+Math.cos(t)*1.5);
    camera.lookAt(10.5,5,11.5);
    camera.setViewOffset(innerWidth,innerHeight,-innerWidth*.12,0,innerWidth,innerHeight);
  }
  if (started) camera.clearViewOffset();
  if(playing){updateMining(dt);updateDrops(dt);}
  if (lastVersion!==world.version&&materials.dirt) rebuildTerrain();
  if (now>toastUntil) $('toast').classList.remove('visible');
  renderer.render(scene,camera);
  frameCount++;
  if(now-frameStart>=1000){fps=Math.round(frameCount*1000/(now-frameStart));frameCount=0;frameStart=now;
    $('debug').textContent=`效能資訊\n${fps} fps\n${innerWidth} × ${innerHeight}（比例 ${renderer.getPixelRatio()}）\n繪製 ${renderer.info.render.calls} 次\n三角形 ${renderer.info.render.triangles}\n方塊 ${world.blocks.size} / 24³\n玩家 ${player.x.toFixed(1)}, ${player.y.toFixed(1)}, ${player.z.toFixed(1)}\nthree.js r180 · ${quality}`;
  }
}

try {
  await Promise.all(textureNames.map(async name=>{
    const texture=await loader.loadAsync(`assets/textures/${name}.png`);
    texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.colorSpace=THREE.SRGBColorSpace;
    textures[name]=texture;
    if(!name.startsWith('destroy_')) materials[name]=new THREE.MeshLambertMaterial({map:texture});
  }));
  for(const type of TYPES)dropMaterials[type]=[0,1,2,3,4,5].map(side=>materials[textureFor(type,side)]);
  rebuildTerrain();$('start').disabled=false;$('start-label').textContent='走進小島';requestAnimationFrame(frame);
} catch(error) {$('fatal').hidden=false;$('fatal').textContent=`素材載入失敗。請透過靜態網站網址開啟，不要直接雙擊 HTML。\n${error.message}`;}
