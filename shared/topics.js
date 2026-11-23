// 「꺾은선그래프 연구소」 조사 주제·단위·입력 제한 (서버와 화면이 함께 사용)
export const YEAR = 2026;
export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // 2026년(평년)

export const CATEGORIES = [
  { id: 'school', name: '학교생활과 공부', icon: 'book' },
  { id: 'sport', name: '운동과 신체 활동', icon: 'graph' },
  { id: 'hobby', name: '취미와 문화생활', icon: 'brush' },
  { id: 'family', name: '가족과 생활', icon: 'scroll' },
  { id: 'eco', name: '환경과 생활 습관', icon: 'weather' },
];

// kind: count(횟수/개수) | days(날수, 그 달의 날수까지) | hours | money | best(개인 최고 기록)
// agg: sum(학급 합계) | avg(응답 학생 평균)
const T = (id, cat, name, unit, kind, max, extra = {}) => ({
  id, cat, name, unit, kind, max, step: 1, agg: 'sum', private: false, ...extra,
});

export const TOPICS = [
  T(1, 'school', '월별 읽은 책의 수', '권', 'count', 100),
  T(2, 'school', '월별 도서관 방문 횟수', '회', 'count', 62),
  T(3, 'school', '월별 감정 글쓰기를 한 날수', '일', 'days', 31),
  T(4, 'school', '월별 독서 활동 시간', '시간', 'hours', 200, { step: 0.5, hint: '30분은 0.5시간으로 적어요.' }),
  T(5, 'school', '월별 학습 목표 달성 횟수', '회', 'count', 100),
  T(6, 'sport', '월별 줄넘기 연습 횟수', '회', 'count', 100, { hint: '줄넘기를 연습한 횟수(번)를 적어요. 넘은 개수가 아니에요.' }),
  T(7, 'sport', '월별 운동한 날수', '일', 'days', 31),
  T(8, 'sport', '월별 자전거 탄 횟수', '회', 'count', 100),
  T(9, 'sport', '월별 산책 횟수', '회', 'count', 100),
  T(10, 'sport', '월별 배구 언더 서브 연속 성공 횟수 변화', '회', 'best', 300, {
    agg: 'avg',
    hint: '그 달에 가장 많이 연속으로 성공한 개인 최고 기록을 적어요. 학급 그래프는 응답한 친구들의 평균으로 그려요.',
  }),
  T(11, 'hobby', '월별 영화 관람 편수', '편', 'count', 40),
  T(12, 'hobby', '월별 그림 완성 작품 수', '개', 'count', 50),
  T(13, 'hobby', '월별 악기 연습 횟수', '회', 'count', 100),
  T(14, 'hobby', '월별 만들기 작품 수', '개', 'count', 50),
  T(15, 'hobby', '월별 문화생활 참여 횟수', '회', 'count', 40, {
    sub: '박물관·전시회·영화관 방문, 축제 참여',
    hint: '한 번 나들이에서 여러 곳을 갔어도 같은 방문은 한 번만 세요.',
  }),
  T(16, 'family', '월별 가족·친구와 나들이한 횟수', '회', 'count', 40),
  T(17, 'family', '월별 집안일을 도운 날수', '일', 'days', 31),
  T(18, 'family', '월별 직접 요리한 횟수', '회', 'count', 100),
  T(19, 'family', '월별 용돈 저축 금액', '원', 'money', 1000000, {
    step: 10, private: true,
    hint: '저축 금액은 개인 정보예요. 친구들에게는 내 금액이 보이지 않고 학급 전체 결과만 보여요.',
  }),
  T(20, 'family', '월별 친구와 야외에서 논 날수', '일', 'days', 31),
  T(21, 'eco', '월별 물을 하루 5잔 이상 마신 날수', '일', 'days', 31),
  T(22, 'eco', '월별 비 오는 날 우산을 사용한 날수', '일', 'days', 31),
  T(23, 'eco', '월별 일회용품을 사용한 날수', '일', 'days', 31),
  T(24, 'eco', '월별 텀블러를 가지고 다닌 날수', '일', 'days', 31),
  T(25, 'eco', '월별 방과 후 간식을 먹은 날수', '일', 'days', 31),
];

export const topicById = (id) => TOPICS.find((t) => t.id === Number(id));

export function monthMax(topic, month) {
  if (topic.kind === 'days') return MONTH_DAYS[month - 1];
  return topic.max;
}

export function monthLabel(m) { return `${m}월`; }

// 학생 한 칸 입력값 검증. 반환: null(통과) 또는 오류 문장
export function validateEntry(topic, month, value) {
  if (value === null || value === undefined || value === '') return '숫자를 적어 주세요.';
  const v = Number(value);
  if (!Number.isFinite(v)) return '숫자만 적을 수 있어요.';
  if (v < 0) return '0보다 작은 수는 적을 수 없어요.';
  const mx = monthMax(topic, month);
  if (v > mx) {
    return topic.kind === 'days'
      ? `${month}월은 ${mx}일까지 있어요. ${mx}보다 큰 수는 적을 수 없어요.`
      : `${mx.toLocaleString()}${topic.unit}보다 큰 수는 다시 확인해 주세요.`;
  }
  const step = topic.step || 1;
  if (Math.abs(Math.round(v / step) * step - v) > 1e-9) {
    return step === 0.5 ? '0.5 단위(30분)로 적어 주세요.' : step === 10 ? '10원 단위로 적어 주세요.' : '자연수(0, 1, 2 …)로 적어 주세요.';
  }
  return null;
}

// 세로 '작은 눈금 한 칸(점선 한 칸)' 크기 후보. 작은 칸 5개 = 큰 눈금(실선) 한 칸
export const SCALE_OPTIONS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
export const MAJOR = 5;      // 큰 눈금 한 칸에 들어가는 작은 칸 수
export const MAX_CELLS = 60; // 작은 칸 최대 개수
export const MIN_CELLS = 3;  // 이보다 적으면 변화가 잘 안 보임

// 모눈에서 점이 붙는 단위: 작은 눈금 한 칸을 10등분(자연수 자료는 1보다 작게 쪼개지 않음)
export function snapStep(scale) {
  if (scale >= 10) return scale / 10;
  if (scale >= 1) return Math.min(scale, 0.5) === 0.5 && scale < 2 ? 0.5 : 1;
  return 0.1;
}
// 작은 눈금이 몇 칸 필요한지
export function cellsNeeded(maxV, yStart, scale) { return Math.ceil((maxV - (yStart || 0)) / scale - 1e-9); }

// ── 점 찍기용 어림값: 큰 수(작은 눈금 한 칸이 1,000 이상)는 반올림해서 눈금에 맞추기 쉽게 ──
// 어림 단위 = 작은 눈금 한 칸 이하의 가장 큰 10의 거듭제곱 (예: 한 칸 50,000 → 만의 자리까지)
export function approxUnit(scale) {
  if (!scale || scale < 1000) return 0;
  return 10 ** Math.floor(Math.log10(scale) + 1e-9);
}
export const PLACE_NAME = { 1000: '천', 10000: '만', 100000: '십만', 1000000: '백만' };
export function approxValue(v, scale) {
  const u = approxUnit(scale);
  if (!u || v === null || v === undefined || v === '') return null;
  return Math.round(Number(v) / u) * u;
}
// 40만, 125만, 3천 처럼 읽기 쉬운 우리말 수
export function koNum(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) >= 10000) {
    const man = Math.floor(n / 10000); const rest = n - man * 10000;
    return `${man.toLocaleString()}만${rest ? ` ${rest.toLocaleString()}` : ''}`;
  }
  if (Math.abs(n) >= 1000 && n % 1000 === 0) return `${n / 1000}천`;
  return n.toLocaleString();
}
