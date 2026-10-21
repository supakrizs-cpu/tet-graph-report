import asyncio, json
from playwright.async_api import async_playwright
# ทดสอบโหมดออนไลน์ด้วย Supabase จำลอง (ไม่แตะข้อมูลจริง)
# ใช้: python tests/online_test.py "D:/TET กราฟรายงงาน"   (ต้อง pip install playwright + python -m playwright install chromium)
import sys, os
U=(sys.argv[1] if len(sys.argv)>1 else "D:/TET กราฟรายงงาน").rstrip("/\\")+"/"
P=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Asia/Bangkok',viewport={'width':1500,'height':900})
    async def route(r):
      path=r.request.url.split('https://tet.test/')[1] or 'index.html'
      src={'supabase.js':P+'tests/mock-supabase.js'}.get(path,P+'public/'+path)
      try: body=open(src,'rb').read()
      except: return await r.fulfill(status=404,body='nf')
      ct='text/html; charset=utf-8' if path.endswith('.html') else 'application/javascript'
      await r.fulfill(status=200,body=body,headers={'content-type':ct})
    await ctx.route('https://tet.test/**',route)
    pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('https://tet.test/'); await pg.wait_for_timeout(500)
    print('login visible', await pg.is_visible('#login'))
    await pg.fill('#lgU','sale'); await pg.fill('#lgP','bad'); await pg.click('#lgBtn'); await pg.wait_for_timeout(200)
    print('bad msg', await pg.text_content('#lgMsg'))
    await pg.fill('#lgP','pw'); await pg.click('#lgBtn'); await pg.wait_for_timeout(500)
    print('sync', await pg.text_content('#sync'))
    await pg.set_input_files('#fileIn',[U+'สรุปปี2026.xlsx']); await pg.wait_for_timeout(1500); await pg.click('#btnSaveAll'); await pg.wait_for_timeout(1500)
    print('pushed', await pg.evaluate('JSON.stringify(window.__mockLog)'), '|', await pg.text_content('#sync'))
    # edit one cell -> only that month row pushed
    await pg.click('#tabs button[data-v="grid"]'); await pg.wait_for_timeout(300)
    i=pg.locator('#grid input[data-d="2026-10-21"][data-k="rawIn"]'); await i.fill('40'); await i.press('Enter'); await pg.wait_for_timeout(1500)
    print('after edit', await pg.evaluate('JSON.stringify(window.__mockLog.slice(-1))'))
    # failure path
    await pg.evaluate('window.__mockFail=true'); i=pg.locator('#grid input[data-d="2026-10-22"][data-k="rawIn"]'); await i.fill('41'); await i.press('Enter'); await pg.wait_for_timeout(1500)
    print('fail', await pg.text_content('#sync'))
    await pg.evaluate('window.__mockFail=false'); await pg.click('[data-sync="retry"]'); await pg.wait_for_timeout(600)
    print('retry', await pg.text_content('#sync'))
    # second "device": clear local cache, reload -> data comes from server
    await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(1200)
    print('login again?', await pg.is_visible('#login'), 'rawIn 22 from server:', await pg.evaluate("S.months['2026-10'].d['2026-10-22'].rawIn"), 'months', await pg.evaluate("Object.keys(S.months).join(',')"))
    await pg.click('#tabs button[data-v="charts"]'); await pg.wait_for_timeout(800); await pg.screenshot(path='online-test.png')
    await pg.click('[data-sync="out"]'); await pg.wait_for_timeout(800)
    print('after logout login visible', await pg.is_visible('#login'))
    print('ERR',errs)
    await b.close()
asyncio.run(main())
