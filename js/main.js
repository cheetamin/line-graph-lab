// 「꺾은선그래프 연구소」 시작점
import { api, onNetwork, isDemo } from './api.js?v=mwswi2vs';
import { h, toast } from './ui.js?v=mwswi2vs';
import { S } from './store.js?v=mwswi2vs';

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
    const { mountStudent } = await import('./pages/student.js?v=mwswi2vs');
    await mountStudent(app);
  } else if (me.role === 'admin') {
    const { mountAdmin } = await import('./pages/admin.js?v=mwswi2vs');
    await mountAdmin(app);
  } else if (me.role === 'teacher') {
    const { mountTeacher } = await import('./pages/teacher.js?v=mwswi2vs');
    await mountTeacher(app);
  } else {
    const { mountCover } = await import('./pages/cover.js?v=mwswi2vs');
    mountCover(app, joinCode ? { ...opts, joinCode, skipCover: true, tab: 'student' } : opts);
  }
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
