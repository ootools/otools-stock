import type { AlertEvent, AlertRule, Instrument, Quote } from './types'
export function quoteFresh(quote: Quote, instrument: Instrument, now: number): boolean {
  const age = now - quote.timestamp
  return quote.timestamp > 0 && age >= 0 && age <= (instrument.market === 'CN' ? 5 : 30) * 60_000
}
export function evaluateAlerts(rules: AlertRule[], quotes: Record<string, Quote>, instruments: Record<string, Instrument>, now: number): { rules: AlertRule[]; events: AlertEvent[] } {
  const events: AlertEvent[] = []
  const updated = rules.map(original => {
    const rule = { ...original }, quote = quotes[rule.symbol], instrument = instruments[rule.symbol]
    if (!rule.enabled || !quote || !instrument || !quoteFresh(quote,instrument,now) || (rule.lastQuoteAt !== null && quote.timestamp <= rule.lastQuoteAt)) return rule
    const value = quote[rule.metric]
    if (value === null || !Number.isFinite(value)) return rule
    rule.lastQuoteAt = quote.timestamp
    const meets = rule.direction === 'above' ? value >= rule.threshold : value <= rule.threshold
    if (!meets) { rule.armed = true; return rule }
    if (!rule.armed || (rule.lastTriggeredAt !== null && now - rule.lastTriggeredAt < rule.cooldownMinutes * 60_000)) return rule
    rule.armed = false; rule.lastTriggeredAt = now
    events.push({ id:`event-${rule.id}-${quote.timestamp}`,ruleId:rule.id,symbol:rule.symbol,metric:rule.metric,direction:rule.direction,threshold:rule.threshold,value,triggeredAt:now,exchangeTime:quote.exchangeTime })
    return rule
  })
  return { rules:updated,events }
}
