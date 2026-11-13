import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const read = name => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'))
test('independent panel manifest and package versions agree', () => {
  const manifest = read('plugin.json'), pkg = read('package.json')
  assert.equal(manifest.packid, 'otools-stock')
  assert.equal(manifest.uuid, manifest.packid)
  assert.equal(manifest.version, pkg.version)
  assert.equal(manifest.openMode, 'panel')
  assert.equal(manifest.entry, 'dist/index.html')
  assert.equal(manifest.devUrl, 'http://127.0.0.1:6552')
  assert.equal(manifest.native, undefined)
  assert.ok(Object.values(pkg.dependencies).every(value => !value.startsWith('file:..') && !value.startsWith('link:..')))
})

test('official SDK runtime snapshot is included in version control rather than ignored dist',()=>{
 const rootIgnore=readFileSync(new URL('../.gitignore',import.meta.url),'utf8')
 const sdkIgnore=readFileSync(new URL('../vendor/otools-plugin-sdk/.gitignore',import.meta.url),'utf8')
 assert.ok(rootIgnore.split('\n').includes('/dist/'))
 assert.ok(!sdkIgnore.split('\n').includes('dist/'))
 assert.ok(readFileSync(new URL('../vendor/otools-plugin-sdk/dist/index.js',import.meta.url),'utf8').includes('export'))
})
