// Supabase จำลองสำหรับทดสอบ — เก็บในหน่วยความจำของหน้า + sessionStorage (จำลองเซิร์ฟเวอร์ข้ามการ reload)
(function(){
  const DB_KEY='__mockdb', SES_KEY='__mocksession';
  const db=()=>JSON.parse(sessionStorage.getItem(DB_KEY)||'{}');
  const put=d=>sessionStorage.setItem(DB_KEY,JSON.stringify(d));
  window.__mockLog=[];
  window.supabase={createClient(){ return {
    auth:{
      async getSession(){ const s=sessionStorage.getItem(SES_KEY); return {data:{session:s?{user:{email:s}}:null}}; },
      async signInWithPassword({email,password}){ if(password!=='pw') return {data:null,error:{message:'Invalid login'}}; sessionStorage.setItem(SES_KEY,email); return {data:{user:{email}},error:null}; },
      async signOut(){ sessionStorage.removeItem(SES_KEY); },
    },
    from(t){ return {
      async select(){ const d=db(); return {data:Object.entries(d).map(([key,v])=>({key,data:v.data})),error:null}; },
      async upsert(rows){ if(window.__mockFail) return {error:{message:'network down'}}; const d=db(); rows.forEach(r=>{d[r.key]={data:r.data,by:r.updated_by};}); put(d); window.__mockLog.push(rows.map(r=>r.key)); return {error:null}; },
    }; },
  }; }};
})();
