import test from 'node:test';
import assert from 'node:assert/strict';
import { NAME_MAX, PLANE_KEYS, creatorAlias, defaultName, displayName, sanitizeName, validPlane } from '../../src/world/identity.js';

test('닉네임에서 제어문자를 지우고 길이를 제한한다', () => {
  assert.equal(sanitizeName('  하늘   위  '), '하늘 위');
  assert.equal(sanitizeName('ego​bloom'), 'egobloom');
  assert.equal(sanitizeName('가'.repeat(40)).length, NAME_MAX);
  for (const bad of [null, undefined, 42, {}, '   ']) assert.equal(sanitizeName(bad), '');
});

test('빈 닉네임은 세션 아이디에서 만든 기본 이름으로 대체한다', () => {
  assert.equal(defaultName('9f3a-xyz'), 'Player 9F3A');
  assert.equal(defaultName(''), 'Player 0000');
  assert.equal(displayName('9f3a-xyz', '  '), 'Player 9F3A');
  assert.equal(displayName('9f3a-xyz', '하늘빛'), '하늘빛');
});

test('알 수 없는 기체 값은 기본 기체로 떨어진다', () => {
  for (const key of PLANE_KEYS) assert.equal(validPlane(key), key);
  for (const bad of ['ufo', null, 3]) assert.equal(validPlane(bad), 'jet');
});

test('미공개 이름은 순위로 만들고 같은 제작자는 늘 같은 번호다', () => {
  assert.equal(creatorAlias({ rank: 7, nickname: '아무개' }), '사용자 7');
  assert.equal(creatorAlias({ rank: 1.4 }), '사용자 1');
  // 순위가 없으면 id 로 만든다. 두 번 불러도 같은 값이다.
  const first = creatorAlias({ id: 'abc-123' });
  assert.equal(first, creatorAlias({ id: 'abc-123' }));
  assert.match(first, /^사용자 \d+$/);
  assert.notEqual(first, creatorAlias({ id: 'abc-124' }));
  assert.match(creatorAlias({}), /^사용자 \d+$/);
});
