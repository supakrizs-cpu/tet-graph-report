import asyncio, base64, datetime, json, sys, os
from playwright.async_api import async_playwright
# ทดสอบ "โฟลเดอร์เฝ้าดู" ด้วย directory handle จำลอง (headless เปิด picker จริงไม่ได้)
# ใช้: python tests/watch_test.py "D:/TET กราฟรายงงาน"
# ไฟล์จำลองพิเศษ (ช่อง b64): LOCKED = getFile โยน error · HANG = getFile ค้าง · RLOCK = อ่านเนื้อไฟล์แล้ว error · RHANG = อ่านเนื้อไฟล์ค้าง
U=(sys.argv[1] if len(sys.argv)>1 else "D:/TET กราฟรายงงาน").rstrip("/\\")+"/"
P=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/"
OK=[]
def chk(n,c,x=''): OK.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n,x)
b64=lambda n: base64.b64encode(open(U+n,'rb').read()).decode()
SRC={'pend':b64('ค้างส่ง 20.10.2026_ตามรูป.xlsx'),'bill':b64('เปิดบิลขาย 20.10.2026_pivot_summary.xlsx'),'order':b64('20.10.2026 สรุป.xlsx')}
INIT=r'''
window.__localMode=1;
window.__watchT={perm:500,list:4000,stat:400,read:400,stuck:700};
(function(){
  const ss=k=>sessionStorage.getItem(k);
  const files=()=>JSON.parse(ss('__fakeFiles')||'[]');
  const never=()=>new Promise(()=>{});
  const nre=()=>new DOMException('The requested file could not be read','NotReadableError');
  const mk=f=>{ const raw=['RLOCK','RHANG'].includes(f.b64)?'': f.b64; const b=Uint8Array.from(atob(raw),c=>c.charCodeAt(0)); const o=new File([b],f.name,{lastModified:f.mtime});
    if(f.b64==='RLOCK') o.arrayBuffer=()=>Promise.reject(nre()); if(f.b64==='RHANG') o.arrayBuffer=never; return o; };
  const fh=f=>({kind:'file',name:f.name,async getFile(){ if(f.b64==='LOCKED') throw nre(); if(f.b64==='HANG') return never(); return mk(f); }});
  const handle={kind:'directory',name:'TEST รายงาน',
    async *entries(){ if(ss('__entriesFail')) throw new DOMException('state had changed since it was read from disk','InvalidStateError'); for(const f of files()) yield [f.name,fh(f)]; },
    async getFileHandle(n){ window.__probed=(window.__probed||0)+1; if(ss('__probeFail')) throw new DOMException('not allowed by the user agent','NotAllowedError'); const f=files().find(x=>x.name===n); if(!f) throw new DOMException('not found','NotFoundError'); return fh(f); },
    async isSameEntry(o){ if(ss('__sameFail')) throw new DOMException('x','InvalidStateError'); return o===handle; },
    async queryPermission(){ if(ss('__permHang')==='query') return never(); return ss('__perm')||'granted'; },
    async requestPermission(){ window.__asked=(window.__asked||0)+1; if(ss('__permHang')==='request') return never(); sessionStorage.setItem('__perm','granted'); return 'granted'; }};
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
    ss=lambda k,v: pg.evaluate("([k,v])=>v==null?sessionStorage.removeItem(k):sessionStorage.setItem(k,v)",[k,v])
    bar=lambda: pg.text_content('#watchBar')
    npend=lambda: pg.evaluate('pending.length')
    async def reload(ms=2000): await pg.reload(); await pg.wait_for_timeout(ms)
    async def scan(ms=1500): await pg.click('#watchBar [data-w="scan"]'); await pg.wait_for_timeout(ms)
    async def clear():
      if await pg.is_visible('#btnClearPv'): await pg.click('#btnClearPv'); await pg.wait_for_timeout(200)
    F=lambda name,src,mt: {'name':name,'b64':SRC.get(src,src),'mtime':mt}
    base=[F('ค้างส่ง 29.10.2026_ตามรูป.xlsx','pend',1000),F('เปิดบิลขาย 29.10.2026_pivot_summary.xlsx','bill',1000),F('29.10.2026 สรุป.xlsx','order',1000),
          F('ค้างส่ง 29.10.2026.xlsx','pend',1000),F('~$ค้างส่ง 29.10.2026_ตามรูป.xlsx','pend',1000)]
    await pg.goto(url); await pg.wait_for_timeout(500); await setfiles(base)
    chk('bar shows pick button', await pg.is_visible('#watchBar [data-w="pick"]'))
    await pg.click('#watchBar [data-w="pick"]'); await pg.wait_for_timeout(800)
    t=await pg.text_content('#toast'); chk('picked: 3 existing files marked seen, none imported', '3 ไฟล์เดิม' in t and await npend()==0, t)
    chk('bar shows watching', 'เฝ้าดู' in await bar())
    # --- ไฟล์วันใหม่มา -> เปิดหน้าใหม่ -> การ์ดตัวอย่าง ---
    await setfiles(base+[F('ค้างส่ง 30.10.2026_ตามรูป.xlsx','pend',2000),F('เปิดบิลขาย 30.10.2026_pivot_summary.xlsx','bill',2000),F('30.10.2026 สรุป.xlsx','order',2000),F('ค้างส่ง 30.10.2026.xlsx','pend',2000)])
    await reload(2500)
    n=await npend(); chk('reload: 3 new files -> 3 preview cards (raw file ignored)', n==3, n)
    await pg.click('#btnSaveAll'); await pg.wait_for_timeout(800)
    dd=await pg.evaluate("JSON.stringify(Object.fromEntries(Object.entries(S.months['2026-10'].d).map(([d,r])=>[d,Object.keys(r).filter(k=>k!=='_src')])))")
    chk('saved data from 3 files (order 20/10 content, pend/bill by filename 30/10)', '"2026-10-20":["white"' in dd and '2026-10-30' in dd, dd)
    await reload()
    chk('reload again: nothing new', await npend()==0 and 'ไม่มีไฟล์ใหม่' in await bar(), await bar())
    await scan(600); t=await pg.text_content('#toast')
    chk('manual scan, nothing new -> explains why', 'ไม่มีไฟล์ใหม่' in t and 'จะไม่ขึ้นซ้ำ' in t, t)
    cur=base+[F('ค้างส่ง 30.10.2026_ตามรูป.xlsx','pend',2000),F('เปิดบิลขาย 30.10.2026_pivot_summary.xlsx','bill',2000),F('30.10.2026 สรุป.xlsx','order',2000)]
    # --- ไฟล์เปิดค้างใน Excel แบบที่ 1: getFile โยน error -> ข้ามไฟล์นั้น ไฟล์อื่นยังมา + แจ้งชื่อไฟล์ในแถบ ---
    await setfiles(cur+[F('ค้างส่ง 31.10.2026_ตามรูป.xlsx','LOCKED',3000),F('31.10.2026 สรุป.xlsx','order',3000)])
    await reload(2500); t=await bar()
    chk('getFile error: file skipped + named, other new file still previewed', await npend()==1 and 'อ่านไม่ได้ 1 ไฟล์' in t and 'ค้างส่ง 31.10.2026_ตามรูป.xlsx' in t and 'พบไฟล์ใหม่ 1 ไฟล์' in t, t)
    await pg.click('#btnSaveAll'); await pg.wait_for_timeout(500)
    await setfiles(cur+[F('ค้างส่ง 31.10.2026_ตามรูป.xlsx','pend',3000),F('31.10.2026 สรุป.xlsx','order',3000)])
    await scan(); t=await bar()
    chk('after closing Excel: rescan picks the file up, warning gone', await npend()==1 and 'อ่านไม่ได้' not in t and 'พบไฟล์ใหม่ 1' in t, t)
    await pg.click('#btnSaveAll'); await pg.wait_for_timeout(500)
    cur=cur+[F('ค้างส่ง 31.10.2026_ตามรูป.xlsx','pend',3000),F('31.10.2026 สรุป.xlsx','order',3000)]
    # --- แบบที่ 2: ได้ไฟล์แต่อ่านเนื้อไม่ได้ -> ไม่ขึ้นเป็นการ์ด "ข้าม" (กันถูก mark seen ตอนกดบันทึก) ---
    await setfiles(cur+[F('ค้างส่ง 01.11.2026_ตามรูป.xlsx','RLOCK',4000),F('เปิดบิลขาย 01.11.2026_pivot_summary.xlsx','bill',4000)])
    await scan(); t=await bar()
    kinds=await pg.evaluate("pending.map(p=>p.kind).join()")
    chk('read error: no skip card, listed as unreadable, other file previewed', kinds=='bill' and 'อ่านไม่ได้ 1 ไฟล์' in t and 'ค้างส่ง 01.11.2026_ตามรูป.xlsx' in t and 'ไฟล์ถูกเปิด/ล็อกอยู่' in t, kinds+' | '+t)
    await pg.click('#btnSaveAll'); await pg.wait_for_timeout(500)
    seen=await pg.evaluate("Object.keys(Watch.meta.seen).filter(k=>k.includes('01.11.2026')).join(' ; ')")
    chk('save all: unreadable file NOT marked seen', 'ค้างส่ง 01.11.2026' not in seen and 'เปิดบิลขาย 01.11.2026' in seen, seen)
    await setfiles(cur+[F('ค้างส่ง 01.11.2026_ตามรูป.xlsx','pend',4000),F('เปิดบิลขาย 01.11.2026_pivot_summary.xlsx','bill',4000)])
    await scan()
    chk('readable again (same file, unchanged) -> previewed', await pg.evaluate("pending.map(p=>p.kind).join()")=='pend')
    await pg.click('#btnSaveAll'); await pg.wait_for_timeout(500)
    cur=cur+[F('ค้างส่ง 01.11.2026_ตามรูป.xlsx','pend',4000),F('เปิดบิลขาย 01.11.2026_pivot_summary.xlsx','bill',4000)]
    # --- แบบที่ 3/4: ค้าง (ไม่ตอบ) -> หมดเวลาแล้วไปต่อ ไม่ค้างทั้งการสแกน ---
    await setfiles(cur+[F('ค้างส่ง 02.11.2026_ตามรูป.xlsx','HANG',5000),F('เปิดบิลขาย 02.11.2026_pivot_summary.xlsx','RHANG',5000),F('02.11.2026 สรุป.xlsx','order',5000)])
    await pg.click('#watchBar [data-w="scan"]'); await pg.wait_for_timeout(150)
    chk('while scanning: bar says scanning', 'กำลังสแกน' in await bar(), await bar())
    await pg.wait_for_timeout(2300); t=await bar()
    chk('hanging files time out: scan finishes, 2 unreadable listed, 1 previewed', await pg.evaluate('Watch.busy')==False and 'อ่านไม่ได้ 2 ไฟล์' in t and await npend()==1 and 'กำลังสแกน' not in t, t)
    await clear(); await setfiles(cur+[F('02.11.2026 สรุป.xlsx','order',5000)]); cur=cur+[F('02.11.2026 สรุป.xlsx','order',5000)]
    await scan(600)
    # --- ไล่รายชื่อทั้งโฟลเดอร์ไม่ได้ -> ใช้วิธีถามหาไฟล์ตามชื่อของวันล่าสุดแทน ---
    td=datetime.date.today(); ds=lambda d: d.strftime('%d.%m.%Y')
    y=td-datetime.timedelta(days=1)
    await ss('__entriesFail','1')
    await setfiles(cur+[F(f'ค้างส่ง {ds(y)}_ตามรูป.xlsx','pend',6000),F(f'{ds(td)} สรุป.xlsx','order',6000),F('ค้างส่ง 03.01.2020_ตามรูป.xlsx','pend',6000)])
    await scan(2500); t=await bar()
    chk('listing fails -> fallback by filename finds recent files (old one out of range ignored)', await npend()==2 and 'ไล่รายชื่อทั้งโฟลเดอร์ไม่ได้' in t and 'InvalidStateError' in t and 'พบไฟล์ใหม่ 2' in t, t)
    await clear(); await ss('__entriesFail',None)
    cur=cur+[F(f'ค้างส่ง {ds(y)}_ตามรูป.xlsx','pend',6000),F(f'{ds(td)} สรุป.xlsx','order',6000),F('ค้างส่ง 03.01.2020_ตามรูป.xlsx','pend',6000)]
    await scan(1500); await clear()   # 2020 file appears via full listing -> dismiss
    # --- สิทธิ์: Chrome ขอยืนยันใหม่ ---
    await ss('__perm','prompt')
    await setfiles(cur+[F('ค้างส่ง 05.11.2026_ตามรูป.xlsx','pend',7000)])
    await reload(1500)
    chk('perm prompt: shows click-to-scan, no auto import', await pg.is_visible('#watchBar [data-w="scan"]') and 'ยืนยันสิทธิ์' in await bar() and await npend()==0, await bar())
    # ป๊อปอัปสิทธิ์ค้าง (ผู้ใช้ไม่ตอบ) -> กดซ้ำทันทีได้ข้อความ / กดซ้ำหลังค้างนาน = เริ่มรอบใหม่ ไม่ค้างถาวร
    await ss('__permHang','request')
    await pg.click('#watchBar [data-w="scan"]'); await pg.wait_for_timeout(200)
    t=await bar(); chk('waiting for Chrome prompt is visible in bar', 'รอกด' in t and 'กำลังสแกน' in t, t)
    await pg.click('#watchBar [data-w="scan"]'); await pg.wait_for_timeout(150)
    chk('click again while busy -> told it is scanning (not silent)', 'กำลังสแกนอยู่' in await pg.text_content('#toast'), await pg.text_content('#toast'))
    await ss('__permHang',None); await pg.wait_for_timeout(800)
    await scan(1500); t=await bar()
    chk('stuck scan superseded: new click scans + 1 card', await pg.evaluate('window.__asked')==2 and await npend()==1 and 'พบไฟล์ใหม่ 1' in t, t)
    await clear(); cur=cur+[F('ค้างส่ง 05.11.2026_ตามรูป.xlsx','pend',7000)]
    await reload(1500)
    chk('cancelled file not shown again', await npend()==0)
    # Chrome ไม่ตอบเรื่องสิทธิ์ -> แจ้งสาเหตุในแถบ (ไม่เงียบ)
    await ss('__permHang','query'); await scan(1000); t=await bar()
    chk('permission query hangs -> error shown with hint', 'สแกนไม่สำเร็จ' in t and 'Chrome ไม่ตอบ' in t and 'เปลี่ยน' in t and await pg.evaluate('Watch.busy')==False, t)
    await ss('__permHang',None)
    # "เปลี่ยน" แล้วเลือกโฟลเดอร์เดิม = เชื่อมใหม่ ไม่ทิ้งไฟล์ที่ยังไม่ได้นำเข้า
    await setfiles(cur+[F('เปิดบิลขาย 06.11.2026_pivot_summary.xlsx','bill',8000)])
    await pg.click('#watchBar [data-w="pick"]'); await pg.wait_for_timeout(1500); t=await bar()
    chk('re-pick same folder: keeps seen list, pending new file still previewed', await npend()==1 and 'พบไฟล์ใหม่ 1' in t and 'สแกนไม่สำเร็จ' not in t, t)
    await clear(); cur=cur+[F('เปิดบิลขาย 06.11.2026_pivot_summary.xlsx','bill',8000)]
    await ss('__sameFail','1'); await setfiles(cur+[F('07.11.2026 สรุป.xlsx','order',9000)])
    await pg.click('#watchBar [data-w="pick"]'); await pg.wait_for_timeout(1500); t=await bar()
    chk('re-pick when folders cannot be compared: same name = reconnect (keeps seen)', await npend()==1 and 'พบไฟล์ใหม่ 1' in t, t)
    await clear(); await ss('__sameFail',None)
    # โฟลเดอร์ใช้ไม่ได้เลย (ทั้งไล่รายชื่อและถามตามชื่อ) -> แจ้งสาเหตุ ไม่ค้าง
    await ss('__entriesFail','1'); await ss('__probeFail','1'); await scan(1200); t=await bar()
    chk('folder unusable -> error with reason, not busy', 'สแกนไม่สำเร็จ' in t and 'NotAllowedError' in t and await pg.evaluate('Watch.busy')==False, t)
    await ss('__entriesFail',None); await ss('__probeFail',None)
    # เวลา "สแกนล่าสุด" ของวันก่อนต้องมีวันที่กำกับ
    await pg.evaluate("(()=>{const k=Object.keys(localStorage).find(k=>k.endsWith('-watch')); const m=JSON.parse(localStorage.getItem(k)); m.last=Date.now()-26*3600e3; localStorage.setItem(k,JSON.stringify(m)); sessionStorage.setItem('__permHang','query');})()")
    await pg.reload(); await pg.wait_for_timeout(250); t=await bar()
    yd=(datetime.datetime.now()-datetime.timedelta(hours=26)).strftime('%d/%m')
    chk('last scan from another day shows its date', f'สแกนล่าสุด {yd} ' in t, t)
    await ss('__permHang',None); await pg.wait_for_timeout(700)
    await pg.screenshot(path=P+'test/watch.png')
    # ยกเลิกเฝ้าดู
    await pg.click('#watchBar [data-w="forget"]'); await pg.wait_for_timeout(500)
    chk('forget -> pick button back', await pg.is_visible('#watchBar [data-w="pick"]'))
    # เบราว์เซอร์ที่ไม่มี API -> ซ่อนแถบ
    pg2=await ctx.new_page(); await pg2.add_init_script('delete window.showDirectoryPicker'); await pg2.goto(url); await pg2.wait_for_timeout(500)
    chk('no API -> bar hidden', await pg2.evaluate("document.getElementById('watchBar').hidden"))
    chk('no page errors', not errs, errs)
    await b.close()
  print('ALL PASS' if all(OK) else 'SOME FAILED')
asyncio.run(main())
