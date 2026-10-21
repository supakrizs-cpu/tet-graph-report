-- ตาราง กราฟรายงาน TET (ใช้ในโปรเจกต์ Supabase เดียวกับ tet-sale)
-- วิธีใช้: Supabase → SQL Editor → New query → วางทั้งไฟล์ → Run (รันซ้ำได้ ไม่เสียหาย, ไม่แตะตารางของ tet-sale)
-- เก็บ 1 แถว/เดือน (key = 'm:2026-10') + 1 แถวตารางจับคู่ (key = 'maps') — ข้อมูลประมาณ 0.3 MB/ปี

create table if not exists public.graph_report (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- เฉพาะคนที่ล็อกอินแล้ว (บัญชีเดียวกับ Sale Order Tracker) อ่าน/เขียนได้ — คนนอกเข้าไม่ได้
alter table public.graph_report enable row level security;
revoke all on public.graph_report from anon;
grant select, insert, update, delete on public.graph_report to authenticated;
drop policy if exists "team graph report" on public.graph_report;
create policy "team graph report" on public.graph_report for all to authenticated using (true) with check (true);
