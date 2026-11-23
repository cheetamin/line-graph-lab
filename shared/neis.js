// 나이스 교육정보 개방 포털 — 학교기본정보 검색(서버와 브라우저가 함께 씀)
// 인증키 없이도 이름 일부로 찾을 수 있어요(브라우저에서 바로 부를 수 있음). 인증키가 있으면 서버에서 KEY로 함께 보냅니다.
const ORDER = { 초등학교: 0, 중학교: 1, 고등학교: 2 };
// 시·도 교육청 코드(인증키가 없으면 결과가 5개까지라 시·도와 학교급으로 좁혀 찾아요)
export const OFFICES = [
  ['B10', '서울'], ['C10', '부산'], ['D10', '대구'], ['E10', '인천'], ['F10', '광주'], ['G10', '대전'], ['H10', '울산'], ['I10', '세종'],
  ['J10', '경기'], ['K10', '강원'], ['M10', '충북'], ['N10', '충남'], ['P10', '전북'], ['Q10', '전남'], ['R10', '경북'], ['S10', '경남'], ['T10', '제주'],
];
export async function neisSearch(q, { key = '', base = 'https://open.neis.go.kr/hub/schoolInfo', timeoutMs = 7000, office = '', kind = '' } = {}) {
  const off = OFFICES.some(([c]) => c === office) ? office : '';
  const knd = ['초등학교', '중학교', '고등학교'].includes(kind) ? kind : '';
  const url = `${base}?Type=json&pIndex=1&pSize=100&SCHUL_NM=${encodeURIComponent(q)}${off ? `&ATPT_OFCDC_SC_CODE=${off}` : ''}${knd ? `&SCHUL_KND_SC_NM=${encodeURIComponent(knd)}` : ''}${key ? `&KEY=${encodeURIComponent(key)}` : ''}`;
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
