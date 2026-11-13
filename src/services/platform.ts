import type { AlertEvent, Instrument } from '../domain/types'
import { MAX_BACKUP_BYTES } from '../domain/snapshot'
import { number } from '../domain/format'
export interface FileHost {
  dialog?: { save(options?: {title?:string;defaultPath?:string;filters?:{name:string;extensions:string[]}[]}):Promise<string|null>;open?(options?:{multiple?:boolean;filters?:{name:string;extensions:string[]}[]}):Promise<string|string[]|null> }
  writeHostFile?(request:{path:string;dataBase64:string}):Promise<void>
  readHostFile?(path:string):Promise<{size:number;dataBase64:string}>
}
const hostDefault=():FileHost|null=>typeof window!=='undefined'?window.otools||null:null
function base64(bytes:Uint8Array):string {let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary)}
export async function saveTextFile(text:string,name:string,mime:string,host:FileHost|null=hostDefault()):Promise<boolean>{
  if(host?.dialog?.save && host.writeHostFile){
    const path=await host.dialog.save({title:'保存股票工作台数据',defaultPath:name,filters:[{name:mime==='application/json'?'JSON 备份':'CSV 表格',extensions:[mime==='application/json'?'json':'csv']}]})
    if(!path)return false
    await host.writeHostFile({path,dataBase64:base64(new TextEncoder().encode(text))});return true
  }
  const url=URL.createObjectURL(new Blob([text],{type:`${mime};charset=utf-8`}))
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove()
  setTimeout(()=>URL.revokeObjectURL(url),30000);return true
}
export async function readBackupFile(file:File):Promise<string>{
  if(file.size>MAX_BACKUP_BYTES)throw new Error('备份过大，上限 2 MiB')
  if(typeof file.text==='function')return file.text()
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('备份读取失败'));reader.onload=()=>resolve(String(reader.result));reader.readAsText(file,'utf-8')})
}
export async function pickHostBackup(host:FileHost|null=hostDefault()):Promise<string|null|undefined>{
  if(!host?.dialog?.open || !host.readHostFile)return undefined
  const selected=await host.dialog.open({multiple:false,filters:[{name:'股票工作台 JSON 备份',extensions:['json']}]})
  if(!selected)return null
  const path=Array.isArray(selected)?selected[0]:selected;if(!path)return null
  const payload=await host.readHostFile(path)
  if(payload.size>MAX_BACKUP_BYTES || payload.dataBase64.length>MAX_BACKUP_BYTES*1.34)throw new Error('备份过大，上限 2 MiB')
  return new TextDecoder().decode(Uint8Array.from(atob(payload.dataBase64),c=>c.charCodeAt(0)))
}
export async function requestNotifications():Promise<void>{
  if(typeof Notification==='undefined')throw new Error('当前环境不支持系统通知，可使用站内提醒')
  const permission=await Notification.requestPermission()
  if(permission!=='granted')throw new Error('系统通知权限被拒绝，站内提醒不受影响')
}
let audio:AudioContext|null=null
export async function enableSound():Promise<void>{
  const ctor=globalThis.AudioContext
  if(!ctor)throw new Error('当前环境不支持提示音')
  audio ||= new ctor();await audio.resume()
  if(audio.state!=='running')throw new Error('浏览器阻止提示音，请点击按钮后重试')
}
export async function playSound():Promise<void>{
  if(!audio || audio.state!=='running')throw new Error('提示音尚未启用，请在设置中点击启用')
  const oscillator=audio.createOscillator(),gain=audio.createGain()
  oscillator.type='sine';oscillator.frequency.value=880;gain.gain.setValueAtTime(0.08,audio.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,audio.currentTime+0.3)
  oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+0.3)
}
export async function sendAlertNotifications(events:AlertEvent[],instruments:Record<string,Instrument>):Promise<void>{
  if(typeof Notification==='undefined' || Notification.permission!=='granted')throw new Error('系统通知未获得权限，触发记录已保存在站内')
  for(const event of events){const name=instruments[event.symbol]?.name||event.symbol;new Notification(`股票提醒 · ${name}`,{body:`${event.metric==='price'?'价格':'涨跌幅'} ${number(event.value)}${event.metric==='changePercent'?'%':''}，已触发设置阈值`,tag:event.id})}
}
export function openExternal(url:string):void{
  const target=new URL(url);if(target.protocol!=='https:')throw new Error('只允许 HTTPS 外链')
  if(window.otools?.shellOpenExternal)window.otools.shellOpenExternal(target.href);else window.open(target.href,'_blank','noopener,noreferrer')
}
