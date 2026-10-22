import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const entries=git('log','--reverse','--format=%H %s').split('\n');
const find=text=>{const i=entries.findIndex(v=>v.includes(text));assert.ok(i>=0,text);return {index:i,sha:entries[i].split(' ')[0]};};
const brief=find('保存需求、驗收條件');
const plan=find('建立逐步計畫');
assert.ok(brief.index<plan.index,'需求與第 2 批測試應先於第一版計畫');
assert.ok(git('show',`${brief.sha}:VERIFY.md`).includes('STEP 5'));
const expectedNew=[8,6,6,8,7,8];
const results=[];
for(let step=0;step<=5;step++){
  const red=find(`STEP ${step} 先`),green=find(`STEP ${step} 完成`);
  assert.ok(red.index<green.index);
  const changed=git('diff','--name-only',red.sha,green.sha).split('\n');
  assert.ok(!changed.some(p=>p.startsWith('tests/')),`STEP ${step} 實作提交改了測試`);
  const redLog=git('show',`${red.sha}:evidence/step${step}-red.txt`);
  const greenLog=git('show',`${green.sha}:evidence/step${step}-green.txt`);
  assert.ok(new RegExp(`fail ${expectedNew[step]}(?:\\r?\\n|$)`).test(redLog));
  assert.ok(/fail 0(?:\r?\n|$)/.test(greenLog));
  results.push({step,red:red.sha.slice(0,7),green:green.sha.slice(0,7),newFailures:expectedNew[step],testsUnchanged:true});
}
assert.equal(git('show',`${brief.sha}:VERIFY.md`),git('show','HEAD:VERIFY.md'),'VERIFY.md 建立後被更動');
console.log(JSON.stringify(results,null,2));
console.log('紀錄核對通過：六步均先失敗再通過，實作提交沒有修改測試，驗收表維持原始內容。');
