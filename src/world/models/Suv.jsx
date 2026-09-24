import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Block from './ModelBlock';
import { Shell } from './SurfaceParts.jsx';
import { Wheel } from './carParts.jsx';
import { beamBetween, curvedPane, CAR_PALETTE as P, createVehicleBodyGeometries, flatPolygonGeometry, GLASS_OPACITY, loftBody, MAX_STEER, rollWheels, steerAngle, VEHICLE_SHAPES } from './carGeometry.js';
import { PanelSeam } from './exteriorDetails.jsx';
import StaticBatch from '../StaticBatch.jsx';
import { SUV_FRONT_LIGHTS, SUV_REAR_LIGHTS } from '../headlights.js';

const BODY = '#b4b1a7', BODY_DARK = '#424b53', BODY_LINE = '#84949c', GLASS = '#253b45';
const WHEEL_RADIUS = 0.48, WHEEL_Y = -0.9 + WHEEL_RADIUS;
const FRONT_Z = -1.6, REAR_Z = 1.65, TRACK_X = 1.02;
const SHAPE = VEHICLE_SHAPES.suv;
const GRILLE_RIGHT = Object.freeze([
  [0.055, 0.24], [0.15, 0.30], [0.48, 0.30], [0.56, 0.23],
  [0.53, -0.12], [0.43, -0.20], [0.16, -0.18], [0.07, -0.10],
]);
const FRONT_FASCIA = Object.freeze([
  [-1.04, 0.36], [1.04, 0.36], [1.04, -0.36], [0.92, -0.45], [-0.92, -0.45], [-1.04, -0.36],
]);
const LOWER_INTAKE = Object.freeze([[-0.73, -0.27], [0.73, -0.27], [0.61, -0.46], [-0.61, -0.46]]);
const REAR_FASCIA = Object.freeze([
  [-1.04, 0.36], [1.04, 0.36], [1.04, -0.35], [0.91, -0.44], [-0.91, -0.44], [-1.04, -0.35],
]);
const PLATE_RECESS = Object.freeze([[-0.31, -0.02], [0.31, -0.02], [0.27, -0.23], [-0.27, -0.23]]);
const REAR_DIFFUSER = Object.freeze([[-0.91, -0.34], [0.91, -0.34], [0.76, -0.51], [-0.76, -0.51]]);
const mirrorOutline = points => points.map(([x, y]) => [-x, y]);

const mirroredPane = points => points.map(([x, y, z]) => [-x, y, z]);

function FrameBeam({ from, to, width = 0.046, depth = 0.06, color = BODY_DARK }) {
  const beam = beamBetween(from, to);
  return <mesh position={beam.position} quaternion={beam.quaternion} scale={[width, beam.length, depth]}>
    <cylinderGeometry args={[.5,.5,1,12]} /><meshStandardMaterial color={color} metalness={0.24} roughness={0.46} />
  </mesh>;
}

export default function Suv({ wheelsRef, steer = 0, speed = 0, firstPerson = false }) {
  const wheels = useRef([]), steering = useRef([]);
  const geometries = useMemo(() => {
    const body = createVehicleBodyGeometries('suv'), left = SHAPE.sideWindows.left;
    return {
      ...body, roof: loftBody(SHAPE.roofSections),
      windshield: curvedPane(SHAPE.windshield), rearWindow: curvedPane(SHAPE.rearWindow),
      frontLeft: curvedPane(left.front), rearLeft: curvedPane(left.rear), quarterLeft: curvedPane(left.quarter),
      frontRight: curvedPane(mirroredPane(left.front)), rearRight: curvedPane(mirroredPane(left.rear)),
      quarterRight: curvedPane(mirroredPane(left.quarter)),
      frontFascia: flatPolygonGeometry(FRONT_FASCIA, -2.481),
      frontGrilles: [flatPolygonGeometry(mirrorOutline(GRILLE_RIGHT), -2.489), flatPolygonGeometry(GRILLE_RIGHT, -2.489)],
      frontLampHousings: SUV_FRONT_LIGHTS.housings.map(lamp => flatPolygonGeometry(lamp.rear, 0)),
      frontLampRows: SUV_FRONT_LIGHTS.rows.map(row => flatPolygonGeometry(row.rear, 0)),
      lowerIntake: flatPolygonGeometry(LOWER_INTAKE, -2.491),
      rearFascia: flatPolygonGeometry(REAR_FASCIA, 2.474),
      rearLampHousings: SUV_REAR_LIGHTS.housings.map(lamp => flatPolygonGeometry(lamp.rear, 0)),
      rearLampRows: SUV_REAR_LIGHTS.rows.map(row => flatPolygonGeometry(row.rear, 0)),
      plateRecess: flatPolygonGeometry(PLATE_RECESS, 2.478),
      rearDiffuser: flatPolygonGeometry(REAR_DIFFUSER, 2.482),
    };
  }, []);
  useEffect(() => () => Object.values(geometries).flat().forEach(geometry => geometry.dispose()), [geometries]);
  useEffect(() => {
    const angle = steerAngle(steer, MAX_STEER);
    steering.current.forEach(group => { if (group) group.rotation.y = angle; });
  }, [steer]);
  useFrame((_, delta) => {
    const live = wheelsRef?.current;
    if (live) {
      const angle = steerAngle(live.steer, MAX_STEER);
      steering.current.forEach(group => { if (group) group.rotation.y = angle; });
    }
    rollWheels(wheels.current, delta, live ? live.speed : speed);
  });

  return <group>
    <StaticBatch>
      {['hood', 'tail', 'sideSkin', 'frontDeck', 'rearDeck'].map(name => <mesh key={name}
        userData={name === 'sideSkin' ? { part: 'g45-body-shell' } : undefined} geometry={geometries[name]} dispose={null}>
        <meshStandardMaterial color={BODY} metalness={0.42} roughness={0.29} side={THREE.DoubleSide} />
      </mesh>)}
      <mesh geometry={geometries.floor} dispose={null}><meshStandardMaterial color={BODY_DARK} roughness={0.54} /></mesh>
      <PanelSeam position={[0, 0.39, -1.39]} scale={[1.58, 0.014, 0.03]} color={BODY_DARK} />
      {[-1, 1].map(side => <group key={side}>
        <PanelSeam position={[side * 1.065, 0.18, -0.25]} scale={[0.014, 0.50, 0.025]} color={BODY_DARK} />
        <PanelSeam position={[side * 1.065, 0.18, 1.03]} scale={[0.014, 0.50, 0.025]} color={BODY_DARK} />
        <Block position={[side * 1.075, 0.30, -0.48]} scale={[0.018, 0.038, 0.25]} color={BODY_DARK} />
        <Block position={[side * 1.075, 0.30, 0.78]} scale={[0.018, 0.038, 0.25]} color={BODY_DARK} />
        <Block position={[side * 1.08, -0.545, 0.08]} scale={[0.10, 0.035, 1.92]} color={P.tire} />
        <group position={[side * 1.08, 0.52, -1.03]}>
          <Block position={[-side * 0.07, -0.06, 0.05]} scale={[0.15, 0.055, 0.08]} rotation={[0, side * 0.28, 0]} color={BODY_DARK} />
          <Shell color={BODY_DARK} rotation={[0,side*.12,0]} segments={24} steps={3}
            stations={[{z:-.10,rx:.055,ry:.045,power:2},{z:-.04,rx:.11,ry:.064,power:3},{z:.06,rx:.095,ry:.055,power:3},{z:.10,rx:.075,ry:.043,power:3}]}/>
        </group>
      </group>)}

      <Shell color={BODY} stations={[{z:-2.48,rx:1.035,ry:.39,cy:-.045,power:7},{z:-2.36,rx:1.08,ry:.40,cy:-.045,power:5},{z:-2.22,rx:1.04,ry:.38,cy:-.045,power:5}]}/>
      <mesh geometry={geometries.frontFascia} dispose={null}>
        <meshStandardMaterial color={BODY} metalness={0.42} roughness={0.29} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((side, grilleIndex) => {
        const outline = side < 0 ? mirrorOutline(GRILLE_RIGHT) : GRILLE_RIGHT;
        return <group key={side}>
          <mesh userData={{ part: 'suv-kidney-grille' }} geometry={geometries.frontGrilles[grilleIndex]} dispose={null}>
            <meshStandardMaterial color="#161b1d" metalness={0.25} roughness={0.38} side={THREE.DoubleSide} />
          </mesh>
          {outline.map((point, index) => <FrameBeam key={index}
            from={[...point, -2.501]} to={[...outline[(index + 1) % outline.length], -2.501]}
            width={0.012} depth={0.014} color="#b3c0c6" />)}
          {[0.21, 0.13, 0.05, -0.03, -0.11].map((y, index) => <Block key={y}
            userData={{ part: 'suv-grille-slat' }} position={[side * 0.305, y, -2.503]}
            scale={[0.34 - index * 0.012, 0.012, 0.012]} color={BODY_LINE} />)}
        </group>;
      })}
      {SUV_FRONT_LIGHTS.housings.map((lamp, index) => <mesh key={lamp.side}
        userData={{ part: 'suv-headlamp-housing' }} geometry={geometries.frontLampHousings[index]}
        position={[0, 0, SUV_FRONT_LIGHTS.housingZ]} dispose={null}>
        <meshStandardMaterial color="#11181c" metalness={0.25} roughness={0.30} side={THREE.DoubleSide} />
      </mesh>)}
      {SUV_FRONT_LIGHTS.rows.map((row, index) => <mesh key={index}
        userData={{ part: 'suv-headlamp-line' }} geometry={geometries.frontLampRows[index]}
        position={[0, 0, SUV_FRONT_LIGHTS.rowZ]} dispose={null}>
        <meshStandardMaterial color={P.headLamp} emissive={P.headLamp} emissiveIntensity={0.85}
          roughness={0.24} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>)}
      <mesh userData={{ part: 'suv-lower-intake' }} geometry={geometries.lowerIntake} dispose={null}>
        <meshStandardMaterial color="#111719" roughness={0.40} side={THREE.DoubleSide} />
      </mesh>
      {[-0.38, -0.30, -0.22].map(y => <Block key={y} position={[0, y, -2.500]}
        scale={[1.20 - (-0.22 - y) * 0.55, 0.012, 0.012]} color={BODY_LINE} />)}
      {[-1, 1].map(side => <Block key={side} userData={{ part: 'suv-air-curtain' }}
        position={[side * 0.97, -0.285, -2.494]} scale={[0.065, 0.25, 0.018]} color="#111719" />)}
      <Block position={[0, -0.485, -2.455]} scale={[1.92, 0.05, 0.08]} color={BODY_DARK} />

      <Shell color={BODY} stations={[{z:2.25,rx:1.04,ry:.4,cy:-.04,power:5},{z:2.37,rx:1.07,ry:.4,cy:-.04,power:5},{z:2.47,rx:1.035,ry:.39,cy:-.04,power:7}]}/>
      <mesh userData={{ part: 'suv-rear-fascia' }} geometry={geometries.rearFascia} dispose={null}>
        <meshStandardMaterial color={BODY} metalness={0.42} roughness={0.29} side={THREE.DoubleSide} />
      </mesh>
      {SUV_REAR_LIGHTS.housings.map((lamp, index) => <mesh key={lamp.side}
        userData={{ part: 'suv-tail-housing' }} geometry={geometries.rearLampHousings[index]}
        position={[0, 0, SUV_REAR_LIGHTS.housingZ]} dispose={null}>
        <meshStandardMaterial color="#171719" metalness={0.22} roughness={0.32} side={THREE.DoubleSide} />
      </mesh>)}
      {SUV_REAR_LIGHTS.rows.map((row, index) => <mesh key={index}
        userData={{ part: 'suv-tail-row' }} geometry={geometries.rearLampRows[index]}
        position={[0, 0, SUV_REAR_LIGHTS.rowZ]} dispose={null}>
        <meshStandardMaterial color="#ef3348" emissive="#ef3348" emissiveIntensity={0.72}
          roughness={0.30} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>)}
      <mesh geometry={geometries.plateRecess} position={[0, 0, 0]} dispose={null}>
        <meshStandardMaterial color={BODY_DARK} roughness={0.46} side={THREE.DoubleSide} />
      </mesh>
      <Block position={[0, -0.13, 2.488]} scale={[0.47, 0.15, 0.012]} color={P.plate} />
      <mesh userData={{ part: 'suv-rear-diffuser' }} geometry={geometries.rearDiffuser} dispose={null}>
        <meshStandardMaterial color="#111719" roughness={0.42} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map(side => <group key={side}>
        <Block position={[side * 0.965, -0.27, 2.481]} scale={[0.15, 0.34, 0.018]} color="#111719" />
        <Block userData={{ part: 'suv-vertical-reflector' }} position={[side * 0.99, -0.255, 2.488]}
          scale={[0.025, 0.23, 0.012]} color="#d32635" />
      </group>)}
    </StaticBatch>

    <group visible={!firstPerson} userData={{ part: 'camera-intersection' }}>
      <StaticBatch>
        <mesh geometry={geometries.roof} dispose={null}><meshStandardMaterial color={BODY_DARK} metalness={0.26} roughness={0.44} /></mesh>
        {[-1, 1].map(side => <Block key={side} position={[side * 0.66, 1.182, 0.33]} scale={[0.045, 0.016, 1.90]} color={P.trim} />)}
        {['windshield', 'rearWindow', 'frontLeft', 'rearLeft', 'quarterLeft', 'frontRight', 'rearRight', 'quarterRight'].map(name =>
          <mesh key={name} geometry={geometries[name]} dispose={null}>
            <meshStandardMaterial color={GLASS} metalness={0.18} roughness={0.16} transparent opacity={Math.max(GLASS_OPACITY, 0.62)} side={THREE.DoubleSide} />
          </mesh>)}
        {[-1, 1].map(side => {
          const mirror = ([x, y, z]) => [side < 0 ? x : -x, y, z];
          const { front, rear, quarter } = SHAPE.sideWindows.left;
          return <group key={side}>
            <FrameBeam from={mirror(front[0])} to={mirror(front[1])} />
            <FrameBeam from={mirror(front[3])} to={mirror(front[2])} width={0.06} />
            <FrameBeam from={mirror(rear[3])} to={mirror(rear[2])} width={0.07} />
            <FrameBeam from={mirror(quarter[3])} to={mirror(quarter[2])} width={0.10} depth={0.11} />
            <FrameBeam from={mirror(front[1])} to={mirror(front[2])} width={0.05} />
            <FrameBeam from={mirror(front[2])} to={mirror(rear[2])} width={0.05} />
            <FrameBeam from={mirror(rear[2])} to={mirror(quarter[1])} width={0.05} />
            <FrameBeam from={mirror(quarter[1])} to={mirror(quarter[2])} width={0.085} depth={0.10} />
          </group>;
        })}
        <Block position={[0, 0.50, -1.04]} scale={[1.68, 0.08, 0.38]} color={P.cabinDark} />
        {[-0.5, 0.5].map(x => <group key={x}>
          <Block position={[x, 0.08, 0.20]} scale={[0.50, 0.16, 0.56]} color={P.leather} />
          <Block position={[x, 0.43, 0.48]} scale={[0.48, 0.58, 0.14]} color={P.leather} />
        </group>)}
        <Block position={[0, 0.38, 1.34]} scale={[1.68, 0.52, 0.14]} color={P.leather} />
      </StaticBatch>
    </group>

    {[-1, 1].map((side, index) => <group key={side} ref={el => { steering.current[index] = el; }}
      position={[side * TRACK_X, WHEEL_Y, FRONT_Z]} userData={{ dynamic: true, part: 'wheel-hub', axle: 'front' }}>
      <group ref={el => { wheels.current[index] = el; }}><Wheel radius={WHEEL_RADIUS} brake spokes={6} /></group>
    </group>)}
    {[-1, 1].map((side, index) => <group key={side} position={[side * TRACK_X, WHEEL_Y, REAR_Z]}
      userData={{ dynamic: true, part: 'wheel-hub', axle: 'rear' }}>
      <group ref={el => { wheels.current[2 + index] = el; }}><Wheel radius={WHEEL_RADIUS} spokes={6} /></group>
    </group>)}
  </group>;
}
