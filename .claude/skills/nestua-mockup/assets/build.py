"""Baut eine Mockup-Seite aus shell.html + mockup.css + Phone-Inhalt + Ist-Stand-Bildern.

  python3 -I build.py out.html --titel "..." --einleitung "..." --phone phone.html \
      --jetzt a-l=hell.png a-d=dunkel.png [--abweichungen "..."]

Die Klammern in CSS und JS werden NICHT angefasst (früher ging das beim Ersetzen von "{{" kaputt).
Bilder werden auf 520 px Breite verkleinert und als WebP eingebettet (Seitengröße klein halten).
"""
import argparse, base64, io, json, pathlib
from PIL import Image

HERE = pathlib.Path(__file__).parent

def webp_data_uri(path, width=520):
    im = Image.open(path).convert('RGB')
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=70, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('--titel', required=True); ap.add_argument('--einleitung', default='')
ap.add_argument('--phone', required=True); ap.add_argument('--jetzt', nargs='*', default=[])
ap.add_argument('--abweichungen', default='')
a = ap.parse_args()

shell = (HERE / 'shell.html').read_text()
css = (HERE / 'mockup.css').read_text()
images = {}
for item in a.jetzt:
    key, path = item.split('=', 1)
    images[key] = webp_data_uri(path)
html = (shell
        .replace('__TITEL__', a.titel).replace('__EINLEITUNG__', a.einleitung)
        .replace('__PHONE__', pathlib.Path(a.phone).read_text())
        .replace('__ABWEICHUNGEN__', a.abweichungen)
        .replace('__JIMGS__', json.dumps(images))
        .replace('__STYLE__', f'<style>\n{css}\n</style>'))
pathlib.Path(a.out).write_text(html)
print(f'{a.out}: {len(html) // 1024} KB')
