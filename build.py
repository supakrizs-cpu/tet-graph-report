#!/usr/bin/env python3
"""รวม src/ + vendor/ เป็นไฟล์ HTML ไฟล์เดียว (มี supabase + config ในตัว — ไฟล์ในเครื่องก็ซิงก์ออนไลน์ได้/ใช้ออฟไลน์ได้)
   - dist/TET-กราฟรายงาน.html  (ใช้ในเครื่อง ไม่ต้องมีเน็ต)
   - index.html                (GitHub Pages — โหมดเครื่อง)
   - public/index.html         (Cloudflare — โหมดออนไลน์ Supabase; ใช้คู่กับ public/supabase*.js)
"""
import os, io, json, datetime
ROOT = os.path.dirname(os.path.abspath(__file__))
def rd(*p): return io.open(os.path.join(ROOT, *p), encoding='utf8').read()
html = rd('src', 'index.template.html')
SITE = 'https://tet-graph-report.supakrizs.workers.dev/'
VER = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).strftime('%Y-%m-%d %H:%M')
parts = {
    '/*CSS*/': rd('src', 'styles.css'),
    '/*LIB_XLSX*/': rd('vendor', 'xlsx.full.min.js'),
    '/*LIB_CHART*/': rd('vendor', 'chart.umd.js'),
    '/*LIB_DL*/': rd('vendor', 'chartjs-plugin-datalabels.min.js'),
    '/*LIB_H2C*/': rd('vendor', 'html2canvas.min.js'),
    '/*LIB_SB*/': rd('vendor', 'supabase.js'),
    '/*SB_CFG*/': rd('public', 'supabase-config.js'),
    '/*VER*/': 'window.APP_VER=%s;window.APP_SITE=%s;' % (json.dumps(VER), json.dumps(SITE)),
    '/*DEFAULTS*/': rd('src', 'defaults.js'),
    '/*APP*/': rd('src', 'app.js'),
}
for k, v in parts.items():
    assert html.count(k) == 1, k
    html = html.replace(k, v.replace('</script', '<\\/script'))
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'public'), exist_ok=True)
for out in [os.path.join('dist', 'TET-กราฟรายงาน.html'), 'index.html', os.path.join('public', 'index.html'), os.path.join('public', 'tet-graph-report.html')]:
    io.open(os.path.join(ROOT, out), 'w', encoding='utf8').write(html)
print('built', len(html) // 1024, 'KB')
io.open(os.path.join(ROOT, 'public', 'version.json'), 'w', encoding='utf8').write(json.dumps({'v': VER}))
io.open(os.path.join(ROOT, 'public', 'sw.js'), 'w', encoding='utf8').write(rd('src', 'sw.js').replace('__VER__', VER))
print('version', VER)
