import type { ChartPoint } from './types'
export interface PlotCandle { x:number; y:number; width:number; height:number; highY:number; lowY:number; volumeY:number; volumeHeight:number; up:boolean; point:ChartPoint }
export interface ChartGeometry { candles:PlotCandle[]; linePath:string; areaPath:string; averagePath:string; maPaths:{period:number;path:string}[]; ticks:{y:number;value:number}[]; timeTicks:{x:number;label:string}[]; left:number; right:number; top:number; bottom:number; volumeBottom:number }
const pathFor = (values:(number|null)[],x:(i:number)=>number,y:(value:number)=>number):string => {
  let path='',connected=false
  values.forEach((value,i)=>{if(value===null){connected=false;return}path+=`${connected?'L':'M'}${x(i).toFixed(2)},${y(value).toFixed(2)} `;connected=true})
  return path.trim()
}
export function movingAverage(points:ChartPoint[],period:number):(number|null)[]{
  if(!Number.isInteger(period)||period<=0)throw new Error('均线周期无效')
  let total=0
  return points.map((point,i)=>{total+=point.close;if(i>=period)total-=points[i-period]!.close;return i>=period-1?total/period:null})
}
export function buildChartGeometry(points:ChartPoint[],minute:boolean):ChartGeometry{
  const left=12,right=574,top=18,bottom=218,volumeBottom=294
  if(!points.length)return {candles:[],linePath:'',areaPath:'',averagePath:'',maPaths:[],ticks:[],timeTicks:[],left,right,top,bottom,volumeBottom}
  const values=points.flatMap(p=>[p.high,p.low,...(minute && p.average ? [p.average] : [])])
  let min=Math.min(...values),max=Math.max(...values)
  const margin=Math.max((max-min)*0.09,Math.max(Math.abs(max),1)*0.002)
  min-=margin;max+=margin
  const span=(right-left)/points.length,width=Math.max(1.2,Math.min(11,span*0.62))
  const x=(i:number)=>left+span*(i+0.5),y=(value:number)=>bottom-(value-min)/(max-min)*(bottom-top)
  const maxVolume=Math.max(1,...points.map(p=>p.volume))
  const candles=points.map((point,i)=>({x:x(i),y:Math.min(y(point.open),y(point.close)),width,height:Math.max(1,Math.abs(y(point.open)-y(point.close))),highY:y(point.high),lowY:y(point.low),volumeY:volumeBottom-point.volume/maxVolume*48,volumeHeight:point.volume/maxVolume*48,up:point.close>=point.open,point}))
  const linePath=pathFor(points.map(p=>p.close),x,y)
  const areaPath=`${linePath} L${x(points.length-1).toFixed(2)},${bottom} L${x(0).toFixed(2)},${bottom} Z`
  const ticks=Array.from({length:5},(_,i)=>({y:top+(bottom-top)*i/4,value:max-(max-min)*i/4}))
  const indices=[...new Set([0,Math.floor((points.length-1)/2),points.length-1])]
  return {candles,linePath,areaPath,averagePath:pathFor(points.map(p=>p.average??null),x,y),maPaths:[5,10,20].map(period=>({period,path:pathFor(movingAverage(points,period),x,y)})),ticks,timeTicks:indices.map(i=>({x:x(i),label:minute?points[i]!.time:points[i]!.time.slice(5)})),left,right,top,bottom,volumeBottom}
}
