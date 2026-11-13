import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
export { marketTarget } from './market-routes.mjs'
export const MAX_MARKET_BYTES: number
export function marketProxy(): (req: IncomingMessage, res: ServerResponse, next?: () => void) => Promise<void>
export function marketProxyPlugin(): Plugin
