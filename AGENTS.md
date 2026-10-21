# กฎสำหรับ AI agent (Antigravity / Claude / Codex)

1. อ่าน `HANDOFF.md` หัวข้อ 0, 4, 8 ก่อนแก้ทุกครั้ง
2. แก้เฉพาะไฟล์ใน `src/` แล้วรัน `python build.py` — ห้ามแก้ `index.html` / `public/index.html` / `dist/*.html` ตรง ๆ (commit ทุกไฟล์ที่ build)
3. ห้ามเปลี่ยน localStorage key `tet-graph-report-v1` และห้ามเปลี่ยนสูตรในหัวข้อ 4 โดยไม่ถามผู้ใช้
4. ห้าม commit ไฟล์ Excel/JSON ข้อมูลจริง (repo เป็น public) · ห้ามขอหรือ commit Supabase secret/service_role key (publishable key ใน `public/supabase-config.js` เปิดเผยได้)
4.1 push `main` = ขึ้นเว็บจริงทันที (Cloudflare + GitHub Pages) — ทดสอบก่อนเสมอ ตาราง Supabase ใหม่ให้เขียน SQL ให้ผู้ใช้รันเอง
5. UI ภาษาไทย · รูปส่ง LINE พื้นขาว · ห้ามใช้ alert/confirm/prompt
6. หลังแก้: ทดสอบตามหัวข้อ 7 แล้วอัปเดต `HANDOFF.md` (หัวข้อที่เกี่ยว + งานค้าง)
