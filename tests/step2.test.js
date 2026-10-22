import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/src/core.js';
function floor() {const w=new core.World();for(let x=0;x<10;x++)for(let z=0;z<10;z++)w.set(x,0,z,'stone');return w;}

test('STEP 2：方塊挖掉後彈出同種類小方塊並旋轉',()=>{
  const d=core.createDrop({x:4,y:2,z:4,type:'dirt'});
  assert.equal(d.type,'dirt');assert.equal(d.x,4.5);assert.equal(d.z,4.5);assert.ok(d.vy>0);
  const y=d.y;core.updateDrop(floor(),d,.05);
  assert.ok(d.y>y);assert.ok(d.rotation>0);
});

test('STEP 2：掉落物落到地上停住，不懸浮、不穿地',()=>{
  const w=floor(),d=core.createDrop({x:4,y:4,z:4,type:'stone'});
  for(let i=0;i<300;i++)core.updateDrop(w,d,1/60);
  assert.ok(Math.abs(d.y-(1+core.DROP_RADIUS))<.002);
  assert.equal(d.grounded,true);assert.equal(d.vy,0);
  const y=d.y, r=d.rotation;core.updateDrop(w,d,.05);
  assert.ok(Math.abs(d.y-y)<.002);assert.ok(d.rotation>r);
});

test('STEP 2：地面被挖空後繼續掉落，不留在半空',()=>{
  const w=floor();w.set(4,2,4,'dirt');
  const d=core.createDrop({x:4,y:4,z:4,type:'dirt'});
  for(let i=0;i<180;i++)core.updateDrop(w,d,1/60);
  assert.ok(d.y>3);
  w.set(4,2,4,null);
  for(let i=0;i<180;i++)core.updateDrop(w,d,1/60);
  assert.ok(Math.abs(d.y-(1+core.DROP_RADIUS))<.002);
});

test('STEP 2：正上方挖方塊彈出時不鑽進上層方塊',()=>{
  const w=floor();w.set(4,3,4,'stone');
  const d=core.createDrop({x:4,y:2,z:4,type:'dirt'});
  for(let i=0;i<60;i++){core.updateDrop(w,d,1/60);assert.ok(d.y+core.DROP_RADIUS<=3.001);}
});

test('STEP 2：大時間步長與高速落下仍不穿透地板',()=>{
  const w=floor(),d=core.createDrop({x:4,y:2,z:4,type:'dirt'});d.vy=-80;
  core.updateDrop(w,d,10);
  assert.ok(d.y>=1+core.DROP_RADIUS-.001);
});

test('STEP 2：掉落島外的物品會清除，避免無限累積',()=>{
  const d=core.createDrop({x:0,y:0,z:0,type:'stone'});d.y=-15;
  core.updateDrop(new core.World(),d,.05);assert.equal(d.removed,true);
});
