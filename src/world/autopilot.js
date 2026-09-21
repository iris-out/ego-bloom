/** 자동 비행. 순수 함수이며 조종 입력만 만들어 낸다.
 * 도시 외곽을 한 바퀴 돈 뒤 활주로에 정렬해 내려앉고 브레이크로 멈춘다.
 * 헬기는 더 좁은 궤도를 낮게 돌다가 활주로 위에서 수직으로 내린다.
 */
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value)));
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

export const CRUISE_ALTITUDE = 190;
export const ROTOR_ALTITUDE = 90;
const GATE_Z = 420;

export function createAutopilot() {
  return { mode: 'depart', elapsed: 0, turned: 0, angle: null, goAround: false };
}

function ringHeading(state, ring) {
  const angle = Math.atan2(finite(state.z), finite(state.x));
  const radius = Math.hypot(finite(state.x), finite(state.z)) || 1;
  // 접선 방향에 반지름 오차 보정을 섞어 원 궤도로 되돌아온다.
  const pull = clamp((ring - radius) / 260, -0.9, 0.9);
  const dx = -Math.sin(angle) + Math.cos(angle) * pull;
  const dz = Math.cos(angle) + Math.sin(angle) * pull;
  return Math.atan2(-dx, -dz);
}

const towardHeading = (state, target) => Math.atan2(-(target.x - finite(state.x)), -(target.z - finite(state.z)));

function steer(state, desired, gain = 1.5) {
  return clamp(-wrap(desired - finite(state.heading)) * gain, -1, 1);
}

function holdAltitude(state, target, gain = 0.012) {
  return clamp((target - finite(state.y)) * gain - finite(state.climb) * 0.045, -1, 1);
}

export function stepAutopilot(previous, state, { extent = 180, dt = 0, rotor = false } = {}) {
  const ap = { ...previous, elapsed: finite(previous.elapsed) + Math.max(0, finite(dt)) };
  if (!state || state.phase === 'crashed') return { ap: createAutopilot(), input: { throttle: 0, pitch: 0, roll: 0, yaw: 0, brake: false } };

  const ring = finite(extent, 180) + (rotor ? 200 : 340);
  const lap = Math.PI * 2 * (rotor ? 0.7 : 1.15);
  const runwayX = finite(extent, 180) + 110;
  const cruise = rotor ? ROTOR_ALTITUDE : CRUISE_ALTITUDE;
  const angle = Math.atan2(finite(state.z), finite(state.x));
  if (ap.mode === 'cruise' && ap.angle !== null) ap.turned = finite(ap.turned) + Math.abs(wrap(angle - ap.angle));
  ap.angle = angle;

  if (ap.mode === 'depart') {
    if (state.phase === 'airborne' && finite(state.y) > cruise * 0.55) { ap.mode = 'cruise'; ap.turned = 0; }
    const desired = ringHeading(state, ring);
    return { ap, input: rotor
      ? { throttle: 0.9, pitch: finite(state.y) > 24 ? 0.6 : 0, roll: steer(state, desired, 1.1), yaw: 0, brake: false }
      : { throttle: 1, pitch: state.phase === 'runway' ? 1 : clamp(holdAltitude(state, cruise) + 0.35, -1, 1),
          roll: state.phase === 'runway' ? 0 : steer(state, desired), yaw: 0, brake: false } };
  }

  if (ap.mode === 'cruise') {
    if (ap.turned >= lap) { ap.mode = 'approach'; ap.goAround = false; }
    const desired = ringHeading(state, ring);
    return { ap, input: rotor
      ? { throttle: clamp(0.55 + holdAltitude(state, cruise) * 0.35, 0, 1), pitch: 0.75, roll: steer(state, desired, 1.1), yaw: 0, brake: false }
      : { throttle: 0.72, pitch: holdAltitude(state, cruise), roll: steer(state, desired), yaw: 0, brake: false } };
  }

  if (ap.mode === 'approach') {
    // 헬기는 활주로 위로 곧장 가서 그 자리에 선다. 고정익만 진입점을 돌아 정렬한다.
    if (rotor) {
      const target = { x: runwayX, z: 60 };
      const range = Math.hypot(finite(state.x) - target.x, finite(state.z) - target.z);
      if (range < 26) ap.mode = 'land';
      return { ap, input: { throttle: clamp(0.55 + holdAltitude(state, 34) * 0.35, 0, 1),
        pitch: clamp(range / 120, 0.1, 0.7), roll: steer(state, towardHeading(state, target), 1.1), yaw: 0, brake: false } };
    }
    if (finite(state.z) < -150) ap.goAround = true;
    if (ap.goAround && finite(state.z) > 340) ap.goAround = false;
    // 활주로 옆으로 벗어나 있으면 아직 내려가지 않는다. 터미널과 관제탑이 서쪽에 있다.
    const lateral = Math.abs(finite(state.x) - runwayX);
    const southbound = Math.abs(wrap(finite(state.heading))) < 0.7;
    const onCenter = lateral < 45 && southbound;
    const aligned = !ap.goAround && onCenter && finite(state.z) < GATE_Z;
    // 정렬 뒤에는 140 앞의 중심선 점을 겨냥한다. 좌우 오차가 그대로 기수 보정이 된다.
    // 정렬 전에는 연장 중심선의 먼 북쪽 점을 겨냥해 긴 최종 진입로를 만든다.
    const target = ap.goAround ? { x: runwayX + 240, z: GATE_Z + 220 }
      : aligned ? { x: runwayX, z: finite(state.z) - 140 }
      : onCenter ? { x: runwayX, z: finite(state.z) - 200 }
      : { x: runwayX, z: GATE_Z + 420 };
    // 완만한 활강 경사다. z 120 근처를 접지점으로 잡고 멀리서부터 고도를 버린다.
    const glide = ap.goAround ? cruise * 0.7 : aligned ? clamp(3 + (finite(state.z) - 120) * 0.11, 3, cruise) : 95;
    const fast = finite(state.speed) > 46;
    if (state.phase === 'runway') ap.mode = 'stop';
    // 중심선에 10 안쪽으로 붙기 전에는 접지 제어로 넘기지 않는다. 옆으로 어긋난 채 닿으면 활주로를 벗어난다.
    else if (aligned && lateral < 10 && finite(state.y) < 45 && finite(state.z) < 360) ap.mode = 'land';
    return { ap, input: { throttle: ap.goAround ? 0.85 : aligned ? (fast ? 0.04 : 0.35) : 0.38,
      pitch: holdAltitude(state, glide, 0.024), roll: steer(state, towardHeading(state, target), 1.3), yaw: 0, brake: false } };
  }

  if (ap.mode === 'land') {
    if (state.phase === 'runway') ap.mode = 'stop';
    else if (!rotor && finite(state.z) < -200) { ap.mode = 'approach'; ap.goAround = true; }
    const desired = towardHeading(state, { x: runwayX, z: finite(state.z) - 90 });
    return { ap, input: rotor
      ? { throttle: clamp(0.42 + holdAltitude(state, 2) * 0.3, 0, 1), pitch: 0, roll: steer(state, desired, 0.8), yaw: 0, brake: false }
      : { throttle: finite(state.speed) > 44 ? 0.03 : 0.28, pitch: clamp(holdAltitude(state, 2.5, 0.03) - 0.08, -0.5, 0.22), roll: steer(state, desired, 1.2), yaw: 0, brake: false } };
  }

  // stop: 스로틀을 끊고 브레이크를 잡되, 멈출 때까지 앞바퀴로 중심선을 따라간다.
  const rollOut = towardHeading(state, { x: runwayX, z: finite(state.z) - 60 });
  return { ap, input: { throttle: 0, pitch: 0, roll: steer(state, rollOut, 0.9), yaw: 0, brake: true } };
}
