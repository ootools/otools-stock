import type { Trade } from './types'
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2200-12-31'
}
export function decimal(value: unknown, places: number, max: number, allowZero = true): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (!allowZero && value === 0)) return false
  const scaled = value * 10 ** places
  return Math.abs(scaled - Math.round(scaled)) < 0.000001
}
export function validateTrade(trade: Trade): void {
  if (!['opening', 'buy', 'sell'].includes(trade.type)) throw new Error('无效的交易类型')
  if (!validDate(trade.date)) throw new Error('无效的交易日期')
  if (!decimal(trade.quantity, 4, 100_000_000, false)) throw new Error('持股数量必须为正数，最多四位小数')
  if (!decimal(trade.price, 6, 10_000_000, false)) throw new Error('成交价必须为正数，最多六位小数')
  if (!decimal(trade.fees, 6, 1_000_000_000)) throw new Error('费用必须为非负数，最多六位小数')
  if (trade.quantity * trade.price > 1e12) throw new Error('单笔交易金额过大')
  if (typeof trade.note !== 'string' || trade.note.length > 500) throw new Error('交易备注过长')
}
export function exchangeDate(value: string): string | null {
  const match = /^(\d{4})[/-]?(\d{2})[/-]?(\d{2})/.exec(value)
  const date = match ? `${match[1]}-${match[2]}-${match[3]}` : ''
  return validDate(date) ? date : null
}
