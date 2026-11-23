// 만족도 조사 문항(학생: 세 활동을 모두 마친 뒤 / 교사: 작품을 한 개 이상 승인한 뒤)
export const SCALE_LABELS = ['전혀 아니에요', '아니에요', '보통이에요', '그래요', '매우 그래요'];

export const STUDENT_SURVEY = [
  { id: 'fun', type: 'scale', q: '꺾은선그래프 연구소 활동이 재미있었나요?' },
  { id: 'understand', type: 'scale', q: '꺾은선그래프로 나타내면 시간에 따른 변화를 한눈에 알 수 있다는 것을 알게 되었나요?' },
  { id: 'draw', type: 'scale', q: '눈금을 정하고 점을 찍고 선분으로 이어, 꺾은선그래프를 스스로 그릴 수 있게 되었나요?' },
  { id: 'life', type: 'scale', q: '내 생활과 우리 고장 자료로 그래프를 그려 보니, 꺾은선그래프가 생활에 쓰인다는 것을 느꼈나요?' },
  { id: 'easy', type: 'scale', q: '연구소(프로그램)를 쓰는 방법이 쉬웠나요?' },
  { id: 'best', type: 'choice', q: '가장 좋았던 활동은 무엇인가요?', options: ['1차 기상자료 탐험실', '2차 나의 주제 그래프', '3차 우리 고장 그래프', '작품 전시관 감상'] },
  { id: 'comment', type: 'text', q: '더 하고 싶은 말이나 바라는 점을 적어 주세요. (선택)', optional: true },
];

export const TEACHER_SURVEY = [
  { id: 'goal', type: 'scale', q: '꺾은선그래프 단원(4학년 2학기 5단원) 지도에 도움이 되었나요?' },
  { id: 'engage', type: 'scale', q: '학생들이 활동에 적극적으로 참여했나요?' },
  { id: 'flow', type: 'scale', q: '1차(기상자료) → 2차(나의 주제) → 3차(우리 고장) 활동 흐름이 수업에 알맞았나요?' },
  { id: 'manage', type: 'scale', q: '학급 만들기, 학생 명단, 작품 승인 같은 관리 기능이 편리했나요?' },
  { id: 'design', type: 'scale', q: '화면 디자인과 책장 넘김이 학생들의 몰입에 도움이 되었나요?' },
  { id: 'reuse', type: 'scale', q: '다음에도 이 프로그램을 쓰거나 다른 선생님께 추천하고 싶나요?' },
  { id: 'good', type: 'text', q: '좋았던 점 (선택)', optional: true },
  { id: 'improve', type: 'text', q: '고쳤으면 하는 점이나 더했으면 하는 기능 (선택)', optional: true },
];

// 답 검사·정리: 잘못된 값은 버리고, 필수 문항이 빠지면 오류 목록을 돌려줌
export function cleanSurvey(items, raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const out = {}; const missing = [];
  items.forEach((it, i) => {
    const v = a[it.id];
    if (it.type === 'scale') { const n = Number(v); if (Number.isInteger(n) && n >= 1 && n <= 5) out[it.id] = n; }
    else if (it.type === 'choice') { if (it.options.includes(v)) out[it.id] = v; }
    else if (typeof v === 'string' && v.trim()) out[it.id] = v.trim().slice(0, 500);
    if (!it.optional && out[it.id] === undefined) missing.push(i + 1);
  });
  return { answers: out, missing };
}

// 학급 결과 모으기(이름 없이)
export function summarize(items, list) {
  return items.map((it) => {
    const vals = list.map((x) => x[it.id]).filter((v) => v !== undefined);
    if (it.type === 'scale') {
      const dist = [1, 2, 3, 4, 5].map((k) => vals.filter((v) => v === k).length);
      return { id: it.id, type: it.type, q: it.q, n: vals.length, avg: vals.length ? Math.round((vals.reduce((p, c) => p + c, 0) / vals.length) * 10) / 10 : null, dist };
    }
    if (it.type === 'choice') return { id: it.id, type: it.type, q: it.q, n: vals.length, counts: it.options.map((o) => ({ option: o, n: vals.filter((v) => v === o).length })) };
    return { id: it.id, type: it.type, q: it.q, n: vals.length, texts: vals };
  });
}
