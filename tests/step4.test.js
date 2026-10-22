import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/src/core.js';
function setup(){const w=new core.World();w.set(4,0,4,'stone');return {w,p:core.createPlayer({x:6.5,y:1,z:4.5}),bag:core.createInventory(),hit:{x:4,y:0,z:4,normal:[0,1,0],distance:3}};}

test('STEP 4：選有庫存的方塊，放置一個並扣一',()=>{
  const {w,p,bag,hit}=setup();bag.dirt=2;
  assert.equal(core.placeBlock(w,hit,'dirt',bag,p).ok,true);
  assert.equal(w.get(4,1,4),'dirt');assert.equal(bag.dirt,1);
});

test('STEP 4：零個不放置，數量不會變負數',()=>{
  const {w,p,bag,hit}=setup();
  assert.equal(core.placeBlock(w,hit,'dirt',bag,p).ok,false);
  assert.equal(w.get(4,1,4),null);assert.equal(bag.dirt,0);
});

test('STEP 4：自己身體所在格與已占用格不可放置且不扣數量',()=>{
  const {w,p,bag,hit}=setup();bag.dirt=3;p.x=4.5;
  assert.equal(core.placeBlock(w,hit,'dirt',bag,p).ok,false);
  p.x=6.5;w.set(4,1,4,'stone');
  assert.equal(core.placeBlock(w,hit,'dirt',bag,p).ok,false);assert.equal(bag.dirt,3);
});

test('STEP 4：世界外、超過六格、沒有支撐面都不放置',()=>{
  const {w,p,bag,hit}=setup();bag.dirt=3;
  w.set(0,1,4,'stone');
  assert.equal(core.placeBlock(w,{x:0,y:1,z:4,normal:[-1,0,0],distance:3},'dirt',bag,p).ok,false);
  assert.equal(core.placeBlock(w,{...hit,distance:6.01},'dirt',bag,p).ok,false);
  assert.equal(core.placeBlock(w,{...hit,y:5},'dirt',bag,p).ok,false);
  assert.equal(bag.dirt,3);
});

test('STEP 4：無效目標與非單位面不會消耗物品',()=>{
  const {w,p,bag,hit}=setup();bag.dirt=1;
  for(const h of [null,{...hit,normal:[0,2,0]},{...hit,normal:[1,1,0]},{...hit,normal:[NaN,0,0]}])
    assert.equal(core.placeBlock(w,h,'dirt',bag,p).ok,false);
  assert.equal(bag.dirt,1);
});

test('STEP 4：第 1 批整串，挖掉、落地、飛入、放回，方塊與物品數守恆',()=>{
  const {w,p,bag,hit}=setup();w.set(4,1,4,'dirt');p.x=5.5;
  const originalSize=w.blocks.size,originalCount=bag.dirt;
  const broken=new core.MiningSession().update(w,{x:4,y:1,z:4},true,.73).broken;
  assert.ok(broken);const d=core.createDrop(broken);
  for(let i=0;i<180;i++)core.updateDrop(w,d,1/60);
  assert.equal(d.grounded,true);
  for(let i=0;i<60;i++)core.collectDrop(w,d,p,bag,1/60);
  assert.equal(bag.dirt,originalCount+1);
  assert.equal(core.placeBlock(w,hit,'dirt',bag,p).ok,true);
  assert.equal(bag.dirt,originalCount);assert.equal(w.blocks.size,originalSize);assert.equal(w.get(4,1,4),'dirt');
});

test('STEP 4：滿世界頂端不可再往上蓋',()=>{
  const {w,p,bag}=setup();w.set(4,23,4,'stone');bag.dirt=1;
  assert.equal(core.placeBlock(w,{x:4,y:23,z:4,normal:[0,1,0],distance:1},'dirt',bag,p).ok,false);
  assert.equal(bag.dirt,1);
});
