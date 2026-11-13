import type { Market } from './types'
import { validDate } from './validation'
export function parseExchangeTimestamp(raw: string, market: Market): number {
  const compact = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(raw)
  const readable = /^(\d{4})[/-](\d{2})[/-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(raw)
  const m = compact || readable
  if (!m) return 0
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number) as [number, number, number, number, number, number]
  if (!validDate(`${m[1]}-${m[2]}-${m[3]}`) || hour > 23 || minute > 59 || second > 59) return 0
  const utc = Date.UTC(year, month - 1, day, hour, minute, second)
  if (market !== 'US') return utc - 8 * 60 * 60 * 1000
  // Derive New York's actual date offset, including summer DST, without assuming the user's timezone.
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' })
  let timestamp = utc + 5 * 60 * 60 * 1000
  for (let iteration = 0; iteration < 2; iteration++) {
    const fields = Object.fromEntries(formatter.formatToParts(timestamp).map(p => [p.type, p.value]))
    const local = Date.UTC(Number(fields.year),Number(fields.month)-1,Number(fields.day),Number(fields.hour),Number(fields.minute),Number(fields.second))
    timestamp += utc - local
  }
  return timestamp
}
