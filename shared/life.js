// 3차 활동: 꺾은선그래프를 생활에 활용해 볼까요? (교과서 122~123쪽)
// 우리 고장(진주) 자료를 학생이 직접 찾아 연도별 꺾은선그래프로 나타냅니다.
// 선생님이 [설정]에서 주제·링크를 고칠 수 있어요(누리집 주소는 바뀔 수 있음).
// 관광지 입장객 수는 공공데이터포털 「경상남도_주요관광지점 입장객 현황」(2017~2022년) 파일의 진주시 자료예요.

import { TOUR_DATA, TOUR_YEARS, TOUR_SOURCE } from './tourdata.js?v=mwt6l81r';

export const DEFAULT_LIFE_REGION = '진주시';

const enc = encodeURIComponent;
const searchUrl = (q) => `https://search.naver.com/search.naver?query=${enc(q)}`;
const TOUR_LINKS = [
  { t: '공공데이터포털: 경상남도 주요관광지점 입장객 현황', u: 'https://www.data.go.kr/data/3034241/fileData.do' },
  { t: '관광지식정보시스템(2023년 이후 자료 찾기)', u: 'https://know.tour.go.kr/stat/visitStatDis/introduce.do' },
];
// 진주시는 선생님이 고른 관광지 순서와 설명을 그대로 씀
const JINJU_PICK = [
  ['fortress', '진주성', '임진왜란 진주대첩의 현장이자 진주를 대표하는 관광지예요.'],
  ['forest', '산림박물관', '진양호 근처 경상남도 수목원 안에 있는 산림박물관이에요.'],
  ['wolasan', '월아산 숲속의 진주', '숲속 놀이·체험 시설과 야영장이 있는 월아산 휴양 공간이에요.'],
  ['zoo', '진양호 동물원', '진양호 공원 안에 있는 동물원이에요.'],
  ['leesj', '진주시립이성자미술관', '진주 출신 화가 이성자의 작품을 볼 수 있는 미술관이에요.'],
  ['dino', '진주익룡발자국전시관', '진주에서 발견된 익룡 발자국 화석을 볼 수 있는 전시관이에요.'],
];

// "진주", "창원", "하동" → 자료에 있는 이름(진주시, 통합창원시→창원시 …). 없으면 입력 그대로
export function normalizeRegion(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  const last = t.split(' ').pop();
  const keys = Object.keys(TOUR_DATA);
  const plain = (k) => k.replace(/^통합/, '');
  const hit = keys.find((k) => plain(k) === last) || keys.find((k) => plain(k).replace(/[시군]$/, '') === last.replace(/[시군]$/, ''));
  return hit ? plain(hit) : t;
}
const dataKey = (region) => Object.keys(TOUR_DATA).find((k) => k.replace(/^통합/, '') === region);
export const hasTourData = (region) => !!dataKey(normalizeRegion(region));

// 학교 주소 "경상남도 진주시 ○○로" → "진주시", "부산광역시 해운대구 …" → "부산광역시 해운대구"
export function regionFromAddress(address) {
  const tk = String(address || '').trim().split(/\s+/);
  if (tk.length < 2) return '';
  if (/[시군]$/.test(tk[1])) return normalizeRegion(tk[1]);
  if (/(광역시|특별시|특별자치시)$/.test(tk[0])) return /구$|군$/.test(tk[1]) ? `${tk[0]} ${tk[1]}` : tk[0];
  return tk[1];
}

const tip = (place) => `아래 공공데이터 자료표에서 ${place}의 연도별 입장객 수를 찾아 표에 옮겨 적어요. 수가 크면 ‘만 명’으로 바꾸어 어림해도 돼요(예: 2253455명 → 225만 명). 2020·2021년에는 감염병 때문에 관광객이 크게 줄었어요.`;
const tourCard = (id, place, desc, values) => {
  const first = TOUR_YEARS[values.findIndex((v) => v !== null)];
  return {
    id, group: 'tour', title: `${place} 입장객 수`, place, unit: '명', icon: 'search',
    desc: desc + (first > 2017 ? ` ${first}년부터 자료가 있어요.` : ''),
    tip: tip(place), data: { years: TOUR_YEARS.slice(), values: values.slice(), note: TOUR_SOURCE }, links: TOUR_LINKS.map((l) => ({ ...l })),
  };
};

// 지역 이름으로 3차 자료 카드 만들기: 관광지 입장객 수(경남은 실제 자료표) + 인구 + 도시공원 수 + 직접 찾기
export function buildLifeSources(regionText) {
  const region = normalizeRegion(regionText) || DEFAULT_LIFE_REGION;
  const key = dataKey(region);
  const out = [];
  if (region === '진주시' && key) {
    const list = TOUR_DATA[key];
    for (const [id, place, desc] of JINJU_PICK) { const row = list.find((x) => x.p === place); if (row) out.push(tourCard(id, place, desc, row.v)); }
  } else if (key) {
    TOUR_DATA[key].slice(0, 6).forEach((row, i) => out.push(tourCard(`t${i + 1}`, row.p, `${region}의 주요 관광지예요.`, row.v)));
  } else {
    out.push({
      id: 'tour', group: 'tour', title: `${region} 관광지 입장객 수`, place: `${region} 관광지`, unit: '명', icon: 'search',
      desc: `${region}의 대표 관광지 한 곳을 골라, 해마다 몇 명이 찾았는지 알아봐요.`,
      tip: `관광지식정보시스템 → 국내관광통계 → 주요관광지점 입장객통계에서 우리 시·도 → ${region} → 관광지를 골라 연도별 입장객 수를 찾아요. 공공데이터포털에서 ‘${region} 관광지 입장객’을 검색해도 돼요.`,
      links: [
        { t: '관광지식정보시스템(주요관광지점 입장객통계)', u: 'https://know.tour.go.kr/stat/visitStatDis/introduce.do' },
        { t: `공공데이터포털에서 ‘${region} 관광지 입장객’ 찾기`, u: `https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=${enc(`${region} 관광지 입장객`)}` },
      ],
    });
  }
  out.push({
    id: 'park', group: 'other', title: `${region} 도시공원 수`, unit: '곳', icon: 'park',
    desc: `교과서 122쪽의 힘찬시처럼, ${region}의 공원은 해마다 늘었을까요? 시·군에서 펴내는 통계연보에 공원 수가 나와요.`,
    tip: `${region} 누리집에서 ‘통계연보’를 찾거나, 국가통계포털에서 ‘${region} 도시공원’을 찾아요. 찾기 어려우면 선생님과 함께 찾아요.`,
    links: [
      { t: `‘${region} 통계연보 도시공원’ 찾아보기`, u: searchUrl(`${region} 통계연보 도시공원 현황`) },
      { t: '국가통계포털(KOSIS)', u: 'https://kosis.kr/' },
      { t: '공공데이터포털: 전국도시공원정보', u: 'https://www.data.go.kr/data/15012890/standard.do' },
    ],
  });
  out.push({
    id: 'population', group: 'other', title: `${region} 인구`, unit: '명', icon: 'people',
    desc: `${region}에 사는 사람은 해마다 늘었을까요, 줄었을까요? 주민등록 인구 통계에서 연도별 인구를 찾을 수 있어요.`,
    tip: `주민등록 인구통계 → 주민등록 인구 및 세대현황에서 ${region}을(를) 고르고 ‘연간’으로 연도별 인구를 찾아요. 수가 크면 ‘만 명’으로 어림해도 돼요.`,
    links: [
      { t: '행정안전부 주민등록 인구통계', u: 'https://jumin.mois.go.kr/' },
      { t: '국가통계포털(KOSIS)', u: 'https://kosis.kr/' },
    ],
  });
  out.push({
    id: 'free', group: 'other', title: `내가 찾은 ${region} 자료`, unit: '', icon: 'search',
    desc: `${region}과(와) 관련된 다른 자료도 좋아요. 연도에 따라 변하는 양(예: 도서관 수, 축제 방문객 수)을 찾아 보세요.`,
    tip: '연도별로 3~8개의 값이 있는 자료를 골라요. 자료를 찾은 누리집이나 기사 이름을 출처에 꼭 적어요.',
    links: [
      { t: '통계놀이터(어린이 통계 누리집)', u: 'https://kids.kostat.go.kr/' },
      { t: '국가통계포털(KOSIS)', u: 'https://kosis.kr/' },
    ],
  });
  return out;
}

export const DEFAULT_LIFE_SOURCES = buildLifeSources(DEFAULT_LIFE_REGION);

export function cleanLifeSources(list) {
  const s = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const out = (Array.isArray(list) ? list : []).slice(0, 12).map((x, i) => ({
    id: s(x?.id, 20) || `s${i + 1}`, title: s(x?.title, 40), unit: s(x?.unit, 10), icon: s(x?.icon, 12) || 'search',
    desc: s(x?.desc, 400), tip: s(x?.tip, 500), group: s(x?.group, 10), place: s(x?.place, 40),
    data: x?.data && Array.isArray(x.data.years) && Array.isArray(x.data.values)
      ? { years: x.data.years.slice(0, 12).map(Number), values: x.data.values.slice(0, 12).map((v) => (v === null || v === '' ? null : Number(v))), note: s(x.data.note, 200) } : null,
    links: (Array.isArray(x?.links) ? x.links : []).slice(0, 8).map((l) => ({ t: s(l?.t, 80), u: s(l?.u, 400) })).filter((l) => l.t && /^https?:\/\//.test(l.u)),
  })).filter((x) => x.title);
  return out.length ? out : DEFAULT_LIFE_SOURCES.map((x) => ({ ...x, links: x.links.map((l) => ({ ...l })) }));
}
