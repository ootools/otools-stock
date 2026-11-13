// Compact public-provider wire samples, captured 2026-11-13; not displayed as live data.
export function wireQuote(symbol: string, values: Record<number, string>): string {
  const fields = Array<string>(88).fill('')
  for (const [index, value] of Object.entries(values)) fields[Number(index)] = value
  return `v_${symbol}="${fields.join('~')}";`
}
export const cnWire = wireQuote('sh600519', { 0:'1', 1:'贵州茅台', 2:'600519', 3:'1427.95', 4:'1410.27', 5:'1404.00', 6:'20492', 9:'1426.37', 10:'3', 19:'1427.83', 20:'3', 30:'20261113120535', 31:'17.68', 32:'1.25', 33:'1431.95', 34:'1394.00', 36:'20492', 37:'290392', 38:'0.16', 39:'21.73', 45:'17850.54' })
export const hkWire = wireQuote('hk00700', { 0:'100', 1:'腾讯控股', 2:'00700', 3:'388.800', 4:'398.800', 5:'393.000', 6:'16478133.0', 30:'2026/11/13 11:59:59', 31:'-10.000', 32:'-2.51', 33:'395.200', 34:'387.800', 36:'16478133.0', 37:'6444405641.468', 38:'0', 39:'14.20', 45:'35352.2031' })
export const usWire = wireQuote('usAAPL', { 0:'200', 1:'苹果', 2:'AAPL.OQ', 3:'354.88', 4:'355.36', 5:'357.81', 6:'31874978', 30:'2026-11-12 16:00:01', 31:'-0.48', 32:'-0.14', 33:'359.37', 34:'354.41', 35:'USD', 36:'31874978', 37:'11361383723', 38:'0.22', 39:'39.52', 45:'51571.80748' })
export const searchWire = String.raw`v_hint="sh~600519~\u8d35\u5dde\u8305\u53f0~gzmt~GP-A^hk~00700~\u817e\u8baf\u63a7\u80a1~txkg~GP^us~aapl.oq~\u82f9\u679c~pg~GP"`
export const dayWire = JSON.stringify({ code: 0, data: { sh600519: { qfqday: [ ['2026-11-12','1395.130','1410.270','1411.000','1388.110','32373.000'], ['2026-11-13','1404.00','1427.95','1431.95','1394.00','20492'] ] } } })
export const minuteWire = JSON.stringify({ code: 0, data: { sh600519: { data: { date: '20261113', data: ['0930 1404.00 150 21060000.00', '0931 1397.51 864 120847636.00'] } } } })
