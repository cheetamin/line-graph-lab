// 제4장 꺾은선그래프 그리기 (연구 주제)
import { S } from '../store.js';
import { topicById } from '../../shared/topics.js';
import { graphSpread, celebrate } from './graphwork.js';

export function spreads(app) {
  const d = S.data; const s = d.cls.settings;
  const t = topicById(d.gates.research);
  const months = []; for (let m = s.monthFrom; m <= s.monthTo; m++) months.push(m);
  const tv = d.state.tables?.[t.id]?.values || [];
  return [graphSpread(app, {
    kind: 'topic',
    labels: months.map((m) => `${m}월`),
    values: months.map((_, i) => (tv[i] === '' || tv[i] === undefined ? null : Number(tv[i]))),
    unit: t.unit, xUnit: '월',
    heading: { kicker: '제4장 · 직접 그리기', title: t.name },
    intro: '완성한 자료표를 보고 모눈종이에 직접 꺾은선그래프를 그려요.',
    onSubmitted: async () => {
      await app.reload(false);
      await celebrate('작품을 제출했어요!', '선생님이 확인하고 승인하면 작품 전시관에 걸려요. 그동안 친구들의 작품을 감상해 볼까요?');
      app.go('gallery', 0, 'next');
    },
  })];
}
