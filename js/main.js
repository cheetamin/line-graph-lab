// 「꺾은선그래프 연구소」 시작점
import { api, onNetwork, isDemo } from './api.js?v=mwx3sl2c';
import { h, toast } from './ui.js?v=mwx3sl2c';
import { S } from './store.js?v=mwx3sl2c';

const app = document.getElementById('app');

export async function boot(opts = {}) {
  if (window.__KGL_READY__) await window.__KGL_READY__;
  let me = { role: null };
  try { me = await api('GET', '/api/me'); } catch (e) { toast(e.message, 'bad'); }
  // 체험판 띠는 교사·관리자 화면에만(학생 화면에는 체험판 설명을 보이지 않음)
  document.querySelector('.demo-ribbon')?.remove();
  if (isDemo() && (me.role === 'teacher' || me.role === 'admin')) document.body.append(h('div', { class: 'demo-ribbon' }, '체험판 · 자료는 이 브라우저에만 저장돼요'));
  S.me = me;
  // QR로 들어온 경우: 주소 끝의 #join-학급코드
  const jm = location.hash.match(/^#join-([A-Za-z0-9]{4,8})$/);
  const joinCode = jm ? jm[1].toUpperCase() : (opts.joinCode || null);
  if (jm) { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* */ } }
  app.replaceChildren();
  if (me.role === 'student') {
    if (joinCode) setTimeout(() => toast('이미 연구소에 들어와 있어요. 다른 학급이면 [나가기] 뒤에 다시 QR을 비춰 주세요.'), 600);
    const { mountStudent } = await import('./pages/student.js?v=mwx3sl2c');
    await mountStudent(app);
  } else if (me.role === 'admin') {
    const { mountAdmin } = await import('./pages/admin.js?v=mwx3sl2c');
    await mountAdmin(app);
  } else if (me.role === 'teacher') {
    const { mountTeacher } = await import('./pages/teacher.js?v=mwx3sl2c');
    await mountTeacher(app);
  } else {
    const { mountCover } = await import('./pages/cover.js?v=mwx3sl2c');
    mountCover(app, joinCode ? { ...opts, joinCode, skipCover: true, tab: 'student' } : location.hash === '#admin' ? { ...opts, skipCover: true, tab: 'teacher' } : opts);
  }
  warmUp(me.role);
}

// 화면이 뜬 뒤 쉬는 틈에 그림·화면 모듈을 미리 받아 풀어 둬요 → 처음 넘길 때 멈칫하지 않아요
const WARM_ART = ['btn_gold', 'btn_hanji', 'btn_hyeonpan', 'btn_jade', 'btn_off', 'btn_red', 'divider', 'dot_off', 'dot_on', 'frame_corner',
  'icon_book', 'icon_brush', 'icon_gallery', 'icon_graph', 'icon_home', 'icon_scroll', 'icon_search', 'icon_table', 'icon_town', 'icon_vote', 'icon_weather',
  'prop_mountains_faint', 'prop_mountains_small', 'seal_done', 'seal_lock', 'seal_show', 'seal_table', 'seal_wait', 'tab_off', 'tab_on', 'tile_off', 'tile_on', 'arrow_next', 'arrow_prev'];
const WARM_BG = ['04_left_page_blank', '05_right_page_blank', '17_topic_card_default', '18_topic_card_selected', '19_graph_frame_blank', '20_data_table_frame_blank', '21_description_panel_blank'];
function warmUp(role) {
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 400));
  idle(() => {
    const keep = (window.__kglWarm = window.__kglWarm || []);
    [...WARM_ART.map((n) => `assets/art/${n}.webp`), ...WARM_BG.map((n) => `assets/${n}.webp`)].forEach((src, i) => {
      setTimeout(() => { const im = new Image(); im.decoding = 'async'; im.src = src; keep.push(im); im.decode?.().catch(() => {}); }, i * 25);
    });
    // 다음에 쓸 화면 모듈도 미리 받아 둠
    const mods = role === 'student'
      ? [import('./pages/topics.js?v=mwx3sl2c'), import('./pages/table.js?v=mwx3sl2c'), import('./pages/graphwork.js?v=mwx3sl2c'), import('./pages/life.js?v=mwx3sl2c'), import('./pages/gallery.js?v=mwx3sl2c'), import('./pages/survey.js?v=mwx3sl2c')]
      : role === 'teacher' ? [] : [import('./pages/student.js?v=mwx3sl2c'), import('./pages/teacher.js?v=mwx3sl2c')];
    Promise.allSettled(mods);
  });
}

export async function logout() {
  try { await api('POST', '/api/logout'); } catch { /* 이미 나감 */ }
  location.hash = '';
  boot({ skipCover: false });
}

let banner;
onNetwork((ok) => {
  if (!ok && !banner) { banner = h('div', { class: 'offline-banner', role: 'alert' }, '인터넷 연결이 끊겼어요. 연결되면 다시 저장해 주세요.'); document.body.append(banner); }
  if (ok && banner) { banner.remove(); banner = null; }
});
window.addEventListener('hashchange', () => { if (/^#join-/.test(location.hash)) boot(); });
window.addEventListener('online', () => banner && toast('인터넷이 다시 연결되었어요. [중간 저장]을 눌러 주세요.', 'ok'));

boot();
