import asyncio, sys, json
sys.path.insert(0,'/home/claude')
from e2e_lib import *
from playwright.async_api import async_playwright
LOGGER = """() => { window.__log = []; let lastL = null;
  const tick = () => { const leaf = document.querySelectorAll('.turn-leaf').length;
    const L = document.querySelector('.page.left .page-body h2, .page.left .page-body h3'); const t = L ? L.textContent.trim().slice(0,12) : '';
    const R = document.querySelector('.page.right .page-body h2, .page.right .page-body h3'); const rt = R ? R.textContent.trim().slice(0,12) : '';
    const holders = document.querySelectorAll('.page-holder').length;
    window.__log.push([performance.now()|0, leaf, holders, t, rt]); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }"""
async def geom(pg):
    return await pg.evaluate("""() => { const l=document.querySelector('.turn-leaf'); const pr=document.querySelector('.page.right').getBoundingClientRect(); const pl=document.querySelector('.page.left').getBoundingClientRect();
      if(!l) return null; const r=l.getBoundingClientRect(); return {leaf:[r.left|0,r.top|0,r.right|0,r.bottom|0], right:[pr.left|0,pr.top|0,pr.right|0,pr.bottom|0], spine: ((pl.right+pr.left)/2)|0}; }""")
async def main():
    async with async_playwright() as p:
        b,ctx,pg=await new(p,1440,900)
        cdp=await ctx.new_cdp_session(pg); await cdp.send('Animation.enable')
        await student_login(pg,'DEMO26',1,'1234')
        await pg.goto(BASE+'/#home-0'); await pg.reload(); await pg.wait_for_timeout(1500)
        # 1) 한 번 넘김 시간 측정
        await pg.evaluate(LOGGER)
        await pg.click('.flip-btn.next'); await pg.wait_for_timeout(900)
        log = await pg.evaluate('window.__log')
        on=[x[0] for x in log if x[1]]; print('flip duration ms ~', on[-1]-on[0] if on else None)
        # 2) 연속 3번 클릭 → 한 장씩
        await pg.evaluate(LOGGER)
        for _ in range(3): await pg.click('.flip-btn.next', force=True); await pg.wait_for_timeout(60)
        await pg.wait_for_timeout(2400)
        log = await pg.evaluate('window.__log')
        print('hash after 3 rapid clicks:', await pg.evaluate('location.hash'))
        seq=[]; 
        for x in log:
            key=(x[1],x[3],x[4])
            if not seq or seq[-1]!=key: seq.append(key)
        for s in seq: print('  leaf=%d left=%-12s right=%s'%s)
        # 깜빡임 검사: 왼쪽 내용이 바뀌는 프레임에 이전 프레임은 leaf가 있어야(착지 직후 교체) 하고, 오른쪽 내용 바뀜은 leaf 시작 프레임과 같아야
        bad=0
        for a,c in zip(log,log[1:]):
            if a[3]!=c[3] and not (a[1]==1 and c[1]==0) and not (a[1]==1 and c[1]==1): bad+=1
        print('left-change outside landing frames:', bad)
        # 3) 창 크기 바꾼 뒤 축·경계 확인
        for w,h in [(1200,800),(1680,1000)]:
            await pg.set_viewport_size({'width':w,'height':h}); await pg.wait_for_timeout(500)
            await cdp.send('Animation.setPlaybackRate', {'playbackRate': 0.05})
            await pg.click('.flip-btn.prev'); await pg.wait_for_timeout(120)
            print(w,h,'geom at start:', await geom(pg))
            # 넘김 도중 창 크기 변경
            await pg.set_viewport_size({'width':w-200,'height':h-100}); await pg.wait_for_timeout(300)
            print(w-200,h-100,'geom after resize mid-flip:', await geom(pg))
            await cdp.send('Animation.setPlaybackRate', {'playbackRate': 1}); await pg.wait_for_timeout(1200)
        # 4) 메뉴로 건너뛰기: 한 번만 짧게
        await pg.set_viewport_size({'width':1440,'height':900}); await pg.wait_for_timeout(400)
        await pg.evaluate(LOGGER)
        await pg.click('.side-tab:has-text("작품 전시관")'); await pg.wait_for_timeout(1500)
        log = await pg.evaluate('window.__log')
        print('menu jump: leaf frames', sum(1 for x in log if x[1]), 'hash', await pg.evaluate('location.hash'))
        print('errors', pg.errs); await b.close()
asyncio.run(main())
