import asyncio, sys, json
sys.path.insert(0,'/home/claude')
from e2e_lib import *
from playwright.async_api import async_playwright
SH='/home/claude/shots/'
async def main():
    async with async_playwright() as p:
        b, ctx, pg = await new(p)
        await student_login(pg, 'DEMO26', 1, '1234')
        await pg.goto(BASE+'/#topics-0'); await pg.wait_for_timeout(1200)
        await pg.click('.topic-card:has-text("월별 운동한 날수")')
        await pg.click('button:has-text("이 주제를 추천해요")'); await pg.wait_for_timeout(700)
        await pg.click('text=월별 조사하러 가기'); await pg.wait_for_timeout(1300)
        # 3번 주제(감정 글쓰기) 월별 입력
        await pg.click('.page.left .chapter-item:has-text("감정 글쓰기")'); await pg.wait_for_timeout(600)
        vals=[3,5,'unk',8,10,7,4,0,9,11,12]
        for m,v in enumerate(vals, start=1):
            if v=='unk':
                await pg.click(f'.month-row:nth-child({m}) button:has-text("기억나지 않음")')
            else:
                await pg.fill(f'input[aria-label="{m}월 일"]', str(v))
        # 잘못된 값 확인: 2월 30일
        await pg.fill('input[aria-label="2월 일"]', '30')
        await pg.wait_for_timeout(200)
        err = await pg.locator('.month-row.bad .msg').first.inner_text()
        print('validation msg:', err)
        await pg.fill('input[aria-label="2월 일"]', '5')
        await pg.click('.month-row:nth-child(1) button:has-text("실제 기록")')
        await pg.screenshot(path=SH+'survey.png')
        await pg.click('button:has-text("조사 제출하기")'); await pg.wait_for_timeout(1500)
        await pg.select_option('select[aria-label="나의 연구 주제"]', '3'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=SH+'survey2.png')
        # 자료표: 참고자료로 직접 합 구하기 (테스트는 API로 계산)
        await pg.goto(BASE+'/#table-0'); await pg.wait_for_timeout(1500)
        ref = await pg.evaluate("fetch('/api/student/table-ref?topicId=3').then(r=>r.json())")
        sums = [sum(r['values']) for r in ref['rows']]
        print('sums', sums)
        await pg.screenshot(path=SH+'table0.png')
        # 일부러 1칸 틀리게
        for i,v in enumerate(sums):
            await pg.fill(f'input[aria-label="{i+1}월 우리 반 값"]', str(v+ (1 if i==4 else 0)))
        await pg.click('button:has-text("표 확인하기")'); await pg.wait_for_timeout(900)
        print('wrong msg:', (await pg.locator('.page.right .note').first.inner_text())[:80])
        await pg.fill('input[aria-label="5월 우리 반 값"]', str(sums[4]))
        await pg.click('button:has-text("표 확인하기")'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=SH+'table1.png')
        # 새로고침 후 복원 확인
        await pg.reload(); await pg.wait_for_timeout(1500)
        print('after reload hash:', await pg.evaluate('location.hash'), 'table verified tab done:', await pg.locator('.side-tab.done:has-text("자료표")').count())
        await pg.goto(BASE+'/#graph-0'); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelectorAll('.step').forEach(d=>d.open=true)")
        await pg.fill('.step input[placeholder^="예: 우리 반"]', '우리 반 월별 감정 글쓰기를 한 날수')
        await pg.fill('input[placeholder="예: 월"]', '월')
        await pg.fill('input[placeholder="예: 날수, 횟수"]', '날수')
        sels = pg.locator('.step select'); await sels.nth(0).select_option('월'); await sels.nth(1).select_option('일')
        mx=max(sums); scale = 10 if mx<=300 else 20
        await pg.click(f'.step .chip-btn:text-is("{scale}")'); await pg.wait_for_timeout(400)
        for i,v in enumerate(sums): await click_point(pg, i, v)
        # 실행 취소 → 다시하기 확인
        await pg.click('.tool-btn:has-text("되돌리기")'); n1 = await pg.evaluate("Object.keys(window.__editor.d.points).length")
        await pg.click('.tool-btn:has-text("다시하기")'); n2 = await pg.evaluate("Object.keys(window.__editor.d.points).length")
        print('undo/redo points', n1, n2)
        await pg.click('.tool-btn:has-text("선 잇기")')
        for i,v in enumerate(sums): await click_point(pg, i, v)
        await pg.click('.tool-btn:has-text("확대")'); await pg.wait_for_timeout(200)
        labels=[f'{i+1}월' for i in range(11)]
        mxl = labels[sums.index(max(sums))]; mnl = labels[sums.index(min(sums))]
        diffs=[abs(sums[i]-sums[i-1]) for i in range(1,11)]; ci=diffs.index(max(diffs))+1
        ip = pg.locator('.step select')
        await ip.nth(2).select_option(mxl); await ip.nth(3).select_option(mnl); await ip.nth(4).select_option(f'{labels[ci-1]}~{labels[ci]}')
        await pg.fill('.step textarea', '학기 중에는 감정 글쓰기가 늘어나고 방학에는 줄어들었어요.')
        await pg.wait_for_timeout(300)
        await pg.click('.step button.btn:text-is("확인하기")'); await pg.wait_for_timeout(1500)
        print('check note:', (await pg.locator('.step .note').last.inner_text())[:500].replace(chr(10),' / '))
        await pg.screenshot(path=SH+'graph_check.png')
        await pg.click('label.toggle input'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=SH+'graph1.png')
        await pg.click('button:has-text("작품 제출하기")'); await pg.wait_for_timeout(400)
        await pg.click('.modal .btn:has-text("제출하기")'); await pg.wait_for_timeout(1200)
        await pg.click('.modal .btn'); await pg.wait_for_timeout(2000)
        await pg.screenshot(path=SH+'gallery_student.png')
        print('student errors:', pg.errs)
        # 교사 승인
        b2, ctx2, tp = await new(p)
        await tp.goto(BASE+'/'); await tp.evaluate("sessionStorage.setItem('kgl-opened','1')")
        await tp.goto(BASE+'/'); await tp.click('button:has-text("교사 관리실")')
        await tp.fill('input[name=username]','demo'); await tp.fill('input[name=password]','demo1234')
        await tp.click('button[type=submit]'); await tp.wait_for_selector('.admin'); await tp.wait_for_timeout(800)
        await tp.screenshot(path=SH+'teacher_progress.png', full_page=True)
        await tp.click('.admin-tab:has-text("작품 승인")'); await tp.wait_for_timeout(800)
        await tp.screenshot(path=SH+'teacher_works.png')
        await tp.click('.work-review:has-text("체험학생") button:has-text("승인")'); await tp.wait_for_timeout(800)
        for t in ['학생 명단','주제·투표','단계·조사 설정','학급 집계','자료 내려받기']:
            await tp.click(f'.admin-tab:has-text("{t}")'); await tp.wait_for_timeout(700)
            await tp.screenshot(path=SH+f'teacher_{t[:2]}.png')
        print('teacher errors:', tp.errs)
        await b2.close()
        # 학생 전시관에 보이는지
        await pg.goto(BASE+'/#gallery-0'); await pg.reload(); await pg.wait_for_timeout(2000)
        n = await pg.evaluate("fetch('/api/gallery').then(r=>r.json()).then(j=>j.items.filter(x=>x.mine).length)")
        print('my approved works in gallery:', n)
        await pg.click('.flip-btn.next'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=SH+'flip_mid.png')
        await pg.wait_for_timeout(900)
        await pg.screenshot(path=SH+'gallery2.png')
        print('errors end:', pg.errs)
        await b.close()
asyncio.run(main())
