// 3차 활동: 꺾은선그래프를 생활에 활용해 볼까요? (교과서 122~123쪽)
// 우리 고장(진주) 자료를 학생이 직접 찾아 연도별 꺾은선그래프로 나타냅니다.
// 선생님이 [설정]에서 주제·링크를 고칠 수 있어요(누리집 주소는 바뀔 수 있음).
// 관광지 입장객 수는 공공데이터포털 「경상남도_주요관광지점 입장객 현황」(2017~2022년) 파일의 진주시 자료예요.

export const DEFAULT_LIFE_REGION = '진주시';

export const DEFAULT_LIFE_SOURCES = [
  {
    id: 'fortress', group: 'tour', title: '진주성 입장객 수', place: '진주성', unit: '명', icon: 'fortress',
    desc: '임진왜란 진주대첩의 현장이자 진주를 대표하는 관광지예요.',
    tip: '아래 공공데이터 자료표에서 연도별 입장객 수를 찾아 표에 옮겨 적어요. 수가 크면 ‘만 명’으로 바꾸어 어림해도 돼요(예: 2253455명 → 225만 명). 2020·2021년에는 감염병 때문에 관광객이 크게 줄었어요.',
    data: { years: [2017, 2018, 2019, 2020, 2021, 2022], values: [1625471, 2253455, 2167256, 601689, 525932, 805775], note: '경상남도 주요관광지점 입장객 현황(공공데이터포털, 2022년 12월 31일 기준) · 내국인과 외국인을 더한 수' },
    links: [
      { t: '공공데이터포털: 경상남도 주요관광지점 입장객 현황', u: 'https://www.data.go.kr/data/3034241/fileData.do' },
      { t: '관광지식정보시스템(2023년 이후 자료 찾기)', u: 'https://know.tour.go.kr/stat/visitStatDis/introduce.do' },
    ],
  },
  {
    id: 'forest', group: 'tour', title: '산림박물관 입장객 수', place: '산림박물관', unit: '명', icon: 'tree',
    desc: '진양호 근처 경상남도 수목원 안에 있는 산림박물관이에요.',
    tip: '아래 공공데이터 자료표에서 연도별 입장객 수를 찾아 표에 옮겨 적어요. 수가 크면 ‘만 명’으로 바꾸어 어림해도 돼요(예: 2253455명 → 225만 명). 2020·2021년에는 감염병 때문에 관광객이 크게 줄었어요.',
    data: { years: [2017, 2018, 2019, 2020, 2021, 2022], values: [404639, 376453, 331010, 185485, 200208, 259977], note: '경상남도 주요관광지점 입장객 현황(공공데이터포털, 2022년 12월 31일 기준) · 내국인과 외국인을 더한 수' },
    links: [
      { t: '공공데이터포털: 경상남도 주요관광지점 입장객 현황', u: 'https://www.data.go.kr/data/3034241/fileData.do' },
      { t: '관광지식정보시스템(2023년 이후 자료 찾기)', u: 'https://know.tour.go.kr/stat/visitStatDis/introduce.do' },
    ],
  },
  {
    id: 'wolasan', group: 'tour', title: '월아산 숲속의 진주 입장객 수', place: '월아산 숲속의 진주', unit: '명', icon: 'tree',
    desc: '숲속 놀이·체험 시설과 야영장이 있는 월아산 휴양 공간이에요. 2019년부터 자료가 있어요.',
    tip: '아래 공공데이터 자료표에서 연도별 입장객 수를 찾아 표에 옮겨 적어요. 수가 크면 ‘만 명’으로 바꾸어 어림해도 돼요(예: 2253455명 → 225만 명). 2020·2021년에는 감염병 때문에 관광객이 크게 줄었어요.',
    data: { years: [2017, 2018, 2019, 2020, 2021, 2022], values: [null, null, 60950, 11784, 17330, 167870], note: '경상남도 주요관광지점 입장객 현황(공공데이터포털, 2022년 12월 31일 기준) · 내국인과 외국인을 더한 수' },
    links: [
      { t: '공공데이터포털: 경상남도 주요관광지점 입장객 현황', u: 'https://www.data.go.kr/data/3034241/fileData.do' },
      { t: '관광지식정보시스템(2023년 이후 자료 찾기)', u: 'https://know.tour.go.kr/stat/visitStatDis/introduce.do' },
    ],
  },
  {
    id: 'zoo', group: 'tour', title: '진양호 동물원 입장객 수', place: '진양호 동물원', unit: '명', icon: 'zoo',
    desc: '진양호 공원 안에 있는 동물원이에요.',
    tip: '아래 공공데이터 자료표에서 연도별 입장객 수를 찾아 표에 옮겨 적어요. 수가 크면 ‘만 명’으로 바꾸어 어림해도 돼요(예: 2253455명 → 225만 명). 2020·2021년에는 감염병 때문에 관광객이 크게 줄었어요.',
    data: { years: [2017, 2018, 2019, 2020, 2021, 2022], values: [153242, 179185, 165854, 64095, 115073, 195225], note: '경상남도 주요관광지점 입장객 현황(공공데이터포털, 2022년 12월 31일 기준) · 내국인과 외국인을 더한 수' },
    links: [
      { t: '공공데이터포털: 경상남도 주요관광지점 입장객 현황', u: 'https://www.data.go.kr/data/3034241/fileData.do' },
      { t: '관광지식정보시스템(2023년 이후 자료 찾기)', u: 'https://know.tour.go.kr/stat/visitStatDis/introduce.do' },
    ],
  },
  {
    id: 'leesj', group: 'tour', title: '진주시립이성자미술관 입장객 수', place: '진주시립이성자미술관', unit: '명', icon: 'art',
    desc: '진주 출신 화가 이성자의 작품을 볼 수 있는 미술관이에요.',
    tip: '아래 공공데이터 자료표에서 연도별 입장객 수를 찾아 표에 옮겨 적어요. 수가 크면 ‘만 명’으로 바꾸어 어림해도 돼요(예: 2253455명 → 225만 명). 2020·2021년에는 감염병 때문에 관광객이 크게 줄었어요.',
    data: { years: [2017, 2018, 2019, 2020, 2021, 2022], values: [8767, 7714, 9727, 1602, 4847, 32912], note: '경상남도 주요관광지점 입장객 현황(공공데이터포털, 2022년 12월 31일 기준) · 내국인과 외국인을 더한 수' },
    links: [
      { t: '공공데이터포털: 경상남도 주요관광지점 입장객 현황', u: 'https://www.data.go.kr/data/3034241/fileData.do' },
      { t: '관광지식정보시스템(2023년 이후 자료 찾기)', u: 'https://know.tour.go.kr/stat/visitStatDis/introduce.do' },
    ],
  },
  {
    id: 'dino', group: 'tour', title: '진주익룡발자국전시관 입장객 수', place: '진주익룡발자국전시관', unit: '명', icon: 'dino',
    desc: '진주에서 발견된 익룡 발자국 화석을 볼 수 있는 전시관이에요. 2020년부터 자료가 있어요.',
    tip: '아래 공공데이터 자료표에서 연도별 입장객 수를 찾아 표에 옮겨 적어요. 수가 크면 ‘만 명’으로 바꾸어 어림해도 돼요(예: 2253455명 → 225만 명). 2020·2021년에는 감염병 때문에 관광객이 크게 줄었어요.',
    data: { years: [2017, 2018, 2019, 2020, 2021, 2022], values: [null, null, null, 5677, 9591, 32736], note: '경상남도 주요관광지점 입장객 현황(공공데이터포털, 2022년 12월 31일 기준) · 내국인과 외국인을 더한 수' },
    links: [
      { t: '공공데이터포털: 경상남도 주요관광지점 입장객 현황', u: 'https://www.data.go.kr/data/3034241/fileData.do' },
      { t: '관광지식정보시스템(2023년 이후 자료 찾기)', u: 'https://know.tour.go.kr/stat/visitStatDis/introduce.do' },
    ],
  },
  {
    id: 'park', title: '진주시 도시공원 수', unit: '곳', icon: 'park',
    desc: '교과서 122쪽의 힘찬시처럼, 우리 진주시의 공원은 해마다 늘었을까요? 시에서 펴내는 통계연보에 공원 수가 나와요.',
    tip: '진주시청 누리집에서 ‘통계연보’를 검색하거나, 국가통계포털에서 ‘진주시 도시공원’을 찾아요. 찾기 어려우면 선생님과 함께 찾아요.',
    links: [
      { t: '진주시청 누리집', u: 'https://www.jinju.go.kr/' },
      { t: '국가통계포털(KOSIS)', u: 'https://kosis.kr/' },
      { t: '공공데이터포털: 전국도시공원정보(진주시 포함)', u: 'https://www.data.go.kr/data/15012890/standard.do' },
    ],
  },
  {
    id: 'population', title: '진주시 인구', unit: '명', icon: 'people',
    desc: '진주시에 사는 사람은 해마다 늘었을까요, 줄었을까요? 주민등록 인구 통계에서 연도별 인구를 찾을 수 있어요.',
    tip: '주민등록 인구통계 → 주민등록 인구 및 세대현황에서 경상남도 진주시, ‘연간’을 골라 연도별 인구를 찾아요. 수가 크면 ‘만 명’으로 어림해도 돼요.',
    links: [
      { t: '행정안전부 주민등록 인구통계', u: 'https://jumin.mois.go.kr/' },
      { t: '국가통계포털(KOSIS)', u: 'https://kosis.kr/' },
    ],
  },
  {
    id: 'free', title: '내가 찾은 진주 자료', unit: '', icon: 'search',
    desc: '진주와 관련된 다른 자료도 좋아요. 연도에 따라 변하는 양(예: 진주시 도서관 수, 진주남강유등축제 방문객 수)을 찾아 보세요.',
    tip: '연도별로 3~8개의 값이 있는 자료를 골라요. 자료를 찾은 누리집이나 기사 이름을 출처에 꼭 적어요.',
    links: [
      { t: '통계놀이터(어린이 통계 누리집)', u: 'https://kids.kostat.go.kr/' },
      { t: '국가통계포털(KOSIS)', u: 'https://kosis.kr/' },
    ],
  },
];

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
