import type { Currency } from './types'
export const number = (value: number | null | undefined, digits = 2): string => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
export const signed = (value: number | null | undefined, digits = 2): string => value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${number(value, digits)}`
export const percent = (value: number | null | undefined): string => value == null ? '—' : `${signed(value)}%`
export const amount = (value: number | null | undefined): string => value == null || !Number.isFinite(value) ? '—' : Math.abs(value) >= 1e8 ? `${number(value / 1e8)}亿` : Math.abs(value) >= 1e4 ? `${number(value / 1e4)}万` : number(value, 0)
export const shares = (value: number): string => value.toLocaleString('zh-CN', { maximumFractionDigits: 4 })
export const currencySymbol = (currency: Currency): string => ({ CNY: '¥', HKD: 'HK$', USD: '$' })[currency]
export const currencyName = (currency: Currency): string => ({ CNY: '人民币', HKD: '港币', USD: '美元' })[currency]
export const trendClass = (value: number | null | undefined): string => value == null || value === 0 ? 'neutral' : value > 0 ? 'up' : 'down'
export const localDate = (now = new Date()): string => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
export const timeLabel = (value: string): string => /^\d{14}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}` : value || '时间未知'
