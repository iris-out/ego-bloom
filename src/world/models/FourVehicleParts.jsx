import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import StaticBatch from '../StaticBatch.jsx';
import { Wheel } from './carParts.jsx';
import { curvedPane, rollWheels, steerAngle } from './carGeometry.js';

/** The front pivot turns around Y; its child wheel rolls around X. */
export function VehicleWheels({ layout, wheelsRef, steer = 0, speed = 0, wheelProps }) {
  const pivots = useRef([]);
  const wheels = useRef([]);
  const { track, radius, y, frontZ, rearZ } = layout.wheels;
  useEffect(() => {
    const angle = steerAngle(steer);
    pivots.current.forEach(pivot => { if (pivot) pivot.rotation.y = angle; });
  }, [steer]);
  useFrame((_, delta) => {
    const live = wheelsRef?.current;
    const angle = steerAngle(live?.steer ?? steer);
    pivots.current.forEach(pivot => { if (pivot) pivot.rotation.y = angle; });
    rollWheels(wheels.current, delta, live?.speed ?? speed);
  });
  return <group userData={{ part: `${layout.key}-wheels` }}>
    {[-1, 1].map((side, index) => <group key={`front-${side}`} ref={node => { pivots.current[index] = node; }}
      position={[side * track, y, frontZ]} userData={{ dynamic: true, part: 'wheel-hub' }}>
      <group ref={node => { wheels.current[index] = node; }}><Wheel radius={radius} brake spokes={5} {...wheelProps} /></group>
    </group>)}
    {[-1, 1].map((side, index) => <group key={`rear-${side}`} position={[side * track, y, rearZ]}
      userData={{ dynamic: true, part: 'wheel-hub' }}>
      <group ref={node => { wheels.current[index + 2] = node; }}><Wheel radius={radius} spokes={5} {...wheelProps} /></group>
    </group>)}
  </group>;
}

/** Cushion centre is the authored position; the back leans behind it (+Z). */
export function CabinSeat({ position, width = .46, depth = .48, height = .62, color = '#403c39', sport = false, quality = 'medium' }) {
  const leather = <meshStandardMaterial color={color} roughness={.82} />;
  const insert = <meshStandardMaterial color={sport ? '#9c9da0' : color} roughness={.88} />;
  const side = width * .47;
  const low = quality === 'low';
  const major = low ? [1, 6, 3] : [1, 8, 4];
  const minor = low ? [1, 4, 2] : [1, 6, 3];
  return <group position={position} userData={{ part: 'cabin-seat' }}>
    <mesh scale={[width * .48, .095, depth * .50]} position={[0, -.015, 0]}>
      <sphereGeometry args={major} />{leather}
    </mesh>
    <mesh scale={[width * .34, .027, depth * .37]} position={[0, .060, -.02]}>
      <sphereGeometry args={minor} />{insert}
    </mesh>
    {[-1, 1].map(sideSign => <mesh key={`cushion-${sideSign}`} position={[sideSign * side, .057, .005]}
      rotation={[0, 0, -sideSign * .13]} scale={[width * .11, .075, depth * .43]}>
      <sphereGeometry args={minor} />{leather}
    </mesh>)}
    <group position={[0, height * .44, depth * .37]} rotation={[-.13, 0, 0]}>
      <mesh scale={[width * .47, height * .46, .083]}>
        <sphereGeometry args={major} />{leather}
      </mesh>
      <mesh position={[0, -.013, -.075]} scale={[width * .34, height * .35, .028]}>
        <sphereGeometry args={minor} />{insert}
      </mesh>
      {[-1, 1].map(sideSign => <mesh key={`back-${sideSign}`} position={[sideSign * width * .38, .015, -.012]}
        rotation={[0, 0, sideSign * .08]} scale={[width * .12, height * .40, .11]}>
          <sphereGeometry args={minor} />{leather}
      </mesh>)}
      <mesh position={[0, height * .43, .025]} scale={[width * .32, height * .17, .095]}>
        <sphereGeometry args={minor} />{leather}
      </mesh>
      {sport && <mesh position={[0, height * .41, -.064]} scale={[width * .22, height * .075, .012]}>
        <sphereGeometry args={minor} />{insert}
      </mesh>}
    </group>
  </group>;
}

/** Wheel and yoke use the tire angle: right input makes negative Z rotation,
 * moving the upper rim toward the driver's right. */
export function CabinSteering({ position, radius = .18, tilt = -.32, yoke = false, wheelsRef, steer = 0, statusRef, quality = 'medium' }) {
  const rim = useRef();
  const low = quality === 'low';
  const high = quality === 'high';
  const ringSegments = low ? [4, 10] : high ? [8, 24] : [6, 18];
  const capSegments = low ? 6 : high ? 12 : 8;
  const gripSegments = low ? [1, 6, 3] : high ? [1, 12, 8] : [1, 8, 4];
  useEffect(() => {
    if (rim.current) rim.current.rotation.z = steerAngle(steer) * 2.2;
  }, [steer]);
  useFrame(() => {
    if (!rim.current) return;
    const liveSteer = wheelsRef?.current?.steer ?? statusRef?.current?.steer ?? steer;
    rim.current.rotation.z = steerAngle(liveSteer) * 2.2;
  });
  const dark = '#222527';
  return <group position={position} rotation={[tilt, 0, 0]}>
    <mesh position={[0, 0, -.045]}><cylinderGeometry args={[radius * .23, radius * .29, .09, capSegments]} />
      <meshStandardMaterial color={dark} roughness={.67} /></mesh>
    <group ref={rim} userData={{ dynamic: true, part: yoke ? 'electric-yoke' : 'steering-wheel' }}>
      <StaticBatch version={quality}>
        <mesh rotation={yoke ? [0, 0, Math.PI] : undefined}><torusGeometry args={[radius, radius * .11, ...ringSegments, yoke ? Math.PI : Math.PI * 2]} />
          <meshStandardMaterial color={dark} roughness={.73} /></mesh>
        {yoke ? <>
          {[-1,1].map(side => <mesh key={side} position={[side * radius * .86, radius * .08, .005]}
            rotation={[0, 0, -side * .30]} scale={[radius * .25, radius * .54, radius * .16]}>
            <sphereGeometry args={gripSegments} /><meshStandardMaterial color={dark} roughness={.73} />
          </mesh>)}
          <mesh position={[0, -radius * .72, 0]} scale={[radius * 1.28, radius * .16, radius * .15]}>
            <boxGeometry /><meshStandardMaterial color={dark} roughness={.72} />
          </mesh>
        </> : <>
          {[-1, 1].map(side => <mesh key={side} position={[side * radius * .45, -.025, 0]}
            rotation={[0, 0, side * .12]} scale={[radius * .92, radius * .12, radius * .13]}>
            <boxGeometry /><meshStandardMaterial color={dark} roughness={.72} />
          </mesh>)}
          <mesh position={[0, -radius * .50, 0]} scale={[radius * .14, radius * .85, radius * .13]}>
            <boxGeometry /><meshStandardMaterial color={dark} roughness={.72} />
          </mesh>
        </>}
        <mesh position={[0, -.025, .02]} scale={[radius * .53, radius * .34, radius * .16]}>
          <sphereGeometry args={gripSegments} /><meshStandardMaterial color="#363b3f" roughness={.45} />
        </mesh>
      </StaticBatch>
    </group>
  </group>;
}

/** Glazing owns its geometry and leaves the frame corners unchanged. */
export function CabinPane({ corners, opacity = .30, color = '#385c6d' }) {
  const geometry = useMemo(() => curvedPane(corners, .028, 6, 3), [corners]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} dispose={null}>
    <meshStandardMaterial color={color} transparent opacity={opacity} metalness={.18} roughness={.16}
      side={THREE.DoubleSide} depthWrite={false} />
  </mesh>;
}
