// 서버와 주고받기. (체험판에서는 window.__KGL_DEMO__가 같은 서버 로직을 브라우저 안에서 실행합니다.)
export class ApiError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data || {}; }
}
const listeners = new Set();
export const onNetwork = (fn) => listeners.add(fn);

export async function api(method, path, body) {
  if (window.__KGL_DEMO__) {
    const r = await window.__KGL_DEMO__(method, path, body);
    if (r.status >= 400) throw new ApiError(r.status, r.body?.error || '문제가 생겼어요.', r.body);
    return r.body;
  }
  let res;
  try {
    res = await fetch(path, {
      method, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'graph-lab' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    listeners.forEach((f) => f(false));
    throw new ApiError(0, '인터넷 연결을 확인해 주세요. 입력한 내용은 이 기기에 잠시 보관해 두었어요.');
  }
  listeners.forEach((f) => f(true));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || '문제가 생겼어요.', data);
  return data;
}
export const isDemo = () => !!window.__KGL_DEMO__;
