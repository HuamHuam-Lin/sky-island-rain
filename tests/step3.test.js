import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/src/core.js';
const player=()=>core.createPlayer({x:4.5,y:1,z:4.5});
const drop=()=>{const d=core.createDrop({x:4,y:1,z:4,type:'dirt'});d.y=1.16;d.vy=0;return d;};
const collect=(w,d,p,bag,n=40)=>{for(let i=0;i<n;i++)core.collectDrop(w,d,p,bag,1/60);};

test('STEP 3：三格外不會吸取物品',()=>{
  const w=new core.World(),d=drop(),p=player(),bag=core.createInventory();p.x+=3;
  collect(w,d,p,bag);
  assert.equal(bag.dirt,0);assert.equal(d.removed,false);assert.equal(d.phase,'ground');
});

test('STEP 3：靠近先飛向玩家，動畫結束才增加一個',()=>{
  const w=new core.World(),d=drop(),p=player(),bag=core.createInventory();p.x+=.8;
  core.collectDrop(w,d,p,bag,1/60);
  assert.equal(d.phase,'collecting');assert.equal(bag.dirt,0);
  assert.ok(d.x>4.5);
  collect(w,d,p,bag);
  assert.equal(d.removed,true);assert.equal(bag.dirt,1);
});

test('STEP 3：同一顆物品再更新也只能加一次',()=>{
  const w=new core.World(),d=drop(),p=player(),bag=core.createInventory();
  collect(w,d,p,bag,120);assert.equal(bag.dirt,1);
});

test('STEP 3：連挖兩格的掉落物都能撿到',()=>{
  const w=new core.World(),p=player(),bag=core.createInventory(),a=drop(),b=drop();b.z+=.5;
  for(let i=0;i<60;i++){core.collectDrop(w,a,p,bag,1/60);core.collectDrop(w,b,p,bag,1/60);}
  assert.equal(bag.dirt,2);assert.equal(a.removed,true);assert.equal(b.removed,true);
});

test('STEP 3：滿 64 個不會吸入，空出一格後才可撿',()=>{
  const w=new core.World(),d=drop(),p=player(),bag=core.createInventory();bag.dirt=64;
  collect(w,d,p,bag);assert.equal(d.phase,'ground');assert.equal(d.removed,false);
  bag.dirt=63;collect(w,d,p,bag);assert.equal(bag.dirt,64);assert.equal(d.removed,true);
});

test('STEP 3：兩顆同時飛入第 64 格也不會超過上限',()=>{
  const w=new core.World(),p=player(),bag=core.createInventory(),a=drop(),b=drop();bag.dirt=63;
  for(let i=0;i<60;i++){core.collectDrop(w,a,p,bag,1/60);core.collectDrop(w,b,p,bag,1/60);}
  assert.equal(bag.dirt,64);assert.equal([a,b].filter(d=>d.removed).length,1);
  assert.equal([a,b].filter(d=>!d.removed)[0].phase,'ground');
});

test('STEP 3：牆壁不會隔空吸取物品',()=>{
  const w=new core.World(),d=drop(),p=player(),bag=core.createInventory();p.x=5.6;d.x=4.8;
  w.set(5,1,4,'stone');w.set(5,2,4,'stone');
  collect(w,d,p,bag);assert.equal(bag.dirt,0);assert.equal(d.phase,'ground');
});

test('STEP 3：物品欄初始化為八種、每格零個，不含未知物品',()=>{
  const bag=core.createInventory();assert.deepEqual(Object.keys(bag),core.TYPES);
  assert.ok(Object.values(bag).every(v=>v===0));
});
