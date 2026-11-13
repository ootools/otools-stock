import { describe, it, expect } from 'vitest'
import { evaluateAlerts } from '../src/domain/alerts'
import type { AlertRule } from '../src/domain/types'
import { maotai, apple, quote, now } from './fixtures/domain'
const rule = (overrides: Partial<AlertRule> = {}): AlertRule => ({id:'rule-1',symbol:'sh600519',metric:'price',direction:'above',threshold:120,enabled:true,cooldownMinutes:5,armed:true,lastTriggeredAt:null,lastQuoteAt:null,...overrides})
const run = (rules:AlertRule[],q=quote(),time=now) => evaluateAlerts(rules,{[q.symbol]:q},{sh600519:maotai,usAAPL:apple},time)
describe('threshold alerts',()=>{
 it('fires once on equality and persists disarmed/last quote state',()=>{
  const first=run([rule()]);expect(first.events).toHaveLength(1)
  expect(first.rules[0]).toMatchObject({armed:false,lastQuoteAt:now,lastTriggeredAt:now})
  expect(run(first.rules).events).toEqual([])
  expect(run(first.rules,quote({timestamp:now+1000}),now+1000).events).toEqual([])
 })
 it('rearms only after the condition becomes false and honors cooldown',()=>{
  const first=run([rule()]);const below=run(first.rules,quote({price:110,timestamp:now+1000}),now+1000)
  expect(below.rules[0]!.armed).toBe(true)
  const tooEarly=run(below.rules,quote({price:121,timestamp:now+2000}),now+2000)
  expect(tooEarly.events).toEqual([]);expect(tooEarly.rules[0]!.armed).toBe(true)
  const later=run(tooEarly.rules,quote({price:121,timestamp:now+301000}),now+301000)
  expect(later.events).toHaveLength(1)
 })
 it('ignores stale/future/duplicate/unknown timestamps and disabled rules',()=>{
  for(const q of [quote({timestamp:now-301000}),quote({timestamp:now+60000}),quote({timestamp:0})])expect(run([rule()],q).events).toEqual([])
  expect(run([rule({enabled:false})]).events).toEqual([])
  expect(run([rule({lastQuoteAt:now})]).events).toEqual([])
 })
 it('does not coerce a missing change percent into a triggered zero',()=>{
  expect(run([rule({metric:'changePercent',direction:'below',threshold:0})],quote({changePercent:null})).events).toEqual([])
 })
 it('allows foreign delayed data only within a bounded 30-minute freshness window',()=>{
  const rules=[rule({symbol:'usAAPL'})]
  expect(run(rules,quote({symbol:'usAAPL',timestamp:now-20*60000})).events).toHaveLength(1)
  expect(run(rules,quote({symbol:'usAAPL',timestamp:now-31*60000})).events).toHaveLength(0)
 })
 it('never mutates input rules',()=>{
  const r=rule();run([r]);expect(r.armed).toBe(true);expect(r.lastQuoteAt).toBeNull()
 })
})
