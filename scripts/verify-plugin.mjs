/** Verify universal or six-platform pure frontend install archives before release. */
import { inflateRawSync, crc32 } from 'node:zlib'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { platformVariants } from './platform-packages.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const directory=path.resolve(root,process.argv[2]||'dist-pack')
const fail=message=>{throw new Error(message)}
const ok=message=>console.log(`✓ ${message}`)
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
function regular(file) {
  if(!fs.existsSync(file))fail(`缺少文件：${path.basename(file)}`)
  const stat=fs.lstatSync(file)
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>128*1024*1024)fail(`不是有效发布文件：${path.basename(file)}`)
  return fs.readFileSync(file)
}
function safePath(name) {
  if(!name||name.includes('\\')||name.includes(':')||name.startsWith('/')||name.split('/').some(segment=>!segment||segment==='.'||segment==='..'))fail(`ZIP 路径非法：${name}`)
}
function readZip(buffer) {
  let end=-1
  for(let i=buffer.length-22;i>=0&&i>=buffer.length-22-65535;i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break}
  if(end<0)fail('不是有效 ZIP：缺少 EOCD')
  const count=buffer.readUInt16LE(end+10),centralSize=buffer.readUInt32LE(end+12)
  let offset=buffer.readUInt32LE(end+16)
  if(count>2000||offset+centralSize!==end)fail('ZIP 中央目录范围无效')
  const entries=[]
  for(let index=0;index<count;index++) {
    if(offset+46>end||buffer.readUInt32LE(offset)!==0x02014b50)fail('ZIP 中央目录无效')
    const method=buffer.readUInt16LE(offset+10),crc=buffer.readUInt32LE(offset+16),compressed=buffer.readUInt32LE(offset+20),size=buffer.readUInt32LE(offset+24)
    const nameLength=buffer.readUInt16LE(offset+28),extraLength=buffer.readUInt16LE(offset+30),commentLength=buffer.readUInt16LE(offset+32),local=buffer.readUInt32LE(offset+42)
    const name=buffer.toString('utf8',offset+46,offset+46+nameLength);safePath(name)
    if(![0,8].includes(method)||size>128*1024*1024||local+30>buffer.length||buffer.readUInt32LE(local)!==0x04034b50)fail(`ZIP 本地头/压缩格式无效：${name}`)
    const localNameLength=buffer.readUInt16LE(local+26),localExtraLength=buffer.readUInt16LE(local+28)
    if(buffer.toString('utf8',local+30,local+30+localNameLength)!==name)fail(`ZIP 内外文件名不同：${name}`)
    const begin=local+30+localNameLength+localExtraLength
    if(begin+compressed>buffer.length)fail(`ZIP 内容被截断：${name}`)
    const raw=buffer.subarray(begin,begin+compressed),data=method===8?inflateRawSync(raw,{maxOutputLength:128*1024*1024}):Buffer.from(raw)
    if(data.length!==size||crc32(data)!==crc)fail(`ZIP CRC/大小校验失败：${name}`)
    entries.push({name,data});offset+=46+nameLength+extraLength+commentLength
  }
  if(offset!==end||new Set(entries.map(entry=>entry.name)).size!==entries.length)fail('ZIP 含重复文件或目录长度不一致')
  return entries
}
function verifyArchive(file,manifest) {
  const entries=readZip(regular(file)),names=entries.map(entry=>entry.name)
  const inside=entries.find(entry=>entry.name==='plugin.json')
  if(!inside||JSON.stringify(JSON.parse(inside.data))!==JSON.stringify(manifest))fail('ZIP 内外 plugin.json 不一致')
  if(!names.includes(manifest.entry)||!names.includes('logo.svg'))fail('ZIP 缺少入口或图标')
  if(names.some(name=>name.startsWith('lib/')||name.includes('node_modules')||name.endsWith('.map')))fail('ZIP 混入原生库或开发文件')
  const entry=entries.find(item=>item.name===manifest.entry).data.toString('utf8')
  if(!/otools/i.test(entry))fail('入口缺少 OTools 插件标识')
  for(const ref of entry.matchAll(/(?:src|href)=["'](\.\/[^"']+)["']/g)) {
    const resource=path.posix.join(path.posix.dirname(manifest.entry),ref[1]);safePath(resource)
    if(!names.includes(resource))fail(`ZIP 缺少入口引用资源：${resource}`)
  }
  if(names.some(name=>name.startsWith('licenses/'))===false)fail('ZIP 缺少第三方许可证')
  ok(`${path.basename(file)}：${entries.length} 条目，CRC、内外清单及前端资源通过`)
}
function main() {
  if(!fs.existsSync(directory))fail(`目录不存在：${directory}`)
  const manifest=JSON.parse(regular(path.join(directory,'plugin.json')))
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(manifest.packid||'')||manifest.uuid!==manifest.packid||!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(manifest.version||''))fail('plugin.json 无效')
  safePath(manifest.entry)
  if(!manifest.entry.startsWith('dist/')||manifest.openMode!=='panel'||manifest.devUrl||manifest.quickDev||manifest.native?.enabled)fail('必须为无开发开关、无原生依赖的 panel 生产包')
  const meta=JSON.parse(regular(path.join(directory,'meta.json')))
  const aggregate=meta.packageMode===1,variants=aggregate?platformVariants():[meta.variants?.[0]?.suffix?meta.variants[0]:null]
  const files=variants.map(v=>`${manifest.packid}-${manifest.version}${v?`-${v.suffix}`:''}.oplg`)
  const actual=fs.readdirSync(directory).filter(name=>name.endsWith('.oplg')).sort()
  if(JSON.stringify(actual)!==JSON.stringify([...files].sort()))fail('缺少预期平台包，或混入其他版本/变体 .oplg')
  const expected=new Set([...files,'plugin.json','logo.svg']),sums=new Map()
  for(const line of regular(path.join(directory,'SHA256SUMS')).toString('utf8').split('\n').filter(Boolean)) {
    const [digest,name]=line.split('  ')
    if(!/^[0-9a-f]{64}$/.test(digest)||!expected.has(name)||sums.has(name))fail('SHA256 摘要清单包含重复或非法文件')
    sums.set(name,digest)
  }
  if(sums.size!==expected.size)fail('SHA256 摘要清单不完整')
  for(const [name,digest]of sums)if(sha(regular(path.join(directory,name)))!==digest)fail(`摘要不匹配：${name}`)
  ok(`SHA256 覆盖 ${sums.size} 文件，默认 panel，无原生或开发配置`)
  if(meta.packid!==manifest.packid||meta.version!==manifest.version||!meta.portableFrontend||!Array.isArray(meta.nativeLibs)||meta.nativeLibs.length)fail('发布元信息不一致')
  if(!Array.isArray(meta.variants)||meta.variants.length!==files.length)fail('发布变体元信息不完整')
  for(let index=0;index<files.length;index++) {
    const file=files[index],item=meta.variants.find(v=>v.filename===file),variant=variants[index]
    if(!item||item.sha256!==sums.get(file)||item.nativeLibraries!==0||item.bytes!==regular(path.join(directory,file)).length)fail(`包摘要/大小元信息无效：${file}`)
    if(aggregate&&['platform','arch','suffix','field'].some(key=>item[key]!==variant[key]))fail(`平台架构元信息无效：${file}`)
    verifyArchive(path.join(directory,file),manifest)
  }
  if(aggregate&&new Set(meta.variants.map(item=>item.sha256)).size!==1)fail('纯前端六包必须使用同一份已验证页面资源')
  console.log(`\n${aggregate?'6 平台包':files[0]} 校验通过。`)
}
try{main()}catch(error){console.error(`✗ ${error.message}`);process.exitCode=1}
