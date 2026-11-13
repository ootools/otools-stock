import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync, existsSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { platformVariants, platformVariant } from '../scripts/platform-packages.mjs'
import { marketPayload } from '../scripts/publish-market.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = JSON.parse(readFileSync(path.join(root, 'plugin.json'), 'utf8'))
const expected = [
 ['windows','x64','windows','packageUrlWindows'], ['windows','arm64','windows-arm','packageUrlWindowsArm'],
 ['macos','arm64','macos','packageUrlMacos'], ['macos','x64','macos-intel','packageUrlMacosIntel'],
 ['linux','x64','linux','packageUrlLinux'], ['linux','arm64','linux-arm','packageUrlLinuxArm'],
]
test('six platform variants exactly match existing OTools architecture and market conventions', () => {
 const variants = platformVariants()
 assert.equal(variants.length, 6)
 for (const [platform, arch, suffix, field] of expected) {
  assert.deepEqual(platformVariant(platform, arch), { platform, arch, suffix, field })
  assert.ok(variants.some(v => v.suffix === suffix))
 }
 assert.throws(() => platformVariant('android','arm64'), /平台|架构/)
 assert.throws(() => platformVariant('macos','x86'), /平台|架构/)
 variants[0].suffix = 'poisoned'
 assert.equal(platformVariant('windows','x64').suffix, 'windows')
})
test('six-package market payload declares exact URLs and no unavailable universal download', () => {
 const tag='plugin-otools-stock-v0.1.0'
 const payload=marketPayload(source,'ootools/otools-stock',tag,'0.1.0',{platformPackages:true})
 assert.equal(payload.packageMode,1)
 assert.equal(payload.packageUrl,undefined)
 for (const [_p,_a,suffix,field] of expected) assert.equal(payload[field],`https://github.com/ootools/otools-stock/releases/download/${tag}/otools-stock-0.1.0-${suffix}.oplg`)
 assert.equal(payload.logo,`https://raw.githubusercontent.com/ootools/otools-stock/${tag}/logo.svg`)
 assert.equal(payload.devUrl,undefined);assert.equal(payload.openMode,'panel')
 assert.throws(()=>marketPayload(source,'ootools/otools-stock','plugin-otools-stock-v9.0.0','0.1.0',{platformPackages:true}),/tag|标签|版本/)
})
test('six-package aggregate passes verification; missing or corrupt platform files fail', {skip:!existsSync(path.join(root,'dist/index.html'))},()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'otools-stock-six-'))
 const run=(script,...args)=>spawnSync(process.execPath,[`scripts/${script}.mjs`,...args],{cwd:root,encoding:'utf8'})
 try {
  const packed=run('pack-plugin','--all-platforms','--out',directory)
  assert.equal(packed.status,0,packed.stderr)
  const names=readdirSync(directory).filter(name=>name.endsWith('.oplg')).sort()
  assert.deepEqual(names,expected.map(([_p,_a,suffix])=>`otools-stock-0.1.0-${suffix}.oplg`).sort())
  const meta=JSON.parse(readFileSync(path.join(directory,'meta.json'),'utf8'))
  assert.equal(meta.packageMode,1);assert.equal(meta.variants.length,6);assert.deepEqual(meta.nativeLibs,[])
  assert.equal(meta.portableFrontend,true)
  for(const item of meta.variants){assert.equal(item.sha256,createHash('sha256').update(readFileSync(path.join(directory,item.filename))).digest('hex'));assert.equal(item.nativeLibraries,0)}
  const checked=run('verify-plugin',directory);assert.equal(checked.status,0,checked.stderr);assert.match(checked.stdout,/6|六/)
  const windows=path.join(directory,'otools-stock-0.1.0-windows.oplg'),original=readFileSync(windows)
  writeFileSync(windows,'tampered');const tampered=run('verify-plugin',directory);assert.notEqual(tampered.status,0);assert.match(tampered.stderr,/摘要|SHA256/)
  writeFileSync(windows,original);unlinkSync(path.join(directory,'otools-stock-0.1.0-linux-arm.oplg'))
  const missing=run('verify-plugin',directory);assert.notEqual(missing.status,0);assert.match(missing.stderr,/缺少|不存在|ENOENT/)
 } finally {rmSync(directory,{recursive:true,force:true})}
})
