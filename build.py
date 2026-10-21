#!/usr/bin/env python3
"""รวม src/ + vendor/ เป็นไฟล์ HTML ไฟล์เดียว
   - dist/TET-กราฟรายงาน.html  (ใช้ในเครื่อง ไม่ต้องมีเน็ต)
   - index.html                (หน้าเว็บ GitHub Pages — ไฟล์เดียวกัน)
"""
import os, io
ROOT = os.path.dirname(os.path.abspath(__file__))
def rd(*p): return io.open(os.path.join(ROOT, *p), encoding='utf8').read()
html = rd('src', 'index.template.html')
parts = {
    '/*CSS*/': rd('src', 'styles.css'),
    '/*LIB_XLSX*/': rd('vendor', 'xlsx.full.min.js'),
    '/*LIB_CHART*/': rd('vendor', 'chart.umd.js'),
    '/*LIB_DL*/': rd('vendor', 'chartjs-plugin-datalabels.min.js'),
    '/*LIB_H2C*/': rd('vendor', 'html2canvas.min.js'),
    '/*DEFAULTS*/': rd('src', 'defaults.js'),
    '/*APP*/': rd('src', 'app.js'),
}
for k, v in parts.items():
    assert html.count(k) == 1, k
    html = html.replace(k, v.replace('</script', '<\\/script'))
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
for out in [os.path.join('dist', 'TET-กราฟรายงาน.html'), 'index.html']:
    io.open(os.path.join(ROOT, out), 'w', encoding='utf8').write(html)
print('built', len(html) // 1024, 'KB')
