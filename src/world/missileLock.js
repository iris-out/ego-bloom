import { toWorld } from './weapons.js';

/** 전투기 미사일의 적기 포착이다. Three, React, DOM 에 기대지 않는 순수 모듈이라
 * 단위 테스트가 자세와 목표를 직접 넣는다. 그리는 쪽은 `ui/LockBox.jsx` 다.
 *
 * 사거리 안에서 기수 원뿔에 든 적기를 하나 잡고, 그 상태로 `time` 초를 버티면 락온이다.
 * 화면의 네모는 `progress` 를 그대로 읽어 좁아진다. 락온 뒤에 쏜 미사일만 유도된다.
 */
export const LOCK = Object.freeze({
  /** 포착을 시작하는 거리다. */
  range: 800,
  /** 한 번 잡은 목표를 놓는 거리다. 사거리와 같게 두면 경계에서 포착이 깜빡인다. */
  drop: 1040,
  /** 기수에서 이 각도 안쪽만 본다(rad). 약 24도다. */
  cone: 0.42,
  /** 이만큼 따라붙어야 락온된다. */
  time: 2,
});

const finite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** 기수가 가리키는 세계 방향이다. 모델의 전진은 -Z 이고 회전은 YXZ 다. */
export function noseOf(pose) {
  return toWorld(pose, [0, 0, -1]);
}

/** 자세에서 목표 하나까지의 거리와 기수에서 벌어진 각이다. */
export function bearingTo(pose, target) {
  const nose = noseOf(pose);
  const dx = finite(target?.x) - finite(pose?.x);
  const dy = finite(target?.y) - finite(pose?.y);
  const dz = finite(target?.z) - finite(pose?.z);
  const range = Math.hypot(dx, dy, dz);
  if (!(range > 1e-3)) return { range: 0, angle: 0 };
  const cos = (dx * nose.x + dy * nose.y + dz * nose.z) / range;
  return { range, angle: Math.acos(clamp(cos, -1, 1)) };
}

/** 지금 잡을 수 있는 적기다. 기수에 가장 가까운 것을 고른다. 없으면 null 이다. */
export function lockCandidate(pose, targets = []) {
  let best = null;
  for (const target of targets) {
    const { range, angle } = bearingTo(pose, target);
    if (!(range > 1e-3) || range > LOCK.range || angle > LOCK.cone) continue;
    if (!best || angle < best.angle) best = { target, range, angle };
  }
  return best;
}

export function createLock() {
  return { index: null, progress: 0, locked: false, range: 0, angle: 0, target: null };
}

/** 포착을 한 걸음 옮긴다. 잡고 있던 목표를 먼저 보므로 더 가까운 적기가 지나가도
 * 포착이 옮겨 가지 않는다. 원뿔을 벗어나거나 `drop` 밖으로 나가면 처음부터 다시 센다. */
export function stepLock(previous, { pose, targets = [], dt = 0 } = {}) {
  const step = clamp(finite(dt), 0, 0.05);
  const held = previous?.index ?? null;
  const holding = held == null ? null : targets.find((target) => target.index === held);
  if (holding) {
    const { range, angle } = bearingTo(pose, holding);
    if (range <= LOCK.drop && angle <= LOCK.cone) {
      const progress = Math.min(LOCK.time, finite(previous?.progress) + step);
      // 2초를 채워도 사거리 밖으로 벌어져 있으면 락온이 아니다. 가까워지면 그대로 걸린다.
      return { index: held, progress, locked: progress >= LOCK.time && range <= LOCK.range, range, angle, target: holding };
    }
  }
  // 여기까지 왔으면 잡고 있던 목표를 놓은 것이다. 새 목표는 진행도 0 부터 다시 센다.
  // 놓은 목표가 이번 걸음에 다시 잡히지는 않는다. 놓는 조건(drop, cone) 이 잡는 조건보다 느슨하다.
  const next = lockCandidate(pose, targets);
  if (!next) return createLock();
  return { index: next.target.index, progress: step, locked: false, range: next.range, angle: next.angle, target: next.target };
}

/** 네모가 좁아진 정도다. 0 이면 막 잡았고 1 이면 락온이다. */
export function lockProgress(lock) {
  return clamp(finite(lock?.progress) / LOCK.time, 0, 1);
}
