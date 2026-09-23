/** Distance to an approximate building volume, not just its rooftop point. */
export function creatorDistance(position,building) {
 if(!position)return Infinity;
 const dx=Math.max(0,Math.abs(position.x-building.x)-10),dz=Math.max(0,Math.abs(position.z-building.z)-10);
 const dy=Math.max(0,position.y-building.height,-position.y);
 return Math.hypot(dx,dy,dz);
}
/** 비행 중에는 두 배 멀리서도 보인다. 시속 300 으로 지나가면 185 는 순식간이다. */
export const CARD_REACH={ ground:{ full:185, fade:135 }, flight:{ full:370, fade:270 } };

export function creatorCardOpacity(distance, mode='ground') {
 const reach=CARD_REACH[mode]||CARD_REACH.ground;
 const t=Math.max(0,Math.min(1,(reach.full-distance)/reach.fade));
 return t*t*(3-2*t);
}

/** 제작자 라벨을 후보로 잡는 최대 거리다. 높은 건물은 멀리서도 보이므로 높이에 비례해 늘린다.
 * 주행은 도로를 빠르게 지나므로 탐색보다 멀리 잡는다. 260 이면 시속 100 에서 9초 만에 지나간다.
 * 비행은 높이를 더하지 않는다. 위에서 내려다보면 높이가 거리를 벌어 주지 않는다. */
export const LABEL_REACH = Object.freeze({
 explore: Object.freeze({ base: 260, perHeight: 4.2 }),
 drive: Object.freeze({ base: 360, perHeight: 5.2 }),
 flight: Object.freeze({ base: 400, perHeight: 0 }),
});

export function labelReach(mode = 'explore', height = 0) {
 const spec = LABEL_REACH[mode] || LABEL_REACH.explore;
 const tall = Number.isFinite(Number(height)) ? Number(height) : 0;
 return Math.max(spec.base, tall * spec.perHeight);
}

/** 주행 카메라가 고층 건물 밑에 있을 때 옥상 라벨은 화면 밖으로 사라진다.
 * 주행 중에는 눈높이보다 4m 위의 외벽 위치를 쓰고, 탐색은 기존 옥상 위치를 유지한다. */
export function creatorLabelAnchor(position, building, mode = 'explore', facadeOffset = 0) {
 let x = Number(building?.x) || 0, z = Number(building?.z) || 0;
 const height = Math.max(0, Number(building?.height) || 0);
 if (mode !== 'drive') return { x, y: height + 7, z };
 const eyeY = Number.isFinite(Number(position?.y)) ? Number(position.y) : 3;
 const offset = Math.max(0, Number(facadeOffset) || 0);
 if (position && offset > 0) {
  const dx = Number(position.x) - x, dz = Number(position.z) - z;
  if (Math.abs(dx) >= Math.abs(dz)) x += (Math.sign(dx) || 1) * offset;
  else z += (Math.sign(dz) || 1) * offset;
 }
 return { x, y: Math.min(height + 7, Math.max(7, eyeY + 4)), z };
}

/** 200px 주행 카드를 50m 안에서는 160px, 200m 밖에서는 120px로 표시한다. */
export function driveCardScale(distance) {
 const safeDistance = Number.isFinite(distance) ? distance : 50;
 if (safeDistance <= 50) return 0.8;
 if (safeDistance >= 200) return 0.6;
 const t = Math.max(0, Math.min(1, (safeDistance - 50) / 150));
 return 0.8 - 0.2 * t;
}

/** 화면 밖으로 조금 벗어난 주행 카드를 읽을 수 있는 가장자리 안쪽으로 놓는다. */
export function driveCardScreenPosition(projected, size) {
 const x = (projected.x + 1) * size.width / 2;
 const y = (1 - projected.y) * size.height / 2;
 const marginX = Math.min(100, size.width / 2);
 const marginY = Math.min(50, size.height / 2);
 return [
  Math.max(marginX, Math.min(size.width - marginX, x)),
  Math.max(marginY, Math.min(size.height - marginY, y)),
 ];
}

/** 탐색 라벨의 3D 크기 기준이다. 주행 라벨은 화면 픽셀 크기로 고정한다. */
export const LABEL_SCALE = Object.freeze({ explore: 55 });
