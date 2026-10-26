// Service worker: ให้หน้าเว็บเปิดได้ตอนไม่มีเน็ต (ข้อมูลอยู่ในแคช localStorage ของแอป)
// รุ่น: 2026-10-26 17:53 (build.py ใส่ให้ — เปลี่ยนทุก build เพื่อให้เบราว์เซอร์อัปเดต)
const CACHE='tet-graph-2026-10-26 17:53';
const FILES=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET' || u.origin!==location.origin) return;          // Supabase ไม่ผ่านตรงนี้
  if(/version\.json|tet-graph-report\.html/.test(u.pathname)) return;
  // เน็ตก่อน (ได้เวอร์ชันล่าสุด) — ไม่มีเน็ตใช้ของในแคช
  e.respondWith(fetch(e.request).then(r=>{ if(r.ok){ const cp=r.clone(); caches.open(CACHE).then(c=>c.put(e.request.mode==='navigate'?'index.html':e.request,cp)); } return r; })
    .catch(()=>caches.match(e.request.mode==='navigate'?'index.html':e.request).then(r=>r||caches.match('index.html'))));
});
