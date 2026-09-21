/** 도시 공용 primitive 의 세그먼트 수와 삼각형 수를 모아 둔 표.
 * WorldScene.useResources 가 geometry 를 만들 때와 테스트가 예산을 셀 때 같은 값을 읽는다.
 * segments 를 바꾸면 triangles 도 같이 고친다. 값은 three r182 의 실제 index 수와 맞춘다.
 */
export const SHAPES = Object.freeze({
  gable: { triangles: 8 },
  box: { triangles: 12 },
  pane: { triangles: 2 },
  // 팔각 실루엣은 다이아몬드 티어의 정체성이라 8 을 유지한다.
  octagon: { radial: 8, triangles: 32 },
  spire: { radial: 5, triangles: 10 },
  tree: { detail: 0, triangles: 20 },
  trunk: { radial: 5, triangles: 20 },
  hill: { radial: 8, height: 5, triangles: 64 },
  cylinder: { radial: 10, triangles: 40 },
  cone: { radial: 8, triangles: 16 },
  pyramid: { radial: 4, triangles: 8 },
  dome: { radial: 10, height: 5, triangles: 90 },
});

export const shapeTriangles = (shape) => SHAPES[shape]?.triangles ?? SHAPES.box.triangles;

/** 재질의 기본색. useResources 가 material 을 만들 때와 먼 단계에서 재질을 합칠 때 같은 값을 읽는다. */
export const PALETTE = Object.freeze({
  stone: '#e8e3d6', brick: '#ad7760', sand: '#dbcdab', violet: '#777d99',
  roof: '#647a78', dark: '#45545a', pavement: '#aaa99f', road: '#42494d',
  marking: '#e9e2c5', water: '#73b8c4', bank: '#b7c5b1', ground: '#a8bc9a',
  green: '#769d72', leaf: '#88ae74', wood: '#9b7c56', accent: '#ffffff',
  glass: '#6b939e', blueglass: '#88b5cd', lamp: '#ffecb2', car: '#ffffff', pick: '#ffffff',
  tint: '#587589', steel: '#c9ced3',
  // accent 와 같은 흰 바탕이라 인스턴스 색(간판 금색)이 낮에 그대로 보인다.
  // accent 는 도시 전역의 트림에 두루 쓰이므로 야간 발광을 따로 줄 재질을 나눴다.
  sign: '#ffffff', shopfront: '#ffffff',
  // 차선 도색과 차량 등화다. marking 은 흰 차선이고 centerline 은 중앙선이다.
  centerline: '#e8c34a', tail: '#d94f3d', head: '#fff3d5',
  // 가로등이 바닥에 떨구는 빛 웅덩이다. emissive 는 주변을 비추지 못하므로
  // 실제 광원 대신 반투명 원판을 깔아 조명 느낌을 만든다.
  glow: '#ffdca8',
});

/** 먼 단계에서 합칠 재질. 색은 인스턴스별로 그대로 실어 보내므로 화면 색은 유지되고
 * 거칠기와 금속감만 대표 재질을 따른다. 조합이 줄어든 만큼 타일당 draw call 이 줄어든다.
 */
export const FAR_MATERIAL = Object.freeze({
  brick: 'stone', sand: 'stone', violet: 'stone', roof: 'stone', bank: 'stone',
  steel: 'stone', pavement: 'stone', ground: 'stone', car: 'stone',
  blueglass: 'glass', tint: 'glass', marking: 'dark', centerline: 'dark', tail: 'accent', head: 'accent',
  leaf: 'green', wood: 'green', lamp: 'accent', glow: 'accent', sign: 'accent', shopfront: 'accent',
});

/** batches 는 createBatches() 의 map 이거나 tileBatches() 의 배열이다. */
export function countTriangles(batches) {
  const list = Array.isArray(batches) ? batches : Object.values(batches || {});
  return list.reduce((sum, batch) => sum + batch.parts.length * shapeTriangles(batch.shape), 0);
}

export function countInstances(batches) {
  const list = Array.isArray(batches) ? batches : Object.values(batches || {});
  return list.reduce((sum, batch) => sum + batch.parts.length, 0);
}
