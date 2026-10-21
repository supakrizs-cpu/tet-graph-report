// ตั้งค่าการเชื่อมต่อ Supabase (ใช้โปรเจกต์เดียวกับ tet-sale — บัญชีผู้ใช้ชุดเดียวกัน)
// key = publishable key (ออกแบบมาให้เปิดเผยได้ ข้อมูลถูกล็อกด้วยรหัสผ่าน + RLS)
// ❌ ห้ามใส่ secret / service_role key ในไฟล์นี้เด็ดขาด
window.SB_CONFIG = {
  url: "https://nngrzevsxmxyccmuenjp.supabase.co",
  key: "sb_publishable_BBRTuOT-udtf4n8J3WRY9w_Knv-qkIR",
  table: "graph_report",
  domain: "tet.local"   // ชื่อผู้ใช้ sale → ล็อกอินเป็น sale@tet.local
};
