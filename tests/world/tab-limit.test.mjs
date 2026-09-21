import test from 'node:test';
import assert from 'node:assert/strict';
import { overTabLimit, TABS_PER_ORIGIN } from '../../src/world/multiplayer.js';

const meta = (origin, since) => [{ origin, since }];
const state = (entries) => Object.fromEntries(entries.map(([id, origin, since]) => [id, meta(origin, since)]));

test('한 회선에서 두 탭까지는 통과한다', () => {
  assert.equal(TABS_PER_ORIGIN, 2);
  const rooms = state([['a', 'ip1', 10], ['b', 'ip1', 20]]);
  assert.equal(overTabLimit(rooms, 'a'), false);
  assert.equal(overTabLimit(rooms, 'b'), false);
});

test('세 번째부터 막히고 먼저 들어온 쪽이 남는다', () => {
  const rooms = state([['a', 'ip1', 10], ['b', 'ip1', 20], ['c', 'ip1', 30]]);
  assert.equal(overTabLimit(rooms, 'a'), false);
  assert.equal(overTabLimit(rooms, 'b'), false);
  assert.equal(overTabLimit(rooms, 'c'), true);
});

test('다른 회선은 서로 세지 않는다', () => {
  const rooms = state([['a', 'ip1', 10], ['b', 'ip2', 20], ['c', 'ip2', 30], ['d', 'ip2', 40]]);
  assert.equal(overTabLimit(rooms, 'a'), false);
  assert.equal(overTabLimit(rooms, 'd'), true);
});

test('입장 시각이 같으면 세션 id 로 가른다. 모든 탭이 같은 답을 낸다', () => {
  const rooms = state([['c', 'ip1', 10], ['a', 'ip1', 10], ['b', 'ip1', 10]]);
  const blocked = ['a', 'b', 'c'].filter((id) => overTabLimit(rooms, id));
  assert.deepEqual(blocked, ['c']);
});

test('출처 키가 없으면 아무도 막지 않는다', () => {
  const rooms = state([['a', '', 10], ['b', '', 20], ['c', '', 30]]);
  for (const id of ['a', 'b', 'c']) assert.equal(overTabLimit(rooms, id), false);
});

test('목록에 없는 세션과 빈 상태는 막지 않는다', () => {
  assert.equal(overTabLimit(state([['a', 'ip1', 10]]), 'zz'), false);
  assert.equal(overTabLimit({}, 'a'), false);
  assert.equal(overTabLimit(undefined, 'a'), false);
});
