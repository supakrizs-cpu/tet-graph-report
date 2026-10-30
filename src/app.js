/* =====================================================================
   กราฟรายงาน TET — app.js
   แก้ที่ src/ แล้วรัน build.py เพื่อรวมเป็นไฟล์เดียว
   ===================================================================== */
'use strict';

/* ---------------- 1. ฟิลด์ข้อมูลรายวัน ---------------- */
const FIELDS = [
  {k:'white',        l:'ขาว',                    src:'order', g:'เปิดสั่งย้อม (ไฟล์สรุป)'},
  {k:'black',        l:'ดำ',                     src:'order', g:'เปิดสั่งย้อม (ไฟล์สรุป)'},
  {k:'wash',         l:'ล้างน้ำ',                 src:'order', g:'เปิดสั่งย้อม (ไฟล์สรุป)'},
  {k:'color',        l:'สี',                     src:'order', g:'เปิดสั่งย้อม (ไฟล์สรุป)'},
  {k:'narrow',       l:'แคบ',                    src:'order', g:'ประเภทการอบ (ไฟล์สรุป)'},
  {k:'wide',         l:'กว้าง',                   src:'order', g:'ประเภทการอบ (ไฟล์สรุป)'},
  {k:'split',        l:'ผ่า',                     src:'order', g:'ประเภทการอบ (ไฟล์สรุป)'},
  {k:'waitBake',     l:'รออบ',                   src:'order', g:'ประเภทการอบ (ไฟล์สรุป)'},
  {k:'repair',       l:'ผ้าซ่อม/ตีกลับ ต่อวัน',      src:'order', g:'ผ้าซ่อม'},
  {k:'pending',      l:'ผ้าค้างส่ง',               src:'pend',  g:'ค้างส่ง (ไฟล์ค้างส่ง)'},
  {k:'pendingPrev',  l:'ค้างส่งเดือนก่อนหน้า',        src:'pend',  g:'ค้างส่ง (ไฟล์ค้างส่ง)'},
  {k:'pendingAfter8',l:'ค้างส่ง หลัง 8 โมง',         src:'pend',  g:'ค้างส่ง (ไฟล์ค้างส่ง)'},
  {k:'shipRepair',   l:'ส่งผ้าซ่อม',               src:'manual',g:'กรอกมือ'},
  {k:'shipGood',     l:'ส่งผ้าดี',                 src:'manual',g:'กรอกมือ'},
  {k:'fromProd',     l:'รับผ้าจากผลิต (ไม่รวม C)',   src:'manual',g:'กรอกมือ'},
  {k:'rawIn',        l:'รับผ้าดิบเข้าโรงงาน',        src:'manual',g:'กรอกมือ'},
];
const FK = Object.fromEntries(FIELDS.map(f=>[f.k,f]));
/* ฟิลด์รายงานยอดขาย & ส่งผ้า (ไม่แสดงในตารางเดือน) */
const SFIELDS = [
  {k:'shipPrevKg', l:'ส่งผ้าได้ (กก.) ผ้าค้างส่งเดือนก่อน', dec:2},
  {k:'shipCurKg',  l:'ส่งผ้าได้ (กก.) ผ้าเสร็จในเดือน', dec:2},
  {k:'salePrev',   l:'ยอดขาย (บาท) ผ้าค้างส่ง', dec:2},
  {k:'saleCur',    l:'ยอดขาย (บาท) ผ้าเสร็จในเดือน', dec:2},
  {k:'pendValNet', l:'มูลค่าผ้าค้างส่ง − หลัง 08:00 (บาท)', dec:0},
  {k:'pendVal8',   l:'มูลค่าค้างส่งหลัง 08:00 (บาท)', dec:0},
  {k:'saleCumManual', l:'ยอดขายสะสม (บาท) กรอกเอง', dec:2},
  {k:'orderTotal', l:'ออเดอร์จริง (นำเข้า)', dec:3},
  {k:'orderManual', l:'ออเดอร์จริง (กรอกเอง)', dec:3},
];
const SK = Object.fromEntries(SFIELDS.map(f=>[f.k,f]));
const LBL = k=>(FK[k]||SK[k]||{l:k}).l;
const DEC = k=>SK[k]?SK[k].dec:3;
const DEFAULT_TARGETS = {order:44, ship:42, raw:45, rep1:1.1, rep2:1.4};
const DEFAULT_CAP = {white:13.75, black:15, wash:4.95, color:20};   // กำลังผลิตต่อวัน (ตัน) จาก Excel แถว CAP — ใช้ทุกเดือน, แก้ได้ในตั้งค่า (เก็บที่ S.maps.cap)
const COLOR_K = ['white','black','wash','color'], BAKE_K = ['narrow','wide','split','waitBake'];
const TH_DOW = ['อา','จ','อ','พ','พฤ','ศ','ส'];
const TH_MON = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

/* ---------------- 2. ที่เก็บข้อมูล ----------------
   โหมดออนไลน์ (มี supabase-config — ทั้งหน้าเว็บและไฟล์ html ในเครื่อง file://):
     Supabase ตาราง graph_report: 1 แถว/เดือน key='m:YYYY-MM' + 1 แถว key='maps'
     แคชในเครื่อง '…-online-cache' (S ปัจจุบัน) + '…-online-base' (ข้อมูลเซิร์ฟเวอร์ครั้งล่าสุดที่ซิงก์)
     ใช้งานออฟไลน์ได้: แก้แล้วเก็บในเครื่องก่อน ส่วนต่าง S กับ base = "รอส่ง" (อยู่รอดข้ามการปิดเปิด)
     ซิงก์ = ดึงเซิร์ฟเวอร์ → รวมรายช่อง (ช่องที่เครื่องนี้แก้ทับของเซิร์ฟเวอร์ ช่องอื่นใช้ของเซิร์ฟเวอร์;
     ชนช่องเดียวกัน = ใครแก้ทีหลังชนะ เทียบเวลาแก้ในเครื่องกับ updated_at ของแถว) → ส่งเฉพาะแถวที่เปลี่ยน
   โหมดเครื่อง (ไม่มี config): localStorage key 'tet-graph-report-v1'
   ------------------------------------------------------------------------------- */
const STORE_KEY = 'tet-graph-report-v1';
const SB_CFG = window.SB_CONFIG || null;
const SB_LIB = window.__mockSupabase || window.supabase;
const IS_SB = !window.__localMode && !!SB_CFG && !!SB_LIB && !/ใส่-/.test((SB_CFG.url||'')+(SB_CFG.key||''));
const SB_TABLE = (SB_CFG && SB_CFG.table) || 'graph_report';
const LOCAL_KEY = IS_SB ? STORE_KEY+'-online-cache' : STORE_KEY;
const BASE_KEY = STORE_KEY+'-online-base', META_KEY = STORE_KEY+'-online-meta';
let SB=null, SB_USER='';
const SYNC={state:IS_SB?'loading':'local', at:null, err:''};
const lsGet=(k,d)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } };
const lsSet=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ return false; } };
const Storage = {
  load(){ return lsGet(LOCAL_KEY,null); },
  save(state){
    const ok=lsSet(LOCAL_KEY,state);
    if(!ok && !IS_SB) toast('บันทึกในเบราว์เซอร์ไม่ได้ — กด "บันทึกไฟล์สำรอง (JSON)" ในหน้าตั้งค่า');
    if(IS_SB){ Cloud.meta.editAt=Date.now(); lsSet(META_KEY,Cloud.meta); Cloud.queue(); }
    return ok;
  },
};
/* แปลง object เป็น {path: ค่า JSON} เพื่อเทียบ/รวมรายช่อง */
const PSEP='\u0001';
function flat(o,pre,out){ out=out||{}; pre=pre||'';
  if(o&&typeof o==='object'&&!Array.isArray(o)){ const ks=Object.keys(o); if(!ks.length&&pre) out[pre]='{}'; ks.forEach(k=>flat(o[k],pre?pre+PSEP+k:k,out)); }
  else if(o!==undefined) out[pre]=JSON.stringify(o);
  return out; }
function unflat(m){ const r={}; Object.keys(m).sort().forEach(p=>{ const ks=p.split(PSEP); let o=r;
  for(let i=0;i<ks.length-1;i++){ if(!o[ks[i]]||typeof o[ks[i]]!=='object'||Array.isArray(o[ks[i]])) o[ks[i]]={}; o=o[ks[i]]; }
  const v=JSON.parse(m[p]); const last=ks[ks.length-1]; if(!(m[p]==='{}'&&o[last]&&typeof o[last]==='object')) o[last]=v; }); return r; }
/* รวม 3 ทาง: base=ต้นทาง, mine=ของเครื่องนี้, theirs=ของเซิร์ฟเวอร์ → ช่องที่เครื่องนี้แก้ใช้ของเครื่องนี้ (ชนกัน: mineWins ตัดสิน) */
function merge3(base,mine,theirs,mineWins){ const B=flat(base),M=flat(mine),T=flat(theirs),R=Object.assign({},T);
  new Set([...Object.keys(B),...Object.keys(M)]).forEach(p=>{ if(M[p]===B[p]) return;
    if(T[p]!==B[p] && T[p]!==M[p] && !mineWins) return;
    if(M[p]===undefined) delete R[p]; else R[p]=M[p]; });
  /* ลบ path ที่เป็นพ่อ/ลูกชนกัน (เช่น {} กับค่าข้างใน) */
  return unflat(R); }
const isUserKey=p=>!p.split(PSEP).includes('_src');
function countDiff(a,b){ const A=flat(a),B=flat(b); let n=0; new Set([...Object.keys(A),...Object.keys(B)]).forEach(p=>{ if(A[p]!==B[p]&&isUserKey(p)) n++; }); return n; }
const Cloud = {
  base:lsGet(BASE_KEY,null),            // {rowKey: data} ข้อมูลเซิร์ฟเวอร์ครั้งล่าสุดที่ซิงก์ (null = ยังไม่เคยซิงก์ในเครื่องนี้)
  meta:lsGet(META_KEY,{}),              // {editAt: เวลาแก้ล่าสุดในเครื่อง, user}
  timer:null, busy:false, again:false, retry:null,
  rowsOf(st){ const r={maps:st.maps}; Object.entries(st.months||{}).forEach(([ym,m])=>r['m:'+ym]=m); return r; },
  stateOf(rows,ui){ const st=freshState(); st.ui=ui||{}; if(rows.maps) st.maps=rows.maps;
    Object.entries(rows).forEach(([k,v])=>{ if(k.startsWith('m:')) st.months[k.slice(2)]=v; }); return st; },
  pendingCount(){ if(!this.base) return 0; return countDiff(this.base,this.rowsOf(S)); },
  queue(){ clearTimeout(this.timer); this.timer=setTimeout(()=>{this.timer=null;this.sync();},700); setSync(); },
  async sync(opts){
    opts=opts||{};
    if(!SB) return;
    if(this.busy){ this.again=true; return; }
    if(!SB_USER){ setSync('login'); return; }
    if(navigator.onLine===false){ setSync('offline'); return; }
    this.busy=true; this.again=false; setSync('saving');
    try{
      const ses=await getSes(); if(!ses){ if(navigator.onLine===false) throw new Error('offline'); throw new Error('auth: no session'); }
      const {data,error}=await SB.from(SB_TABLE).select('key,data,updated_at'); if(error) throw error;
      const theirs={}, tAt={}; (data||[]).forEach(r=>{ theirs[r.key]=r.data; tAt[r.key]=Date.parse(r.updated_at)||0; });
      if(this.base && Object.keys(this.base).length && !Object.keys(theirs).length) throw new Error('เซิร์ฟเวอร์ไม่ส่งข้อมูลกลับมา (ไม่มีสิทธิ์อ่าน?) — ยังไม่ส่งข้อมูล');
      const mine=this.rowsOf(S), snap=JSON.parse(JSON.stringify(mine));
      let merged;
      if(!this.base){
        /* เครื่องนี้ยังไม่เคยซิงก์: มีข้อมูลบนเซิร์ฟเวอร์ = ใช้ของเซิร์ฟเวอร์ (ไม่เอาข้อมูลเก่าในเครื่อง) / เซิร์ฟเวอร์ว่าง = ส่งของเครื่องนี้ขึ้น */
        merged = Object.keys(theirs).length ? JSON.parse(JSON.stringify(theirs)) : snap;
      } else {
        merged={}; const editAt=this.meta.editAt||0;
        new Set([...Object.keys(theirs),...Object.keys(mine)]).forEach(k=>{
          if(!(k in mine)){ merged[k]=theirs[k]; return; }
          merged[k]=merge3(this.base[k]||{}, mine[k], theirs[k]||{}, editAt>(tAt[k]||0));
        });
      }
      const up=Object.keys(merged).filter(k=>JSON.stringify(merged[k])!==JSON.stringify(theirs[k]))
        .map(k=>({key:k,data:merged[k],updated_at:new Date().toISOString(),updated_by:SB_USER}));
      if(up.length){ const {error:e2}=await SB.from(SB_TABLE).upsert(up); if(e2) throw e2; }
      /* ระหว่างรอเน็ต ผู้ใช้อาจแก้เพิ่ม → เอาส่วนที่แก้หลัง snap ทับลงไป (รอบหน้าจะส่ง) */
      const now=this.rowsOf(S), final={};
      Object.keys(Object.assign({},merged,now)).forEach(k=>{ final[k]= (k in now) ? merge3(snap[k]||{}, now[k], merged[k]||{}, true) : merged[k]; });
      this.base=merged; lsSet(BASE_KEY,merged);
      const changedView = JSON.stringify(final)!==JSON.stringify(now);
      S=this.stateOf(final,S.ui); lsSet(LOCAL_KEY,S);
      this.meta.user=SB_USER; lsSet(META_KEY,this.meta);
      SYNC.at=new Date(); setSync('ok');
      if(changedView && !typing()){ fillMonthSel(); refresh(); }
      else if(changedView) this.again=true;
    }catch(e){
      const msg=String((e&&e.message)||e);
      if(/jwt|token|auth|401|403|row-level/i.test(msg) && navigator.onLine!==false) setSync('login',msg);
      else if(navigator.onLine===false || /offline|fetch|network|timeout|load failed/i.test(msg)) setSync('offline',msg);
      else setSync('err',msg);
      clearTimeout(this.retry); this.retry=setTimeout(()=>{ if(this.pendingCount()) this.sync(); },60000);
    }finally{
      this.busy=false;
      if(this.again && SYNC.state==='ok'){ this.again=false; this.queue(); }
    }
  },
  pending(){ return !!this.timer || this.busy || this.pendingCount()>0; },
};
function setSync(state,err){
  if(state){ SYNC.state=state; SYNC.err=err||''; }
  const el=document.getElementById('sync'); if(!el) return;
  const t=SYNC.at?`${pad2(SYNC.at.getHours())}:${pad2(SYNC.at.getMinutes())}`:'';
  const n=IS_SB?Cloud.pendingCount():0;
  const wait=n?` · <b class="pend">รอส่ง ${n} ช่อง</b> <button class="btn sm pri" data-sync="now">ส่งตอนนี้</button>`:'';
  el.innerHTML={
    local:'<span title="ข้อมูลเก็บในเบราว์เซอร์ของเครื่องนี้">💾 เก็บในเครื่องนี้</span>',
    loading:'⏳ กำลังโหลด…',
    saving:`⏳ กำลังซิงก์… <span class="hint">👤 ${esc(SB_USER)}</span>`,
    ok: n ? `🟡 ออนไลน์ · 👤 ${esc(SB_USER)}${wait}`
          : `✅ ออนไลน์ · 👤 ${esc(SB_USER)} · ${t} <button class="btn sm" data-sync="now" title="โหลดข้อมูลล่าสุดจากเซิร์ฟเวอร์">🔄</button> <button class="btn sm" data-sync="out">ออกจากระบบ</button>`,
    offline:`<span class="off" title="${esc(SYNC.err)}">🟠 ออฟไลน์ · 👤 ${esc(SB_USER)}</span>${n?wait:' · ข้อมูลล่าสุด '+(t||'ที่เก็บในเครื่อง')}`,
    login:`<span style="color:var(--bad)">🔑 ต้องล็อกอินใหม่</span>${n?` · <b class="pend">รอส่ง ${n} ช่อง</b>`:''} <button class="btn sm pri" data-sync="login">ล็อกอิน</button>`,
    err:`<span style="color:var(--bad)">⚠ ซิงก์ไม่สำเร็จ: ${esc(SYNC.err)}</span>${n?` · <b class="pend">รอส่ง ${n} ช่อง</b>`:''} <button class="btn sm" data-sync="now">ลองใหม่</button>`,
  }[SYNC.state]||'';
  el.querySelectorAll('[data-sync]').forEach(b=>b.onclick=async()=>{
    const a=b.dataset.sync;
    if(a==='now'){ flushDraft(); Cloud.sync(); }
    if(a==='out') sbLogout();
    if(a==='login'){ await sbLogin(true); Cloud.sync(); }
  });
}
function freshState(){ return {v:1, maps:JSON.parse(JSON.stringify(DEFAULT_MAPS)), months:{}, ui:{}}; }
let S = Storage.load() || freshState();
if(!S.maps) S.maps = JSON.parse(JSON.stringify(DEFAULT_MAPS));
if(!S.ui) S.ui = {};
const save = ()=>Storage.save(S);

/* ---------------- 3. ตัวช่วยวันที่/ตัวเลข ---------------- */
const pad2 = n=>String(n).padStart(2,'0');
const ymd = d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const ymOf = s=>s.slice(0,7);
const parseYmd = s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};
const daysIn = ym=>{const [y,m]=ym.split('-').map(Number);return new Date(y,m,0).getDate();};
const monthDates = ym=>Array.from({length:daysIn(ym)},(_,i)=>`${ym}-${pad2(i+1)}`);
const dayLabel = s=>{const d=parseYmd(s);return `${TH_DOW[d.getDay()]} ${pad2(d.getDate())}/${pad2(d.getMonth()+1)}`;};
const ymLabel = ym=>{const [y,m]=ym.split('-').map(Number);return `${TH_MON[m]} ${y}`;};
const num = v=>{ if(v==null||v==='') return null; if(typeof v==='number') return isFinite(v)?v:null; const n=parseFloat(String(v).replace(/,/g,'')); return isFinite(n)?n:null; };
const fmt = (v,d=2)=>v==null||v===''||!isFinite(v)?'':Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const r6 = v=>v==null?null:Math.round(v*1e6)/1e6;
const esc = s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toDate(v){
  if(v==null||v==='') return null;
  if(v instanceof Date) return isNaN(v)?null:v;
  if(typeof v==='number'){ const d=XLSX.SSF.parse_date_code(v); return d?new Date(d.y,d.m-1,d.d,d.H,d.M,Math.round(d.S)):null; }
  const s=String(v).trim(); let m;
  if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/))) return new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0),+(m[6]||0));
  if((m=s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/))){ let y=+m[3]; if(y<100)y+=2000; if(y>2400)y-=543; return new Date(y,+m[2]-1,+m[1],+(m[4]||0),+(m[5]||0)); }
  return null;
}
function dateFromFilename(name){
  const m=name.match(/(\d{1,2})[.\-_](\d{1,2})[.\-_](\d{4})/); if(!m) return null;
  let y=+m[3]; if(y>2400) y-=543; return `${y}-${pad2(+m[2])}-${pad2(+m[1])}`;
}

/* ---------------- 4. เดือน / เป้า / วันหยุด ---------------- */
function getMonth(ym, create=true){
  if(!S.months[ym] && create){
    const prev = Object.keys(S.months).filter(k=>k<ym).sort().pop();
    S.months[ym] = {t:{...(prev?S.months[prev].t:DEFAULT_TARGETS)}, mt:{}, hol:{}, d:{}};
  }
  return S.months[ym];
}
function isHoliday(date){
  const M=S.months[ymOf(date)]; const o=M&&M.hol?M.hol[date]:undefined;
  if(o!==undefined) return o;
  return parseYmd(date).getDay()===0;
}
const workDaysOf = ym=>monthDates(ym).filter(d=>!isHoliday(d)).length;
function monthTarget(ym,key){ // key: raw|order|ship|rep1
  const M=getMonth(ym,false); if(!M) return null;
  if(M.mt && num(M.mt[key])!=null) return num(M.mt[key]);
  return M.t[key]*workDaysOf(ym);
}

/* ---------------- 5. ตารางจับคู่ ---------------- */
function buildLookups(){
  const m=S.maps;
  const bills=[...m.billTypes].sort((a,b)=>b.prefix.length-a.prefix.length);
  const bake=new Map(); m.bake.forEach(([k,v])=>{const n=num(k); if(n!=null&&!bake.has(n)) bake.set(n,v);});
  const shadeExact=new Map(), shadeTrim=new Map();
  m.shade.forEach(([c,v])=>{const s=String(c); if(!shadeExact.has(s)) shadeExact.set(s,v); const t=s.trim().toUpperCase(); if(!shadeTrim.has(t)) shadeTrim.set(t,v);});
  return {
    bill(no){ const s=String(no??'').trim().toUpperCase(); for(const b of bills){ if(b.prefix && s.startsWith(b.prefix.toUpperCase())) return b; } return {prefix:'',name:'ออเดอร์',count:'order'}; },
    bake(q){ const n=num(q); return n!=null&&bake.has(n)?bake.get(n):null; },
    shade(c){ const s=String(c??''); return shadeExact.get(s) ?? shadeTrim.get(s.trim().toUpperCase()) ?? null; },
    group(cat){ return m.shadeGroups[cat] || 'color'; },
  };
}

/* ---------------- 6. อ่านไฟล์ Excel ---------------- */
const norm = s=>String(s??'').replace(/\s+/g,'').toLowerCase();
function sheetRows(ws){ return XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null,blankrows:false}); }
function findHeader(rows, need){
  for(let i=0;i<Math.min(rows.length,15);i++){
    const h=rows[i].map(norm);
    if(need.every(n=>h.includes(norm(n)))) return {i, idx:name=>h.indexOf(norm(name))};
  }
  return null;
}
async function readWorkbook(file){
  const buf=await file.arrayBuffer();
  return XLSX.read(buf,{type:'array',cellDates:false});
}
async function analyzeFile(file){
  const wb=await readWorkbook(file); const name=file.name;
  // ก) ไฟล์สรุปปี (ชีต YYYY.MM)
  const yearSheets=wb.SheetNames.filter(n=>/^\d{4}\.\d{1,2}$/.test(n.trim()));
  if(yearSheets.length){
    const out=[parseYearBook(wb,yearSheets,name)];
    for(const sn of wb.SheetNames){ if(yearSheets.includes(sn)) continue;
      const rows=sheetRows(wb.Sheets[sn]);
      if(rows.some(r=>r&&r.some(v=>norm(v)===norm('รวมยอดขาย')))){ const x=parseSalesBook(rows,name+' · ชีต '+sn,sn); if(Object.keys(x.months).length){ out.push(x); break; } } }
    return out;
  }
  // ข) ไฟล์เปิดบิลสั่งย้อม (สรุป)
  for(const sn of wb.SheetNames){
    const rows=sheetRows(wb.Sheets[sn]);
    const h=findHeader(rows,['วันที่','เลขที่บิล','นิ้วอบ','เฉด','น้ำหนัก']);
    if(h) return parseOrderSheet(rows,h,name,sn);
  }
  // ค) ไฟล์ค้างส่ง / เปิดบิลขาย
  for(const sn of wb.SheetNames){
    const rows=sheetRows(wb.Sheets[sn]);
    const h=findHeader(rows,['วันที่ขนส่งรับ','น้ำหนักสุทธิ','เลขที่บิล']);
    if(h){
      if(isBillFile(rows,h,name)) return parseBillSheet(rows,h,name,sn);
      return parsePendingSheet(rows,h,name,sn);
    }
  }
  // ง) ไฟล์รายงานยอดขาย (Excel เดิม — บล็อกรายเดือน)
  for(const sn of wb.SheetNames){
    const rows=sheetRows(wb.Sheets[sn]);
    if(rows.some(r=>r&&r.some(v=>norm(v)===norm('รวมยอดขาย')))) return parseSalesBook(rows,name,sn);
  }
  return {kind:'skip',name,msg:'ไม่รู้จักรูปแบบไฟล์นี้'};
}

function parseOrderSheet(rows,h,name,sn){
  const L=buildLookups();
  const c={date:h.idx('วันที่'),bill:h.idx('เลขที่บิล'),inch:h.idx('นิ้วอบ'),shade:h.idx('เฉด'),w:h.idx('น้ำหนัก')};
  const byDate={}; const warn={shade:{},bake:{},noDate:0};
  for(let r=h.i+1;r<rows.length;r++){
    const row=rows[r]; const w=num(row[c.w]); if(w==null) continue;
    const dt=toDate(row[c.date]); if(!dt){warn.noDate++;continue;}
    const key=ymd(dt);
    const o=byDate[key]||(byDate[key]={white:0,black:0,wash:0,color:0,narrow:0,wide:0,split:0,waitBake:0,repair:0,_rows:0,_order:0});
    o._rows++;
    const bt=L.bill(row[c.bill]);
    if(bt.count==='repair'){ o.repair+=w; continue; }
    if(bt.count!=='order') continue;
    o._order+=w;
    const cat=L.shade(row[c.shade]);
    if(!cat){ const k=String(row[c.shade]??'(ว่าง)'); warn.shade[k]=(warn.shade[k]||0)+w; }
    o[L.group(cat||'ไม่รู้')]+=w;
    const bk=L.bake(row[c.inch]);
    if(bk==='แคบ') o.narrow+=w; else if(bk==='กว้าง') o.wide+=w; else if(bk==='ผ่า') o.split+=w;
    else { o.waitBake+=w; const k=String(row[c.inch]??'(ว่าง)'); warn.bake[k]=(warn.bake[k]||0)+w; }
  }
  const days={};
  Object.entries(byDate).forEach(([d,o])=>{ days[d]={}; ['white','black','wash','color','narrow','wide','split','waitBake','repair'].forEach(k=>days[d][k]=r6(o[k]/1000)); });
  const warns=[];
  const sh=Object.entries(warn.shade); if(sh.length) warns.push(`รหัสเฉดที่ไม่มีในตารางจับคู่ (นับเป็น "สี"): ${sh.map(([k,v])=>`${k} ${fmt(v/1000,3)} ตัน`).join(', ')}`);
  const bk=Object.entries(warn.bake); if(bk.length) warns.push(`นิ้วอบที่ไม่มีในตาราง (นับเป็น "รออบ"): ${bk.map(([k,v])=>`${k}`).join(', ')}`);
  if(warn.noDate) warns.push(`มี ${warn.noDate} แถวที่อ่านวันที่ไม่ได้ — ข้ามไป`);
  return {kind:'order',name,sheet:sn,days,warns,fields:['white','black','wash','color','narrow','wide','split','waitBake','repair']};
}

function parsePendingSheet(rows,h,name,sn){
  const c={recv:h.idx('วันที่ขนส่งรับ'),w:h.idx('น้ำหนักสุทธิ'),v:h.idx('มูลค่า')};
  const items=[]; let maxD=null;
  for(let r=h.i+1;r<rows.length;r++){
    const w=num(rows[r][c.w]); if(w==null) continue;
    const d=toDate(rows[r][c.recv]); items.push({w,d,v:c.v>=0?(num(rows[r][c.v])||0):0});
    if(d&&(!maxD||d>maxD)) maxD=d;
  }
  const guess=dateFromFilename(name)||(maxD?ymd(maxD):ymd(new Date()));
  const res={kind:'pend',name,sheet:sn,items,reportDate:guess,warns:[],fields:['pending','pendingPrev','pendingAfter8'].concat(c.v>=0?['pendValNet','pendVal8']:[])};
  calcPending(res); return res;
}
function calcPending(res){
  const rd=parseYmd(res.reportDate); const mStart=new Date(rd.getFullYear(),rd.getMonth(),1); const at8=new Date(rd.getFullYear(),rd.getMonth(),rd.getDate(),8,0,0);
  let tot=0,prev=0,after=0,noDate=0,vt=0,v8=0;
  res.items.forEach(({w,d,v})=>{ tot+=w; vt+=v; if(!d){noDate++;return;} if(d>=at8) v8+=v; if(d<mStart) prev+=w; else if(d>=at8) after+=w; });
  res.days={[res.reportDate]:{pending:r6((tot-prev-after)/1000),pendingPrev:r6(prev/1000),pendingAfter8:r6(after/1000),pendValNet:Math.round(vt-v8),pendVal8:Math.round(v8)}};
  res.summary=`รวมค้างส่ง ${fmt(tot/1000,3)} ตัน จาก ${res.items.length} รายการ`;
  res.warns = noDate?[`มี ${noDate} รายการไม่มีวันที่ขนส่งรับ (นับรวมใน "ผ้าค้างส่ง")`]:[];
}

/* นำเข้าไฟล์สรุปปี (ชีต 2026.09, 2026.10 …) — อ่านค่าตามหัวคอลัมน์ */
const YEAR_COLS = {
  date:['วันที่','A'], tOrder:['เป้าออเดอร์','B'], tShip:['เป้าหมายส่งผ้าสำเร็จ','AB'], tRaw:['เป้าหมายรับผ้าดิบเข้าโรงงาน','AP'],
  tRep1:['เป้าหมายที่ 1 รับผ้าซ่อม/ตีกลับ ต่อวัน','X'], tRep2:['เป้าหมายที่2รับผ้าซ่อม/ตีกลับ ต่อวัน','Z'],
  white:['ขาว','F'], black:['ดำ','G'], wash:['ล้างน้ำ','H'], color:['สี','I'], narrow:['แคบ','J'], wide:['กว้าง','K'], split:['ผ่า','L'], waitBake:['รออบ','M'],
  repair:['ผ้าซ่อม/ผ้าตีกลับ ต่อวัน','U'], shipRepair:['ส่งผ้าซ่อม','AD'], shipGood:['ส่งผ้าดี','AE'], pending:['ผ้าค้างส่ง','AF'],
  pendingPrev:['ผ้าค้างส่งเดือนก่อนหน้า','AG'], pendingAfter8:['ผ้าค้างส่ง หลัง 8โมงของวันที่ส่ง','AH'], fromProd:['รับผ้าจากผลิต(ไม่รวมC)','AM'], rawIn:['รับผ้าดิบเข้าโรงงาน','AR'],
};
function parseYearBook(wb,sheets,name){
  const months={}; const warns=[];
  sheets.forEach(sn=>{
    const rows=sheetRows(wb.Sheets[sn]); if(!rows.length) return;
    const hdr=rows[0].map(norm);
    const col={};
    Object.entries(YEAR_COLS).forEach(([k,[h,letter]])=>{
      let i=hdr.lastIndexOf(norm(h));
      if(k==='tShip'||k==='date'){ i=XLSX.utils.decode_col(letter); if(norm(rows[0][i])!==norm(h)) i=hdr.indexOf(norm(h)); }
      if(i<0){ i=XLSX.utils.decode_col(letter); warns.push(`${sn}: ไม่พบหัวคอลัมน์ "${h}" ใช้คอลัมน์ ${letter} แทน`); }
      col[k]=i;
    });
    const [y,m]=sn.trim().split('.').map(Number); const ym=`${y}-${pad2(m)}`;
    const out={d:{},hol:{},t:{}}; const tv={tOrder:[],tShip:[],tRaw:[],tRep1:[],tRep2:[]};
    for(let r=1;r<Math.min(rows.length,40);r++){
      const dt=toDate(rows[r][col.date]); if(!dt||ymd(dt).slice(0,7)!==ym) continue;
      const ds=ymd(dt); const rec={}; let any=false;
      FIELDS.forEach(f=>{const v=num(rows[r][col[f.k]]); if(v!=null){rec[f.k]=v;any=true;}});
      if(any){ rec._src={}; FIELDS.forEach(f=>{ if(rec[f.k]!=null) rec._src[f.k]='import'; }); out.d[ds]=rec; }
      const to=num(rows[r][col.tOrder]);
      out.hol[ds]= to==null;
      Object.keys(tv).forEach(k=>{const v=num(rows[r][col[k]]); if(v!=null) tv[k].push(v);});
    }
    const mode=a=>{ if(!a.length) return null; const c={}; a.forEach(v=>c[v]=(c[v]||0)+1); return +Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0]; };
    out.t={order:mode(tv.tOrder),ship:mode(tv.tShip),raw:mode(tv.tRaw),rep1:mode(tv.tRep1),rep2:mode(tv.tRep2)};
    months[ym]=out;
  });
  return {kind:'year',name,months,warns};
}

/* ---------------- 7. คำนวณเดือน (ตามสูตร Excel; สะสม = ยอดจริง) ---------------- */
function calcMonth(ym, upto){
  const M=getMonth(ym); const dates=monthDates(ym);
  const v=k=>dates.map(d=>{const r=M.d[d]; return r&&r[k]!=null?r[k]:null;});
  const order=dates.map(d=>{const r=M.d[d]; if(!r) return null; const a=['white','black','wash','color'].map(k=>r[k]); return a.every(x=>x==null)?null:a.reduce((s,x)=>s+(x||0),0);});
  const ship=dates.map(d=>{const r=M.d[d]; if(!r||(r.shipGood==null&&r.shipRepair==null)) return null; return (r.shipGood||0)+(r.shipRepair||0);});
  let lastIdx=-1;
  dates.forEach((d,i)=>{ const r=M.d[d]; if(r && FIELDS.some(f=>r[f.k]!=null) && (!upto||d<=upto)) lastIdx=i; });
  if(upto && dates.indexOf(upto)>lastIdx) lastIdx=dates.indexOf(upto);
  const cut=a=>a.map((x,i)=>i<=lastIdx?x:null);
  const avgOf=a=>{const b=a.filter((x,i)=>x!=null&&i<=lastIdx); return b.length?b.reduce((s,x)=>s+x,0)/b.length:null;};
  const cum=a=>{let s=0;return a.map((x,i)=>{if(i>lastIdx)return null;s+=x||0;return s;});};
  const work=dates.map(d=>!isHoliday(d));
  const tcum=t=>{let s=0;return work.map(w=>{if(w)s+=t;return s;});};
  const flat=x=>dates.map((_,i)=>i<=lastIdx?x:null);
  const T=M.t;
  const S_={};
  FIELDS.forEach(f=>S_[f.k]=cut(v(f.k)));
  S_.order=cut(order); S_.ship=cut(ship);
  const A={raw:avgOf(S_.rawIn),order:avgOf(S_.order),ship:avgOf(S_.ship),good:avgOf(S_.shipGood),prod:avgOf(S_.fromProd),rep:avgOf(S_.repair)};
  return {
    ym, dates, labels:dates.map(dayLabel), lastIdx, lastDate:lastIdx>=0?dates[lastIdx]:null, work, T,
    workDays:work.filter(Boolean).length, workToDate:work.filter((w,i)=>w&&i<=lastIdx).length,
    s:{...S_,
      rawAvg:flat(A.raw), rawCum:cum(S_.rawIn), rawT:tcum(T.raw),
      orderAvg:flat(A.order), orderCum:cum(S_.order), orderT:tcum(T.order),
      shipAvg:flat(A.ship), goodAvg:flat(A.good), prodAvg:flat(A.prod), shipCum:cum(S_.ship), prodCum:cum(S_.fromProd), shipT:tcum(T.ship),
      repAvg:flat(A.rep), repCum:cum(S_.repair), rep1:tcum(T.rep1), rep2:tcum(T.rep2),
    },
    avg:A,
    mt:{raw:monthTarget(ym,'raw'),order:monthTarget(ym,'order'),ship:monthTarget(ym,'ship'),rep1:monthTarget(ym,'rep1')},
  };
}

/* ---------------- 8. UI พื้นฐาน ---------------- */
const $ = s=>document.querySelector(s);
const $$ = s=>[...document.querySelectorAll(s)];
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>e.classList.remove('on'),2200);}
let curView='upload', curStyle='A';
function allMonths(){ const k=Object.keys(S.months).sort(); const now=ymOf(ymd(new Date())); if(!k.includes(now)) k.push(now); return k.sort(); }
function curYm(){ return $('#selMonth').value || ymOf(ymd(new Date())); }
function curUpto(){ return $('#selDay').value || null; }
function fillMonthSel(prefer){
  const sel=$('#selMonth'); const ms=allMonths(); const keep=prefer||sel.value||S.ui.month||ms.filter(m=>S.months[m]&&Object.keys(S.months[m].d).length).pop()||ms[ms.length-1];
  sel.innerHTML=ms.map(m=>`<option value="${m}">${ymLabel(m)}</option>`).join('');
  sel.value=ms.includes(keep)?keep:ms[ms.length-1];
  fillDaySel();
}
function fillDaySel(prefer){
  const ym=curYm(); const M=getMonth(ym); const sel=$('#selDay');
  const withData=monthDates(ym).filter(d=>M.d[d]&&FIELDS.some(f=>M.d[d][f.k]!=null));
  const last=withData[withData.length-1];
  sel.innerHTML=monthDates(ym).map(d=>`<option value="${d}">${dayLabel(d)}${M.d[d]&&FIELDS.some(f=>M.d[d][f.k]!=null)?'':' (ว่าง)'}</option>`).join('');
  sel.value=prefer&&monthDates(ym).includes(prefer)?prefer:(last||monthDates(ym)[0]);
}
/* บันทึกค่าที่กำลังพิมพ์ทันที (ไม่ต้องรอกดบันทึก/ออกจากช่อง) — กันข้อมูลหายตอนสลับแท็บ/สลับหน้าต่าง */
function setVal(d,k,raw){
  const M=getMonth(ymOf(d)); const cur=M.d[d]||(M.d[d]={_src:{}}); cur._src=cur._src||{};
  const v=num(raw); const was=cur._src[k];
  if(v==null){ if(cur[k]==null) return false; delete cur[k]; delete cur._src[k]; }
  else { if(cur[k]===v) return false; cur[k]=v; cur._src[k]=(!FK[k]||FK[k].src==='manual')?'manual':((was==='file'||was==='import'||was==='edit')?'edit':'manual'); }
  save(); return true;
}
const DRAFT={t:null,fn:null};
function draft(fn){ clearTimeout(DRAFT.t); DRAFT.fn=fn; DRAFT.t=setTimeout(flushDraft,400); }
function flushDraft(){ clearTimeout(DRAFT.t); DRAFT.t=null; const f=DRAFT.fn; DRAFT.fn=null; if(f) f(); }
const typing=()=>{ const a=document.activeElement; return !!(a && a.matches && a.matches('#grid input[data-k], #quickForm input[data-q], #salesBox input[data-ed]')); };
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') flushDraft(); });
window.addEventListener('pagehide',flushDraft);
function refresh(){
  flushDraft();
  if(curView==='grid') renderGrid();
  if(curView==='charts') renderCharts();
  if(curView==='year') renderYear();
  if(curView==='settings') renderSettings();
  if(curView==='sales') renderSales();
  if(curView==='upload') renderQuick();
}
$$('#tabs button').forEach(b=>b.onclick=()=>{
  curView=b.dataset.v; $$('#tabs button').forEach(x=>x.classList.toggle('on',x===b));
  $$('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+curView)); refresh();
});
$('#selMonth').onchange=()=>{S.ui.month=curYm();save();fillDaySel();refresh();};
$('#selDay').onchange=()=>refresh();

/* ---------------- 9. อัปโหลด ---------------- */
let pending=[];
const drop=$('#drop'), fin=$('#fileIn');
drop.onclick=()=>fin.click();
fin.onchange=()=>{handleFiles([...fin.files]);fin.value='';};
['dragenter','dragover'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('over');}));
['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('over');}));
drop.addEventListener('drop',ev=>handleFiles([...ev.dataTransfer.files]));
async function handleFiles(files){
  for(const f of files){
    if(f.name.startsWith('~$')) continue;
    try{ const r=await analyzeFile(f); (Array.isArray(r)?r:[r]).forEach(x=>{ if(f._watch) x._watch=f._watch; pending.push(x); }); }
    catch(e){ console.error(e); pending.push({kind:'skip',name:f.name,msg:'อ่านไฟล์ไม่ได้: '+e.message,_watch:f._watch}); }
  }
  renderPreview();
}
function renderPreview(){
  const box=$('#pvList'); box.innerHTML=''; let html0='';
  pending.forEach((p,pi)=>{
    const el=document.createElement('div'); el.className='pv';
    if(p.kind==='skip'){ el.innerHTML=`<h3>⚪ ${esc(p.name)}</h3><div class="hint">${esc(p.msg)}</div>`; box.appendChild(el); return; }
    if(p.kind==='year'){
      const ms=Object.keys(p.months).sort();
      el.innerHTML=`<h3>📚 ${esc(p.name)} — นำเข้าย้อนหลัง</h3>
        <div class="hint">พบ ${ms.length} เดือน: ${ms.map(m=>`${ymLabel(m)} (${Object.keys(p.months[m].d).length} วัน, เป้า ออเดอร์ ${p.months[m].t.order} · ส่ง ${p.months[m].t.ship} · ผ้าดิบ ${p.months[m].t.raw} · ซ่อม ${p.months[m].t.rep1}/${p.months[m].t.rep2})`).join(' · ')}</div>
        ${ms.some(m=>S.months[m]&&Object.keys(S.months[m].d).length)?'<div class="warn">⚠ บางเดือนมีข้อมูลอยู่แล้ว — ค่าในไฟล์จะเขียนทับเฉพาะวันที่ไฟล์มีข้อมูล (ช่องที่แก้มือไว้จะไม่ถูกทับ)</div>':''}
        ${p.warns.map(w=>`<div class="warn">⚠ ${esc(w)}</div>`).join('')}`;
      box.appendChild(el); return;
    }
    if(p.kind==='sales'){
      const ms=Object.keys(p.months).sort();
      el.innerHTML=`<h3>💰 ${esc(p.name)} — นำเข้ารายงานยอดขาย & ส่งผ้า ย้อนหลัง</h3>
        <div class="hint">พบ ${ms.length} เดือน: ${ms.map(m=>`${ymLabel(m)} (${Object.keys(p.months[m].d).length} วัน${p.months[m].s.saleTarget?`, เป้าขาย ${fmt(p.months[m].s.saleTarget,0)}`:''})`).join(' · ')}</div>
        <div class="hint">นำเข้า: ส่งผ้าได้ / ยอดขาย (ช่องย่อย — รวมให้โปรแกรมบวกเอง) · ยอดขายสะสมตามที่พิมพ์ไว้ · มูลค่าค้างส่ง · เป้า · วันหยุดขาย/ออเดอร์</div>
        ${p.warns.map(w=>`<div class="warn">⚠ ${esc(w)}</div>`).join('')}`;
      box.appendChild(el); return;
    }
    const icon=p.kind==='order'?'🧾':p.kind==='bill'?'💰':'🚚';
    const title=p.kind==='order'?'เปิดบิลสั่งย้อม (ไฟล์สรุป)':p.kind==='bill'?'เปิดบิลขาย (ส่งผ้าได้ / ยอดขาย)':'ผ้าค้างส่ง';
    if(p.kind==='bill') html0=`<div class="hint">${esc(p.summary)}</div>`; else html0='';
    let html=`<h3>${icon} ${esc(p.name)} — ${title}</h3>`+html0;
    if(p.kind==='pend') html+=`<div class="row"><label class="hint">วันที่รายงาน</label><input type="date" value="${p.reportDate}" data-rd="${pi}" class="btn sm"><span class="hint">${esc(p.summary)} · "หลัง 8 โมง" = ขนส่งรับตั้งแต่ 08:00 ของวันนี้</span></div>`;
    Object.entries(p.days).sort().forEach(([d,vals])=>{
      const old=(S.months[ymOf(d)]||{d:{}}).d[d]||{};
      html+=`<table><tr><th>${dayLabel(d)}</th>${p.fields.map(k=>`<th>${LBL(k)}</th>`).join('')}</tr>
        <tr><th>ค่าใหม่</th>${p.fields.map(k=>`<td class="${old[k]!=null&&Math.abs(old[k]-vals[k])>1e-6?'chg':''}">${fmt(vals[k],DEC(k))}</td>`).join('')}</tr>
        ${p.fields.some(k=>old[k]!=null)?`<tr><th>ค่าเดิม</th>${p.fields.map(k=>`<td class="old">${fmt(old[k],DEC(k))}${old._src&&old._src[k]==='edit'?' ✎':''}</td>`).join('')}</tr>`:''}</table>`;
      if(p.fields.some(k=>old[k]!=null)) html+=`<div class="warn">⚠ วันนี้มีข้อมูลอยู่แล้ว — บันทึกจะเขียนทับ (ช่องที่มี ✎ แก้มือไว้ ก็จะถูกทับด้วย)</div>`;
    });
    p.warns.forEach(w=>html+=`<div class="warn">⚠ ${esc(w)}</div>`);
    el.innerHTML=html; box.appendChild(el);
  });
  $$('[data-rd]').forEach(i=>i.onchange=()=>{const p=pending[+i.dataset.rd]; p.reportDate=i.value; calcPending(p); renderPreview();});
  $('#pvActions').style.display=pending.some(p=>p.kind!=='skip')?'flex':'none';
}
$('#btnClearPv').onclick=()=>{Watch.markSeen(pending);pending=[];renderPreview();};
$('#btnSaveAll').onclick=()=>{
  let lastDate=null, n=0;
  pending.forEach(p=>{
    if(p.kind==='year'){
      Object.entries(p.months).forEach(([ym,mo])=>{
        const M=getMonth(ym);
        Object.entries(mo.t).forEach(([k,v])=>{ if(v!=null) M.t[k]=v; });
        Object.assign(M.hol, mo.hol);
        Object.entries(mo.d).forEach(([d,rec])=>{
          const cur=M.d[d]||(M.d[d]={_src:{}}); cur._src=cur._src||{};
          FIELDS.forEach(f=>{ if(rec[f.k]!=null && cur._src[f.k]!=='edit'){ cur[f.k]=rec[f.k]; cur._src[f.k]='import'; } });
          if(!lastDate||d>lastDate) lastDate=d;
        });
        n++;
      });
    } else if(p.kind==='sales'){
      Object.entries(p.months).forEach(([ym,mo])=>{
        const M=getMonth(ym); M.s=Object.assign(M.s||{},mo.s); M.holSale=Object.assign(M.holSale||{},mo.holSale);
        if(mo.hol) Object.assign(M.hol,mo.hol);
        Object.entries(mo.d).forEach(([d,rec])=>{
          const cur=M.d[d]||(M.d[d]={_src:{}}); cur._src=cur._src||{};
          Object.entries(rec).forEach(([k,v])=>{ if(v!=null && cur._src[k]!=='edit' && !(k==='saleCumManual'&&cur._src[k]==='manual')){ cur[k]=v; cur._src[k]='import'; } });
          if(!lastDate||d>lastDate) lastDate=d;
        });
        n++;
      });
    } else if(p.kind==='order'||p.kind==='pend'||p.kind==='bill'){
      Object.entries(p.days).forEach(([d,vals])=>{
        const M=getMonth(ymOf(d)); const cur=M.d[d]||(M.d[d]={_src:{}}); cur._src=cur._src||{};
        p.fields.forEach(k=>{ cur[k]=vals[k]; cur._src[k]='file'; });
        if(!lastDate||d>lastDate) lastDate=d; n++;
      });
    }
  });
  save(); Watch.markSeen(pending); pending=[]; renderPreview();
  if(lastDate){ fillMonthSel(ymOf(lastDate)); fillDaySel(lastDate); }
  renderQuick();
  toast(`บันทึกแล้ว ${n} รายการ`);
};

/* กรอกมือเร็ว (วันที่เลือกอยู่) */
function renderQuick(){
  const d=curUpto(); const box=$('#quickForm'); if(!d){box.innerHTML='';return;}
  const M=getMonth(ymOf(d)); const r=M.d[d]||{};
  const mans=FIELDS.filter(f=>f.src==='manual');
  box.innerHTML=`<div class="field" style="min-width:140px"><label>วันที่</label><input type="date" id="qDate" value="${d}"></div>`+
    mans.map(f=>`<div class="field"><label>${f.l} (ตัน)</label><input type="number" step="0.001" data-q="${f.k}" value="${r[f.k]??''}"></div>`).join('')+
    `<button class="btn pri" id="qSave" style="align-self:flex-end">บันทึก</button>`;
  $('#qDate').onchange=e=>{flushDraft(); const v=e.target.value; if(!v) return; fillMonthSel(ymOf(v)); fillDaySel(v); renderQuick();};
  // บันทึกอัตโนมัติทุกช่องระหว่างพิมพ์ (ปุ่มบันทึกยังกดได้ เพื่อยืนยัน)
  $$('[data-q]').forEach(i=>{
    const put=()=>setVal($('#qDate').value,i.dataset.q,i.value);
    i.oninput=()=>draft(put); i.onchange=()=>{ draft(put); flushDraft(); };
  });
  $('#qSave').onclick=()=>{
    flushDraft(); const dd=$('#qDate').value;
    $$('[data-q]').forEach(i=>setVal(dd,i.dataset.q,i.value));
    fillMonthSel(ymOf(dd)); fillDaySel(dd); toast('บันทึกแล้ว');
  };
}

/* ---------------- 9b. โฟลเดอร์เฝ้าดู — นำเข้าอัตโนมัติ (File System Access API: Chrome/Edge) ----------------
   ผู้ใช้เลือกโฟลเดอร์ครั้งเดียว (handle เก็บใน IndexedDB ของเครื่องนั้น) → ทุกครั้งที่เปิดโปรแกรมสแกนหาไฟล์ใหม่
   ที่ชื่อตรงแบบ ค้างส่ง dd.mm.yyyy_ตามรูป / เปิดบิลขาย dd.mm.yyyy_pivot_summary / dd.mm.yyyy สรุป
   → ขึ้นการ์ดตัวอย่างเหมือนลากไฟล์ ผู้ใช้กด "บันทึกทั้งหมด" เอง (ผู้ใช้เลือก 30 ต.ค.)
   ไฟล์ที่มีอยู่ตอนตั้งค่าถือว่าเห็นแล้ว (ไม่นำเข้าย้อนหลัง) · เห็นแล้ว = name|lastModified|size ใน localStorage '…-watch'
   ------------------------------------------------------------------------------------------------- */
const WATCH_KEY=STORE_KEY+'-watch';
const WATCH_RE=[/^ค้างส่ง \d\d\.\d\d\.\d{4}_ตามรูป\.xlsx$/, /^เปิดบิลขาย \d\d\.\d\d\.\d{4}_pivot_summary\.xlsx$/, /^\d\d\.\d\d\.\d{4} สรุป\.xlsx$/];
const Watch={
  dir:null, meta:lsGet(WATCH_KEY,{seen:{},at:null,name:''}), busy:false,
  ok(){ return !!window.showDirectoryPicker && !!window.indexedDB; },
  idb(){ return new Promise((res,rej)=>{ const r=indexedDB.open('tet-graph-report',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); },
  async loadDir(){ try{ const db=await this.idb(); return await new Promise((res,rej)=>{ const t=db.transaction('kv').objectStore('kv').get('dir'); t.onsuccess=()=>res(t.result||null); t.onerror=()=>rej(t.error); }); }catch(e){ return null; } },
  async saveDir(h){ try{ const db=await this.idb(); await new Promise((res,rej)=>{ const t=db.transaction('kv','readwrite'); (h?t.objectStore('kv').put(h,'dir'):t.objectStore('kv').delete('dir')); t.oncomplete=res; t.onerror=()=>rej(t.error); }); }catch(e){} },
  async files(){ const out=[]; for await (const [name,h] of this.dir.entries()){ if(h.kind!=='file'||name.startsWith('~$')||!WATCH_RE.some(r=>r.test(name))) continue; const f=await h.getFile(); out.push(f); } return out; },
  key(f){ return `${f.name}|${f.lastModified}|${f.size}`; },
  async pick(){
    try{ const h=await window.showDirectoryPicker({id:'tet-report',mode:'read'}); this.dir=h; await this.saveDir(h);
      const fs=await this.files(); this.meta={seen:Object.fromEntries(fs.map(f=>[this.key(f),1])),at:Date.now(),name:h.name}; this.save();
      toast(`เฝ้าดูโฟลเดอร์ "${h.name}" แล้ว — ไฟล์ใหม่ที่มาหลังจากนี้จะขึ้นให้ตรวจเอง (${fs.length} ไฟล์เดิมไม่นำเข้า)`); this.render('granted'); }
    catch(e){ if(e&&e.name!=='AbortError') toast('เลือกโฟลเดอร์ไม่ได้: '+e.message); }
  },
  save(){ lsSet(WATCH_KEY,this.meta); },
  async forget(){ this.dir=null; await this.saveDir(null); this.meta={seen:{},at:null,name:''}; this.save(); this.render(); toast('ยกเลิกเฝ้าดูโฟลเดอร์แล้ว'); },
  async perm(ask){ if(!this.dir) return 'none'; try{ let p=await this.dir.queryPermission({mode:'read'}); if(p!=='granted'&&ask) p=await this.dir.requestPermission({mode:'read'}); return p; }catch(e){ return 'denied'; } },
  async scan(ask){
    if(!this.dir||this.busy) return; this.busy=true;
    try{
      const p=await this.perm(ask); if(p!=='granted'){ this.render(p); return; }
      const fs=(await this.files()).filter(f=>!this.meta.seen[this.key(f)]).sort((a,b)=>a.name.localeCompare(b.name,'th'));
      this.meta.last=Date.now(); this.save();
      if(fs.length){ fs.forEach(f=>{ f._watch=this.key(f); }); await handleFiles(fs); toast(`พบไฟล์ใหม่ในโฟลเดอร์ ${fs.length} ไฟล์ — ตรวจแล้วกด "บันทึกทั้งหมด"`); }
      this.render('granted', fs.length);
    }catch(e){ console.error(e); toast('สแกนโฟลเดอร์ไม่ได้: '+e.message); this.render('granted'); }
    finally{ this.busy=false; }
  },
  markSeen(ps){ let ch=false; ps.forEach(p=>{ if(p._watch){ this.meta.seen[p._watch]=1; ch=true; } }); if(ch) this.save(); },
  render(perm,found){
    const el=$('#watchBar'); if(!el) return;
    if(!this.ok()){ el.hidden=true; return; }
    el.hidden=false;
    if(!this.dir){ el.innerHTML=`<span class="hint">นำเข้าอัตโนมัติ: ให้โปรแกรมสแกนโฟลเดอร์รายงานทุกครั้งที่เปิด (Chrome/Edge)</span><button class="btn sm pri" data-w="pick">📂 เลือกโฟลเดอร์รายงาน</button>`; }
    else if(perm&&perm!=='granted'){ el.innerHTML=`<span class="hint">📂 โฟลเดอร์ <b>${esc(this.meta.name)}</b> — Chrome ขอให้ยืนยันสิทธิ์อ่านอีกครั้ง</span><button class="btn sm pri" data-w="scan">กดเพื่อสแกนไฟล์ใหม่</button><button class="btn sm" data-w="forget">ยกเลิก</button>`; }
    else { const t=this.meta.last?new Date(this.meta.last):null;
      el.innerHTML=`<span class="hint">📂 เฝ้าดู <b>${esc(this.meta.name)}</b>${t?` · สแกนล่าสุด ${pad2(t.getHours())}:${pad2(t.getMinutes())}`:''}${found!=null?` · ${found?`พบไฟล์ใหม่ ${found} ไฟล์`:'ไม่มีไฟล์ใหม่'}`:''}</span><button class="btn sm" data-w="scan">🔄 สแกนใหม่</button><button class="btn sm" data-w="pick" title="เปลี่ยนโฟลเดอร์">เปลี่ยน</button><button class="btn sm" data-w="forget">ยกเลิก</button>`; }
    el.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{ const a=b.dataset.w; if(a==='pick') this.pick(); if(a==='scan') this.scan(true); if(a==='forget') this.forget(); });
  },
  async boot(){ if(!this.ok()) return; this.dir=await this.loadDir(); if(this.dir&&!this.meta.name) this.meta.name=this.dir.name; this.render(); if(this.dir) this.scan(false);
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&this.dir&&!pending.length) this.scan(false); }); },
};

/* ---------------- 10. ตารางเดือน ---------------- */
const getCap = ()=>({...DEFAULT_CAP, ...((S.maps&&S.maps.cap)||{})});
/* สรุปคอลัมน์สี/การอบ: วันที่ 1 → upto, เฉลี่ย = หารจำนวนวันที่มีข้อมูล (เหมือน AVERAGE ใน Excel) */
function sumStats(ym, upto){
  const M=getMonth(ym); const ds=monthDates(ym).filter(d=>!upto||d<=upto);
  const st={}; const cap=getCap();
  [...COLOR_K,...BAKE_K,'order'].forEach(k=>{
    const v=ds.map(d=>{const r=M.d[d]; if(!r) return null; if(k==='order') return COLOR_K.some(x=>r[x]!=null)?COLOR_K.reduce((s,x)=>s+(r[x]||0),0):null; return r[k]!=null?r[k]:null;}).filter(x=>x!=null);
    const sum=v.reduce((a,b)=>a+b,0); st[k]={sum, n:v.length, avg:v.length?sum/v.length:null};
  });
  const tc=COLOR_K.reduce((s,k)=>s+st[k].sum,0), tb=BAKE_K.reduce((s,k)=>s+st[k].sum,0);
  COLOR_K.forEach(k=>{ st[k].pct=tc?st[k].sum/tc*100:null; st[k].cap=cap[k]; });
  BAKE_K.forEach(k=>{ st[k].pct=tb?st[k].sum/tb*100:null; });
  st.order.pct=tc?100:null; st.order.cap=COLOR_K.reduce((s,k)=>s+(+cap[k]||0),0);
  Object.values(st).forEach(o=>{ if(o.cap!=null){ o.capPct=o.avg!=null&&o.cap?o.avg/o.cap*100:null; o.capLeft=o.avg!=null?o.cap-o.avg:null; } });
  return st;
}
const SUM_ROWS = [
  ['รวม','sum',v=>fmt(v,3)], ['เฉลี่ย/วัน','avg',v=>fmt(v,3)], ['% ของยอดรวม','pct',v=>v==null?'':fmt(v,1)+'%'],
  ['CAP ต่อวัน','cap',v=>fmt(v,2)], ['% เฉลี่ยเทียบ CAP','capPct',v=>v==null?'':fmt(v,0)+'%'], ['CAP − เฉลี่ย (รับเพิ่มได้)','capLeft',v=>fmt(v,2)],
];
function renderGrid(){
  const ym=curYm(); const M=getMonth(ym); const upto=curUpto();
  const groups=[]; FIELDS.forEach(f=>{const g=groups[groups.length-1]; if(g&&g.g===f.g) g.n++; else groups.push({g:f.g,n:1});});
  let h=`<thead><tr class="grp"><th rowspan="2" style="position:sticky;left:0;z-index:3">วันที่</th><th rowspan="2">หยุด</th>${groups.map(g=>`<th colspan="${g.n}">${g.g}</th>`).join('')}<th colspan="2">คำนวณ</th></tr>
    <tr class="hd">${FIELDS.map(f=>`<th>${f.l}</th>`).join('')}<th>ออเดอร์รวม</th><th>ส่งผ้าสำเร็จ</th></tr></thead><tbody>`;
  monthDates(ym).forEach(d=>{
    const r=M.d[d]||{}; const src=r._src||{}; const hol=isHoliday(d);
    const ord=['white','black','wash','color'].some(k=>r[k]!=null)?['white','black','wash','color'].reduce((s,k)=>s+(r[k]||0),0):null;
    const shp=r.shipGood!=null||r.shipRepair!=null?(r.shipGood||0)+(r.shipRepair||0):null;
    h+=`<tr class="${hol?'hol':''} ${d===upto?'today':''}"><td class="d">${dayLabel(d)}</td><td class="hc"><input type="checkbox" data-hol="${d}" ${hol?'checked':''} style="width:auto"></td>`+
      FIELDS.map(f=>{const s=src[f.k]; const cls=s==='edit'?'edit':(s==='file'||s==='import')?'file':''; return `<td class="${cls}"><input data-d="${d}" data-k="${f.k}" value="${r[f.k]!=null?+(+r[f.k]).toFixed(4):''}" inputmode="decimal" title="${s?{file:'จากไฟล์',import:'นำเข้าจากสรุปปี',edit:'แก้มือ',manual:'กรอกมือ'}[s]:''}"></td>`;}).join('')+
      `<td class="calc">${fmt(ord,3)}</td><td class="calc">${fmt(shp,3)}</td></tr>`;
  });
  const st=sumStats(ym,upto); const n0=st.white.n;
  h+='</tbody><tfoot>'+SUM_ROWS.map(([lab,key,f],ri)=>`<tr class="sum ${ri===0?'first':''}">`+
    `<td class="d" style="bottom:${(SUM_ROWS.length-1-ri)*28}px">${lab}${ri===1?` <span class="hint">(${n0} วัน)</span>`:''}</td><td style="bottom:${(SUM_ROWS.length-1-ri)*28}px"></td>`+
    FIELDS.map(fd=>{const o=st[fd.k]; const v=o?o[key]:undefined; const neg=key==='capLeft'&&v<0; return `<td class="sv ${neg?'neg':''}" style="bottom:${(SUM_ROWS.length-1-ri)*28}px">${v===undefined?'':f(v)}</td>`;}).join('')+
    `<td class="sv" style="bottom:${(SUM_ROWS.length-1-ri)*28}px">${(v=>v===undefined?'':f(v))(st.order[key])}</td><td style="bottom:${(SUM_ROWS.length-1-ri)*28}px"></td></tr>`).join('')+'</tfoot>';
  $('#grid').innerHTML=h;
  $$('#grid input[data-k]').forEach(i=>{
    i.oninput=()=>draft(()=>setVal(i.dataset.d,i.dataset.k,i.value));
    i.onchange=()=>{
      const d=i.dataset.d,k=i.dataset.k; DRAFT.fn=null; clearTimeout(DRAFT.t);
      setVal(d,k,i.value); const sel=$('#selDay').value; fillDaySel(sel); renderGrid();
      setTimeout(()=>{const n=document.querySelector(`#grid input[data-d="${d}"][data-k="${k}"]`); const all=$$('#grid input[data-k]'); const ix=all.indexOf(n); if(all[ix+FIELDS.length]) all[ix+FIELDS.length].focus();},0);
    };
    i.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); i.blur(); } };
  });
  $$('#grid input[data-hol]').forEach(c=>c.onchange=()=>{const d=c.dataset.hol; const M=getMonth(ymOf(d)); M.hol[d]=c.checked; save(); renderGrid();});
  const t=document.querySelector('#grid tr.today'); if(t&&!renderGrid._scrolled){t.scrollIntoView({block:'center'});renderGrid._scrolled=true;}
}

/* ---------------- 11. กราฟ ---------------- */
Chart.register(ChartDataLabels);
Chart.defaults.font.family='"Segoe UI","Tahoma","Leelawadee UI","Noto Sans Thai","Sarabun",sans-serif';
Chart.defaults.animation=false;
Chart.defaults.plugins.datalabels.display=false;
let charts=[];
function killCharts(root){ charts=charts.filter(c=>{ if(!root||root.contains(c.canvas)){ c.destroy(); return false;} return true; }); }
function mkChart(canvas,cfg){ const c=new Chart(canvas,cfg); charts.push(c); return c; }

/* ---- แบบ a : เหมือน Excel ---- */
function defsA(C){
  const s=C.s, T=C.T, m=+C.ym.slice(5), y=C.ym.slice(0,4);
  return [
    {name:'ผ้าดิบ', title:`เป้าหมายเดือน ${m}/${y} ผ้าดิบเข้าโรงงาน  ${fmt(T.raw,0)} ตัน/วัน  ${fmt(C.mt.raw,0)} ตัน/เดือน`, cls:'red', ds:[
      {t:'bar', l:'รับผ้าดิบเข้าโรงงาน', d:s.rawIn, c:'#5b9bd5', lab:'#2f5597'},
      {t:'line',l:'เฉลี่ยผ้าดิบเข้าโรงงาน', d:s.rawAvg, c:'#a6a6a6', pt:'#ff0000'},
      {t:'line',l:'ผ้าดิบเข้าโรงงานสะสม', d:s.rawCum, c:'#ffc000', y2:true},
      {t:'line',l:'เป้าหมายรับผ้าเข้าสะสม', d:s.rawT, c:'#4472c4', pt:'#7030a0', y2:true}]},
    {name:'ออเดอร์', title:`เป้าหมายเดือน ${m}/${y} ลูกค้าสั่งออเดอร์  ${fmt(T.order,0)} ตัน/วัน  ${fmt(C.mt.order,0)} ตัน/เดือน`, cls:'black', ds:[
      {t:'bar', l:'ออเดอร์', d:s.order, c:'#255e91', lab:'#000'},
      {t:'bar', l:'เปิดสั่งย้อมจริงต่อวัน', d:s.order, c:'#5b9bd5', lab:'#000'},
      {t:'line',l:'เฉลี่ยORDER', d:s.orderAvg, c:'#a5a5a5'},
      {t:'line',l:'ออเดอร์สะสม', d:s.orderCum, c:'#ffc000', y2:true},
      {t:'line',l:'เปิดสั่งย้อมแล้ว สะสม', d:s.orderCum, c:'#636363', y2:true},
      {t:'line',l:'เป้าออเดอร์สะสม', d:s.orderT, c:'#9c7a00', y2:true, w:2.5}]},
    {name:'ส่งผ้า', title:`เป้าหมายเดือน ${m} ส่งผ้าสำเร็จ  ${fmt(T.ship,0)} ตัน/วัน  ${fmt(C.mt.ship,0)} ตัน/เดือน`, cls:'blue', tall:true, ds:[
      {t:'bar', l:'ส่งผ้าสำเร็จต่อวัน', d:s.ship, c:'#5b9bd5', lab:'#1f6fb5'},
      {t:'bar', l:'รับผ้าจากผลิต(ไม่รวมC)', d:s.fromProd, c:'#264478', lab:'#1f6fb5'},
      {t:'bar', l:'ผ้าค้างส่ง', d:s.pending, c:'#c55a11', lab:'#1f6fb5'},
      {t:'bar', l:'ผ้าค้างส่งเดือนก่อนหน้า', d:s.pendingPrev, c:'#bf9000', lab:'#1f6fb5'},
      {t:'bar', l:'ผ้าค้างส่ง หลัง 8โมงของวันที่ส่ง', d:s.pendingAfter8, c:'#203864', lab:'#1f6fb5'},
      {t:'line',l:'ค่าเฉลี่ยส่งต่อวัน', d:s.shipAvg, c:'#ffc000'},
      {t:'line',l:'ค่าเฉลี่ยส่งผ้าดี(ไม่รวมC)', d:s.goodAvg, c:'#70ad47'},
      {t:'line',l:'ค่าเฉลี่ยรับผ้าจากผลิต(ไม่รวมC)', d:s.prodAvg, c:'#44546a'},
      {t:'line',l:'รับผ้าจากผลิตสะสม', d:s.prodCum, c:'#ff00ff', pt:'#ff00ff', y2:true, w:2.5},
      {t:'line',l:'ผลรวมส่งผ้าสะสม', d:s.shipCum, c:'#00e000', y2:true},
      {t:'line',l:'เป้าหมายส่งผ้าสำเร็จสะสม', d:s.shipT, c:'#4472c4', y2:true}]},
    {name:'ผ้าซ่อม', title:`เป้าหมายเดือน ${m} ผ้าซ่อม/ตีกลับไม่เกิน  ${fmt(T.rep1,1)} ตัน/วัน  ${fmt(C.mt.rep1,1)} ตัน/เดือน`, cls:'red', ds:[
      {t:'bar', l:'ผ้าซ่อม/ผ้าตีกลับ ต่อวัน', d:s.repair, c:'#5b9bd5', lab:'#000'},
      {t:'line',l:'ค่าเฉลี่ยรับผ้าซ่อม', d:s.repAvg, c:'#a5a5a5'},
      {t:'line',l:'รับผ้าซ่อม/ตีกลับ สะสม', d:s.repCum, c:'#ffc000', y2:true},
      {t:'line',l:'เป้าหมายที่1รับผ้าซ่อม/ตีกลับ สะสม', d:s.rep1, c:'#4472c4', y2:true},
      {t:'line',l:'เป้าหมายที่2รับผ้าซ่อม/ตีกลับ สะสม', d:s.rep2, c:'#ed7d31', y2:true}]},
  ];
}
function renderA(root,C){
  defsA(C).forEach(g=>{
    const card=document.createElement('div'); card.className='card';
    const L=C.labels;
    card.innerHTML=`<div class="cardbar"><button class="btn sm" data-copy>คัดลอกรูป</button><button class="btn sm" data-dl>ดาวน์โหลด PNG</button></div>
      <div class="shot"><div class="xa-title ${g.cls}">${esc(g.title)}</div>
      <div class="xa-scroll"><div class="xa-inner"><div style="height:${g.tall?560:430}px"><canvas></canvas></div>
      <table class="xa"><colgroup><col style="width:190px">${L.map(()=>'<col>').join('')}<col style="width:60px"></colgroup>
      <thead><tr><th></th>${L.map(x=>`<th>${x}</th>`).join('')}<th style="border:0;background:#fff"></th></tr></thead><tbody>
      ${g.ds.map(s=>`<tr><td class="lab"><span class="sw ${s.t==='line'?'ln':''}" style="background:${s.c}"></span>${esc(s.l)}</td>${s.d.map(v=>`<td>${fmt(v, s.y2&&v>=100?0:2)}</td>`).join('')}<td style="border:0"></td></tr>`).join('')}
      </tbody></table></div></div></div>`;
    root.appendChild(card);
    const nb=g.ds.filter(x=>x.t==='bar').length;
    const datasets=g.ds.map(s=>s.t==='bar'?{
        type:'bar',label:s.l,data:s.d,backgroundColor:s.c,yAxisID:'y',order:2,barPercentage:.9,categoryPercentage:.8,
        datalabels:{display:c=>{const v=c.dataset.data[c.dataIndex];return v!=null&&v!==0;},rotation:-90,anchor:'end',align:'end',offset:2,
          color:s.lab,font:{size:nb>2?10:14,weight:600},formatter:v=>fmt(v,2)}
      }:{
        type:'line',label:s.l,data:s.d,borderColor:s.c,backgroundColor:s.pt||s.c,yAxisID:s.y2?'y2':'y',order:1,
        borderWidth:s.w||2,pointRadius:s.pt?4:0,pointBackgroundColor:s.pt||s.c,tension:0
      });
    mkChart(card.querySelector('canvas'),{data:{labels:L,datasets},options:{
      responsive:true,maintainAspectRatio:false,layout:{padding:{top:40}},
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.raw==null?null:`${c.dataset.label}: ${fmt(c.raw)}`}}},
      scales:{x:{grid:{display:false},ticks:{font:{size:11}}},
        y:{beginAtZero:true,grid:{color:'#e7e6e6'},ticks:{callback:v=>fmt(v,1)},afterFit:a=>{a.width=190}},
        y2:{position:'right',beginAtZero:true,grid:{display:false},ticks:{callback:v=>fmt(v,0)},afterFit:a=>{a.width=60}}}
    }});
    wireShot(card,`${g.name}-${C.lastDate||C.ym}`);
  });
}

/* ---- แบบ b : อ่านง่าย ---- */
const CB={s1:'#2a78d6',s2:'#eb6834',s3:'#1baf7a',s4:'#eda100',s5:'#e87ba4',s7:'#6250d6',t:'#3b3a37',grid:'#ecebe7',ink2:'#52514e'};
function renderB(root,C,compact){
  const s=C.s, T=C.T, li=C.lastIdx, last=li>=0?C.dates[li]:null;
  const val=a=>li>=0?a[li]:null;
  const sub=`เดือน ${ymLabel(C.ym)} · ข้อมูลถึง ${last?dayLabel(last):'-'} · วันทำงาน ${C.workToDate}/${C.workDays} วัน`;
  const daily=v=>C.dates.map(()=>v);
  const leg=items=>`<div class="legend">${items.map(i=>`<span><i class="${i.k||''}" style="background:${i.c}"></i>${i.l}</span>`).join('')}</div>`;
  const opts=stack=>({responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.raw==null?null:`${c.dataset.label}: ${fmt(c.raw)}`}}},
    scales:{x:{stacked:!!stack,grid:{display:false},ticks:{color:CB.ink2,font:{size:compact?10:10},maxRotation:compact?0:90,minRotation:compact?0:90,autoSkip:false,callback:compact?(function(v,i){return C.dates[i].slice(8);}):undefined}},
            y:{stacked:!!stack,beginAtZero:true,grid:{color:CB.grid},border:{display:false},ticks:{color:CB.ink2}}}});
  const bar=(l,d,c,stack)=>({type:'bar',label:l,data:d,backgroundColor:c,borderRadius:3,borderSkipped:'start',stack,order:2,barPercentage:.85,categoryPercentage:.8,borderColor:'#fff',borderWidth:stack?{top:1}:0});
  const tline=(l,d)=>({type:'line',label:l,data:d,borderColor:CB.t,borderDash:[6,4],borderWidth:1.5,pointRadius:0,order:0});
  const aline=(l,d,c)=>({type:'line',label:l,data:d,borderColor:c,borderWidth:2,pointRadius:0,pointHoverRadius:4,order:1});
  const lastLab=ds=>({...ds,datalabels:{display:c=>c.dataIndex===li,align:'top',anchor:'end',color:'#0b0b0b',font:{weight:700,size:12},formatter:v=>fmt(v,1)}});
  const kpi=o=>{
    const pct=o.tcum?o.cum/o.tcum*100:null; const ok=o.lower?pct<=100:pct>=100; const aok=o.lower?o.avg<=o.tday:o.avg>=o.tday;
    return `<div class="kpis">
      <div class="kpi"><div class="k">${last?dayLabel(last):''} (ล่าสุด)</div><div class="v">${fmt(o.today,2)} <span class="u">ตัน</span></div></div>
      <div class="kpi"><div class="k">สะสมเดือนนี้</div><div class="v">${fmt(o.cum,1)} <span class="u">ตัน</span></div></div>
      <div class="kpi"><div class="k">เป้าสะสมถึงวันนี้${o.lower?' (ไม่เกิน)':''}</div><div class="v">${fmt(o.tcum,1)} <span class="u">ตัน</span></div></div>
      <div class="kpi"><div class="k">${o.lower?'ใช้ไปของเพดาน':'ทำได้เทียบเป้า'}</div><div class="v ${pct==null?'':ok?'good':'bad'}">${pct==null?'-':(o.lower?(ok?'✓':'✕'):(ok?'▲':'▼'))+' '+fmt(pct,0)+'%'}</div></div>
      <div class="kpi"><div class="k">เฉลี่ย/วัน (เป้า ${o.lower?'≤ ':''}${fmt(o.tday,o.tday<5?1:0)})</div><div class="v ${o.avg==null?'':aok?'good':'bad'}">${fmt(o.avg,2)}</div></div></div>`;
  };
  const card=(name,title,k,panels)=>{
    const el=document.createElement('div'); el.className=compact?'':'card';
    el.innerHTML=(compact?'':`<div class="cardbar"><button class="btn sm" data-copy>คัดลอกรูป</button><button class="btn sm" data-dl>ดาวน์โหลด PNG</button></div>`)+
      `<div class="shot"><div class="b-head"><h2>${esc(title)}</h2>${compact?'':`<div class="sub">${sub}</div>`}</div>${k}
       <div class="b-grid">${panels.map(p=>`<div class="panel"><h3>${p.h}</h3>${p.leg}<div class="b-chart ${p.sm?'sm':''}"><canvas></canvas></div></div>`).join('')}</div></div>`;
    root.appendChild(el);
    el.querySelectorAll('canvas').forEach((cv,i)=>mkChart(cv,{data:{labels:C.labels,datasets:panels[i].ds},options:opts(panels[i].stack)}));
    if(!compact) wireShot(el,`${name}-b-${C.lastDate||C.ym}`);
  };
  card('ผ้าดิบ',`ผ้าดิบเข้าโรงงาน — เป้า ${fmt(T.raw,0)} ตัน/วัน · ${fmt(C.mt.raw,0)} ตัน/เดือน`,
    kpi({today:val(s.rawIn),cum:val(s.rawCum),tcum:val(s.rawT),avg:C.avg.raw,tday:T.raw}),
    [{h:'รายวัน (ตัน)',leg:leg([{c:CB.s1,l:'รับผ้าดิบเข้าโรงงาน'},{c:CB.s2,l:'เฉลี่ย',k:'ln'},{c:CB.t,l:'เป้าต่อวัน',k:'dash'}]),
      ds:[bar('รับผ้าดิบเข้าโรงงาน',s.rawIn,CB.s1),aline('เฉลี่ย',s.rawAvg,CB.s2),tline('เป้าต่อวัน',daily(T.raw))]},
     {h:'สะสม (ตัน)',leg:leg([{c:CB.s1,l:'สะสมจริง',k:'ln'},{c:CB.t,l:'เป้าสะสม',k:'dash'}]),
      ds:[lastLab(aline('สะสมจริง',s.rawCum,CB.s1)),tline('เป้าสะสม',s.rawT)]}]);
  card('ออเดอร์',`ลูกค้าสั่งออเดอร์ — เป้า ${fmt(T.order,0)} ตัน/วัน · ${fmt(C.mt.order,0)} ตัน/เดือน`,
    kpi({today:val(s.order),cum:val(s.orderCum),tcum:val(s.orderT),avg:C.avg.order,tday:T.order}),
    [{h:'รายวัน แยกตามสี (ตัน)',stack:true,leg:leg([{c:CB.s1,l:'ขาว'},{c:CB.s2,l:'ดำ'},{c:CB.s3,l:'ล้างน้ำ'},{c:CB.s4,l:'สี'},{c:CB.t,l:'เป้าต่อวัน',k:'dash'}]),
      ds:[bar('ขาว',s.white,CB.s1,'o'),bar('ดำ',s.black,CB.s2,'o'),bar('ล้างน้ำ',s.wash,CB.s3,'o'),bar('สี',s.color,CB.s4,'o'),tline('เป้าต่อวัน',daily(T.order))]},
     {h:'สะสม (ตัน)',leg:leg([{c:CB.s1,l:'ออเดอร์สะสม',k:'ln'},{c:CB.t,l:'เป้าสะสม',k:'dash'}]),
      ds:[lastLab(aline('ออเดอร์สะสม',s.orderCum,CB.s1)),tline('เป้าสะสม',s.orderT)]}]);
  card('ส่งผ้า',`ส่งผ้าสำเร็จ — เป้า ${fmt(T.ship,0)} ตัน/วัน · ${fmt(C.mt.ship,0)} ตัน/เดือน`,
    kpi({today:val(s.ship),cum:val(s.shipCum),tcum:val(s.shipT),avg:C.avg.ship,tday:T.ship}),
    [{h:'ส่งผ้า vs รับจากผลิต รายวัน (ตัน)',leg:leg([{c:CB.s1,l:'ส่งผ้าสำเร็จ (ดี+ซ่อม)'},{c:CB.s7,l:'รับผ้าจากผลิต (ไม่รวม C)'},{c:CB.t,l:'เป้าต่อวัน',k:'dash'}]),
      ds:[bar('ส่งผ้าสำเร็จ',s.ship,CB.s1),bar('รับผ้าจากผลิต',s.fromProd,CB.s7),tline('เป้าต่อวัน',daily(T.ship))]},
     {h:'สะสม (ตัน)',leg:leg([{c:CB.s1,l:'ส่งสะสม',k:'ln'},{c:CB.s7,l:'รับจากผลิตสะสม',k:'ln'},{c:CB.t,l:'เป้าส่งสะสม',k:'dash'}]),
      ds:[lastLab(aline('ส่งสะสม',s.shipCum,CB.s1)),aline('รับจากผลิตสะสม',s.prodCum,CB.s7),tline('เป้าส่งสะสม',s.shipT)]},
     {h:'ผ้าค้างส่ง ณ สิ้นวัน (ตัน)',stack:true,sm:true,leg:leg([{c:CB.s2,l:'ค้างส่ง'},{c:CB.s4,l:'หลัง 8 โมงของวันที่ส่ง'},{c:CB.s5,l:'ค้างจากเดือนก่อน'}]),
      ds:[bar('ค้างส่ง',s.pending,CB.s2,'p'),bar('หลัง 8 โมง',s.pendingAfter8,CB.s4,'p'),bar('ค้างจากเดือนก่อน',s.pendingPrev,CB.s5,'p')]}]);
  card('ผ้าซ่อม',`ผ้าซ่อม/ตีกลับ — ไม่เกิน ${fmt(T.rep1,1)} ตัน/วัน · ${fmt(C.mt.rep1,1)} ตัน/เดือน`,
    kpi({today:val(s.repair),cum:val(s.repCum),tcum:val(s.rep1),avg:C.avg.rep,tday:T.rep1,lower:true}),
    [{h:'รายวัน (ตัน)',leg:leg([{c:CB.s2,l:'ผ้าซ่อม/ตีกลับ'},{c:CB.t,l:`เพดาน ${fmt(T.rep1,1)}`,k:'dash'}]),
      ds:[bar('ผ้าซ่อม/ตีกลับ',s.repair,CB.s2),tline(`เพดาน ${T.rep1}`,daily(T.rep1))]},
     {h:'สะสม (ตัน)',leg:leg([{c:CB.s2,l:'สะสมจริง',k:'ln'},{c:CB.t,l:`เพดาน 1 (${T.rep1}/วัน)`,k:'dash'},{c:'#a3a29c',l:`เพดาน 2 (${T.rep2}/วัน)`,k:'ln'}]),
      ds:[lastLab(aline('สะสมจริง',s.repCum,CB.s2)),tline('เพดาน 1',s.rep1),{...aline('เพดาน 2',s.rep2,'#a3a29c'),borderWidth:1.5}]}]);
}
function renderM(root,C){
  const wrap=document.createElement('div'); wrap.className='card';
  const last=C.lastDate;
  wrap.innerHTML=`<div class="cardbar"><button class="btn sm" data-copy>คัดลอกรูป</button><button class="btn sm" data-dl>ดาวน์โหลด PNG</button></div>
    <div class="shot compact" style="padding:0"><div class="combo-head">รายงานประจำวัน ${last?dayLabel(last):''} <div class="sub">เดือน ${ymLabel(C.ym)} · วันทำงาน ${C.workToDate}/${C.workDays} วัน</div></div><div class="cbody"></div></div>`;
  root.appendChild(wrap);
  const body=wrap.querySelector('.cbody');
  renderB(body,C,true);
  [...body.children].forEach((c,i)=>{ if(i) body.insertBefore(Object.assign(document.createElement('div'),{className:'combo-sep'}),c); });
  wireShot(wrap,`รายงานรวม-${last||C.ym}`);
}
function renderCharts(){
  const ym=curYm(); const C=calcMonth(ym,curUpto());
  ['A','B','M'].forEach(k=>{const el=$('#charts'+k); killCharts(el); el.innerHTML=''; el.style.display=k===curStyle?'':'none';});
  if(C.lastIdx<0){ $('#charts'+curStyle).innerHTML='<div class="empty">ยังไม่มีข้อมูลเดือนนี้ — ไปที่แท็บ "อัปโหลด"</div>'; return; }
  if(curStyle==='A') renderA($('#chartsA'),C);
  if(curStyle==='B') renderB($('#chartsB'),C);
  if(curStyle==='M') renderM($('#chartsM'),C);
}
$$('#chartTabs button[data-s]').forEach(b=>b.onclick=()=>{curStyle=b.dataset.s;$$('#chartTabs button[data-s]').forEach(x=>x.classList.toggle('on',x===b));renderCharts();});
$('[data-dlall]').onclick=async()=>{ for(const b of $$('#charts'+curStyle+' [data-dl]')){ await b.onclick(); await new Promise(r=>setTimeout(r,400)); } };

/* ---- คัดลอก/ดาวน์โหลดรูป ---- */
async function snap(card){
  const shot=card.querySelector('.shot');
  const sc=shot.querySelector('.xa-scroll, .sr-scroll'); if(sc) sc.style.overflow='visible';
  const hide=[...shot.querySelectorAll('.noshot, td.in input')]; hide.forEach(e=>e.style.display='none');
  const inner=shot.querySelector('.xa-inner, table.sr');
  const w=Math.max(shot.scrollWidth, inner?inner.scrollWidth+32:0);
  try{ return await html2canvas(shot,{backgroundColor:'#ffffff',scale:1.5,width:w,windowWidth:Math.max(w+40,1200),logging:false}); }
  finally{ if(sc) sc.style.overflow=''; hide.forEach(e=>e.style.display=''); }
}
function wireShot(card,name){
  const c=card.querySelector('[data-copy]'), d=card.querySelector('[data-dl]');
  if(c) c.onclick=async()=>{
    try{ const cv=await snap(card); const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
      await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]); toast('คัดลอกรูปแล้ว — วางใน LINE ได้เลย (Ctrl+V)'); }
    catch(e){ console.warn(e); toast('คัดลอกไม่ได้ในเบราว์เซอร์นี้ — ใช้ปุ่มดาวน์โหลดแทน'); }
  };
  if(d) d.onclick=async()=>{ const cv=await snap(card); const a=document.createElement('a'); a.download=`${name}.png`; a.href=cv.toDataURL('image/png'); a.click(); };
}

/* ---------------- 12. สรุปปี ---------------- */
function renderYear(){
  const years=[...new Set(allMonths().map(m=>m.slice(0,4)))].sort();
  const sel=$('#selYear'); const keep=sel.value||curYm().slice(0,4);
  sel.innerHTML=years.map(y=>`<option>${y}</option>`).join(''); sel.value=years.includes(keep)?keep:years[years.length-1];
  sel.onchange=renderYear;
  const y=sel.value; const box=$('#yearBox'); killCharts(box); box.innerHTML='';
  const ms=Array.from({length:12},(_,i)=>`${y}-${pad2(i+1)}`);
  const rows=ms.map(ym=>{
    const M=S.months[ym]; if(!M||!Object.keys(M.d).length) return {ym,has:false};
    const C=calcMonth(ym,null); const li=C.lastIdx; const at=a=>li>=0?a[li]:null;
    return {ym,has:true,C,
      raw:at(C.s.rawCum),order:at(C.s.orderCum),ship:at(C.s.shipCum),rep:at(C.s.repCum),
      tRaw:C.mt.raw,tOrder:C.mt.order,tShip:C.mt.ship,tRep:C.mt.rep1,
      cRaw:at(C.s.rawT),cOrder:at(C.s.orderT),cShip:at(C.s.shipT),cRep:at(C.s.rep1),
      aRaw:C.avg.raw,aOrder:C.avg.order,aShip:C.avg.ship,aRep:C.avg.rep, partial:li<C.dates.length-1};
  });
  const L=ms.map(m=>TH_MON[+m.slice(5)]);
  const defs=[
    {n:'ผ้าดิบเข้าโรงงาน',k:'raw',t:'tRaw',c:'cRaw',a:'aRaw'},{n:'ลูกค้าสั่งออเดอร์',k:'order',t:'tOrder',c:'cOrder',a:'aOrder'},
    {n:'ส่งผ้าสำเร็จ',k:'ship',t:'tShip',c:'cShip',a:'aShip'},{n:'ผ้าซ่อม/ตีกลับ (ไม่เกิน)',k:'rep',t:'tRep',c:'cRep',a:'aRep',lower:true}];
  defs.forEach(df=>{
    const el=document.createElement('div'); el.className='card';
    const tot=rows.reduce((s,r)=>s+(r.has&&r[df.k]||0),0), ttot=rows.reduce((s,r)=>s+(r.has&&r[df.t]||0),0);
    el.innerHTML=`<div class="cardbar"><button class="btn sm" data-copy>คัดลอกรูป</button><button class="btn sm" data-dl>ดาวน์โหลด PNG</button></div>
     <div class="shot"><div class="b-head"><h2>${df.n} — สรุปปี ${y}</h2><div class="sub">รวมทั้งปี ${fmt(tot,1)} ตัน · เป้า ${fmt(ttot,1)} ตัน (เฉพาะเดือนที่มีข้อมูล)</div></div>
     <div class="legend" style="margin-top:8px"><span><i style="background:${CB.s1}"></i>ยอดจริงทั้งเดือน</span><span><i class="dash"></i>เป้าเดือน</span></div>
     <div class="b-chart"><canvas></canvas></div>
     <table class="yr"><tr><th>เดือน</th>${L.map(l=>`<th>${l}</th>`).join('')}</tr>
      <tr><td>ยอดจริง (ตัน)</td>${rows.map(r=>`<td>${r.has?fmt(r[df.k],1)+(r.partial?'*':''):''}</td>`).join('')}</tr>
      <tr><td>เป้าเดือน</td>${rows.map(r=>`<td>${r.has?fmt(r[df.t],1):''}</td>`).join('')}</tr>
      <tr><td>% เทียบเป้า</td>${rows.map(r=>{const tt=r.partial?r[df.c]:r[df.t];if(!r.has||!tt)return '<td></td>';const p=r[df.k]/tt*100;const ok=df.lower?p<=100:p>=100;return `<td style="color:${ok?'var(--good)':'var(--bad)'}">${fmt(p,0)}%</td>`;}).join('')}</tr>
      <tr><td>เฉลี่ย/วัน</td>${rows.map(r=>`<td>${r.has?fmt(r[df.a],2):''}</td>`).join('')}</tr></table>
     <div class="hint" style="margin-top:4px">* เดือนที่ยังไม่ครบ — ยอดถึงวันล่าสุดที่มีข้อมูล และ % เทียบกับเป้าสะสมถึงวันนั้น</div></div>`;
    box.appendChild(el);
    mkChart(el.querySelector('canvas'),{data:{labels:L,datasets:[
      {type:'bar',label:'ยอดจริง',data:rows.map(r=>r.has?r[df.k]:null),backgroundColor:df.lower?CB.s2:CB.s1,borderRadius:4,borderSkipped:'start',order:2,
        datalabels:{display:c=>c.raw!=null,anchor:'end',align:'top',color:'#0b0b0b',font:{weight:600,size:11},formatter:v=>fmt(v,df.lower?1:0)}},
      {type:'line',label:'เป้าเดือน',data:rows.map(r=>r.has?r[df.t]:null),borderColor:CB.t,borderDash:[6,4],borderWidth:1.5,pointRadius:3,pointBackgroundColor:CB.t,order:1}]},
      options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:18}},interaction:{mode:'index',intersect:false},
        plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.raw==null?null:`${c.dataset.label}: ${fmt(c.raw,1)}`}}},
        scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:CB.grid},border:{display:false}}}}});
    wireShot(el,`สรุปปี${y}-${df.k}`);
  });
}

/* ---------------- 13. ตั้งค่า ---------------- */
function renderSettings(){
  const ym=curYm(); const M=getMonth(ym); const wd=workDaysOf(ym);
  const tk=[['order','ออเดอร์ ตัน/วัน'],['ship','ส่งผ้าสำเร็จ ตัน/วัน'],['raw','ผ้าดิบเข้าโรงงาน ตัน/วัน'],['rep1','ผ้าซ่อม เป้าที่ 1 ตัน/วัน'],['rep2','ผ้าซ่อม เป้าที่ 2 ตัน/วัน']];
  const mk=[['raw','ผ้าดิบ ตัน/เดือน'],['order','ออเดอร์ ตัน/เดือน'],['ship','ส่งผ้า ตัน/เดือน'],['rep1','ผ้าซ่อม ตัน/เดือน']];
  const groups={white:'ขาว',black:'ดำ',wash:'ล้างน้ำ',color:'สี',none:'ไม่นับ'};
  const cats=[...new Set(S.maps.shade.map(x=>x[1]).concat(Object.keys(S.maps.shadeGroups)))].sort();
  $('#setBox').innerHTML=`
  <div class="card"><div class="pad"><h2 class="sec">เป้าหมาย — ${ymLabel(ym)} <span class="hint">(วันทำงาน ${wd} วัน · ติ๊กวันหยุดได้ที่แท็บ "ตารางเดือน" · เดือนใหม่จะคัดลอกเป้าจากเดือนก่อน)</span></h2>
    <div class="set-grid">${tk.map(([k,l])=>`<div class="field"><label>${l}</label><input type="number" step="0.01" data-t="${k}" value="${M.t[k]??''}"></div>`).join('')}</div>
    <h2 class="sec" style="margin-top:14px">เป้ารายเดือน (หัวกราฟ) <span class="hint">ว่างไว้ = เป้าต่อวัน × วันทำงาน</span></h2>
    <div class="set-grid">${mk.map(([k,l])=>`<div class="field"><label>${l}</label><input type="number" step="0.1" data-mt="${k}" value="${M.mt[k]??''}" placeholder="${fmt(M.t[k]*wd,1)} (อัตโนมัติ)"></div>`).join('')}</div>
  </div></div>

  <div class="card"><div class="pad"><h2 class="sec">รายงานยอดขาย & ส่งผ้า — ${ymLabel(ym)} <span class="hint">(เดือนใหม่คัดลอกจากเดือนก่อน · วันหยุดขายติ๊กที่แท็บยอดขาย · วันหยุดออเดอร์ติ๊กที่ตารางเดือน)</span></h2>
    <div class="set-grid">${[['orderT','เป้าออเดอร์ (ตัน/วัน)',0.01],['saleTarget','เป้ายอดขาย (บาท/เดือน)',1],['shipMonth','หัวตาราง: ตัน/เดือน',1],['shipDay','หัวตาราง: ตัน/วัน',1],['price','หัวตาราง: บาท/ก.ก.',0.01],['prodDays','หัวตาราง: วันผลิต (ว่าง = เท่าวันขาย)',1]].map(([k,l,st])=>`<div class="field"><label>${l}</label><input type="number" step="${st}" data-ss="${k}" value="${getSaleSet(ym)[k]??''}"></div>`).join('')}</div>
  </div></div>

  <div class="card"><div class="pad"><h2 class="sec">CAP กำลังผลิตต่อวัน (ตัน) <span class="hint">ใช้ในแถวสรุปท้าย "ตารางเดือน" — ใช้ทุกเดือน</span></h2>
    <div class="set-grid">${[['white','ขาว'],['black','ดำ'],['wash','ล้างน้ำ'],['color','สี']].map(([k,l])=>`<div class="field"><label>${l}</label><input type="number" step="0.01" data-cap="${k}" value="${getCap()[k]}"></div>`).join('')}
      <div class="field"><label>รวม</label><input disabled value="${fmt(Object.values(getCap()).reduce((a,b)=>a+(+b||0),0),2)}"></div></div>
  </div></div>

  <div class="card"><div class="pad"><h2 class="sec">ข้อมูล</h2>
    <div class="row">
      <button class="btn" id="bJson">บันทึกไฟล์สำรอง (JSON)</button>
      <button class="btn" id="bJsonIn">โหลดไฟล์สำรอง (JSON)</button><input type="file" id="fJson" accept=".json" hidden>
      <button class="btn" id="bXlsx">Export Excel ทั้งปี ${ym.slice(0,4)}</button>
      <button class="btn danger" id="bWipe">ลบข้อมูลเดือน ${ymLabel(ym)}</button>
    </div>
    <div class="hint" style="margin-top:8px">${IS_SB?'โหมดออนไลน์ — ข้อมูลเก็บบนเซิร์ฟเวอร์ (Supabase) ทุกเครื่องที่ล็อกอินเห็นชุดเดียวกัน · ไฟล์ JSON ใช้สำรอง/ย้ายข้อมูลจากไฟล์ในเครื่องขึ้นออนไลน์ (โหลด JSON = เขียนทับข้อมูลออนไลน์ของเดือนที่อยู่ในไฟล์)':'ข้อมูลเก็บในเบราว์เซอร์ของเครื่องนี้เท่านั้น — ย้ายเครื่อง/สำรองข้อมูลให้ใช้ไฟล์ JSON (แนะนำบันทึกไว้ในโฟลเดอร์แชร์ทุกสิ้นเดือน)'}</div>
  </div></div>

  <details class="card"><summary>ตารางจับคู่ (ใช้ตอนอ่านไฟล์สรุป)</summary><div class="pad"><div class="cols">
    <div><h2 class="sec">ประเภทบิล (ตัวอักษรนำหน้าเลขที่บิล)</h2>
      <div class="hint">เลขบิลที่ไม่ตรงกับแถวไหน = ออเดอร์</div>
      <div class="mapbox"><table class="map" id="mBill"><tr><th>ขึ้นต้นด้วย</th><th>ชื่อ</th><th>นับเป็น</th><th></th></tr>
      ${S.maps.billTypes.map((b,i)=>`<tr><td><input data-b="${i}" data-f="prefix" value="${esc(b.prefix)}"></td><td><input data-b="${i}" data-f="name" value="${esc(b.name)}"></td>
        <td><select data-b="${i}" data-f="count">${[['order','ออเดอร์'],['repair','ผ้าซ่อม/ตีกลับ'],['none','ไม่นับ']].map(([v,l])=>`<option value="${v}" ${b.count===v?'selected':''}>${l}</option>`).join('')}</select></td>
        <td><button class="btn sm" data-bdel="${i}">ลบ</button></td></tr>`).join('')}</table></div>
      <div><button class="btn sm" id="bAddBill" style="margin-top:6px">+ เพิ่มประเภทบิล</button></div>
      <h2 class="sec" style="margin-top:16px">กลุ่มเฉดสี → คอลัมน์</h2>
      <div class="mapbox"><table class="map"><tr><th>เฉดสี</th><th>นับใน</th></tr>
      ${cats.map(c=>`<tr><td>${esc(c)}</td><td><select data-g="${esc(c)}">${Object.entries(groups).map(([v,l])=>`<option value="${v}" ${(S.maps.shadeGroups[c]||'color')===v?'selected':''}>${l}</option>`).join('')}</select></td></tr>`).join('')}</table></div>
    </div>
    <div><h2 class="sec">รหัสเฉด → เฉดสี (${S.maps.shade.length})</h2>
      <div class="mapbox"><table class="map" id="mShade"><tr><th>รหัสเฉด</th><th>เฉดสี</th><th></th></tr>
      ${S.maps.shade.map((r,i)=>`<tr><td><input data-s="${i}" data-c="0" value="${esc(r[0])}"></td><td><input data-s="${i}" data-c="1" value="${esc(r[1])}" list="catList"></td><td><button class="btn sm" data-sdel="${i}">ลบ</button></td></tr>`).join('')}</table></div>
      <datalist id="catList">${cats.map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
      <div><button class="btn sm" id="bAddShade" style="margin-top:6px">+ เพิ่มรหัสเฉด</button></div>
    </div>
    <div><h2 class="sec">นิ้วอบ → ประเภทการอบ (${S.maps.bake.length})</h2>
      <div class="hint">นิ้วที่ไม่มีในตาราง = รออบ</div>
      <div class="mapbox"><table class="map" id="mBake"><tr><th>นิ้วอบ</th><th>ประเภท</th><th></th></tr>
      ${S.maps.bake.map((r,i)=>`<tr><td><input data-k="${i}" data-c="0" value="${r[0]}" type="number" step="0.5"></td><td><select data-k="${i}" data-c="1">${['แคบ','กว้าง','ผ่า'].map(v=>`<option ${r[1]===v?'selected':''}>${v}</option>`).join('')}</select></td><td><button class="btn sm" data-kdel="${i}">ลบ</button></td></tr>`).join('')}</table></div>
      <div><button class="btn sm" id="bAddBake" style="margin-top:6px">+ เพิ่มนิ้วอบ</button> <button class="btn sm danger" id="bResetMaps" style="margin-top:6px">คืนค่าตารางเริ่มต้น</button></div>
    </div>
  </div></div></details>`;
  const keepOpen=()=>{const o=document.querySelector('#setBox details')?.open; save(); renderSettings(); if(o) document.querySelector('#setBox details').open=true;};
  $$('[data-t]').forEach(i=>i.onchange=()=>{const v=num(i.value); if(v!=null){M.t[i.dataset.t]=v; save(); renderSettings();}});
  $$('[data-ss]').forEach(i=>i.onchange=()=>{ const s=getSaleSet(ym); const v=num(i.value); if(v==null){ if(i.dataset.ss==='prodDays') s.prodDays=null; } else s[i.dataset.ss]=v; save(); });
  $$('[data-cap]').forEach(i=>i.onchange=()=>{const v=num(i.value); if(v==null) return; S.maps.cap={...getCap(),[i.dataset.cap]:v}; save(); renderSettings();});
  $$('[data-mt]').forEach(i=>i.onchange=()=>{const v=num(i.value); if(v==null) delete M.mt[i.dataset.mt]; else M.mt[i.dataset.mt]=v; save();});
  $$('[data-b]').forEach(i=>i.onchange=()=>{S.maps.billTypes[+i.dataset.b][i.dataset.f]=i.value.trim(); save();});
  $$('[data-bdel]').forEach(b=>b.onclick=()=>{S.maps.billTypes.splice(+b.dataset.bdel,1); keepOpen();});
  $('#bAddBill').onclick=()=>{S.maps.billTypes.push({prefix:'',name:'',count:'order'}); keepOpen();};
  $$('[data-g]').forEach(s=>s.onchange=()=>{S.maps.shadeGroups[s.dataset.g]=s.value; save();});
  $$('[data-s]').forEach(i=>i.onchange=()=>{S.maps.shade[+i.dataset.s][+i.dataset.c]=i.value; save();});
  $$('[data-sdel]').forEach(b=>b.onclick=()=>{S.maps.shade.splice(+b.dataset.sdel,1); keepOpen();});
  $('#bAddShade').onclick=()=>{S.maps.shade.push(['','']); keepOpen();};
  $$('[data-k]').forEach(i=>i.onchange=()=>{const r=S.maps.bake[+i.dataset.k]; r[+i.dataset.c]=i.dataset.c==='0'?num(i.value):i.value; save();});
  $$('[data-kdel]').forEach(b=>b.onclick=()=>{S.maps.bake.splice(+b.dataset.kdel,1); keepOpen();});
  $('#bAddBake').onclick=()=>{S.maps.bake.push([null,'แคบ']); keepOpen();};
  $('#bResetMaps').onclick=()=>{ if(confirmBox('คืนค่าตารางจับคู่ทั้งหมดเป็นค่าเริ่มต้น?')){ S.maps=JSON.parse(JSON.stringify(DEFAULT_MAPS)); keepOpen(); } };
  $('#bJson').onclick=()=>{ const a=document.createElement('a'); a.download=`TET-กราฟรายงาน-สำรอง-${ymd(new Date())}.json`; a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,1)],{type:'application/json'})); a.click(); };
  $('#bJsonIn').onclick=()=>$('#fJson').click();
  $('#fJson').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; try{ const o=JSON.parse(await f.text()); if(!o.months) throw new Error('ไม่ใช่ไฟล์สำรองของโปรแกรมนี้'); S=o; if(!S.maps) S.maps=JSON.parse(JSON.stringify(DEFAULT_MAPS)); if(!S.ui) S.ui={}; save(); fillMonthSel(); renderSettings(); toast('โหลดไฟล์สำรองแล้ว'); }catch(err){ toast('โหลดไม่ได้: '+err.message); } };
  $('#bXlsx').onclick=()=>exportYear(ym.slice(0,4));
  $('#bWipe').onclick=()=>{ if(confirmBox(`ลบข้อมูลรายวันทั้งหมดของ ${ymLabel(ym)}? (เป้าและวันหยุดยังอยู่)`)){ M.d={}; save(); fillMonthSel(ym); renderSettings(); toast('ลบแล้ว'); } };
}
// ยืนยันแบบไม่ใช้ dialog ของเบราว์เซอร์: กดปุ่มเดิมซ้ำภายใน 4 วินาที
function confirmBox(msg){ const now=Date.now(); if(confirmBox._m===msg && now-confirmBox._t<4000){ confirmBox._m=null; return true; } confirmBox._m=msg; confirmBox._t=now; toast(msg+' — กดอีกครั้งเพื่อยืนยัน'); return false; }

/* ---------------- 14. Export Excel (รูปแบบเดียวกับ สรุปปี2026.xlsx) ---------------- */
/* ---------------- 16. รายงานยอดขาย & ส่งผ้า ----------------
   ส่งผ้าได้/ยอดขาย  = ไฟล์ "เปิดบิลขาย": ตัดเลขบิลที่มี C และเลขบิล 4 หลัก แล้วรวม น้ำหนักสุทธิ/มูลค่า
                       แยกตามเดือนของ "วันที่ขนส่งรับ" (เดือนก่อน = ผ้าค้างส่ง, เดือนเดียวกัน = ผ้าเสร็จในเดือน)
   มูลค่าค้างส่ง      = ไฟล์ "ค้างส่ง": รวมมูลค่าทั้งหมด − มูลค่าที่ขนส่งรับตั้งแต่ 08:00 ของวันรายงาน (และแยกช่องหลัง 08:00)
   ยอดขายสะสม        = สะสมของวันก่อน + รวมยอดขายวันนี้ — ถ้าผู้ใช้กรอก saleCumManual วันไหน ใช้ค่านั้นแทนและนับต่อจากนั้น
   ------------------------------------------------------------------ */
const SALE_DEF = {orderT:41, saleTarget:45000000, shipMonth:1040, shipDay:40, price:45, prodDays:null};
function getSaleSet(ym){ const M=getMonth(ym); if(!M.s){ const prev=Object.keys(S.months).filter(k=>k<ym&&S.months[k].s).sort().pop(); M.s={...(prev?S.months[prev].s:SALE_DEF)}; } if(!M.holSale) M.holSale={}; return M.s; }
function isSaleHoliday(d){ const M=S.months[ymOf(d)]; const o=M&&M.holSale?M.holSale[d]:undefined; if(o!==undefined) return o; return parseYmd(d).getDay()===0; }
function isBillFile(rows,h,name){
  if(/ค้าง/.test(name)) return false;
  if(/เปิดบิล/.test(name)) return true;
  const ci=h.idx('วันที่เปิดบิลขาย'); if(ci<0) return false;
  const s=new Set(); for(let r=h.i+1;r<rows.length;r++){ const d=toDate(rows[r][ci]); if(d) s.add(ymd(d)); if(s.size>2) return false; } return s.size>=1;
}
function parseBillSheet(rows,h,name,sn){
  const c={recv:h.idx('วันที่ขนส่งรับ'),bill:h.idx('วันที่เปิดบิลขาย'),no:h.idx('เลขที่บิล'),w:h.idx('น้ำหนักสุทธิ'),v:h.idx('มูลค่า')};
  const by={}; let cut=0, all=0; const warns=[];
  for(let r=h.i+1;r<rows.length;r++){
    const row=rows[r]; const w=num(row[c.w]); if(w==null) continue; all++;
    const no=String(row[c.no]??'').trim();
    if(/c/i.test(no) || /^\d{4}$/.test(no)){ cut++; continue; }          // ตัดบิลที่มี C และเลขบิล 4 หลัก
    const bd=toDate(row[c.bill]); const rv=toDate(row[c.recv]); if(!bd){ continue; }
    const key=ymd(bd); const o=by[key]||(by[key]={shipPrevKg:0,shipCurKg:0,salePrev:0,saleCur:0});
    const prev = rv && (rv.getFullYear()*12+rv.getMonth()) < (bd.getFullYear()*12+bd.getMonth());
    const v=c.v>=0?(num(row[c.v])||0):0;
    if(prev){ o.shipPrevKg+=w; o.salePrev+=v; } else { o.shipCurKg+=w; o.saleCur+=v; }
  }
  const days={}; Object.entries(by).forEach(([d,o])=>days[d]={shipPrevKg:r6(o.shipPrevKg),shipCurKg:r6(o.shipCurKg),salePrev:r6(o.salePrev),saleCur:r6(o.saleCur)});
  if(c.v<0) warns.push('ไม่พบคอลัมน์ "มูลค่า" — ยอดขายจะเป็น 0');
  return {kind:'bill',name,sheet:sn,days,warns,fields:['shipPrevKg','shipCurKg','salePrev','saleCur'],summary:`ทั้งหมด ${all} แถว · ตัดออก ${cut} แถว (บิลมี C / เลขบิล 4 หลัก) · ใช้ ${all-cut} แถว`};
}
/* นำเข้าไฟล์ Excel รายงานยอดขายเดิม: หาบล็อก "วันที่" + "รวมยอดขาย" ทุกบล็อก, เอาเฉพาะปี 2026 ขึ้นไป */
function parseSalesBook(rows,name,sn){
  const months={}; const warns=[];
  const H=(hdr,re)=>hdr.findIndex(h=>re.test(norm(h)));
  for(let i=0;i<rows.length;i++){
    const hdr=(rows[i]||[]).map(x=>String(x??''));
    if(!hdr.some(x=>norm(x)==='วันที่') || !hdr.some(x=>norm(x)===norm('รวมยอดขาย'))) continue;
    const col={date:hdr.findIndex(x=>norm(x)==='วันที่'),
      shipPrevKg:H(hdr,/^ส่งผ้าได้\(ก\.ก\.\)ผ้าค้าง/), shipCurKg:H(hdr,/^ส่งผ้าได้\(ก\.ก\.\)ผ้าเสร็จ/),
      salePrev:H(hdr,/^ยอดขาย\(บาท\)ผ้าค้าง/), saleCur:H(hdr,/^ยอดขาย\(บาท\)ผ้าเสร็จ/), saleCum:H(hdr,/^ยอดขายสะสม/),
      pendValNet:H(hdr,/^มูลค่าผ้าค้างส่ง/), pendVal8:H(hdr,/^มูล(ค่า)?ค้างส่งหลัง/), saleTarget:H(hdr,/^เป้ายอดขาย$/),
      orderT:H(hdr,/^เป้าต่อวัน$/), orderTotal:H(hdr,/^ออเดอร์จริง$/)};
    // หาเดือนของบล็อกจากวันที่ส่วนใหญ่
    const ds=[]; for(let r=i+1;r<Math.min(rows.length,i+33);r++){ const d=toDate(rows[r]&&rows[r][col.date]); if(!d) break; ds.push(d); }
    if(!ds.length) continue;
    const cnt={}; ds.forEach(d=>{const k=ymd(d).slice(0,7); cnt[k]=(cnt[k]||0)+1;}); const ym=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
    if(+ym.slice(0,4)<2026) continue;
    const title=[rows[i-2],rows[i-1]].map(r=>(r||[]).filter(x=>x!=null).join(' ')).join(' ');
    const out={d:{},hol:{},holSale:{},s:{}}; const dates=monthDates(ym);
    let any=false;
    for(let k=0;k<Math.min(ds.length,dates.length);k++){
      const row=rows[i+1+k]; const d=dates[k]; const rec={};
      ['shipPrevKg','shipCurKg','salePrev','saleCur','pendValNet','pendVal8','orderTotal'].forEach(f=>{ if(col[f]>=0){ const v=num(row[col[f]]); if(v!=null) rec[f]=v; } });
      if(col.saleCum>=0){ const v=num(row[col.saleCum]); if(v!=null) rec.saleCumManual=v; }
      const hasSale=['shipPrevKg','shipCurKg','salePrev','saleCur'].some(f=>rec[f]!=null);
      const lastData=ds.length;
      if(Object.keys(rec).length){ out.d[d]=rec; any=true; }
      if(col.orderT>=0){ const t=num(row[col.orderT]); out.hol[d]= t==null; if(t!=null) out.s.orderT=t; }
      if(col.saleTarget>=0){ const t=num(row[col.saleTarget]); if(t!=null) out.s.saleTarget=t; }
      const sun=parseYmd(d).getDay()===0;
      if(hasSale && sun) out.holSale[d]=false;
    }
    // วันขายที่ผ่านมาแล้วแต่ไม่มียอด (ไม่ใช่อาทิตย์) = วันหยุดขาย — นับเฉพาะถึงวันสุดท้ายที่มียอด
    const saleDays=Object.keys(out.d).filter(d=>['shipPrevKg','shipCurKg','salePrev','saleCur'].some(f=>out.d[d][f]!=null)).sort();
    const lastSale=saleDays[saleDays.length-1];
    dates.forEach(d=>{ if(lastSale && d<lastSale && !saleDays.includes(d) && parseYmd(d).getDay()!==0) out.holSale[d]=true; });
    let m;
    if((m=title.match(/\(([\d,]+)\s*ตัน\/เดือน\s*([\d.]+)\s*ตัน\/วัน\)/))){ out.s.shipMonth=num(m[1]); out.s.shipDay=num(m[2]); }
    if((m=title.match(/\(([\d.]+)\s*บาท\/ก\.ก\.\)/))) out.s.price=num(m[1]);
    if((m=title.match(/วันขาย\s*([\d]+)\s*วันผลิต/))) out.s.prodDays=num(m[1]);
    if(any) months[ym]=out;
  }
  if(!Object.keys(months).length) warns.push('ไม่พบบล็อกรายงานของปี 2026');
  return {kind:'sales',name,sheet:sn,months,warns};
}
function calcSales(ym, upto){
  const s=getSaleSet(ym); const M=getMonth(ym); const dates=monthDates(ym);
  if(num(s.orderT)==null && M.t && num(M.t.order)!=null) s.orderT=M.t.order;   // เดือนเก่าที่ Excel ไม่มีเป้าออเดอร์ → ใช้เป้าออเดอร์ของกราฟเดือนนั้น (แก้ได้ในตั้งค่า)
  const C=calcMonth(ym,upto); const li=C.lastIdx<0?-1:C.lastIdx;
  const orderDay=d=>!isHoliday(d), saleDay=d=>!isSaleHoliday(d);
  const totalSale=dates.filter(saleDay).length, totalOrderDays=dates.filter(orderDay).length;
  const rows=[]; let tCum=0,oCum=0,kgCum=0,bCum=0,saleN=0;
  dates.forEach((d,i)=>{
    const r=M.d[d]||{}; const past=i<=li;
    const oT=orderDay(d)?s.orderT:null; if(oT) tCum+=oT;
    const ord=r.orderManual!=null?r.orderManual:C.s.order[i]!=null?C.s.order[i]:(past&&r.orderTotal!=null?r.orderTotal:null);
    if(past&&ord!=null) oCum+=ord;
    const remain=dates.slice(i).filter(orderDay).length;
    const has=['shipPrevKg','shipCurKg','salePrev','saleCur'].some(k=>r[k]!=null);
    const kg=has?(r.shipPrevKg||0)+(r.shipCurKg||0):null, baht=has?(r.salePrev||0)+(r.saleCur||0):null;
    if(past&&kg!=null) kgCum+=kg;
    if(past&&saleDay(d)) saleN++;
    if(past){ if(r.saleCumManual!=null) bCum=r.saleCumManual; else if(baht!=null) bCum+=baht; }
    const sd=past&&saleDay(d)&&(has||r.saleCumManual!=null);
    const av=sd&&saleN?bCum/saleN:null;
    const fc=av!=null?av*totalSale:null;
    rows.push({d, oT, tCum, ord:past?ord:null, oCum:past&&orderDay(d)?oCum:null, gap:past&&orderDay(d)?tCum-oCum:null,
      need:past&&orderDay(d)&&remain?s.orderT+(tCum-oCum)/remain:null,
      kP:r.shipPrevKg??null, kC:r.shipCurKg??null, kg, kgCum:sd?kgCum:null, bP:r.salePrev??null, bC:r.saleCur??null, baht,
      bCum:sd?bCum:null, manual:r.saleCumManual!=null, typed:!!(r._src&&r._src.saleCumManual==='manual'), av, price:sd&&kgCum?bCum/kgCum:null, fc, fcP:fc!=null?fc+(r.pendValNet||0):null,
      pv:r.pendValNet??null, p8:r.pendVal8??null, tgt:s.saleTarget, gapB:fc!=null?fc-s.saleTarget:null, hol:!saleDay(d), ohol:!orderDay(d), past});
  });
  const lastRow=[...rows].reverse().find(x=>x.bCum!=null)||{};
  const lastOrd=[...rows].reverse().find(x=>x.oCum!=null)||{};
  return {ym,s,rows,totalSale,totalOrderDays,saleN:rows.filter(x=>x.past&&!x.hol).length,upto:C.lastDate,
    sum:{tMonth:s.orderT*totalOrderDays,oCum:lastOrd.oCum,gap:lastOrd.gap,need:lastOrd.need,kgCum:lastRow.kgCum,bCum:lastRow.bCum,av:lastRow.av,price:lastRow.price,fc:lastRow.fc,fcP:lastRow.fcP,gapB:lastRow.gapB}};
}
function renderSales(){
  const ym=curYm(); const box=$('#salesBox'); box.innerHTML='';
  const X=calcSales(ym,curUpto()); const s=X.s; const be=+ym.slice(0,4)+543, m=+ym.slice(5);
  const up=X.upto?parseYmd(X.upto):null;
  const f0=v=>v==null?'':fmt(v,0), f1=v=>v==null?'':fmt(v,1), f2=v=>v==null?'':fmt(v,2), fk=v=>v==null||v===0?'':fmt(v,0);
  const prevM=m===1?12:m-1;
  const card=document.createElement('div'); card.className='card';
  card.innerHTML=`<div class="cardbar"><span class="hint" style="margin-right:auto;align-self:center">ช่อง ออเดอร์จริง / ส่งผ้าได้ / ยอดขาย / ยอดขายสะสม / มูลค่าค้างส่ง <b>คลิกแก้ได้</b> · ติ๊ก "หยุดขาย" เพื่อตั้งวันหยุดขาย · วันหยุดออเดอร์ตั้งที่แท็บตารางเดือน</span>
     <button class="btn sm" data-copy>คัดลอกรูป</button><button class="btn sm" data-dl>ดาวน์โหลด PNG</button></div>
   <div class="shot"><div class="sr-scroll"><table class="sr">
    <tr class="t1"><td colspan="7" class="h-or">เป้าและออเดอร์เดือน ${m}/${be}  ${f0(s.orderT)}ตัน/วัน  ${fmt(X.sum.tMonth,0)}ตัน/เดือน</td>
      <td colspan="16" class="h-sl">รายงานยอดขายและส่งผ้า วันที่ ${up?`${up.getDate()}/${m}/${be}`:'-'}   ${X.saleN} วันขาย (จากทั้งหมด ${X.totalSale} วันขาย ${s.prodDays||X.totalSale} วันผลิต) (${fmt(s.shipMonth,0)}ตัน/เดือน ${fmt(s.shipDay,0)}ตัน/วัน) (${fmt(s.price,0)}บาท/ก.ก.)</td><td class="noshot"></td></tr>
    <tr class="tsum"><td>รวมสะสม</td><td></td><td>${fmt(X.sum.tMonth,0)} ตัน</td><td></td><td>${f0(X.sum.oCum)} ตัน</td><td>${f1(X.sum.gap)} ตัน</td><td>${f1(X.sum.need)} ตัน</td>
      <td colspan="3"></td><td class="c-gr">${f0(X.sum.kgCum)} ก.ก.</td><td colspan="3"></td><td class="c-pe">${f0(X.sum.bCum)} บาท</td><td class="c-lg">${f0(X.sum.av)} บาท</td><td>${f2(X.sum.price)} บาท</td><td>${f0(X.sum.fc)} บาท</td><td class="c-red">${f0(X.sum.fcP)} บาท</td><td colspan="2"></td><td class="c-gr">${fmt(s.saleTarget,0)} บาท</td><td class="neg">${f0(X.sum.gapB)} บาท</td><td class="noshot"></td></tr>
    <tr class="th"><th>วันที่</th><th class="h-o">เป้าต่อวัน</th><th class="h-o">เป้าสะสม</th><th class="h-y">ออเดอร์จริง</th><th class="h-y">ออเดอร์สะสม</th><th class="h-y">ห่างจากเป้า</th><th class="h-y">ต้องปรับเป้าเพิ่มต่อวัน</th>
      <th class="h-c">ส่งผ้าได้(ก.ก.) ผ้าค้างส่ง เดือน ${prevM}</th><th class="h-c">ส่งผ้าได้(ก.ก.) ผ้าเสร็จในเดือน ${m}</th><th class="h-c">รวมส่งผ้าได้</th><th class="h-g">น้ำหนักส่งผ้าสะสม (ก.ก.)</th>
      <th class="h-b">ยอดขาย(บาท) ผ้าค้างส่ง</th><th class="h-b">ยอดขาย(บาท) ผ้าเสร็จในเดือน</th><th class="h-b">รวมยอดขาย</th><th class="h-p">ยอดขายสะสม(บาท)</th><th class="h-lg">ยอดขาย AV (บาท/วัน)</th><th class="h-b">ราคาขายเฉลี่ย (บาท/ก.ก.)</th>
      <th class="h-b">คาดการณ์ยอดขาย จบสิ้นเดือน(${X.totalSale}วันขาย) (บาท)</th><th class="h-r">คาดการณ์ยอดขายจบสิ้นเดือน+มูลค่าผ้าค้างส่ง</th><th class="h-b">มูลค่าผ้าค้างส่ง-มูลค่าค้างส่งหลัง 08:00</th><th class="h-b">มูลค่าค้างส่งหลัง 08:00</th><th class="h-g">เป้ายอดขาย</th><th class="h-b">ห่างจากเป้าหมาย (บาท)</th><th class="noshot">หยุดขาย</th></tr>
    ${X.rows.map(r=>{ const dd=parseYmd(r.d);
      const rec=(getMonth(ymOf(r.d)).d[r.d])||{}; const src=rec._src||{};
      const ED=(key,shown,cls='')=>{ const v=rec[key]; const typed=src[key]==='manual'||src[key]==='edit';
        return `<td class="in ${cls} ${typed?'man':''}" title="${typed?'กรอกเอง':v!=null?'จากไฟล์':''}"><input data-ed="${r.d}|${key}" value="${v==null?'':+(+v).toFixed(2)}"><span class="cv">${shown}</span></td>`; }; const lab=`${pad2(dd.getDate())}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dd.getMonth()]}`;
      if(r.hol) return `<tr class="hol ${r.d>X.upto?'noshot':''}"><td>${lab}</td><td></td><td>${f0(r.tCum)}</td><td colspan="20"></td><td class="noshot"><input type="checkbox" data-hs="${r.d}" checked></td></tr>`;
      return `<tr class="${r.d===X.upto?'today':''} ${r.d>X.upto?'noshot':''}"><td>${lab}</td><td>${r.oT??''}</td><td>${f0(r.tCum)}</td>${(()=>{ const typed=rec.orderManual!=null; return `<td class="in ${typed?'man':''}" title="${typed?'กรอกเอง':'จากไฟล์สรุป'}"><input data-ed="${r.d}|orderManual" value="${typed?rec.orderManual:''}"><span class="cv">${r.ord==null?'':fmt(r.ord,2).replace(/\.?0+$/,'')}</span></td>`; })()}<td>${f1(r.oCum)}</td><td>${f1(r.gap)}</td><td>${f1(r.need)}</td>
      ${ED('shipPrevKg',fk(r.kP))}${ED('shipCurKg',fk(r.kC))}<td>${f0(r.kg)}</td><td class="c-g">${f0(r.kgCum)}</td>${ED('salePrev',fk(r.bP))}${ED('saleCur',fk(r.bC))}<td>${f0(r.baht)}</td>
      <td class="c-p in ${r.typed?'man':''}" title="${r.typed?'กรอกเอง':r.manual?'นำเข้าจาก Excel':'คำนวณ'}">${r.past&&!r.hol?`<input data-cum="${r.d}" value="${r.manual?Math.round(M_cum(r.d)):''}" placeholder="${f0(r.bCum)}">`:''}<span class="cv">${f0(r.bCum)}</span></td>
      <td class="c-lg">${f0(r.av)}</td><td>${f2(r.price)}</td><td>${f2(r.fc)}</td><td class="c-red">${f2(r.fcP)}</td>${ED('pendValNet',f0(r.pv))}${ED('pendVal8',f0(r.p8))}<td class="c-g">${r.past||r.fc!=null?fmt(r.tgt,0)+' บาท':''}</td><td class="neg">${r.gapB==null?'':fmt(Math.abs(r.gapB),0)}</td>
      <td class="noshot"><input type="checkbox" data-hs="${r.d}"></td></tr>`; }).join('')}
   </table></div></div>`;
  box.appendChild(card);
  $$('#salesBox input[data-hs]').forEach(c=>c.onchange=()=>{ const M=getMonth(ymOf(c.dataset.hs)); M.holSale=M.holSale||{}; M.holSale[c.dataset.hs]=c.checked; save(); renderSales(); });
  $$('#salesBox input[data-ed]').forEach(i=>{ i.onchange=()=>{ const [d,k]=i.dataset.ed.split('|'); setVal(d,k,i.value); renderSales(); };
    i.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); i.blur(); } }; });
  $$('#salesBox input[data-cum]').forEach(i=>{ i.onchange=()=>{ const d=i.dataset.cum; const M=getMonth(ymOf(d)); const cur=M.d[d]||(M.d[d]={_src:{}}); cur._src=cur._src||{}; const v=num(i.value);
      if(v==null){ delete cur.saleCumManual; delete cur._src.saleCumManual; } else { cur.saleCumManual=v; cur._src.saleCumManual='manual'; } save(); renderSales(); };
    i.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); i.blur(); } }; });
  wireShot(card,`ยอดขายและส่งผ้า-${X.upto||ym}`);
}
const M_cum=d=>{ const M=S.months[ymOf(d)]; return M&&M.d[d]?M.d[d].saleCumManual:null; };

/* Export ตารางเดือนตามที่เห็นบนจอ (ทุกวันของเดือน + แถวสรุปถึง "ข้อมูลถึงวันที่") */
function exportGrid(){
  flushDraft();
  const ym=curYm(), upto=curUpto(), M=getMonth(ym);
  const groups=[]; FIELDS.forEach(f=>{const g=groups[groups.length-1]; if(g&&g.g===f.g) g.n++; else groups.push({g:f.g,n:1});});
  const r0=['','']; groups.forEach(g=>{ r0.push(g.g); for(let i=1;i<g.n;i++) r0.push(''); }); r0.push('คำนวณ','');
  const r1=['วันที่','หยุด',...FIELDS.map(f=>f.l),'ออเดอร์รวม','ส่งผ้าสำเร็จ'];
  const aoa=[[`ตารางเดือน ${ymLabel(ym)} — ข้อมูลถึง ${upto?dayLabel(upto):'-'}`],r0,r1];
  const serial=d=>(Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8))-Date.UTC(1899,11,30))/86400000;
  monthDates(ym).forEach(d=>{
    const r=M.d[d]||{};
    const ord=COLOR_K.some(k=>r[k]!=null)?COLOR_K.reduce((s,k)=>s+(r[k]||0),0):null;
    const shp=r.shipGood!=null||r.shipRepair!=null?(r.shipGood||0)+(r.shipRepair||0):null;
    aoa.push([serial(d), isHoliday(d)?'หยุด':'', ...FIELDS.map(f=>r[f.k]!=null?r6(r[f.k]):null), ord==null?null:r6(ord), shp==null?null:r6(shp)]);
  });
  const nDays=monthDates(ym).length;
  const st=sumStats(ym,upto); aoa.push([]);
  SUM_ROWS.forEach(([lab,key])=>{
    const pctK=key==='pct'||key==='capPct';
    const val=o=>{ const v=o?o[key]:undefined; return v==null?null:r6(pctK?v/100:v); };
    aoa.push([lab+(key==='avg'?` (${st.white.n} วัน)`:''),'',...FIELDS.map(f=>val(st[f.k])),val(st.order),null]);
  });
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  const merges=[{s:{r:0,c:0},e:{r:0,c:r1.length-1}}]; let c=2;
  groups.forEach(g=>{ if(g.n>1) merges.push({s:{r:1,c},e:{r:1,c:c+g.n-1}}); c+=g.n; }); merges.push({s:{r:1,c},e:{r:1,c:c+1}});
  ws['!merges']=merges;
  ws['!cols']=r1.map((h,i)=>({wch:i===0?12:i===1?6:Math.max(9,Math.min(h.length+2,18))}));
  for(let r=3;r<3+nDays;r++){ const cell=ws[XLSX.utils.encode_cell({r,c:0})]; if(cell) cell.z='ddd dd/mm'; }
  const base=3+nDays+1;
  SUM_ROWS.forEach(([,key],ri)=>{ for(let cc=2;cc<r1.length;cc++){ const cell=ws[XLSX.utils.encode_cell({r:base+ri,c:cc})]; if(!cell) continue; cell.z=(key==='pct'||key==='capPct')?'0.0%':'#,##0.000'; } });
  for(let r=3;r<3+nDays;r++) for(let cc=2;cc<r1.length;cc++){ const cell=ws[XLSX.utils.encode_cell({r,c:cc})]; if(cell) cell.z='#,##0.000'; }
  ws['!freeze']={xSplit:1,ySplit:3}; ws['!views']=[{state:'frozen',xSplit:1,ySplit:3}];
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,ym.replace('-','.'));
  XLSX.writeFile(wb,`ตารางเดือน ${ym.replace('-','.')}${upto?' ถึง '+upto.slice(8)+'.'+upto.slice(5,7):''}.xlsx`);
}
$('#bGridXlsx').onclick=exportGrid;

function exportYear(y){
  const wb=XLSX.utils.book_new(); let n=0;
  Object.keys(S.months).filter(m=>m.startsWith(y)).sort().forEach(ym=>{
    const C=calcMonth(ym,null); const s=C.s, T=C.T, li=C.lastIdx;
    const hdr=['วันที่','เป้าออเดอร์','เป้าออเดอร์สะสม','เป้าหมายส่งผ้าสำเร็จ','เป้าหมายส่งผ้าสำเร็จสะสม','ขาว','ดำ','ล้างน้ำ','สี','แคบ','กว้าง','ผ่า','รออบ','เปิดสั่งย้อมจริงต่อวัน','เปิดสั่งย้อมแล้ว สะสม','เฉลี่ยเปิดสั่งย้อมจริง','ค้างเปิดบิล','ออเดอร์','ออเดอร์สะสม','เฉลี่ยORDER','ผ้าซ่อม/ผ้าตีกลับ ต่อวัน','รับผ้าซ่อม/ตีกลับ สะสม','ค่าเฉลี่ยรับผ้าซ่อม','เป้าหมายที่ 1 รับผ้าซ่อม/ตีกลับ ต่อวัน','เป้าหมายที่1รับผ้าซ่อม/ตีกลับ สะสม','เป้าหมายที่2รับผ้าซ่อม/ตีกลับ ต่อวัน','เป้าหมายที่2รับผ้าซ่อม/ตีกลับ สะสม','เป้าหมายส่งผ้าสำเร็จ','เป้าหมายส่งผ้าสำเร็จสะสม','ส่งผ้าซ่อม','ส่งผ้าดี','ผ้าค้างส่ง','ผ้าค้างส่งเดือนก่อนหน้า','ผ้าค้างส่ง หลัง 8โมงของวันที่ส่ง','ส่งผ้าสำเร็จต่อวัน','ค่าเฉลี่ยส่งต่อวัน','ผลรวมส่งผ้าสะสม','รับผ้าจากผลิตสะสม','รับผ้าจากผลิต(ไม่รวมC)','ค่าเฉลี่ยรับผ้าจากผลิต(ไม่รวมC)','ค่าเฉลี่ยส่งผ้าดี(ไม่รวมC)','เป้าหมายรับผ้าดิบเข้าโรงงาน','เป้าหมายรับผ้าเข้าสะสม','รับผ้าดิบเข้าโรงงาน','เฉลี่ยผ้าดิบเข้าโรงาน','ผ้าดิบเข้าโรงงานสะสม','รับผ้าจากผลิตผ้าดิบ(ผ้าสำเร็จ/.93)'];
    const aoa=[hdr];
    C.dates.forEach((d,i)=>{
      const w=C.work[i], z=v=>v==null?null:r6(v);
      aoa.push([(Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8))-Date.UTC(1899,11,30))/86400000, w?T.order:null, s.orderT[i], w?T.ship:null, s.shipT[i],
        z(s.white[i]),z(s.black[i]),z(s.wash[i]),z(s.color[i]),z(s.narrow[i]),z(s.wide[i]),z(s.split[i]),z(s.waitBake[i]),
        z(s.order[i]),z(s.orderCum[i]),z(s.orderAvg[i]),null,z(s.order[i]),z(s.orderCum[i]),z(s.orderAvg[i]),
        z(s.repair[i]),z(s.repCum[i]),z(s.repAvg[i]), w?T.rep1:null, z(s.rep1[i]), w?T.rep2:null, z(s.rep2[i]), w?T.ship:null, s.shipT[i],
        z(s.shipRepair[i]),z(s.shipGood[i]),z(s.pending[i]),z(s.pendingPrev[i]),z(s.pendingAfter8[i]),z(s.ship[i]),z(s.shipAvg[i]),z(s.shipCum[i]),z(s.prodCum[i]),z(s.fromProd[i]),z(s.prodAvg[i]),z(s.goodAvg[i]),
        w?T.raw:null, s.rawT[i], z(s.rawIn[i]), z(s.rawAvg[i]), z(s.rawCum[i]), s.prodCum[i]==null?null:r6(s.prodCum[i]/0.93)]);
    });
    // แถวสรุปใต้ตาราง (คอลัมน์ F–M = ขาว…รออบ, N = เปิดสั่งย้อมจริงต่อวัน/รวม)
    const st=sumStats(ym,null); aoa.push([]);
    SUM_ROWS.forEach(([lab,key])=>{ const row=new Array(14).fill(null); row[4]=lab;
      [...COLOR_K,...BAKE_K].forEach((k,j)=>{ const v=st[k][key]; row[5+j]=v==null?null:r6(key==='pct'||key==='capPct'?v/100:v); });
      const v=st.order[key]; row[13]=v==null?null:r6(key==='pct'||key==='capPct'?v/100:v); aoa.push(row); });
    const ws=XLSX.utils.aoa_to_sheet(aoa);
    { const base=aoa.length-SUM_ROWS.length; SUM_ROWS.forEach(([,key],ri)=>{ if(key==='pct'||key==='capPct') for(let c=5;c<=13;c++){ const cell=ws[XLSX.utils.encode_cell({r:base+ri,c})]; if(cell) cell.z='0.0%'; } }); }
    ws['!cols']=hdr.map((h,i)=>({wch:i===0?12:Math.min(Math.max(8,h.length*0.9),22)}));
    for(let r=1;r<=C.dates.length;r++){ const c=ws[XLSX.utils.encode_cell({r,c:0})]; if(c){c.z='ddd dd/mm';} }
    XLSX.utils.book_append_sheet(wb,ws,ym.replace('-','.')); n++;
  });
  if(!n){ toast('ไม่มีข้อมูลปี '+y); return; }
  XLSX.writeFile(wb,`สรุปปี${y}-จากโปรแกรม.xlsx`);
}

/* ---------------- 15. เริ่ม + ออนไลน์ ---------------- */
/* อ่าน session ที่จำไว้ (ไม่ค้างถ้าไม่มีเน็ตแล้ว token หมดอายุ) */
async function getSes(){ try{ const r=await Promise.race([SB.auth.getSession(), new Promise(r=>setTimeout(()=>r({}),5000))]); return (r&&r.data&&r.data.session)||null; }catch(e){ return null; } }
function sbLogin(force){
  return new Promise(async res=>{
    if(!force){ const ses=await getSes(); if(ses){ SB_USER=(ses.user.email||'').split('@')[0]; return res(true); } }
    const box=$('#login'); box.hidden=false; setTimeout(()=>$('#lgU').focus(),50);
    if(SB_USER) $('#lgU').value=SB_USER;
    const go=async()=>{
      const u=$('#lgU').value.trim().toLowerCase(), p=$('#lgP').value; if(!u||!p) return;
      const email=u.includes('@')?u:`${u}@${SB_CFG.domain||'tet.local'}`;
      $('#lgMsg').textContent='กำลังเข้าสู่ระบบ…';
      try{ const {data,error}=await SB.auth.signInWithPassword({email,password:p});
        if(error) throw error; SB_USER=(data.user.email||'').split('@')[0]; $('#lgP').value=''; $('#lgMsg').textContent=''; box.hidden=true; res(true); }
      catch(e){ $('#lgMsg').textContent = navigator.onLine===false||/fetch|network/i.test(String(e&&e.message))
        ? 'ไม่มีอินเทอร์เน็ต — ล็อกอินครั้งแรกต้องต่อเน็ต' : 'เข้าสู่ระบบไม่ได้: ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'; }
    };
    $('#lgBtn').onclick=go; $('#lgP').onkeydown=e=>{ if(e.key==='Enter') go(); };
  });
}
async function sbLogout(){
  flushDraft(); const n=Cloud.pendingCount();
  if(n){ toast(`ยังมีข้อมูลรอส่ง ${n} ช่อง — กด "ส่งตอนนี้" ให้เสร็จก่อนออกจากระบบ`); return; }
  try{ [LOCAL_KEY,BASE_KEY,META_KEY].forEach(k=>localStorage.removeItem(k)); await SB.auth.signOut(); }catch(e){} location.reload(); }
async function reloadCloud(){ return Cloud.sync(); }
/* ไฟล์ในเครื่อง (file://): ตรวจว่ามีเวอร์ชันใหม่บนเว็บไหม */
async function checkVersion(){
  if(location.protocol!=='file:' || !window.APP_SITE) return;
  try{ const r=await fetch(APP_SITE+'version.json?t='+Date.now(),{cache:'no-store'}); const j=await r.json();
    if(j && j.v && j.v!==APP_VER){ const el=$('#newver'); el.innerHTML=`มีเวอร์ชันใหม่ (${esc(j.v)}) <a class="btn sm pri" href="${APP_SITE}tet-graph-report.html" download>ดาวน์โหลด</a> แล้ววางทับไฟล์นี้`; el.hidden=false; } }catch(e){}
}
async function boot(){
  fillMonthSel(); renderQuick(); setSync(SYNC.state); Watch.boot();
  if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost') && IS_SB && !window.__mockSupabase){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
  checkVersion();
  if(!IS_SB) return;
  SB=SB_LIB.createClient(SB_CFG.url, SB_CFG.key);
  window.addEventListener('online',()=>Cloud.sync());
  window.addEventListener('offline',()=>setSync('offline'));
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible' && !Cloud.busy && !typing()) Cloud.sync(); });
  window.addEventListener('beforeunload',e=>{ if(Cloud.timer||Cloud.busy){ e.preventDefault(); e.returnValue=''; } });
  /* มีแคช + เคยล็อกอิน → แสดงข้อมูลในเครื่องทันที (ใช้ได้ตอนไม่มีเน็ต) แล้วค่อยตรวจล็อกอิน/ซิงก์เบื้องหลัง */
  if(Cloud.base && Cloud.meta.user){
    SB_USER=Cloud.meta.user; setSync(navigator.onLine===false?'offline':'loading');
    const ses=await getSes();
    if(ses){ SB_USER=(ses.user.email||'').split('@')[0]; return Cloud.sync(); }
    if(navigator.onLine===false){ setSync('offline'); return; }
    setSync('login'); return;
  }
  await sbLogin(); await Cloud.sync();
}
boot();
