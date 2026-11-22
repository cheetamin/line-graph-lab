import asyncio, json
import os
BASE=os.environ.get('BASE','http://localhost:3100')
async def new(p, w=1440, h=900, touch=False, mobile=False):
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={'width':w,'height':h}, has_touch=touch, is_mobile=mobile, device_scale_factor=1)
    pg = await ctx.new_page()
    pg.errs=[]
    pg.on('console', lambda m: pg.errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: pg.errs.append('PAGEERR '+str(e)))
    return b, ctx, pg

async def student_login(pg, code, num, pin):
    await pg.goto(BASE+'/')
    await pg.evaluate("sessionStorage.setItem('kgl-opened','1')")
    await pg.goto(BASE+'/')
    await pg.fill('input[name=classCode]', code)
    await pg.fill('input[name=number]', str(num))
    await pg.fill('input[name=pin]', pin)
    await pg.click('button[type=submit]')
    await pg.wait_for_selector('.side-tab[aria-current]')
    await pg.wait_for_timeout(500)

async def graph_coords(pg, items):
    """items: list of (i, value) -> screen coords via app layout"""
    return await pg.evaluate("""async (items) => {
      const {layout} = await import('/js/graph.js');
      const svg = document.querySelector('.graph-scroll svg');
      const vb = svg.viewBox.baseVal;
      const ctm = svg.getScreenCTM();
      const st = window.__lastL;
      const sc = document.querySelector('.graph-scroll');
      return items.map(([i,v]) => { const L = window.__editor.Lc; const pt = svg.createSVGPoint(); pt.x = L.x(i); pt.y = L.y(v); const q = pt.matrixTransform(ctm); return [q.x, q.y]; });
    }""", items)

async def click_point(pg, i, v, down_up=True, touch=False):
    xy = await pg.evaluate("""([i,v]) => { const ed = window.__editor; const L = ed.Lc; const svg = ed.svg; const sc = ed.scroll;
      const pt = svg.createSVGPoint(); pt.x = L.x(i); pt.y = L.y(v);
      let q = pt.matrixTransform(svg.getScreenCTM()); const r = sc.getBoundingClientRect();
      if (q.x < r.left+20 || q.x > r.right-20) sc.scrollLeft += q.x - (r.left + r.width/2);
      if (q.y < r.top+20 || q.y > r.bottom-20) sc.scrollTop += q.y - (r.top + r.height/2);
      sc.scrollIntoView({block:'nearest'});
      q = pt.matrixTransform(svg.getScreenCTM()); return [q.x, q.y]; }""", [i, v])
    x, y = xy
    if touch: await pg.touchscreen.tap(x, y)
    else: await pg.mouse.move(x, y); await pg.mouse.down(); await pg.mouse.up()
    await pg.wait_for_timeout(70)
