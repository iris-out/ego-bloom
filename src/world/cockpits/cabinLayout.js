import { eyePoint } from '../eyePoints.js';

/** 차량 실내 배치 헬퍼다. 세 실내 파일이 함께 쓴다. */

/** 눈 기준 상대 좌표다. 운전자 앞 조각(계기, 스티어링, 조준경) 에 쓴다. */
export function at(vehicle, offset) {
  const eye = eyePoint(vehicle) || [0, 0.62, 0];
  return [eye[0] + offset[0], eye[1] + offset[1], eye[2] + offset[2]];
}

/** 차체 중심 기준 좌표다. 좌우는 차체 x 그대로, 높이와 앞뒤만 눈에 맞춘다.
 * 대시보드, 기둥, 지붕, 장갑 벽처럼 실내 전체에 걸치는 조각에 쓴다. 눈 기준으로 두면
 * 운전석을 왼쪽으로 옮겨도 실내가 통째로 따라와 늘 한가운데 앉은 것처럼 보인다. */
export function cabin(vehicle, offset) {
  const eye = eyePoint(vehicle) || [0, 0.62, 0];
  return [offset[0], eye[1] + offset[1], eye[2] + offset[2]];
}
