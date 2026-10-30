import asyncio, base64, json, sys, os
from playwright.async_api import async_playwright
# ทดสอบ "โฟลเดอร์เฝ้าดู" ด้วย directory handle จำลอง (headless เปิด picker จริงไม่ได้)
# ใช้: python tests/watch_test.py "D:/TET กราฟรายงงาน"
U=(sys.argv[1] if len(sys.argv)>1 else "D:/TET กราฟรายงงาน").rstrip("/\\")+"/"
P=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/"
OK=[]
def chk(n,c,x=''): OK.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n,x)
b64=lambda n: base64.b64encode(open(U+n,'rb').read()).decode()
SRC={'pend':b64('ค้างส่ง 20.10.2026_ตามรูป.xlsx'),'bill':b64('เปิดบิลขาย 20.10.2026_pivot_summary.xlsx'),'order':b64('20.10.2026 สรุป.xlsx')}
INIT=r'''
window.__localMode=1;
(function(){
  const files=()=>JSON.parse(sessionStorage.getItem('__fakeFiles')||'[]');
  const mk=f=>{ const b=Uint8Array.from(atob(f.b64),c=>c.charCodeAt(0)); return new File([b],f.name,{lastModified:f.mtime}); };
  const handle={kind:'directory',name:'TEST รายงาน',
    async *entries(){ for(const f of files()) yield [f.name,{kind:'file',async getFile(){ return mk(f); }}]; },
    async queryPermission(){ return sessionStorage.getItem('__perm')||'granted'; },
    async requestPermission(){ sessionStorage.setItem('__perm','granted'); window.__asked=1; return 'granted'; }};
  window.showDirectoryPicker=async()=>{ sessionStorage.setItem('__dirSaved','1'); return handle; };
  // IndexedDB จำลอง: เก็บแค่ flag ว่ามี handle
  Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){ const r={}; setTimeout(()=>{ r.result={ createObjectStore(){}, transaction(){ return {objectStore(){ return {
      get(){ const t={}; setTimeout(()=>{ t.result=sessionStorage.getItem('__dirSaved')?handle:null; t.onsuccess&&t.onsuccess(); }); return t; },
      put(){ sessionStorage.setItem('__dirSaved','1'); }, delete(){ sessionStorage.removeItem('__dirSaved'); } }; }, set oncomplete(f){ setTimeout(f); } }; } }; r.onsuccess&&r.onsuccess(); }); return r; }}});
})();'''
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Asia/Bangkok',viewport={'width':1400,'height':900})
    await ctx.add_init_script(INIT); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    url='file://'+P+'index.html'
    def setfiles(lst): return pg.evaluate("l=>sessionStorage.setItem('__fakeFiles',JSON.stringify(l))",lst)
    base=[{'name':'ค้างส่ง 29.10.2026_ตามรูป.xlsx','b64':SRC['pend'],'mtime':1000},{'name':'เปิดบิลขาย 29.10.2026_pivot_summary.xlsx','b64':SRC['bill'],'mtime':1000},
          {'name':'29.10.2026 สรุป.xlsx','b64':SRC['order'],'mtime':1000},{'name':'ค้างส่ง 29.10.2026.xlsx','b64':SRC['pend'],'mtime':1000},{'name':'~$ค้างส่ง 29.10.2026_ตามรูป.xlsx','b64':SRC['pend'],'mtime':1000}]
    await pg.goto(url); await pg.wait_for_timeout(500); await setfiles(base)
    chk('bar shows pick button', await pg.is_visible('#watchBar [data-w="pick"]'))
    await pg.click('#watchBar [data-w="pick"]'); await pg.wait_for_timeout(800)
    t=await pg.text_content('#toast'); chk('picked: 3 existing files marked seen, none imported', '3 ไฟล์เดิม' in t and await pg.evaluate('pending.length')==0, t)
    chk('bar shows watching', 'เฝ้าดู' in await pg.text_content('#watchBar'))
    # new day arrives -> reload -> preview cards
    await setfiles(base+[{'name':'ค้างส่ง 30.10.2026_ตามรูป.xlsx','b64':SRC['pend'],'mtime':2000},{'name':'เปิดบิลขาย 30.10.2026_pivot_summary.xlsx','b64':SRC['bill'],'mtime':2000},{'name':'30.10.2026 สรุป.xlsx','b64':SRC['order'],'mtime':2000},{'name':'ค้างส่ง 30.10.2026.xlsx','b64':SRC['pend'],'mtime':2000}])
    await pg.reload(); await pg.wait_for_timeout(2500)
    print('DBG', await pg.evaluate("JSON.stringify({dir:!!Watch.dir, meta:Watch.meta, bar:document.getElementById('watchBar').textContent, saved:sessionStorage.getItem('__dirSaved'), nf:JSON.parse(sessionStorage.getItem('__fakeFiles')).length})"), errs)
    n=await pg.evaluate('pending.length'); chk('reload: 3 new files -> 3 preview cards (raw file ignored)', n==3, n)
    chk('save button visible', await pg.is_visible('#btnSaveAll'))
    await pg.click('#btnSaveAll'); await pg.wait_for_timeout(800)
    dd=await pg.evaluate("JSON.stringify(Object.fromEntries(Object.entries(S.months['2026-10'].d).map(([d,r])=>[d,Object.keys(r).filter(k=>k!=='_src')])))")
    chk('saved data from 3 files (order 20/10 content, pend/bill by filename 30/10)', '"2026-10-20":["white"' in dd and '2026-10-30' in dd, dd)
    await pg.reload(); await pg.wait_for_timeout(2000)
    chk('reload again: nothing new', await pg.evaluate('pending.length')==0 and 'ไม่มีไฟล์ใหม่' in await pg.text_content('#watchBar'), await pg.text_content('#watchBar'))
    # permission prompt path
    await pg.evaluate("sessionStorage.setItem('__perm','prompt')")
    await setfiles(base+[{'name':'ค้างส่ง 31.10.2026_ตามรูป.xlsx','b64':SRC['pend'],'mtime':3000}])
    await pg.reload(); await pg.wait_for_timeout(1500)
    chk('perm prompt: shows click-to-scan, no auto import', await pg.is_visible('#watchBar [data-w="scan"]') and 'ยืนยันสิทธิ์' in await pg.text_content('#watchBar') and await pg.evaluate('pending.length')==0)
    await pg.click('#watchBar [data-w="scan"]'); await pg.wait_for_timeout(1500)
    chk('after click: permission asked + 1 card', await pg.evaluate('window.__asked')==1 and await pg.evaluate('pending.length')==1)
    # cancel marks seen
    await pg.click('#btnClearPv'); await pg.wait_for_timeout(300); await pg.reload(); await pg.wait_for_timeout(2000)
    chk('cancelled file not shown again', await pg.evaluate('pending.length')==0)
    # forget
    await pg.click('#watchBar [data-w="forget"]'); await pg.wait_for_timeout(500)
    chk('forget -> pick button back', await pg.is_visible('#watchBar [data-w="pick"]'))
    await pg.screenshot(path=P+'test/watch.png')
    # browser without API -> bar hidden
    pg2=await ctx.new_page(); await pg2.add_init_script('delete window.showDirectoryPicker'); await pg2.goto(url); await pg2.wait_for_timeout(500)
    chk('no API -> bar hidden', await pg2.evaluate("document.getElementById('watchBar').hidden"))
    chk('no page errors', not errs, errs)
    await b.close()
  print('ALL PASS' if all(OK) else 'SOME FAILED')
asyncio.run(main())
