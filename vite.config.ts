import { defineConfig } from 'vite'
import type { UserConfig } from 'vite'
import type { InlineConfig } from 'vitest/node'
import vue from '@vitejs/plugin-vue'
import { marketProxyPlugin } from './scripts/market-proxy.mjs'
import { otoolsTauriShimPlugin } from 'otools-plugin-sdk/vite'
import type { Plugin } from 'vite'

const config: UserConfig & { test: InlineConfig } = {
  base: './',
  plugins: [vue(), marketProxyPlugin(), otoolsTauriShimPlugin() as unknown as Plugin],
  define: { __OTOOLS_PLUGIN_UUID__: JSON.stringify('otools-stock') },
  server: { host: '127.0.0.1', port: 6552, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'], restoreMocks: true, clearMocks: true },
}
export default defineConfig(config)
