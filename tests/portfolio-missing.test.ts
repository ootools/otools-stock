import { it,expect } from 'vitest'
import { buildPortfolio } from '../src/domain/portfolio'
import { instruments,quote,trade } from './fixtures/domain'
it('does not include a zero-share known value in a wholly unpriced active-currency subtotal',()=>{
 const portfolio=buildPortfolio([
  trade({symbol:'hk00700',type:'buy',quantity:1,fees:0}),
  trade({symbol:'hk00700',type:'sell',quantity:1,fees:0}),
  trade({symbol:'sh600519',quantity:1,fees:0}),
 ],instruments,{})
 expect(portfolio.summaries.find(s=>s.currency==='CNY')).toMatchObject({marketValue:null,missingQuotes:1})
 expect(portfolio.summaries.find(s=>s.currency==='HKD')).toMatchObject({marketValue:0,missingQuotes:0})
})
