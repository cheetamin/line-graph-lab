// 1차 기상자료 탐험실: 기상자료개방포털의 폭염일수 자료가 잠시 내려간 동안 쓰는 '기사·보도자료' 출처
// 값은 학생이 직접 찾아 적어요(여기에는 링크와 찾는 곳만 둬요).
export const ARTICLE_SOURCES = [
  {
    title: '기상청 보도자료 「2024년 여름철 기후분석 결과」',
    date: '2024. 9. 5.',
    url: 'https://www.kma.go.kr/kma/flexer/html/press/2024/09/05/ATC202409051216232_55db3886-6a11-4c3b-b2a3-d2d22c9ed6ff.hwp.files/Sections1.html',
    find: '맨 아래 [붙임 10. 연·월별 전국 평균 폭염 일수] 표에서 「여름철」 칸 → 2015~2024년',
  },
  {
    title: '경향신문 「평균기온 역대 1위·극한호우·가뭄… 가장 뜨겁고 요란했던 2025년 여름」',
    date: '2025. 9. 4.',
    url: 'https://www.khan.co.kr/article/202509041330001',
    find: '기사 본문의 "전국 폭염일수는 ○○일" 문장 → 2025년',
  },
  {
    title: '기상청 보도자료 「2026년 여름철 기후특성」',
    date: '2026. 9. 3.',
    url: 'https://www.kma.go.kr/kma/flexer/html/press/2026/09/03/ATC202609031517582_d773a312-c6eb-45b3-8904-4e32dcbe8ce8.hwp.files/Sections1.html',
    find: '본문에서 「폭염일수」를 찾아요(Ctrl+F) → 2026년',
  },
];
export const ARTICLE_SOURCE_NAME = '기상청 보도자료·신문 기사';
