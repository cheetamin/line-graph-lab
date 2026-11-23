import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approxUnit, approxValue, koNum } from '../public/shared/topics.js';

test('점 찍기용 어림값: 큰 수는 눈금 한 칸 자리까지 반올림', () => {
  assert.equal(approxUnit(404639), 10000);
  assert.equal(approxUnit(35000), 0, '용돈처럼 10만보다 작은 수는 그대로');
  assert.equal(approxUnit(500), 0);
  assert.equal(approxValue(404639, 404639), 400000);
  assert.equal(approxValue(376453, 404639), 380000);
  assert.equal(koNum(400000), '40만');
  assert.equal(koNum(1250000), '125만');
  assert.equal(approxValue(37, 5), null);
});
