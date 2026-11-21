import asyncio, base64, datetime, json, sys, os
from playwright.async_api import async_playwright
# ทดสอบแท็บ "เบรค & COMMENT" (โหมดเครื่อง ไม่ซิงก์) — ข้อความในไฟล์นี้เป็นตัวอย่างสมมุติ ไม่ใช่ข้อมูลจริง
# ใช้: python tests/brk_test.py
P=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/"
OK=[]
def chk(n,c,x=''): OK.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n,x)
MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
async def main():
  td=datetime.date.today(); ym=td.strftime('%Y-%m'); mon=MON[td.month-1]; D=lambda n: f'{ym}-{n:02d}'
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(timezone_id='Asia/Bangkok',viewport={'width':1500,'height':950})
    await ctx.add_init_script('window.__localMode=1'); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file://'+P+'index.html'); await pg.wait_for_timeout(500)
    await pg.click('#tabs button[data-v="brk"]'); await pg.wait_for_timeout(300)
    rows=lambda: pg.evaluate("JSON.stringify(brkRows().map(r=>[r.l||'',r.from||'',r.c||{}]))")
    labels=lambda: pg.evaluate("[...document.querySelectorAll('#brkBox table.bk tr[data-id] td.bd')].map(t=>t.innerText)")
    async def paste(sel,text):
      await pg.click(sel)
      await pg.evaluate("([sel,text])=>{const dt=new DataTransfer(); dt.setData('text/plain',text); document.querySelector(sel).dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));}",[sel,text])
      await pg.wait_for_timeout(300)
    async def day(n): await pg.select_option('#selDay',D(n)); await pg.wait_for_timeout(250)
    hd=await pg.evaluate("[...document.querySelectorAll('#brkBox table.bk th')].map(t=>t.innerText).join('|')")
    chk('table header like the Excel sheet', hd.startswith('วันที่|เบรคภายใน|ผ้าตีกลับ|COMMENT|') and hd.count('ตกแต่ง')==3 and 'LAB' in hd, hd)
    chk('empty: one blank row, nothing stored', await pg.evaluate("document.querySelectorAll('#brkBox tr[data-id]').length")==1 and await pg.evaluate("!S.brk"))
    # พิมพ์ในแถวว่าง -> สร้างแถวจริง
    await pg.click('#brkBox tr[data-id] td[data-k="l"]'); await pg.keyboard.type('01-Jan - 5 Jan'); await pg.keyboard.press('Enter')
    await pg.click('#brkBox tr[data-id] td[data-k="c2"]'); await pg.keyboard.type('ตัวอย่าง ก'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
    r=await rows(); chk('typing creates a row', r==json.dumps([['01-Jan - 5 Jan','',{'c2':'ตัวอย่าง ก'}]],ensure_ascii=False,separators=(',',':')), r)
    # วางจาก Excel: 3 แถว x 14 ช่อง (มีช่องขึ้นบรรทัด + แท็บท้ายบรรทัด)
    await pg.click('#brkBlank'); await pg.wait_for_timeout(200)
    line=lambda lab,cells: '\t'.join([lab]+[cells.get(i,'') for i in range(13)])
    head='\r\n'.join(['รายงานตัวอย่าง ลูกค้า ก'+'\t'*13, '\t'.join(['วันที่','เบรคภายใน','','','','ผ้าตีกลับ','','','','COMMENT','','','','']), '\t'.join(['','ย้อม','ตกแต่ง','SALE','QA','ย้อม','ตกแต่ง','SALE','QA','ย้อม','ตกแต่ง','SALE','LAB','QA']), '\t'*13])
    tsv=head+'\r\n'+'\r\n'.join([line('06-Jan',{5:'ตัวอย่าง ข'}),line('07-Jan - 8 Feb',{}),line('09-Feb',{9:'"บรรทัด 1\nบรรทัด 2"',12:'ตัวอย่าง "ค"'})])+'\r\n'
    await paste('#brkBox tr[data-id]:last-of-type td[data-k="l"]',tsv)
    r=json.loads(await rows())
    chk('pasted sheet title becomes the report title; header lines skipped', await pg.evaluate("S.brk.title")=='รายงานตัวอย่าง ลูกค้า ก' and len(r)==4, [await pg.evaluate("S.brk.title"),len(r)])
    chk('paste block from Excel: 3 rows, right columns, multiline + quotes kept', len(r)==4 and r[1]==['06-Jan','',{'b2':'ตัวอย่าง ข'}] and r[2][0]=='07-Jan - 8 Feb' and r[3][2]=={'c2':'บรรทัด 1\nบรรทัด 2','c5':'ตัวอย่าง "ค"'}, r)
    # วางช่องเดียว = พิมพ์ต่อในช่อง ไม่ใช่วางเป็นบล็อก
    await paste('#brkBox tr[data-id]:nth-of-type(5) td[data-k="a1"]','คำเดียว'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
    chk('single-cell paste goes into the cell', json.loads(await rows())[1][2].get('a1')=='คำเดียว', await rows())
    # แถวสุดท้ายเลื่อนวันที่เอง
    await day(15); await pg.fill('#brkFrom',D(10)); await pg.check('#brkAuto'); await pg.wait_for_timeout(250)
    l=await labels(); chk('auto last row: start .. as-of date', l[-1]==f'10 {mon} - 15 {mon}', l[-1])
    await day(16); l=await labels(); chk('as-of date moves -> label follows, no edit needed', l[-1]==f'10 {mon} - 16 {mon}', l[-1])
    chk('auto date cell is not editable', await pg.evaluate("document.querySelector('#brkBox tr[data-id]:last-of-type td.bd').isContentEditable")==False)
    # เพิ่มเหตุการณ์วันที่ 16 -> ปิดช่วงเดิมที่ 15, แถววันที่ 16, ช่วงใหม่เริ่ม 17 (ยังไม่แสดง)
    await pg.click('#brkEv'); await pg.wait_for_timeout(300); await pg.keyboard.type('ตัวอย่าง ง'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
    l=await labels(); r=json.loads(await rows())
    chk('add event: old range closed the day before, event row added + focused, next range hidden', l[-2:]==[f'10 {mon} - 15 {mon}',f'16-{mon}'] and r[-1][1]==D(17) and r[-2][2]=={'c2':'ตัวอย่าง ง'}, [l[-2:],r[-2:]])
    await day(17); l=await labels(); chk('next day: new range row appears by itself', l[-2:]==[f'16-{mon}',f'17-{mon}'], l[-2:])
    await day(19); l=await labels(); chk('...and keeps extending', l[-1]==f'17 {mon} - 19 {mon}', l[-1])
    # เหตุการณ์ซ้ำวันเดียวกับวันเริ่มช่วง (ช่วงยังว่าง) -> ไม่ทิ้งแถวช่วงว่างไว้
    await pg.fill('#brkEvD',D(17)); await pg.click('#brkEv'); await pg.wait_for_timeout(300); await pg.keyboard.press('Escape')
    await day(18); l=await labels(); chk('event on the first day of an empty range replaces it', l[-3:]==[f'16-{mon}',f'17-{mon}',f'18-{mon}'], l[-3:])
    # ลบแถวเหตุการณ์ที่เพิ่งเพิ่ม (ว่าง) -> ย้อนกลับ ไม่ให้วันที่ขาด (บั๊กที่ผู้ใช้เจอ 21 พ.ย.)
    snapBefore=await rows(); lb=await labels()
    await pg.fill('#brkEvD',D(18)); await pg.click('#brkEv'); await pg.wait_for_timeout(300); await pg.keyboard.press('Escape')
    await pg.select_option('#selDay',D(19)); await pg.wait_for_timeout(250)
    l=await labels(); chk('add event 18 then as-of 19: range closed at 17, 18 row, 19 auto row', l[-3:]==[f'17-{mon}',f'18-{mon}',f'19-{mon}'], l[-3:])
    for _ in range(2): await pg.click('#brkBox tr[data-id]:nth-last-of-type(2) [data-del]'); await pg.wait_for_timeout(250)   # แถวมีวันที่ = ต้องกด 2 ครั้ง
    l=await labels(); r=json.loads(await rows())
    chk('delete that empty event row -> undone: previous range auto again, no gap, no extra row', l[-1]==f'17 {mon} - 19 {mon}' and r[-1][1]==D(17) and r[-2][0]==f'16-{mon}' and f'18-{mon}' not in [q[0] for q in r], [l[-2:],r[-2:]])
    await day(18)
    # ลบแถวเลื่อนเองที่ว่าง -> แถวก่อนหน้า (วันเดียว) กลับมาเลื่อนเอง
    await pg.fill('#brkEvD',D(18)); await pg.click('#brkEv'); await pg.wait_for_timeout(300); await pg.keyboard.type('เหตุ 18'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
    await day(19); l=await labels(); chk('event 18 with text + auto 19', l[-2:]==[f'18-{mon}',f'19-{mon}'], l[-2:])
    await pg.click('#brkBox tr[data-id]:last-of-type [data-del]'); await pg.wait_for_timeout(300)   # แถวเลื่อนเองที่ว่าง = ลบทันที
    l=await labels(); r=json.loads(await rows())
    chk('delete the empty auto row -> event row extends itself', l[-1]==f'18 {mon} - 19 {mon}' and r[-1][1]==D(18) and r[-1][2]=={'c2':'เหตุ 18'}, [l[-2:],r[-1]])
    # ลบแถววันเดียวกลางตาราง -> แถวช่วงก่อนหน้าขยายครอบวันนั้น
    await pg.select_option('#brkN','0'); await pg.wait_for_timeout(200)
    idx=(await labels()).index(f'16-{mon}')+1
    await pg.click(f'#brkBox tr[data-id]:nth-of-type({idx+3}) [data-del]'); await pg.wait_for_timeout(200)
    await pg.click(f'#brkBox tr[data-id]:nth-of-type({idx+3}) [data-del]'); await pg.wait_for_timeout(300)
    l=await labels(); chk('delete a one-day row in the middle -> previous range now covers it', f'10 {mon} - 16 {mon}' in l and f'16-{mon}' not in l, l[-4:])
    await pg.select_option('#brkN','15'); await pg.wait_for_timeout(200)
    # เหตุการณ์ 16 ถูกลบไปแล้ว: สร้างแถว 17/18 ใหม่ให้สถานะเหมือนเดิมสำหรับขั้นต่อไป
    await day(18); await pg.uncheck('#brkAuto'); await pg.wait_for_timeout(200)
    await pg.click('#brkBlank'); await pg.wait_for_timeout(200)
    await pg.click('#brkBox tr[data-id]:last-of-type td[data-k="l"]'); await pg.keyboard.type(f'18-{mon}'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
    await pg.check('#brkAuto'); await pg.fill('#brkFrom',D(18)); await pg.dispatch_event('#brkFrom','change'); await pg.wait_for_timeout(250)
    # ยกเลิกเลื่อนเอง -> กลายเป็นข้อความ แก้เองได้
    await pg.uncheck('#brkAuto'); await pg.wait_for_timeout(250); r=json.loads(await rows())
    chk('auto off: label frozen as text', r[-1][0]==f'18-{mon}' and r[-1][1]=='' and await pg.evaluate("document.querySelector('#brkBox tr[data-id]:last-of-type td.bd').isContentEditable"), r[-1])
    # แทรก/ลบแถว
    n0=len(r); await pg.click('#brkBox tr[data-id]:nth-of-type(4) [data-ins]'); await pg.wait_for_timeout(250)
    r=json.loads(await rows()); chk('insert blank row above first row', len(r)==n0+1 and r[0]==['','',{}], r[0])
    await pg.click('#brkBox tr[data-id]:nth-of-type(4) [data-del]'); await pg.wait_for_timeout(250)
    chk('empty row deletes at once', len(json.loads(await rows()))==n0)
    await pg.click('#brkBox tr[data-id]:nth-of-type(4) [data-del]'); await pg.wait_for_timeout(200)
    chk('row with text asks first', len(json.loads(await rows()))==n0 and await pg.text_content('#brkBox tr[data-id]:nth-of-type(4) [data-del]')=='ลบ?')
    await pg.click('#brkBox tr[data-id]:nth-of-type(4) [data-del]'); await pg.wait_for_timeout(250)
    r=json.loads(await rows()); chk('second click deletes', len(r)==n0-1 and r[0][0]=='06-Jan', r[0])
    # จำนวนแถวที่แสดง + ชื่อรายงาน
    await pg.click('#brkBlank'); await pg.wait_for_timeout(200)
    await paste('#brkBox tr[data-id]:last-of-type td[data-k="l"]','\n'.join(line(f'{i:02d}-Mar',{1:f'x{i}'}) for i in range(1,21)))
    t=await pg.text_content('#brkBox .brkctl'); shown=await pg.evaluate("document.querySelectorAll('#brkBox tr[data-id]').length")
    chk('shows the latest 15 rows by default', shown==15 and 'แสดง 15 จาก' in t and (await labels())[-1]=='20-Mar', t[:80])
    await pg.select_option('#brkN','0'); await pg.wait_for_timeout(250)
    chk('"all rows" shows everything', await pg.evaluate("document.querySelectorAll('#brkBox tr[data-id]').length")==len(json.loads(await rows())))
    await pg.select_option('#brkN','15'); await pg.wait_for_timeout(250)
    await pg.click('#brkBox td[data-bt]'); await pg.keyboard.press('End'); await pg.keyboard.type(' ทดสอบ'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
    chk('title editable + saved', (await pg.evaluate("S.brk.title")).endswith('ลูกค้า ก ทดสอบ'), await pg.evaluate("S.brk.title"))
    # รูป: ไม่มีปุ่ม/คอลัมน์ควบคุม, พื้นขาว
    du=await pg.evaluate("(async()=>{const c=await snap(document.querySelector('#brkBox .card')); return [c.width,c.height,c.toDataURL('image/png')]})()")
    open(P+'test/brk.png','wb').write(base64.b64decode(du[2].split(',')[1]))
    chk('snapshot rendered', du[0]>900 and du[1]>300, du[:2])
    chk('controls visible again after snapshot', await pg.is_visible('#brkBox tr[data-id] [data-del]'))
    # เปิดใหม่ -> ข้อมูลยังอยู่
    n=len(json.loads(await rows())); await pg.reload(); await pg.wait_for_timeout(600); await pg.click('#tabs button[data-v="brk"]'); await pg.wait_for_timeout(300)
    chk('reload keeps data', len(json.loads(await rows()))==n and await pg.evaluate("document.querySelectorAll('#brkBox tr[data-id]').length")==15)
    # นำเข้าทั้งตารางจากไฟล์ Excel (สร้างไฟล์ตัวอย่างในหน้าเว็บด้วย SheetJS — ไม่ใช้ข้อมูลจริง)
    await pg.evaluate('''async(y)=>{
      const aoa=[['รายงานตัวอย่าง ลูกค้า ข'],['วันที่','เบรคภายใน',null,null,null,'ผ้าตีกลับ',null,null,null,'COMMENT',null,null,null,null],
        [null,'ย้อม','ตกแต่ง','SALE','QA','ย้อม','ตกแต่ง','SALE','QA','ย้อม','ตกแต่ง','SALE','LAB','QA'],
        [0,'ก1'],[null,'ก2'],['29-ม.ค. - 30-ม.ค.',null,null,null,null,null,'ข'],[null,null,null,null,null,null,null,null,null,null,null,null,123],['1 Jan - 5 Jan',null,null,null,null,null,null,null,null,null,null,null,null,'ค']];
      const ws=XLSX.utils.aoa_to_sheet(aoa); ws['A4']={t:'n',v:45685,z:'d-mmm'};          // 28 ม.ค. 2025 เป็นเซลล์วันที่
      const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'ตัวอย่าง');
      const f=new File([XLSX.write(wb,{type:'array',bookType:'xlsx'})],'ตารางตัวอย่าง.xlsx'); await handleFiles([f]); }''')
    await pg.click('#tabs button[data-v="upload"]'); await pg.wait_for_timeout(300)
    card=await pg.inner_text('#pvList'); kinds=await pg.evaluate("pending.map(p=>p.kind).join()")
    chk('Excel file recognised: preview card with row count + replace warning', kinds=='brk' and 'พบ 5 แถว' in card and 'แทนที่ทั้งตาราง' in card and 'เลื่อนตาม' in card, kinds+' | '+card[:260].replace('\n',' '))
    await pg.click('#btnSaveAll'); await pg.wait_for_timeout(500)
    r=json.loads(await rows()); yr=td.year
    chk('import: date cell -> DD-Mon, blank-date rows kept, Thai label kept, number -> text', [q[0] for q in r]==['28-Jan','','29-ม.ค. - 30-ม.ค.','',''] and r[0][2]=={'a1':'ก1'} and r[1][2]=={'a1':'ก2'} and r[2][2]=={'b2':'ข'} and r[3][2]=={'c4':'123'}, r)
    chk('import: last range row set to auto-extend from its start date; title taken; switched to the tab', r[4][1]==f'{yr}-01-01' and r[4][2]=={'c5':'ค'} and await pg.evaluate("S.brk.title")=='รายงานตัวอย่าง ลูกค้า ข' and await pg.evaluate("curView")=='brk', [r[4], await pg.evaluate("curView")])
    l=await labels(); chk('import: last row label follows as-of date', l[-1].startswith('1 Jan - ') and l[-1]!='1 Jan - 5 Jan', l[-1])
    chk('no page errors', not errs, errs)
    await b.close()
  print('ALL PASS' if all(OK) else 'SOME FAILED')
asyncio.run(main())
