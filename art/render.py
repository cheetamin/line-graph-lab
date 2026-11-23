# SVG 그림을 투명 배경 PNG로 굽기: python3 art/render.py [이름...]
import asyncio, sys, os, importlib
sys.path.insert(0, os.path.dirname(__file__))
from playwright.async_api import async_playwright

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'art')
os.makedirs(OUT, exist_ok=True)


def collect():
    items = {}
    for mod in ['ui_art', 'icon_art', 'prop_art']:
        try:
            m = importlib.import_module(mod)
            items.update(m.ASSETS)
        except ModuleNotFoundError:
            pass
    return items


async def main(names):
    items = collect()
    if names:
        items = {k: v for k, v in items.items() if k in names}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(device_scale_factor=1)
        for name, fn in items.items():
            s = fn()
            await pg.set_content(f'<html><body style="margin:0;background:transparent">{s}</body></html>')
            el = await pg.query_selector('svg')
            png = os.path.join(OUT, name + '.png')
            await el.screenshot(path=png, omit_background=True)
            # 화면에는 가벼운 WebP를 써요(PNG보다 약 4배 작음)
            from PIL import Image
            Image.open(png).save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=88, method=6)
            os.remove(png)
        await b.close()
    print(f'{len(items)}개 WebP 완성 →', os.path.abspath(OUT))

asyncio.run(main(sys.argv[1:]))
