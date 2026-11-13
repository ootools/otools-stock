import { test } from 'node:test'
import assert from 'node:assert/strict'
import { klineSmokeCases, summarizeKline } from '../scripts/kline-smoke.mjs'

const rows = [
  ['2026-11-12', '100', '110', '115', '98', '3000'],
  ['2026-11-13', '110', '108', '112', '105', '2000'],
]
const payload = (symbol, field, data = rows) => ({ code: 0, data: { [symbol]: { [field]: data } } })

test('live check covers A/HK/US daily, weekly and monthly candles', () => {
  const cases = klineSmokeCases()
  assert.equal(cases.length, 9)
  assert.equal(new Set(cases.map(c => `${c.symbol}/${c.period}`)).size, 9)
  for (const symbol of ['sh600519', 'hk00700', 'usAAPL.OQ']) {
    assert.deepEqual(cases.filter(c => c.symbol === symbol).map(c => c.period), ['day', 'week', 'month'])
    for (const item of cases.filter(c => c.symbol === symbol)) assert.equal(item.path, `/__market/chart?symbol=${symbol}&period=${item.period}`)
  }
})

test('reads the actual requested period and both adjusted and unadjusted field shapes', () => {
  for (const period of ['day', 'week', 'month']) {
    assert.deepEqual(summarizeKline(payload('sh600519', `qfq${period}`), 'sh600519', period), { field: `qfq${period}`, points: 2, first: '2026-11-12', last: '2026-11-13' })
    assert.equal(summarizeKline(payload('hk00700', period), 'hk00700', period).field, period)
    assert.equal(summarizeKline(payload('usAAPL.OQ', `qfq${period}`), 'usAAPL.OQ', period).points, 2)
  }
  assert.throws(() => summarizeKline(payload('sh600519', 'day'), 'sh600519', 'week'), /K线|历史|周期/)
})

test('rejects provider errors, wrong symbol, empty arrays and unusable fake candles', () => {
  const invalid = [
    { code: 1, data: {} }, { code: 0, data: {} }, payload('hk00700', 'day'),
    payload('sh600519', 'qfqday', []),
    payload('sh600519', 'qfqday', [['2026-02-30', '10', '11', '12', '9', '1'], ['2026-11-13', '10', '11', '9', '12', '1']]),
    payload('sh600519', 'qfqday', [['2026-11-12', '0', '10', '12', '9', '1'], ['2026-11-13', '10', 'NaN', '12', '9', '-1']]),
  ]
  for (const value of invalid) assert.throws(() => summarizeKline(value, 'sh600519', 'day'), /K线|历史|行情/)
})

test('counts only unique usable dates, not duplicate rows or damaged record length', () => {
  const valid = summarizeKline(payload('sh600519', 'qfqday', [rows[1], rows[0], rows[0], ['2026-02-30', '10', '10', '10', '10', '0']]), 'sh600519', 'day')
  assert.deepEqual(valid, { field: 'qfqday', points: 2, first: '2026-11-12', last: '2026-11-13' })
  assert.throws(() => summarizeKline(payload('sh600519', 'qfqday', [rows[0], rows[0]]), 'sh600519', 'day'), /K线|历史/)
})
