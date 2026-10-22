import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/src/core.js';

test('STEP 5：按 R 對應晴雨切換，兩次回到晴天',()=>{
  const weather=new core.Weather();assert.equal(weather.raining,false);
  assert.equal(weather.toggle(),true);assert.equal(weather.raining,true);
  assert.equal(weather.toggle(),false);
});

test('STEP 5：雨滴有限，雨天下落，晴天不更新雨滴',()=>{
  const w=new core.World(),weather=new core.Weather();
  assert.ok(weather.drops.length>50&&weather.drops.length<=300);
  const first=weather.drops[0],y=first.y;
  weather.update(w,.05);assert.equal(first.y,y);
  weather.toggle();weather.update(w,.05);assert.ok(first.y<y);
});

test('STEP 5：屋頂擋雨，雨線終點不會穿過屋頂',()=>{
  const w=new core.World();w.set(4,5,4,'planks');
  assert.equal(core.roofHeight(w,4.5,4.5),6);
  const line=core.rainSegment(w,{x:4.5,y:6.2,z:4.5});
  assert.ok(line.bottom>=6);assert.equal(line.top,6.2);
  assert.equal(core.rainSegment(w,{x:4.5,y:4,z:4.5}),null);
});

test('STEP 5：屋簷下與淋雨位置判斷，不把腳下地板算屋頂',()=>{
  const w=core.createIsland();
  assert.equal(core.isSheltered(w,core.createPlayer({x:17.5,y:7,z:11.5})),true);
  assert.equal(core.isSheltered(w,core.createPlayer({x:11.5,y:7,z:17.5})),false);
});

test('STEP 5：挖掉屋頂下方開始落雨，補回立即重新擋雨',()=>{
  const w=new core.World();w.set(4,0,4,'stone');w.set(4,5,4,'planks');
  const p=core.createPlayer({x:4.5,y:1,z:4.5});
  assert.equal(core.isSheltered(w,p),true);
  assert.equal(core.rainSegment(w,{x:4.5,y:4,z:4.5}),null);
  w.set(4,5,4,null);
  assert.equal(core.isSheltered(w,p),false);
  assert.ok(core.rainSegment(w,{x:4.5,y:4,z:4.5}));
  w.set(4,5,4,'planks');
  assert.equal(core.isSheltered(w,p),true);
  assert.equal(core.rainSegment(w,{x:4.5,y:4,z:4.5}),null);
});

test('STEP 5：落到屋頂的雨滴回到上方，不在棚內繼續落下',()=>{
  const w=new core.World();w.set(4,5,4,'planks');
  const weather=new core.Weather();weather.toggle();
  const d=weather.drops[0];d.x=4.5;d.z=4.5;d.y=6.01;
  weather.update(w,.05);
  assert.ok(d.y>6);
  assert.equal(core.rainSegment(w,{...d,y:4}),null);
});

test('STEP 5：雨天完整挖、掉、撿、放，物品數量回到原本',()=>{
  const w=new core.World();w.set(4,0,4,'stone');w.set(4,1,4,'dirt');
  const p=core.createPlayer({x:5.5,y:1,z:4.5}),bag=core.createInventory(),weather=new core.Weather();
  weather.toggle();
  const b=new core.MiningSession().update(w,{x:4,y:1,z:4},true,.73).broken;
  const d=core.createDrop(b);
  for(let i=0;i<180;i++){weather.update(w,1/60);core.updateDrop(w,d,1/60);core.collectDrop(w,d,p,bag,1/60);}
  assert.equal(bag.dirt,1);
  assert.equal(core.placeBlock(w,{x:4,y:0,z:4,normal:[0,1,0],distance:2},'dirt',bag,p).ok,true);
  assert.equal(bag.dirt,0);assert.equal(weather.raining,true);
});

test('STEP 5：跑一萬格更新仍維持固定雨滴數量',()=>{
  const w=new core.World(),weather=new core.Weather();weather.toggle();
  const n=weather.drops.length;
  for(let i=0;i<10000;i++)weather.update(w,.05);
  assert.equal(weather.drops.length,n);assert.ok(weather.drops.every(d=>Number.isFinite(d.y)&&d.y>=-8));
});
