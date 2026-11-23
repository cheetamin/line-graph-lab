// 제4장 꺾은선그래프 그리기 (연구 주제)
import { S } from '../store.js?v=mwswvbuq';
import { topicById } from '../../shared/topics.js?v=mwswvbuq';
import { graphSpread, celebrate } from './graphwork.js?v=mwswvbuq';
import { myDone } from './student.js?v=mwswvbuq';

export function spreads(app) {
  const d = S.data; const s = d.cls.settings;
  const t = topicById(d.gates.research);
  const months = []; for (let m = s.monthFrom; m <= s.monthTo; m++) months.push(m);
  const tv = d.state.tables?.[t.id]?.values || [];
  return [graphSpread(app, {
    kind: 'topic', topicId: t.id,
    labels: months.map((m) => `${m}월`),
    values: months.map((_, i) => (tv[i] === '' || tv[i] === undefined ? null : Number(tv[i]))),
    unit: t.unit, xUnit: '월',
    heading: { kicker: '2차 활동 ④ · 직접 그리기', title: t.name },
    intro: '완성한 자료표를 보고 모눈종이에 직접 꺾은선그래프를 그려요.',
    submitText: s.topicMode === 'own' ? `확인을 통과하면 제출해요. 꼭 ${s.minWorks}개를 내고, 시간이 남으면 다른 주제로 더 만들 수 있어요.` : null,
    onSubmitted: async () => {
      await app.reload(false);
      if (s.topicMode === 'own') {
        const n = myDone().length; const need = s.minWorks;
        await celebrate(`${n}번째 작품을 제출했어요!`, n < need ? `꼭 내야 하는 작품은 ${need}개예요. 이제 ${need - n}개 남았어요. 다른 주제를 골라 또 만들어 볼까요?` : `꼭 낼 ${need}개를 모두 냈어요! 시간이 남으면 다른 주제로 더 만들어도 좋아요.`);
        app.go('topics', 0, 'jump');
        return;
      }
      await celebrate('작품을 제출했어요!', '선생님이 확인하고 승인하면 작품 전시관에 걸려요. 그동안 친구들의 작품을 감상해 볼까요?');
      app.go('gallery', 0, 'next');
    },
  })];
}
