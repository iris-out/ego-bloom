import { armamentOf } from '../hardpoints.js';
import { muzzleAim } from '../weapons.js';
import { helicopterGunPulse } from './helicopterGunMotion.js';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Block from './ModelBlock';
import { Shell, Airfoil, Duct } from './SurfaceParts.jsx';
import { DetailLamp, PanelSeam, SurfaceVent } from './exteriorDetails.jsx';
import StaticBatch from '../StaticBatch.jsx';

/** 헬리콥터 시각 모델. Jet 과 같은 축 규약을 따른다.
 * 로컬 원점은 동체 중심, +Y 위, 기수 -Z, 가로 X 다. 부모가 위치와 YXZ 자세를 준다.
 * 스키드 최하단은 정확히 -1.9 다. FLIGHT_GROUND=2.1 이 활주로 착지 높이를 맞춘다.
 * 전장 Z -6..9, 메인 로터 반지름 7, 전체 높이 y 4.5 를 넘기지 않는다. 비행 물리와 카메라가 이 크기를 전제한다.
 * 로터 회전은 이 컴포넌트가 직접 돌린다. 부모는 자세만 준다.
 * firstPerson 이면 노즈 캐노피, 글레어실드, 문, 동체 캐빈 몸통을 숨긴다. 3인칭 실루엣은 그대로다.
 */
const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;

const BODY = '#3f6b73';
const BODY_LIGHT = '#52818a';
const IVORY = '#e8e3d6';
const METAL = '#394649';
const GLASS = '#385c6d';
const STRUT = '#78898c';
const BLADE = '#2f373a';
const INTAKE = '#1d2427';
const EXHAUST = '#0f1214';

const MAIN_ROTOR_SPEED = 24;
const TAIL_ROTOR_SPEED = 58;
const MAX_STEP = 0.05;
const BLADE_DROOP = 0.035;
const MAIN_BLADES = [0, 1, 2, 3];
const TAIL_BLADES = [0, 1, 2];

/* 세로로 세운 압출 규약이다. shape 의 x 는 Z 축, y 는 Y 축, 두께는 X 로 가운데 정렬한다. */
function extrudeUpright(points, depth) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], index) => (index ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.rotateY(-HALF_PI);
  geometry.translate(depth / 2, 0, 0);
  return geometry;
}

function Lamp({ position, radius, color }) {
  return <mesh position={position}><sphereGeometry args={[radius, 8, 6]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} roughness={0.4} /></mesh>;
}

function MainBlade() {
  return <group rotation={[BLADE_DROOP, 0, 0]}>
    <Airfoil rotation={[0,-Math.PI/2,0]} color={BLADE} stations={[{x:.2,front:-.17,back:.17,thickness:.065},{x:5.8,front:-.17,back:.17,thickness:.045},{x:6.6,front:-.1,back:.17,thickness:.03}]}/>
    <Block position={[0, 0.005, 6.35]} scale={[0.35, 0.075, 0.5]} color={IVORY} />
  </group>;
}

/* 로컬 Y 가 회전축이다. 부모 group 이 Z 로 90도 돌려서 회전축을 월드 X 로 맞춘다. */
function TailBlade() {
  return <Block position={[0, 0, 0.62]} scale={[0.2, 0.04, 1.1]} color={BLADE} />;
}

/** Each gun is authored backward from the shared muzzle, so effects/projectiles
 * and physical barrel openings retain exactly the same local origin. */
function HelicopterGun({port,index,glowRef}) {
  const flash=useRef(),barrel=useRef(),pulse=useRef({shots:0,remaining:0});
  useEffect(()=>{pulse.current={shots:glowRef?.current?.shots||0,remaining:0};},[glowRef]);
  const orientation=useMemo(()=>new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),new THREE.Vector3(...muzzleAim(port,armamentOf('helicopter').converge))),[port]);
  useFrame((_,delta)=>{
    pulse.current=helicopterGunPulse(pulse.current,glowRef?.current?.shots,delta,index);
    if(flash.current)flash.current.visible=pulse.current.remaining>0;
    if(barrel.current)barrel.current.position.z=pulse.current.remaining/.055*.045;
  });
  return <group position={port} quaternion={orientation} userData={{part:'helicopter-gun',index}}>
    <StaticBatch>
      <Shell color={METAL} metalness={.48} roughness={.55} segments={16} steps={2}
        stations={[{z:1.35,rx:.11,ry:.12,power:4},{z:1.65,rx:.15,ry:.16,power:4},{z:2.05,rx:.13,ry:.14,power:4}]}/>
      <Block position={[index?-.18:.18,.09,1.8]} scale={[.35,.14,.26]} color={METAL}/>
      <Block position={[0,-.13,1.7]} scale={[.21,.2,.40]} color={BODY}/>
    </StaticBatch>
    <group ref={barrel} userData={{dynamic:true}}><StaticBatch>
      <mesh position={[0,0,.70]} rotation={[HALF_PI,0,0]} castShadow><cylinderGeometry args={[.07,.095,1.4,16]}/><meshStandardMaterial color="#273237" metalness={.65} roughness={.4}/></mesh>
      <mesh position={[0,0,.10]} rotation={[HALF_PI,0,0]}><cylinderGeometry args={[.105,.10,.20,16,1,true]}/><meshStandardMaterial color="#465156" metalness={.55} roughness={.45} side={THREE.DoubleSide}/></mesh>
      <mesh position={[0,0,.055]} rotation={[0,Math.PI,0]}><circleGeometry args={[.072,16]}/><meshStandardMaterial color="#050809" roughness={1}/></mesh>
      <mesh position={[0,0,0]}><torusGeometry args={[.086,.017,6,16]}/><meshStandardMaterial color="#657076" metalness={.6} roughness={.4}/></mesh>
      {[.35,.62,.9,1.18].map(z=><mesh key={z} position={[0,0,z]}><torusGeometry args={[.09,.012,4,12]}/><meshStandardMaterial color="#586368" roughness={.5}/></mesh>)}
    </StaticBatch></group>
    <group userData={{part:'helicopter-gun-muzzle',index}}/>
    <mesh ref={flash} visible={false} position={[0,0,-.21]} rotation={[-HALF_PI,0,0]} userData={{dynamic:true,part:'helicopter-gun-flash',index}}>
      <coneGeometry args={[.14,.42,8]}/><meshBasicMaterial color="#ffd889" transparent opacity={.88} toneMapped={false} depthWrite={false}/>
    </mesh>
  </group>;
}

export default function Helicopter({ firstPerson = false, glowRef }) {
  const mainRotor = useRef();
  const tailRotor = useRef();

  const geometries = useMemo(() => ({
    fin: extrudeUpright([[6.7, 0.35], [7.5, 2.7], [8.4, 2.7], [8.55, 0.35]], 0.2),
    ventralFin: extrudeUpright([[7.2, 0.4], [8.3, 0.4], [8.1, -0.5], [7.5, -0.5]], 0.16),
  }), []);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);

  /* 탭이 뒤에서 돌아온 뒤 큰 delta 로 블레이드가 튀지 않게 한 프레임 회전량을 막는다. */
  useFrame((_, delta) => {
    const step = Math.min(delta, MAX_STEP);
    if (mainRotor.current) mainRotor.current.rotation.y = (mainRotor.current.rotation.y + MAIN_ROTOR_SPEED * step) % TWO_PI;
    if (tailRotor.current) tailRotor.current.rotation.y = (tailRotor.current.rotation.y + TAIL_ROTOR_SPEED * step) % TWO_PI;
  });

  return <group>
    {armamentOf('helicopter').cannon.map((port,index)=><HelicopterGun key={index} port={port} index={index} glowRef={glowRef}/>)}
    <StaticBatch>
      <mesh position={[0, -0.3, -4.5]} scale={[1.25, 0.9, 1.45]} castShadow><sphereGeometry args={[1, 32, 20]} /><meshStandardMaterial color={BODY} metalness={0.15} roughness={0.45} /></mesh>
      <Shell color={BODY} stations={[{z:-3.7,rx:1.08,ry:.47,cy:-.58,power:3},{z:-2.8,rx:1.25,ry:.55,cy:-.6,power:3},{z:.1,rx:1.24,ry:.52,cy:-.58,power:3},{z:.9,rx:1,ry:.43,cy:-.55}]}/>
      <Shell color={BODY_LIGHT} stations={[{z:.6,rx:1.05,ry:.9,cy:.25,power:3},{z:1.7,rx:.98,ry:.92,cy:.25,power:3},{z:2.8,rx:.58,ry:.54,cy:.4}]}/>

      <PanelSeam position={[0, 0.82, -1.3]} scale={[0.55, 0.025, 3.2]} color={BODY_LIGHT} />

      <mesh position={[0, -1.12, -4.6]} rotation={[HALF_PI, 0, 0]}><cylinderGeometry args={[0.18, 0.18, 0.12, 10]} /><meshStandardMaterial color={IVORY} emissive={IVORY} emissiveIntensity={0.8} roughness={0.3} /></mesh>

      {[-1, 1].map((side) => <group key={side}>
        <Block position={[side * 1.2, 0, -0.95]} scale={[0.06, 1.9, 0.06]} color={METAL} />
        <Block position={[side * 1.24, 0.05, -1.25]} scale={[0.08, 0.08, 0.32]} color={METAL} />
        <Block position={[side * 1.2, 0.45, -2.75]} scale={[0.1, 0.2, 0.12]} color={METAL} />
        <Block position={[side * 1.2, -0.45, -2.75]} scale={[0.1, 0.2, 0.12]} color={METAL} />
        <Lamp position={[side * 1.3, -0.35, -0.6]} radius={0.09} color={side < 0 ? '#ff3b30' : '#35d072'} />
        <SurfaceVent position={[side * 1.22, 0.18, 0.35]} scale={[0.42, 0.02, 0.08]} />
        <PanelSeam position={[side * 1.27, 0.1, -1.45]} scale={[0.018, 0.54, 2.2]} color={BODY_LIGHT} />

        <mesh position={[side * 0.5, 1.6, 2.45]} rotation={[HALF_PI, 0, 0]} castShadow><cylinderGeometry args={[0.17, 0.19, 0.7, 10]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} /></mesh>
        <mesh position={[side * 0.5, 1.6, 2.81]}><circleGeometry args={[0.15, 10]} /><meshStandardMaterial color={EXHAUST} /></mesh>
        <Block position={[side * 0.35, 2.85, 0.2]} scale={[0.05, 0.6, 0.05]} color={STRUT} />
        <Block position={[side * 1.3, 0.85, 6]} scale={[0.06, 0.55, 0.75]} color={BODY} />

        <mesh position={[side * 1.35, -1.81, -1.4]} rotation={[HALF_PI, 0, 0]} castShadow><cylinderGeometry args={[0.09, 0.09, 5.6, 8]} /><meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.5} /></mesh>
        <mesh position={[side * 1.35, -1.55, -4.56]} rotation={[-0.95, 0, 0]}><cylinderGeometry args={[0.09, 0.09, 0.9, 8]} /><meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.5} /></mesh>
        {[-3.1, 0.3].map((z) => <mesh key={z} position={[side * 1.25, -1.5, z]} rotation={[0, 0, side * 0.317]}><cylinderGeometry args={[0.07, 0.07, 0.66, 8]} /><meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.5} /></mesh>)}
      </group>)}

      <Shell color={BODY_LIGHT} stations={[{z:-1.3,rx:.6,ry:.25,cy:1.55,power:3},{z:-.6,rx:.75,ry:.375,cy:1.55},{z:1.2,rx:.69,ry:.32,cy:1.55},{z:1.9,rx:.51,ry:.23,cy:1.55}]}/>
      <Duct position={[0,1.55,-1.16]} scale={[1,.44,1]} radius={.58} length={.3} wall={.045} color={INTAKE}/>
      <mesh position={[0, 1.55, 1.9]} scale={[0.75, 0.37, 0.7]} castShadow><sphereGeometry args={[1, 32, 20]} /><meshStandardMaterial color={BODY_LIGHT} roughness={0.6} /></mesh>

      <mesh position={[0, 2.35, 0.2]}><cylinderGeometry args={[0.14, 0.18, 1, 10]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 2.55, 0.2]}><cylinderGeometry args={[0.45, 0.45, 0.12, 12]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} /></mesh>
      {/* 로터가 계속 돌므로 정적 병합에서 뺀다 */}
      <group ref={mainRotor} position={[0, 3.2, 0.2]} userData={{ dynamic: true }}><StaticBatch>
        <mesh castShadow><cylinderGeometry args={[0.3, 0.3, 0.32, 10]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} /></mesh>
        {MAIN_BLADES.map((index) => <group key={index} rotation={[0, index * HALF_PI, 0]}><MainBlade /></group>)}
      </StaticBatch></group>
      {/* 빠르게 도는 블레이드의 깜빡임을 가리는 반투명 원판이다. 그림자는 만들지 않는다. */}
      <mesh position={[0, 3.25, 0.2]} rotation={[-HALF_PI, 0, 0]}><circleGeometry args={[6.6, 24]} /><meshStandardMaterial color={BLADE} transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} /></mesh>

      {/* 꼬리 쪽이 가늘다. 회전 뒤 radiusTop 이 +Z 로 간다. */}
      <mesh position={[0, 0.55, 5.1]} rotation={[HALF_PI, 0, 0]} castShadow><cylinderGeometry args={[0.26, 0.6, 5.2, 28]} /><meshStandardMaterial color={BODY} metalness={0.15} roughness={0.45} /></mesh>
      <mesh position={[0, 0.55, 7.7]}><sphereGeometry args={[0.26, 10, 8]} /><meshStandardMaterial color={BODY} roughness={0.5} /></mesh>
      <Block position={[0, 0.95, 5]} scale={[0.2, 0.16, 4.6]} rotation={[0.068, 0, 0]} color={BODY_LIGHT} />
      <mesh geometry={geometries.fin} castShadow dispose={null}><meshStandardMaterial color={BODY_LIGHT} roughness={0.55} /></mesh>
      <mesh geometry={geometries.ventralFin} dispose={null}><meshStandardMaterial color={BODY} roughness={0.55} /></mesh>
      <Airfoil position={[0,.85,0]} color={BODY_LIGHT} stations={[{x:-1.3,front:5.75,back:6.35,thickness:.045},{x:0,front:5.65,back:6.35,thickness:.11},{x:1.3,front:5.75,back:6.35,thickness:.045}]}/>
      <Block position={[0.3, 1.7, 7.6]} scale={[0.36, 0.3, 0.3]} color={METAL} />
      <group position={[0.55, 1.7, 7.6]} rotation={[0, 0, HALF_PI]}>
        <group ref={tailRotor} userData={{ dynamic: true }}><StaticBatch>
          <mesh><cylinderGeometry args={[0.12, 0.12, 0.16, 8]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} /></mesh>
          {TAIL_BLADES.map((index) => <group key={index} rotation={[0, index * TWO_PI / 3, 0]}><TailBlade /></group>)}
        </StaticBatch></group>
        <mesh rotation={[HALF_PI, 0, 0]}><torusGeometry args={[1.3, 0.04, 6, 16]} /><meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.5} /></mesh>
      </group>
      <Lamp position={[0, 2.75, 8.4]} radius={0.08} color="#f0e9d4" />
      <DetailLamp position={[0, 0.9, -5.6]} color="#f0e9d4" scale={0.07} />

      <Block position={[0, 1.55, -2.4]} scale={[0.05, 0.5, 0.45]} color={IVORY} />
      <mesh position={[0, 1.6, 4]}><cylinderGeometry args={[0.015, 0.025, 1, 5]} /><meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} /></mesh>
    </StaticBatch>
    {/* 노즈 캐노피, 글레어실드, 문, 동체 캐빈 몸통. 1인칭에서는 실내가 대신 그려지므로 숨긴다. */}
    <group visible={!firstPerson}>
      <StaticBatch>
        {/* 앞유리 중앙 기둥. 깊이 0.5 라 1인칭에서 두꺼운 날개판처럼 보여 캐빈과 함께 숨기고 실내가 얇은 기둥을 그린다 */}
        <Block position={[0, 0.75, -5.2]} scale={[0.08, 1.2, 0.5]} rotation={[0.5, 0, 0]} color={BODY} />
        <mesh position={[0, 0.1, -1.6]} rotation={[HALF_PI, 0, 0]} castShadow><capsuleGeometry args={[1.2, 3.6, 12, 28]} /><meshStandardMaterial color={BODY} metalness={0.15} roughness={0.45} /></mesh>
        <mesh position={[0, 0.6, -3.9]} scale={[1.15, 0.95, 1.6]} castShadow><sphereGeometry args={[1, 32, 20]} /><meshStandardMaterial color={GLASS} metalness={0.3} roughness={0.2} /></mesh>
        <Block position={[0, 1.45, -3.2]} scale={[1.2, 0.14, 1.5]} color={BODY} />
        {[-1, 1].map((side) => <Block key={side} position={[side * 1.16, 0.55, -1.9]} scale={[0.1, 0.8, 1.4]} color={GLASS} />)}
      </StaticBatch>
    </group>
  </group>;
}
