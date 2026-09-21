import test from 'node:test';
import assert from 'node:assert/strict';
import { creatorDistance, creatorCardOpacity, labelReach, LABEL_REACH, LABEL_SCALE } from '../../src/world/creatorProximity.js';
test('flight creator cards fade smoothly with distance to the building, including tall facades',()=>{
 const b={x:0,z:0,height:180};
 assert.equal(creatorDistance({x:40,y:30,z:0},b),30);
 assert.equal(creatorCardOpacity(200),0);assert.equal(creatorCardOpacity(30),1);
 assert.ok(creatorCardOpacity(150)<creatorCardOpacity(100));
 assert.ok(creatorCardOpacity(100)<creatorCardOpacity(60));
 assert.equal(creatorDistance(null,b),Infinity);
});

test('주행 라벨은 탐색보다 멀리서 뜬다', () => {
  // 사용자가 도로를 달릴 때 카드가 너무 늦게 떴다. 주행 기준 거리를 따로 둔다.
  assert.ok(labelReach('drive', 0) > labelReach('explore', 0));
  assert.equal(labelReach('explore', 0), LABEL_REACH.explore.base);
  assert.equal(labelReach('drive', 0), LABEL_REACH.drive.base);
  // 높은 건물은 멀리서도 보이므로 높이에 비례해 더 늘어난다.
  assert.equal(labelReach('drive', 200), 200 * LABEL_REACH.drive.perHeight);
  assert.ok(labelReach('drive', 200) > labelReach('explore', 200));
  // 비행은 높이를 더하지 않는다.
  assert.equal(labelReach('flight', 500), LABEL_REACH.flight.base);
  // 모르는 모드는 탐색으로 떨어지고 높이가 이상해도 기준값을 지킨다.
  assert.equal(labelReach('nope', 0), LABEL_REACH.explore.base);
  assert.equal(labelReach('drive', Number.NaN), LABEL_REACH.drive.base);
});

test('주행 카드는 멀리서도 읽히게 더 크다', () => {
  assert.ok(LABEL_SCALE.drive > LABEL_SCALE.explore);
});
