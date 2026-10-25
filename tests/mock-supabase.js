// Supabase จำลองสำหรับทดสอบ — ใช้กับ add_init_script; เซิร์ฟเวอร์จริงอยู่ฝั่ง Python (window.__mockServer)
// window.__mockOffline=true = จำลองเน็ตหลุด
(function(){
  const SES_KEY='__mocksession';
  const net=async(op,arg)=>{ if(window.__mockOffline||localStorage.getItem('__mockOff')==='1') throw new TypeError('Failed to fetch'); return JSON.parse(await window.__mockServer(op,JSON.stringify(arg||null))); };
  window.__mockLog=[];
  window.__mockSupabase={createClient(){ return {
    auth:{
      async getSession(){ const s=localStorage.getItem(SES_KEY); return {data:{session:s?{user:{email:s}}:null}}; },
      async signInWithPassword({email,password}){ try{ await net('ping'); }catch(e){ return {data:null,error:{message:'Failed to fetch'}}; }
        if(password!=='pw') return {data:null,error:{message:'Invalid login'}}; localStorage.setItem(SES_KEY,email); return {data:{user:{email}},error:null}; },
      async signOut(){ localStorage.removeItem(SES_KEY); },
    },
    from(t){ return {
      async select(){ try{ return {data:await net('select'),error:null}; }catch(e){ return {data:null,error:{message:e.message}}; } },
      async upsert(rows){ try{ await net('upsert',rows); window.__mockLog.push(rows.map(r=>r.key)); return {error:null}; }catch(e){ return {error:{message:e.message}}; } },
    }; },
  }; }};
})();
