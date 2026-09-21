/** Ocean visual source: water Y=-2.8, island/airport shelves below land.
 * Airport center tracks extent+110; update models/Airport and flight/map bounds
 * together if moving it. Fish orbit beyond square-island corners (sqrt(2)).
 * Animate instance matrices; do not allocate a separate mesh for every fish.
 */
import { memo, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { applySurfaceShader } from './shaders/surfaces';
import Boat from './models/Boat';
import StaticBatch from './StaticBatch';
import { freezeStatic } from './cityTiles.js';
import { riverCenter, riverHalf } from '../../shared/river.js';
import { AIRPORT_GROUND, CAUSEWAY } from './models/airportLayout.js';

/** 바다 판의 한 변이다. 도시 한가운데에서 봐도 안개 끝까지 물이 이어진다. */
const SEA_SIZE = 6000;
/** 섬과 공항 선반 윗면은 물보다 높아 그 아래 수면은 보이지 않는다. 구멍 가장자리를 선반 옆면보다
 * 이만큼 안으로 들여 물과 선반이 만나는 선에 틈이 생기지 않게 한다. */
const SHELF_OVERLAP = 6;

/** UrbanScenery 의 도시 바닥 상자는 반폭 extent+35, 윗면 0, 밑면 -4 다. 그 안에 든 선반 면은 보이지 않는다. */
const GROUND_REACH = 35;

function Shelf({ position, scale, color }) {
  return <mesh position={position} scale={scale} receiveShadow><boxGeometry /><meshStandardMaterial color={color} roughness={1} /></mesh>;
}

/** 섬 선반(반폭 extent+42, 윗면 -2.2) 은 도시 바닥 상자 밖으로 나온 테두리만 보인다. 통짜 상자면
 * 윗면이 도시 밑 전체에 깔려 지상 시점마다 화면 아래를 한 번 더 칠한다. 같은 모양의 테두리 넷만 둔다.
 * 안쪽 끝은 바닥 상자 안으로 1 만큼 넣어 틈이 보이지 않게 한다. */
function IslandRim({ extent, color }) {
  const outer = extent + 42, inner = extent + GROUND_REACH - 1, band = outer - inner, middle = (outer + inner) / 2;
  return <>
    {[-1, 1].map((side) => <Shelf key={`z${side}`} position={[0, -3, side * middle]} scale={[outer * 2, 1.6, band]} color={color} />)}
    {[-1, 1].map((side) => <Shelf key={`x${side}`} position={[side * middle, -3, 0]} scale={[band, 1.6, inner * 2]} color={color} />)}
  </>;
}

/** 섬과 두 공항이 덮는 자리를 뺀 수면이다. 로그 깊이 버퍼는 early-Z 를 막아 가려진 수면도
 * 물결 셰이더를 다 돌린다. 도시 밑까지 깔면 지상 시점마다 화면 아래 절반을 한 번 더 칠한다.
 * 섬이 바다 판보다 크면(제작자 1000명이면 섬 반폭 3275) 보이는 수면이 없으므로 null 이다. */
function seaShape(extent) {
  const half = SEA_SIZE / 2;
  const island = extent + 42 - SHELF_OVERLAP;
  if (island >= half - 1) return null;
  // 공항 선반은 활주로 중심에서 서쪽 AIRPORT_GROUND.west+8.5, 동쪽 east+8.5 까지다. 섬과 겹치는 부분은 섬 구멍에 맡긴다.
  // 구멍이 바깥 윤곽에 닿으면 삼각분할이 깨지므로 판 가장자리 안쪽에서 멈춘다.
  const airport = Math.min(extent + 110 + AIRPORT_GROUND.east + 8.5 - SHELF_OVERLAP, half - 1);
  const reach = Math.min(389 - SHELF_OVERLAP, island - 1);
  const outline = new THREE.Shape([
    new THREE.Vector2(-half, -half), new THREE.Vector2(half, -half), new THREE.Vector2(half, half), new THREE.Vector2(-half, half),
  ]);
  // 섬 사각형 좌우에 공항 직사각형을 붙인 십자 모양 구멍이다. 구멍끼리 겹치면 삼각분할이 깨지므로 윤곽 하나로 만든다.
  outline.holes.push(new THREE.Path([
    [-island, -island], [-island, -reach], [-airport, -reach], [-airport, reach], [-island, reach], [-island, island],
    [island, island], [island, reach], [airport, reach], [airport, -reach], [island, -reach], [island, -island],
  ].map(([x, y]) => new THREE.Vector2(x, y))));
  return new THREE.ShapeGeometry(outline);
}

function Ocean({ extent, quality, timeOfDay }) {
  const bodies = useRef(), tails = useRef(), fins = useRef(), still = useRef();
  const fishCount = { low: 18, medium: 36, high: 60 }[quality], count = fishCount + 4;
  const transform = useMemo(() => new THREE.Object3D(), []);
  const waterSurface=useMemo(()=>{
    const material=new THREE.MeshStandardMaterial({roughness:.34,metalness:.16});
    return {material,time:applySurfaceShader(material,'water')};
  },[]);
  const sea = useMemo(() => seaShape(extent), [extent]);
  useEffect(()=>()=>waterSurface.material.dispose(),[waterSurface]);
  useEffect(() => () => sea?.dispose(), [sea]);
  useEffect(()=>{waterSurface.material.color.set(timeOfDay==='night'?'#193647':timeOfDay==='day'?'#397e94':'#416d7e');},[waterSurface,timeOfDay]);
  // 선반과 수면은 움직이지 않는다. 물고기 mesh 도 인스턴스 행렬만 바뀌고 자기 행렬은 그대로다.
  useLayoutEffect(() => { freezeStatic(still.current); }, [extent, quality, timeOfDay]);
  useFrame(({ clock }) => {
    // Three shader uniforms are intentionally mutable frame state.
    // eslint-disable-next-line react-hooks/immutability
    waterSurface.time.value=clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const shark = i >= fishCount, school = shark ? i - fishCount + 4 : Math.floor(i / 6);
      const radius = extent * Math.SQRT2 + 230 + school * 24 + (i % 6) * 3;
      const angle = school * 1.42 + clock.elapsedTime * (shark ? 0.013 : 0.021) + (i % 6) * 0.018;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      const heading = -angle;
      transform.position.set(x, -2.62, z); transform.rotation.set(0, heading, 0);
      transform.scale.set(shark ? 2.4 : 0.85, shark ? 0.48 : 0.17, shark ? 7 : 2.1);
      transform.updateMatrix(); bodies.current.setMatrixAt(i, transform.matrix);
      const tailDistance = shark ? 6.6 : 2;
      transform.position.set(x - Math.sin(heading) * tailDistance, -2.55, z - Math.cos(heading) * tailDistance);
      transform.rotation.set(0, heading + Math.sin(clock.elapsedTime * 4 + i) * 0.22, 0);
      transform.scale.set(shark ? 3.4 : 1.35, 0.15, shark ? 2.1 : 0.8);
      transform.updateMatrix(); tails.current.setMatrixAt(i, transform.matrix);
      transform.position.set(x, shark ? -1.6 : -2.55, z); transform.rotation.set(0, heading, 0);
      transform.scale.set(shark ? 1.15 : 0.01, shark ? 2.6 : 0.01, shark ? 2.9 : 0.01);
      transform.updateMatrix(); fins.current.setMatrixAt(i, transform.matrix);
    }
    bodies.current.instanceMatrix.needsUpdate = true; tails.current.instanceMatrix.needsUpdate = true; fins.current.instanceMatrix.needsUpdate = true;
  });
  const water = timeOfDay === 'night' ? '#254957' : '#6eaebc';
  return <>
    <group ref={still}>
      {sea && <mesh geometry={sea} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.8, 0]} receiveShadow dispose={null}>
        <primitive object={waterSurface.material} attach="material" dispose={null}/>
      </mesh>}
      {/* 선반은 색이 같은 것끼리 한 mesh 로 합친다. 물 색은 시간대마다 바뀌므로 그때 다시 합친다. */}
      <StaticBatch version={`${extent}:${water}`}>
        {/* 도시 바닥 상자 안에 통째로 드는 선반은 두지 않는다. 보이지 않고 화면만 한 번 더 칠한다. */}
        <IslandRim extent={extent} color="#929f97" />
        {[1, -1].map((side) => <group key={`airport${side}`}>
          {/* 공항 땅은 서쪽으로 길다(airportLayout.AIRPORT_GROUND). 진입등이 서는 활주로 너머까지 선반을 늘린다. */}
          <Shelf position={[side * (extent + 110 + (AIRPORT_GROUND.east - AIRPORT_GROUND.west) / 2), -2.3, 0]} scale={[AIRPORT_GROUND.west + AIRPORT_GROUND.east + 17, 1.2, 778]} color="#c9cbb0" />
          <Shelf position={[side * (extent + 110 + (AIRPORT_GROUND.east - AIRPORT_GROUND.west) / 2), -3, 0]} scale={[AIRPORT_GROUND.west + AIRPORT_GROUND.east + 32, 1.2, 793]} color="#929f97" />
          {/* 동쪽 둑만 공항로를 받친다. 서쪽은 해변과 강 하구가 있어 도로가 없다. */}
          {side > 0 && <Shelf position={[extent + (CAUSEWAY.x0 + CAUSEWAY.x1) / 2, -2.25, CAUSEWAY.z]} scale={[CAUSEWAY.x1 - CAUSEWAY.x0, 1.2, CAUSEWAY.halfWidth * 2]} color="#cfceb2" />}
        </group>)}
        {/* 강이 지도 끝에서 바다로 이어지는 자리다. 중심선이 굽어 있어 양끝의 z 와 폭이 다르다. */}
        {[-1, 1].map((side) => {
          const mouthZ = riverCenter(extent, side * extent), mouthWidth = riverHalf(extent, side * extent) * 2;
          return <group key={side}>
            <Shelf position={[side * (extent + 23), -1.15, mouthZ]} scale={[42, 0.2, mouthWidth]} color={water} />
            <Shelf position={[side * (extent + 43), -2.02, mouthZ]} scale={[0.4, 1.7, mouthWidth]} color={water} />
          </group>;
        })}
      </StaticBatch>
      <instancedMesh ref={bodies} args={[null, null, count]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 6]} /><meshStandardMaterial color="#376c79" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={tails} args={[null, null, count]} frustumCulled={false}>
        <coneGeometry args={[1, 1, 3]} /><meshStandardMaterial color="#417783" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={fins} args={[null, null, count]} frustumCulled={false}>
        <coneGeometry args={[1, 1, 3]} /><meshStandardMaterial color="#536d73" roughness={0.7} />
      </instancedMesh>
    </group>
    <Boat extent={extent} quality={quality} />
  </>;
}

export default memo(Ocean);
