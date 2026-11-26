// 1차 기상자료 탐험실: 기상청 「우리나라 113년 기후변화 분석 보고서」의 【표 2】 연대별 폭염일수로 조사해요.
// (기상자료개방포털의 폭염일수 자료가 잠시 내려간 동안의 기본 방법) 값은 학생이 직접 찾아 적어요.
export const DECADE_SOURCE = {
  title: '기상청 보도자료 「우리나라 113년 기후변화 분석 보고서」 발간',
  date: '2025. 12. 30.',
  url: 'https://www.weather.go.kr/kma/flexer/html/press/2025/12/30/ATC202512300724012_c9e94dce-2beb-454d-89b5-7dd0dcf37012.hwp.files/Sections1.html',
  find: '아래쪽 [붙임 1]의 【표 2】 연대별 폭염일수, 열대야일수, 한파일수 → 맨 윗줄 「폭염일수(일)」',
};
export const ARTICLE_SOURCE_NAME = '기상청 「우리나라 113년 기후변화 분석 보고서」 표 2';
export const DECADES = [1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
export const isDecadeMode = (w) => w?.unit === 'decade';
export const yearLabel = (w, y) => (isDecadeMode(w) ? `${y}년대` : `${y}년`);
// 【표 2】 연대별 폭염일수(일) — 기상청 「우리나라 113년 기후변화 분석 보고서」(2025. 12. 30.) 그대로
export const DECADE_HEAT = { 1910: 7.7, 1920: 10.3, 1930: 10.4, 1940: 12.2, 1950: 8.1, 1960: 8.2, 1970: 7.8, 1980: 7.9, 1990: 10.1, 2000: 8.0, 2010: 13.3, 2020: 16.9 };
