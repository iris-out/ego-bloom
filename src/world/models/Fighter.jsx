import { useEffect, useMemo } from 'react';
import { airfoilGeometry, pairedAirfoil } from './vehicleSurfaces.js';
import { Shell, Duct, CanopyFrame } from './SurfaceParts.jsx';
import Block from './ModelBlock';
import { DetailLamp, PanelSeam, SurfaceVent } from './exteriorDetails.jsx';
import StaticBatch from '../StaticBatch.jsx';

const HALF_PI = Math.PI / 2;
const FIN_CANT = 0.28;
const PAINT = '#8e979b', PAINT_DARK = '#6f797e', PAINT_DEEP = '#5a646a', METAL = '#394649', GLASS = '#142b36';

/** Twin-engine fighter sharing Jet's frame: +Y up, nose toward -Z, wings span X, origin near the CG.
 * Envelope is fixed by flightPhysics and the chase camera: z -8..7, x within 5.5, wheel bottoms at -1.9, fin tips under y 4.
 * Extruded shapes use shape y as world z (wing, stabilizer) or shape x as world z (fin).
 * firstPerson 이면 캐노피, HUD, 계기 코밍을 숨긴다. 캐노피 활대는 실내가 그 자리에 프레임을
 * 그리지 않으므로 앞부분에 남는다. 3인칭 실루엣은 그대로다.
 */
/** 다른 기체 사이에서 너무 작아 보여 12퍼센트 키웠다. planeDimensions.fighter 와
 * hardpoints 의 총구, 파일런 좌표가 같은 배율을 쓴다. 한쪽만 고치면 탄이 빗나간다. */
export const FIGHTER_SCALE = 1.12;

export default function Fighter({ firstPerson = false }) {
  const geometries = useMemo(() => {
    const wing = pairedAirfoil([{x:.8,front:-.8,back:4.6,thickness:.36},{x:2,front:.1,back:4.52,thickness:.24},{x:5.3,front:3.4,back:4.1,thickness:.065}]);
    const lerx = airfoilGeometry([{x:.65,front:-4.6,back:-.8,thickness:.20},{x:1.4,front:-2.5,back:-.8,thickness:.11},{x:2,front:-.85,back:-.8,thickness:.015}]);
    const stabilizer = pairedAirfoil([{x:.8,front:4.4,back:7,thickness:.2},{x:3.1,front:6.1,back:6.7,thickness:.05}]);
    const fin = airfoilGeometry([{x:0,front:3.2,back:6.8,thickness:.20},{x:2.8,front:5.25,back:6.32,thickness:.10},{x:3,front:5.4,back:6.3,thickness:.065}]);
    fin.rotateZ(Math.PI/2);
    return { wing, lerx, stabilizer, fin };
  }, []);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);

  return <group scale={FIGHTER_SCALE}>
  <StaticBatch>
    <mesh position={[0, -0.42, -6.6]} rotation={[HALF_PI, 0, 0]}><cylinderGeometry args={[0.04, 0.05, 1.8, 6]} /><meshStandardMaterial color={METAL} metalness={0.6} /></mesh>
    <Shell color={PAINT} metalness={.12} roughness={.58} stations={[{z:-8,rx:.015,ry:.015},{z:-7.5,rx:.18,ry:.16},{z:-6.5,rx:.44,ry:.39},{z:-5.4,rx:.6,ry:.52},{z:-3.6,rx:.68,ry:.6},{z:-1.2,rx:1.04,ry:.68,cy:-.02},{z:1.2,rx:1.22,ry:.7,cy:-.05},{z:3.5,rx:1.2,ry:.64},{z:5.1,rx:1.15,ry:.55},{z:6.3,rx:1.04,ry:.45}]}/>
    <Shell color={PAINT} metalness={.12} roughness={.58} stations={[{z:-1.5,rx:.36,ry:.18,cy:.63},{z:0,rx:.42,ry:.28,cy:.66},{z:2.8,rx:.4,ry:.24,cy:.65},{z:4,rx:.18,ry:.12,cy:.6}]}/>


    {/* 캐노피 활대. 실내가 이 자리에 프레임을 그리지 않으므로 앞부분에 남긴다. */}
    <PanelSeam position={[0, 0.48, -0.9]} scale={[0.7, 0.025, 3.8]} color={PAINT_DEEP} />
    <SurfaceVent position={[0, -0.7, -2.2]} scale={[0.55, 0.02, 0.08]} />

    <mesh geometry={geometries.wing} position={[0, -0.25, 0]} castShadow dispose={null}><meshStandardMaterial color={PAINT} roughness={0.6} /></mesh>
    <mesh geometry={geometries.stabilizer} position={[0, -0.05, 0]} castShadow dispose={null}><meshStandardMaterial color={PAINT_DARK} roughness={0.6} /></mesh>

    <Block position={[0, -1.15, -4.6]} scale={[0.14, 1.1, 0.14]} color="#78898c" />
    <mesh position={[0, -1.39643, -4.6]} rotation={[0, 0, HALF_PI]} castShadow><cylinderGeometry args={[0.3, 0.3, 0.24, 12]} /><meshStandardMaterial color="#2a3134" roughness={0.9} /></mesh>
    <Block position={[0.32, -1.0, -4.6]} scale={[0.06, 0.9, 1.2]} color={PAINT} />

    {[-1, 1].map((side) => <group key={side}>
      <Shell position={[side*.75,0,0]} color={PAINT_DARK} metalness={.12} roughness={.58} stations={[{z:-5.5,rx:.08,ry:.12,cy:-.05},{z:-3.8,rx:.2,ry:.25,cy:-.05},{z:-1.7,rx:.17,ry:.2,cy:-.05}]}/>
      <mesh geometry={geometries.lerx} position={[0, 0.22, 0]} scale={[side, 1, 1]} castShadow dispose={null}><meshStandardMaterial color={PAINT_DARK} roughness={0.6} /></mesh>

      <Duct position={[side*1.55,-.35,.2]} scale={[.82,1,1]} radius={.55} length={3.6} color={PAINT_DARK}/>
      <Block position={[side * 1.12, -0.35, -1.3]} scale={[0.06, 1.2, 1.2]} color={PAINT_DEEP} />

      <group position={[side * 0.85, 0.55, 0]} rotation={[0, 0, -side * FIN_CANT]} scale={[side, 1, 1]}>
        <mesh geometry={geometries.fin} castShadow dispose={null}><meshStandardMaterial color={PAINT_DARK} roughness={0.6} /></mesh>
        <Block position={[0, 2.95, 5.85]} scale={[0.22, 0.16, 1.0]} color={PAINT_DEEP} />
      </group>
      <Block position={[side * 0.9, -0.85, 5.4]} scale={[0.08, 0.45, 1.4]} rotation={[0, 0, side * 0.35]} color={PAINT_DEEP} />

      <Duct position={[side*.7,-.05,6.4]} rotation={[0,Math.PI,0]} radius={.55} length={1.2} wall={.045} color={METAL}/>
      <mesh position={[side * 0.7, -0.05, 6.92]}><torusGeometry args={[0.4, 0.035, 8, 32]} /><meshStandardMaterial color="#1a1f22" metalness={0.5} roughness={0.6} /></mesh>


      <Block position={[side * 1.5, -1.2, 1.8]} scale={[0.16, .97, 0.16]} color="#78898c" />
      <mesh position={[side * 1.5, -1.33643, 1.8]} rotation={[0, 0, HALF_PI]} castShadow><cylinderGeometry args={[0.36, 0.36, 0.3, 12]} /><meshStandardMaterial color="#2a3134" roughness={0.9} /></mesh>
      <Block position={[side * 1.15, -1.1, 1.8]} scale={[0.06, 0.9, 1.3]} color={PAINT} />

      <Block position={[side * 2.3, -0.7, 2.4]} scale={[0.14, 0.5, 1.8]} color={PAINT_DARK} />
      <mesh position={[side * 2.3, -1.25, 2.4]} rotation={[HALF_PI, 0, 0]} castShadow><capsuleGeometry args={[0.34, 2.6, 4, 10]} /><meshStandardMaterial color={PAINT} metalness={0.2} roughness={0.5} /></mesh>

      <Block position={[side * 3.9, -0.6, 3.2]} scale={[0.1, 0.35, 1.2]} color={PAINT_DARK} />
      <mesh position={[side * 3.9, -0.9, 3.0]} rotation={[HALF_PI, 0, 0]} castShadow><cylinderGeometry args={[0.13, 0.13, 2.4, 8]} /><meshStandardMaterial color="#b9bfc2" metalness={0.3} roughness={0.5} /></mesh>
      <mesh position={[side * 3.9, -0.9, 1.55]} rotation={[-HALF_PI, 0, 0]}><coneGeometry args={[0.13, 0.5, 8]} /><meshStandardMaterial color={METAL} /></mesh>
      <Block position={[side * 3.9, -0.9, 3.9]} scale={[0.7, 0.04, 0.4]} color="#b9bfc2" />
      <Block position={[side * 3.9, -0.9, 3.9]} scale={[0.04, 0.7, 0.4]} color="#b9bfc2" />
      <SurfaceVent position={[side * 1.55, -0.95, -0.35]} scale={[0.45, 0.018, 0.08]} rotation={[0, 0, 0]} />

      <Block position={[side * 5.35, -0.3, 3.6]} scale={[0.2, 0.2, 1.8]} color={PAINT_DEEP} />
      <mesh position={[side * 5.35, -0.55, 3.4]} rotation={[HALF_PI, 0, 0]} castShadow><cylinderGeometry args={[0.11, 0.11, 2.2, 8]} /><meshStandardMaterial color="#b9bfc2" metalness={0.3} roughness={0.5} /></mesh>
      <mesh position={[side * 5.35, -0.55, 2.08]} rotation={[-HALF_PI, 0, 0]}><coneGeometry args={[0.11, 0.45, 8]} /><meshStandardMaterial color={METAL} /></mesh>
      <mesh position={[side * 5.35, -0.2, 2.75]}><sphereGeometry args={[0.1, 8, 6]} /><meshStandardMaterial color={side < 0 ? '#ff3b30' : '#35d072'} emissive={side < 0 ? '#ff3b30' : '#35d072'} emissiveIntensity={1.2} /></mesh>
      <DetailLamp position={[side * 5.35, -0.08, 2.75]} color={side < 0 ? '#ff3b30' : '#35d072'} scale={0.06} />
    </group>)}
  </StaticBatch>
  {/* 캐노피 구, HUD 상자, 계기 코밍. 1인칭에서는 실내가 대신 그려지므로 숨긴다. */}
  <group visible={!firstPerson}>
    <StaticBatch>
    {/* 캐노피 활대와 뒤 돔. 눈앞 0.35~0.8m 에 놓여 1인칭 HUD 를 가리므로 캐빈과 함께 숨긴다 */}


      <mesh position={[0, 0.75, -3.3]} scale={[0.7, 0.7, 1.9]} castShadow><sphereGeometry args={[1, 32, 20]} /><meshStandardMaterial color={GLASS} metalness={0.12} roughness={0.24} /></mesh>
      <CanopyFrame position={[0,.75,-3.3]} rx={.7} ry={.7} rz={1.9} color={PAINT_DEEP}/>
      <Block position={[0, 0.7, -2.7]} scale={[0.5, 0.5, 0.2]} color="#2f373a" />
      <Block position={[0, 1.0, -2.75]} scale={[0.36, 0.28, 0.16]} color="#2f373a" />
    </StaticBatch>
  </group>
  </group>;
}
