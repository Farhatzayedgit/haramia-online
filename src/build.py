#!/usr/bin/env python3
"""بيجمّع اللعبة في ملف واحد: www/index.html (للأبليكيشن) و dist/web.html (للتجربة على المتصفح).
شغّله من جذر المستودع:  python3 src/build.py
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

def read(name):
    with open(os.path.join(HERE, name), encoding="utf8") as f:
        return f.read()

cards = json.loads(read("cards.json"))
emblem = re.search(r'<svg width="220".*?</svg>', cards["back"], re.S).group(0)
cards["emblem"] = emblem.replace('width="220" height="220" ', "")

engine = read("engine.js").replace('if (typeof module !== "undefined") module.exports = Engine;', "")
page = (read("template.html")
        .replace("/*ENGINE*/", engine)
        .replace("/*CARDS*/", json.dumps(cards, ensure_ascii=False).replace("</", "<\\/"))
        .replace("/*APP*/", read("app.js")))

GOOGLE = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lalezar&family=Baloo+Bhaijaan+2:wght@500;600;700;800&display=swap">'
assert GOOGLE in page

AR = "U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0898-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC"
LA = "U+0000-00FF,U+2000-206F,U+00D7"
faces = ['@font-face{font-family:"Lalezar";src:url(fonts/lalezar-arabic-400-normal.woff2) format("woff2");font-weight:400;unicode-range:%s;}' % AR,
         '@font-face{font-family:"Lalezar";src:url(fonts/lalezar-latin-400-normal.woff2) format("woff2");font-weight:400;unicode-range:%s;}' % LA]
for w in (500, 600, 700, 800):
    faces.append('@font-face{font-family:"Baloo Bhaijaan 2";src:url(fonts/baloo-bhaijaan-2-arabic-%d-normal.woff2) format("woff2");font-weight:%d;unicode-range:%s;}' % (w, w, AR))
    faces.append('@font-face{font-family:"Baloo Bhaijaan 2";src:url(fonts/baloo-bhaijaan-2-latin-%d-normal.woff2) format("woff2");font-weight:%d;unicode-range:%s;}' % (w, w, LA))

app_page = page.replace(GOOGLE, "<style>\n" + "\n".join(faces) + "\n</style>")
app_page = app_page.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "")
t_end = app_page.index("</title>") + len("</title>")
doc = ('<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">\n'
       '<meta name="theme-color" content="#1F2A44">\n' + app_page[:t_end] +
       '\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
       'body{margin:0;user-select:none;-webkit-user-select:none}input,textarea{user-select:text;-webkit-user-select:text}</style>\n'
       '</head>\n<body>\n' + app_page[t_end:] + "\n</body>\n</html>\n")

os.makedirs(os.path.join(ROOT, "www"), exist_ok=True)
with open(os.path.join(ROOT, "www", "index.html"), "w", encoding="utf8") as f:
    f.write(doc)
os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
with open(os.path.join(ROOT, "dist", "web.html"), "w", encoding="utf8") as f:
    f.write(page)
print("www/index.html", len(doc), "| dist/web.html", len(page))
