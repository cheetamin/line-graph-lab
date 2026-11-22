# 여러 화면 크기 스크린샷: 표지, 학생 장면들, 교사
import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from e2e_lib import *
from playwright.async_api import async_playwright
SH=__import__('os').environ.get('SHOTS','/tmp/')
async def main():
    async with async_playwright() as p:
        for name,w,h,touch,mob in [('desk',1440,900,False,False),('tabL',1180,820,True,False),('tabP',820,1180,True,True),('phone',390,844,True,True)]:
            b, ctx, pg = await new(p, w, h, touch, mob)
            await pg.goto(BASE+'/'); await pg.evaluate("sessionStorage.clear()"); await pg.goto(BASE+'/'); await pg.wait_for_timeout(2200)
            await pg.screenshot(path=SH+f'{name}_cover.png')
            await student_login(pg, 'DEMO26', 1, '1234')
            for hsh in ['graph-0','gallery-1','topics-1']:
                await pg.goto(BASE+'/#'+hsh); await pg.reload(); await pg.wait_for_timeout(1800)
                await pg.screenshot(path=SH+f'{name}_{hsh}.png', full_page=(name in ('phone','tabP')))
            sw = await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            print(name, 'horizontal overflow px:', sw, 'errors:', pg.errs)
            await b.close()
asyncio.run(main())
