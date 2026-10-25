import asyncio, json, sys, os, datetime
from playwright.async_api import async_playwright
# ทดสอบออนไลน์ + ออฟไลน์ + รวมรายช่อง 2 เครื่อง (หน้าเว็บ https และไฟล์ในเครื่อง file://) ด้วย Supabase จำลอง
# ใช้: python tests/offline_test.py "D:/TET กราฟรายงงาน"
U=(sys.argv[1] if len(sys.argv)>1 else "D:/TET กราฟรายงงาน").rstrip("/\\")+"/"
P=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/"
DB={}; OK=[]
def chk(name,cond,extra=''):
  OK.append(bool(cond)); print(('PASS ' if cond else 'FAIL ')+name, extra)
def server(op,arg):
  arg=json.loads(arg)
  if op=='select': return json.dumps([{'key':k,'data':v['data'],'updated_at':v['at']} for k,v in DB.items()])
  if op=='upsert':
    for r in arg: DB[r['key']]={'data':r['data'],'at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  return 'null'
MOCK=open(P+'tests/mock-supabase.js',encoding='utf8').read()
async def device(b,kind):
  ctx=await b.new_context(timezone_id='Asia/Bangkok',viewport={'width':1500,'height':900})
  await ctx.expose_function('__mockServer',server); await ctx.add_init_script(MOCK)
  async def route(r):
    path=r.request.url.split('https://tet.test/')[1].split('?')[0] or 'index.html'
    try: body=open(P+'public/'+path,'rb').read()
    except: return await r.fulfill(status=404,body='nf')
    await r.fulfill(status=200,body=body,headers={'content-type':'text/html; charset=utf-8' if path.endswith('.html') else 'application/javascript'})
  await ctx.route('https://tet.test/**',route)
  await ctx.route('https://tet-graph-report.supakrizs.workers.dev/**',lambda r:r.fulfill(status=200,body='{"v":"9999-01-01 00:00"}',headers={'content-type':'application/json','access-control-allow-origin':'*'}))
  pg=await ctx.new_page(); pg.errs=[]; pg.on('pageerror',lambda e:pg.errs.append(str(e)))
  await pg.goto('https://tet.test/' if kind=='web' else 'file://'+P+'dist/TET-กราฟรายงาน.html'); await pg.wait_for_timeout(600)
  return ctx,pg
async def login(pg):
  await pg.fill('#lgU','sale'); await pg.fill('#lgP','pw'); await pg.click('#lgBtn'); await pg.wait_for_timeout(800)
async def edit(pg,d,k,v):
  await pg.click('#tabs button[data-v="grid"]'); await pg.wait_for_timeout(200)
  i=pg.locator(f'#grid input[data-d="{d}"][data-k="{k}"]'); await i.fill(str(v)); await i.press('Enter'); await pg.wait_for_timeout(200)
sync=lambda pg: pg.text_content('#sync')
srv=lambda d,k: DB['m:2026-10']['data']['d'].get(d,{}).get(k)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    A_ctx,A=await device(b,'web')
    chk('A login shown', await A.is_visible('#login'))
    await login(A)
    await A.set_input_files('#fileIn',[U+'สรุปปี2026.xlsx']); await A.wait_for_timeout(1500); await A.click('#btnSaveAll'); await A.wait_for_timeout(2000)
    chk('A uploaded to server', 'm:2026-10' in DB and 'maps' in DB, await sync(A))
    # --- A ออฟไลน์ แก้ 2 ช่อง ---
    await A.evaluate('window.__mockOffline=true'); await A_ctx.set_offline(True); await A.wait_for_timeout(300)
    await edit(A,'2026-10-21','rawIn',40); await edit(A,'2026-10-20','shipGood',9); await A.wait_for_timeout(1200)
    t=await sync(A); chk('A offline badge + pending 2', 'ออฟไลน์' in t and 'รอส่ง 2' in t, t)
    # ปิดเปิดหน้าใหม่ตอนออฟไลน์ (จำลองด้วย mock — ข้อมูลต้องยังอยู่และยังรอส่ง)
    await A_ctx.set_offline(False); await A.evaluate("localStorage.setItem('__mockOff','1')"); await A.reload(); await A.wait_for_timeout(1200)
    t=await sync(A); v=await A.evaluate("S.months['2026-10'].d['2026-10-21'].rawIn")
    chk('A reload offline: no login, data kept, still pending', (not await A.is_visible('#login')) and v==40 and 'รอส่ง 2' in t, f'{v} | {t}')
    chk('server not yet changed', srv('2026-10-21','rawIn')!=40)
    await A.wait_for_timeout(1500)
    # --- B = ไฟล์ในเครื่อง file:// แก้ช่องเดียวกัน (ทีหลัง) + ช่องอื่น ---
    B_ctx,Bp=await device(b,'file')
    chk('B (file://) login shown', await Bp.is_visible('#login')); await login(Bp); await Bp.wait_for_timeout(800)
    chk('B got server data', await Bp.evaluate("!!S.months['2026-10']"), await sync(Bp))
    nv=await Bp.is_visible('#newver'); chk('B new-version banner', nv, await Bp.text_content('#newver'))
    await edit(Bp,'2026-10-21','rawIn',45); await edit(Bp,'2026-10-22','rawIn',50); await Bp.wait_for_timeout(1500)
    chk('B pushed', srv('2026-10-21','rawIn')==45 and srv('2026-10-22','rawIn')==50, await sync(Bp))
    # A logout while pending -> refused
    await A.click('[data-sync="now"]'); await A.wait_for_timeout(500)
    # --- A กลับมาออนไลน์ ---
    await A.evaluate("window.__mockOffline=false; localStorage.removeItem('__mockOff')"); await A.evaluate("window.dispatchEvent(new Event('online'))"); await A.wait_for_timeout(1500)
    t=await sync(A)
    chk('A synced, no pending', 'ออนไลน์' in t and 'รอส่ง' not in t, t)
    chk('field merge: 20 shipGood from A', srv('2026-10-20','shipGood')==9, srv('2026-10-20','shipGood'))
    chk('field merge: 22 rawIn from B kept', srv('2026-10-22','rawIn')==50)
    chk('conflict 21 rawIn: later edit (B) wins', srv('2026-10-21','rawIn')==45, srv('2026-10-21','rawIn'))
    chk('A screen shows merged', await A.evaluate("[S.months['2026-10'].d['2026-10-22'].rawIn,S.months['2026-10'].d['2026-10-21'].rawIn].join()")=='50,45')
    # B แก้ทีหลังด้วยเน็ตปกติ แล้ว A กลับมาที่หน้า -> เห็นค่า
    await edit(Bp,'2026-10-19','rawIn',33); await Bp.wait_for_timeout(1200)
    await A.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await A.wait_for_timeout(1200)
    chk('A sees B later edit', await A.evaluate("S.months['2026-10'].d['2026-10-19'].rawIn")==33)
    # ชนกันอีกแบบ: B แก้ก่อน (ส่งแล้ว) แล้ว A แก้ทีหลังตอนออฟไลน์ -> A ชนะ
    await edit(Bp,'2026-10-17','rawIn',7); await Bp.wait_for_timeout(1200)
    await A.evaluate('window.__mockOffline=true'); await A.wait_for_timeout(300); await edit(A,'2026-10-17','rawIn',8); await A.wait_for_timeout(1000)
    await A.evaluate('window.__mockOffline=false'); await A.click('[data-sync="now"]'); await A.wait_for_timeout(1200)
    chk('conflict 17 rawIn: later edit (A, offline) wins', srv('2026-10-17','rawIn')==8, srv('2026-10-17','rawIn'))
    # logout with pending refused
    await A.evaluate('window.__mockOffline=true'); await edit(A,'2026-10-18','rawIn',1); await A.wait_for_timeout(1200)
    await A.click('#tabs button[data-v="upload"]')
    t=await sync(A); chk('pending again', 'รอส่ง 1' in t, t)
    await A.evaluate('sbLogout()'); await A.wait_for_timeout(500)
    chk('logout refused while pending', not await A.is_visible('#login'))
    await A.evaluate('window.__mockOffline=false'); await A.click('[data-sync="now"]'); await A.wait_for_timeout(1200)
    await A.click('[data-sync="out"]'); await A.wait_for_timeout(800)
    chk('logout ok after send', await A.is_visible('#login'))
    # sales tab sanity on B
    await Bp.click('#tabs button[data-v="sales"]'); await Bp.wait_for_timeout(500)
    chk('no page errors', not A.errs and not Bp.errs, A.errs+Bp.errs)
    await Bp.screenshot(path=P+'test/offline-B.png')
    await b.close()
  print('ALL PASS' if all(OK) else 'SOME FAILED')
asyncio.run(main())
