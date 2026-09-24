import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLAYER_PLANE, NAME_MAX, PLANE_KEYS, SELECTABLE_PLANE_KEYS, creatorAlias, defaultName, displayName, loadIdentity, sanitizeName, saveIdentity, validPlane, validSelectablePlane } from '../../src/world/identity.js';

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

test('씬 모델 키와 플레이어 선택 키는 라이트 제트만 다르다', () => {
  assert.equal(DEFAULT_PLAYER_PLANE, 'fighter');
  assert.deepEqual(SELECTABLE_PLANE_KEYS, PLANE_KEYS.filter(key => key !== 'jet'));
  for (const key of PLANE_KEYS) assert.equal(validPlane(key), key);
  for (const bad of ['ufo', null, 3]) assert.equal(validPlane(bad), 'jet');
  for (const key of SELECTABLE_PLANE_KEYS) assert.equal(validSelectablePlane(key), key);
  for (const bad of ['jet', 'ufo', null, 3]) assert.equal(validSelectablePlane(bad), 'fighter');
});

test('저장된 라이트 제트는 전투기로 마이그레이션하고 다른 설정을 지킨다', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const entries = new Map([['eb-world-pilot', JSON.stringify({ name: '테스트 파일럿', plane: 'jet', vehicle: 'suv' })]]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  } });
  try {
    assert.deepEqual(loadIdentity(), { name: '테스트 파일럿', plane: 'fighter', vehicle: 'suv' });
    assert.deepEqual(JSON.parse(entries.get('eb-world-pilot')), { name: '테스트 파일럿', plane: 'fighter', vehicle: 'suv' });
    assert.equal(saveIdentity({ name: '다음 파일럿', plane: 'jet', vehicle: 'sedan' }).plane, 'fighter');
    entries.delete('eb-world-pilot');
    assert.equal(loadIdentity().plane, 'fighter', '새 프로필도 전투기로 시작한다');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
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
