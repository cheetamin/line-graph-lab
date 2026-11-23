// 학생 상태 보관소: 서버가 원본, 이 파일은 화면용 사본입니다.
import { api } from './api.js?v=mwt6l81r';
import { debounce } from './ui.js?v=mwt6l81r';

export const S = {
  me: null,        // /api/me 결과
  data: null,      // /api/student/state 결과
  saveEl: null,    // 상단 저장 표시
};

export async function loadStudent() {
  S.data = await api('GET', '/api/student/state');
  return S.data;
}

export function setSave(text, bad = false) {
  if (!S.saveEl) return;
  S.saveEl.textContent = text;
  S.saveEl.classList.toggle('bad', bad);
}

// 기기 임시 보관(인터넷이 끊겼을 때 다시 보내기용)
const BK = 'kgl-backup';
export function backup(key, value) {
  try { const all = JSON.parse(localStorage.getItem(BK) || '{}'); all[key] = { value, at: Date.now() }; localStorage.setItem(BK, JSON.stringify(all)); } catch { /* 저장소 없음 */ }
}
export function clearBackup(key) {
  try { const all = JSON.parse(localStorage.getItem(BK) || '{}'); delete all[key]; localStorage.setItem(BK, JSON.stringify(all)); } catch { /* */ }
}
export function getBackup(key) {
  try { return JSON.parse(localStorage.getItem(BK) || '{}')[key]?.value; } catch { return undefined; }
}

export async function saveState(patch, label = '저장됨') {
  setSave('저장 중…');
  try {
    const r = await api('PUT', '/api/student/state', patch);
    S.data.state = r.state;
    setSave(`${label} ✓`);
    return r;
  } catch (e) {
    setSave('저장 실패', true);
    throw e;
  }
}

export const saveUi = debounce((chapter, spread) => {
  api('PUT', '/api/student/state', { ui: { chapter, spread } }).catch(() => {});
}, 600);
