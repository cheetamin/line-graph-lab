// 나이스 교육정보 개방 포털 — 학교기본정보 검색(서버와 브라우저가 함께 씀)
// 인증키 없이도 이름 일부로 찾을 수 있어요(브라우저에서 바로 부를 수 있음). 인증키가 있으면 서버에서 KEY로 함께 보냅니다.
const ORDER = { 초등학교: 0, 중학교: 1, 고등학교: 2 };
export async function neisSearch(q, { key = '', base = 'https://open.neis.go.kr/hub/schoolInfo', timeoutMs = 7000 } = {}) {
  const url = `${base}?Type=json&pIndex=1&pSize=100&SCHUL_NM=${encodeURIComponent(q)}${key ? `&KEY=${encodeURIComponent(key)}` : ''}`;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let j;
  try {
    const r = await fetch(url, ctrl ? { signal: ctrl.signal } : {});
    if (!r.ok) throw new Error(`NEIS ${r.status}`);
    j = await r.json();
  } finally { if (timer) clearTimeout(timer); }
  if (j.RESULT && j.RESULT.CODE === 'INFO-200') return [];
  if (j.RESULT && j.RESULT.CODE !== 'INFO-000') throw new Error(j.RESULT.MESSAGE || 'NEIS error');
  const rows = (j.schoolInfo && j.schoolInfo[1] && j.schoolInfo[1].row) || [];
  return rows.map((x) => ({
    name: x.SCHUL_NM, code: x.SD_SCHUL_CODE, officeCode: x.ATPT_OFCDC_SC_CODE, office: x.ATPT_OFCDC_SC_NM,
    kind: x.SCHUL_KND_SC_NM, region: x.LCTN_SC_NM, address: (x.ORG_RDNMA || '').trim(),
  })).sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9) || a.name.localeCompare(b.name, 'ko'));
}
