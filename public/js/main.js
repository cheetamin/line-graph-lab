// 「꺾은선그래프 연구소」 시작점
import { api, onNetwork, isDemo } from './api.js';
import { h, toast } from './ui.js';
import { S } from './store.js';

const app = document.getElementById('app');

export async function boot(opts = {}) {
  if (window.__KGL_READY__) await window.__KGL_READY__;
  if (isDemo() && !document.querySelector('.demo-ribbon')) document.body.append(h('div', { class: 'demo-ribbon' }, '체험판 · 자료는 이 브라우저에만 저장돼요'));
  let me = { role: null };
  try { me = await api('GET', '/api/me'); } catch (e) { toast(e.message, 'bad'); }
  S.me = me;
  app.replaceChildren();
  if (me.role === 'student') {
    const { mountStudent } = await import('./pages/student.js');
    await mountStudent(app);
  } else if (me.role === 'teacher') {
    const { mountTeacher } = await import('./pages/teacher.js');
    await mountTeacher(app);
  } else {
    const { mountCover } = await import('./pages/cover.js');
    mountCover(app, opts);
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
window.addEventListener('online', () => banner && toast('인터넷이 다시 연결되었어요. [중간 저장]을 눌러 주세요.', 'ok'));

boot();
