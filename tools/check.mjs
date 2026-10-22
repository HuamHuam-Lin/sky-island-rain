import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createIsland,exposedFaces,WORLD_SIZE} from '../dist/src/core.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
for(const path of ['dist/src/main.js','dist/src/core.js','tools/serve.mjs']){
  const result=spawnSync(process.execPath,['--check',path],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
}
const html=await read('dist/index.html');
assert.ok(html.includes('lang="zh-Hant"'));
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
  assert.ok(!/^https?:/.test(match[1]),'成品不應依賴外部 CDN');
  await stat(new URL('../dist/'+match[1],import.meta.url));
}
const main=await read('dist/src/main.js');
assert.ok(main.includes("../vendor/three.module.js"));
assert.ok(!/https?:\/\//.test(main),'遊戲不應呼叫外部網路');
for(const name of ['grass_top','grass_side','dirt','stone','log_side','log_top','leaves','planks','sand','brick',...Array.from({length:10},(_,i)=>`destroy_stage_${i}`)])
  await stat(new URL(`../dist/assets/textures/${name}.png`,import.meta.url));
const manifest=JSON.parse(await read('evidence/assets-sha256.json'));
for(const [path,expected] of Object.entries(manifest)){
  const bytes=await readFile(new URL('../'+path,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,`素材被修改：${path}`);
}
const w=createIsland(),faces=exposedFaces(w);
assert.ok(WORLD_SIZE<=32);
assert.ok(faces.length<10000,'可見表面數超過預算');
assert.ok(faces.length<w.blocks.size*6,'沒有剔除內部面');
console.log(`檢查通過：語法、本地資源、${Object.keys(manifest).length} 張原始素材、固定世界 ${WORLD_SIZE}³、${faces.length} 個可見面。`);
