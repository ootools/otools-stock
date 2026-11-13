import { build } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
await build({root,configFile:path.join(root,'vite.config.ts')})
console.log('OTools Stock web assets built in dist/')
