import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/src/core.js';

const target = {x:4,y:2,z:4};
const stone = () => {const w = new core.World(); w.set(4,2,4,'stone'); return w;};

test('STEP 1：泥土裂痕逐漸加深，0.72 秒挖掉', () => {
  const w = stone(); w.set(4,2,4,'dirt');
  const m = new core.MiningSession();
  assert.equal(m.update(w,target,true,0.2).stage,2);
  assert.equal(w.get(4,2,4),'dirt');
  assert.ok(m.update(w,target,true,0.3).stage > 2);
  const result = m.update(w,target,true,0.23);
  assert.equal(result.broken.type,'dirt');
  assert.equal(w.get(4,2,4),null);
});

test('STEP 1：單點不挖掉，放開歸零，下次從頭開始', () => {
  const w = stone(); w.set(4,2,4,'dirt'); const m = new core.MiningSession();
  m.update(w,target,true,0.08);
  assert.equal(w.get(4,2,4),'dirt');
  assert.equal(m.update(w,target,false,0.2).progress,0);
  assert.equal(m.update(w,target,true,0.08).stage,1);
  assert.equal(w.get(4,2,4),'dirt');
});

test('STEP 1：挖石頭需約兩秒，不會在泥土時間就消失', () => {
  const w = stone(), m = new core.MiningSession();
  assert.equal(m.update(w,target,true,0.75).broken,null);
  assert.equal(m.update(w,target,true,1.24).broken,null);
  assert.equal(w.get(4,2,4),'stone');
  assert.equal(m.update(w,target,true,0.02).broken.type,'stone');
});

test('STEP 1：換目標、失去目標與暫停後不能沿用裂痕', () => {
  const w = stone(); w.set(5,2,4,'dirt'); const m = new core.MiningSession();
  m.update(w,target,true,0.4);
  assert.ok(m.update(w,{x:5,y:2,z:4},true,0.1).progress < 0.15);
  assert.equal(m.update(w,null,true,0.3).stage,-1);
  m.update(w,target,true,0.4); m.reset();
  assert.equal(m.progress,0);
  assert.equal(w.get(4,2,4),'stone');
});

test('STEP 1：射線命中最近方塊，回傳外側面，超過六格不命中', () => {
  const w = stone(); w.set(4,2,7,'dirt');
  const hit = core.raycast(w,{x:4.5,y:2.5,z:10},{x:0,y:0,z:-1});
  assert.deepEqual([hit.x,hit.y,hit.z],[4,2,7]);
  assert.deepEqual(hit.normal,[0,0,1]);
  assert.ok(Math.abs(hit.distance - 2) < 0.001);
  assert.equal(core.raycast(w,{x:4.5,y:2.5,z:15},{x:0,y:0,z:-1}),null);
});

test('STEP 1：射線可擊中島外側，零向量或空目標不會破壞', () => {
  const w = stone();
  assert.equal(core.raycast(w,{x:4.5,y:2.5,z:7},{x:0,y:0,z:0}),null);
  assert.equal(new core.MiningSession().update(w,{x:0,y:0,z:0},true,10).broken,null);
  const hit = core.raycast(w,{x:-1,y:2.5,z:4.5},{x:1,y:0,z:0});
  assert.equal(hit.x,4);
  assert.deepEqual(hit.normal,[-1,0,0]);
});
