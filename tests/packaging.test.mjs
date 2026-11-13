import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { productionManifest } from '../scripts/pack-plugin.mjs'
import { releaseMeta, marketPayload } from '../scripts/publish-market.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const source=JSON.parse(readFileSync(path.join(root,'plugin.json'),'utf8'))
test('production package keeps panel mode and strips only development switches without mutating source',()=>{
 const result=productionManifest(source)
 assert.equal(result.openMode,'panel');assert.equal(result.devUrl,undefined);assert.equal(result.quickDev,undefined)
 assert.equal(source.devUrl,'http://127.0.0.1:6552');assert.equal(source.quickDev,true)
 assert.equal(result.version,'0.1.0')
 for(const entry of ['../index.html','/etc/passwd','dist/../index.html','C:/index.html','dist\\index.html'])assert.throws(()=>productionManifest({...source,entry}))
})
test('publish metadata uses immutable version tag logo and sanitized package manifest',()=>{
 const tag='plugin-otools-stock-v0.1.0'
 assert.equal(releaseMeta(source,'',tag).release_tag,tag)
 assert.throws(()=>releaseMeta(source,'', 'plugin-otools-stock-v9.0.0'))
 const payload=marketPayload(source,'ootools/otools-stock',tag,'0.1.0')
 assert.equal(payload.logo,`https://raw.githubusercontent.com/ootools/otools-stock/${tag}/logo.svg`)
 assert.equal(payload.openMode,'panel');assert.equal(payload.devUrl,undefined)
 assert.equal(payload.packageUrl,`https://github.com/ootools/otools-stock/releases/download/${tag}/otools-stock-0.1.0.oplg`)
})
test('standalone archive and all metadata pass CRC/SHA256 validation; tampering is rejected', {skip:!existsSync(path.join(root,'dist/index.html'))},()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'otools-stock-pack-'))
 try{
  const pack=spawnSync(process.execPath,['scripts/pack-plugin.mjs','--out',directory],{cwd:root,encoding:'utf8'})
  assert.equal(pack.status,0,pack.stderr)
  const verify=spawnSync(process.execPath,['scripts/verify-plugin.mjs',directory],{cwd:root,encoding:'utf8'})
  assert.equal(verify.status,0,verify.stderr)
  assert.match(verify.stdout,/校验通过/)
  const meta=JSON.parse(readFileSync(path.join(directory,'meta.json'),'utf8'));assert.deepEqual(meta.nativeLibs,[])
  writeFileSync(path.join(directory,'logo.svg'), 'tampered')
  const invalid=spawnSync(process.execPath,['scripts/verify-plugin.mjs',directory],{cwd:root,encoding:'utf8'})
  assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/摘要不匹配/)
 }finally{rmSync(directory,{recursive:true,force:true})}
})
