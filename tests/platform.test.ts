import { it, expect, vi, afterEach } from 'vitest'
import { saveTextFile, readBackupFile, requestNotifications } from '../src/services/platform'
import { MAX_BACKUP_BYTES } from '../src/domain/snapshot'
afterEach(()=>vi.unstubAllGlobals())
it('uses host save dialog and UTF-8 base64 file write instead of local downloads',async()=>{
 const host={dialog:{save:vi.fn().mockResolvedValue('/tmp/stocks.json')},writeHostFile:vi.fn().mockResolvedValue(undefined)}
 expect(await saveTextFile('你好','stocks.json','application/json',host)).toBe(true)
 const payload=host.writeHostFile.mock.calls[0]![0]
 expect(payload.path).toBe('/tmp/stocks.json');expect(Buffer.from(payload.dataBase64,'base64').toString('utf8')).toBe('你好')
})
it('treats cancelled dialogs as cancellation and bounds imported file sizes',async()=>{
 const host={dialog:{save:vi.fn().mockResolvedValue(null)},writeHostFile:vi.fn()}
 expect(await saveTextFile('x','x.json','application/json',host)).toBe(false)
 expect(host.writeHostFile).not.toHaveBeenCalled()
 await expect(readBackupFile(new File(['x'.repeat(MAX_BACKUP_BYTES+1)],'big.json'))).rejects.toThrow(/2 MiB|过大/)
})
it('requires explicitly granted notification permission and surfaces denied support',async()=>{
 vi.stubGlobal('Notification',{requestPermission:vi.fn().mockResolvedValue('denied'),permission:'default'})
 await expect(requestNotifications()).rejects.toThrow(/权限|拒绝/)
})
