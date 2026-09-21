/** 계기 눈금판의 좌표 계산이다. Three 와 React, 캔버스에 의존하지 않아 단위 테스트가 그대로 읽는다.
 *
 * 눈금판 그림과 바늘이 같은 식을 써야 바늘이 가리키는 자리와 숫자가 어긋나지 않는다.
 * 바늘은 mesh 라 3D 각 A = sweep/2 - ratio * sweep 로 돌고, 방향은 (-sin A, cos A) 다.
 * 캔버스는 y 가 아래로 커지므로 같은 점이 (centre - sin A * r, centre - cos A * r) 이고,
 * 이것을 캔버스 각으로 풀면 a = -A - pi/2 다. dialFaceAngle 이 그 값을 준다. */

/** 7시에서 5시까지 240도다. parts.jsx 의 Dial sweep 기본값과 같은 값이다. */
export const DIAL_SWEEP = 4.19;

/** 눈금판 캔버스 한 장의 픽셀 표다. 반지름은 전부 중심에서 잰 값이다.
 * 256 에서는 반지름 0.06 짜리 계기의 숫자가 화면에서 한두 픽셀로 뭉갰다. 320 으로 올리고
 * 숫자 반지름을 0.30 에서 0.34 배로 안쪽으로 당겨 글자 칸을 넓혔다. */
export const DIAL_FACE = Object.freeze({
  size: 320, centre: 160, disc: 150, bezel: 146,
  tickOuter: 142, tickMajor: 116, tickMinor: 130, arc: 128, number: 96,
});

/** 눈금판 안에서 라벨과 단위를 적는 y 다. 중심에서 아래로 내려간 픽셀 수라 size 가 바뀌면
 * 함께 따라간다. 바늘 허브가 중심을 덮으므로 그 아래에 적는다. */
export const DIAL_TEXT = Object.freeze({ label: 74, unit: 103 });

/** 숫자를 몇 칸마다 적을지다. 칸이 아홉을 넘으면 한 칸 걸러 적어 글자를 키운다.
 * 사이 칸은 주 눈금만 남아 눈금 자체는 그대로 읽힌다. */
export function dialNumberStride(count) {
  if (count <= 9) return 1;
  return count % 2 === 1 ? 2 : 1;
}

/** 비율 하나가 도는 3D 각이다. 0 이 7시, 1 이 5시다. */
export const dialAngle = (ratio, sweep = DIAL_SWEEP) => sweep / 2 - ratio * sweep;

/** 같은 비율의 캔버스 각이다. ctx.arc 에 그대로 넣는다. */
export const dialFaceAngle = (ratio, sweep = DIAL_SWEEP) => -dialAngle(ratio, sweep) - Math.PI / 2;

/** 비율과 반지름으로 캔버스 위 점을 구한다. */
export function dialFacePoint(ratio, radius, sweep = DIAL_SWEEP) {
  const angle = dialFaceAngle(ratio, sweep);
  return [DIAL_FACE.centre + Math.cos(angle) * radius, DIAL_FACE.centre + Math.sin(angle) * radius];
}

/** 눈금판에 적을 숫자다. 배열이면 그대로 쓰고 개수만 주면 0 에서 max 까지 고르게 나눈다. */
export function dialFaceNumbers(numbers, max) {
  if (Array.isArray(numbers)) return numbers.map(Number).filter(Number.isFinite);
  const count = Math.max(2, Math.round(Number(numbers) || 0));
  const top = Number(max) || 1;
  return Array.from({ length: count }, (_, index) => (top * index) / (count - 1));
}

/** 숫자를 적을 글자 크기다. 칸이 좁으면 줄인다. 13칸짜리 속도계도 겹치지 않아야 읽힌다.
 * stride 로 건너뛴 칸만큼 간격이 넓어지므로 그만큼 글자를 키운다. 하한 16 은 320 캔버스가
 * 화면에서 반지름 0.06 으로 줄어도 획이 남는 크기다. */
export function dialNumberSize(count, digits, sweep = DIAL_SWEEP, stride = 1) {
  const spacing = (DIAL_FACE.number * sweep * Math.max(1, stride)) / Math.max(1, count - 1);
  // monospace 글자 하나가 크기의 0.6 배 폭이라 digits 자리 숫자의 폭은 size * digits * 0.6 이다.
  // 계수 1.5 는 그 폭이 칸 간격의 0.9 배를 넘지 않게 잡은 값이다. 1.7 이면 세 자리 숫자가 붙는다.
  return Math.max(16, Math.min(38, Math.floor((spacing * 1.5) / Math.max(1, digits))));
}
