import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/src/core.js';

test('STEP 0：世界固定為 24 格且拒絕越界與未知方塊', () => {
  const w = new core.World();
  assert.equal(w.size, 24);
  assert.equal(w.set(-1, 0, 0, 'dirt'), false);
  assert.equal(w.set(24, 1, 1, 'dirt'), false);
  assert.equal(w.set(1, 24, 1, 'dirt'), false);
  assert.equal(w.set(1, 1, 24, 'dirt'), false);
  assert.equal(w.set(1.5, 1, 1, 'dirt'), false);
  assert.equal(w.set(1, 1, 1, 'unknown'), false);
  assert.equal(w.get(25, 0, 0), null);
});

test('STEP 0：地形具有可走出生點、小島底部留空、屋頂與八種方塊', () => {
  const w = core.createIsland();
  assert.ok(w.blocks.size > 1000 && w.blocks.size < 24 ** 3);
  assert.ok([...w.blocks.keys()].every(k => k.split(',').every(v => +v >= 0 && +v < 24)));
  assert.equal(w.get(0, 0, 0), null);
  assert.equal(w.get(11, 6, 17), 'grass');
  assert.equal(w.get(11, 7, 17), null);
  assert.equal(w.get(17, 11, 11), 'planks');
  assert.equal(new Set(w.blocks.values()).size, 8);
});

function floor() {
  const w = new core.World();
  for (let x = 0; x < 10; x++) for (let z = 0; z < 10; z++) w.set(x, 0, z, 'stone');
  return w;
}

test('STEP 0：重力會落到地面，不穿透地板', () => {
  const p = core.createPlayer({x: 4.5, y: 5, z: 4.5});
  const w = floor();
  for (let i = 0; i < 180; i++) core.movePlayer(w, p, {}, 1 / 60);
  assert.ok(Math.abs(p.y - 1) < 0.001);
  assert.equal(p.grounded, true);
});

test('STEP 0：牆壁擋住走路，斜走不會比較快', () => {
  const w = floor();
  for (let z = 0; z < 10; z++) for (let y = 1; y < 4; y++) w.set(6, y, z, 'stone');
  const p = core.createPlayer({x: 4.5, y: 1, z: 4.5});
  for (let i = 0; i < 120; i++) core.movePlayer(w, p, {right: 1}, 1 / 60);
  assert.ok(p.x <= 6 - core.PLAYER_RADIUS + 0.001);
  const a = core.createPlayer({x: 2, y: 1, z: 2});
  const b = core.createPlayer({x: 2, y: 1, z: 2});
  core.movePlayer(w, a, {right: 1}, 0.05);
  core.movePlayer(w, b, {right: 1, forward: 1}, 0.05);
  assert.ok(Math.abs(Math.hypot(a.x - 2, a.z - 2) - Math.hypot(b.x - 2, b.z - 2)) < 0.001);
});

test('STEP 0：跳躍只能在落地時起跳，天花板擋住頭部', () => {
  const w = floor();
  w.set(4, 3, 4, 'planks');
  const p = core.createPlayer({x: 4.5, y: 1, z: 4.5});
  core.movePlayer(w, p, {}, 1 / 60);
  core.movePlayer(w, p, {jump: true}, 1 / 60);
  assert.ok(p.y > 1);
  for (let i = 0; i < 5; i++) core.movePlayer(w, p, {jump: true}, 1 / 60);
  assert.ok(p.y + core.PLAYER_HEIGHT <= 3.001);
  assert.ok(p.vy <= 0);
});

test('STEP 0：暫停不移動，長時間步長受限，落島回安全點', () => {
  const w = core.createIsland();
  const p = core.createPlayer();
  const before = {...p};
  core.movePlayer(w, p, {forward: 1, paused: true}, 1);
  assert.deepEqual(p, before);
  core.movePlayer(w, p, {forward: 1}, 3);
  assert.ok(Math.abs(p.z - before.z) <= 0.23);
  p.y = -15;
  core.movePlayer(w, p, {}, 1 / 60);
  assert.ok(p.y >= 7);
  assert.equal(p.x, 11.5);
});

test('STEP 0：只產生露出的方塊面，兩顆相鄰方塊合計十面', () => {
  const w = new core.World();
  w.set(1, 1, 1, 'dirt');
  w.set(2, 1, 1, 'dirt');
  const faces = core.exposedFaces(w);
  assert.equal(faces.length, 10);
  assert.ok(faces.every(f => f.type === 'dirt' && f.normal.length === 3));
});

test('STEP 0：出生點被玩家蓋住後仍會找安全站立處', () => {
  const w = core.createIsland();
  w.set(11, 7, 17, 'stone');
  w.set(11, 8, 17, 'stone');
  const p = core.createPlayer({x: 0, y: -20, z: 0});
  core.movePlayer(w, p, {}, 1 / 60);
  assert.equal(core.playerIntersectsWorld(w, p), false);
  assert.ok(p.y >= 7);
});
