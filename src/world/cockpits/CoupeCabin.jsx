import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FOUR_VEHICLE_LAYOUT } from '../models/fourVehicleLayout.js';
import { CabinPane, CabinSeat, CabinSteering } from '../models/FourVehicleParts.jsx';
import { Shell } from '../models/SurfaceParts.jsx';
import { beamBetween } from '../models/carGeometry.js';
import StaticBatch from '../StaticBatch.jsx';
import InstrumentDisplay from './InstrumentDisplay.jsx';
import Mirrors from './Mirrors.jsx';

const L = FOUR_VEHICLE_LAYOUT.coupe;
const WALNUT = '#73543d', HONEY = '#9b6a4b', LEATHER = '#a67d61';
const DARK = '#28282b', SILVER = '#bdc0c2', CHROME = '#c9c6bf';

function SurfaceCurve({ points, radius = .01, color }) {
  const signature = JSON.stringify(points);
  const geometry = useMemo(() => new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(JSON.parse(signature).map(p => new THREE.Vector3(...p))),
    10, radius, 3, false,
  ), [signature, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} dispose={null}><meshStandardMaterial color={color} roughness={.43} metalness={.28}/></mesh>;
}

function Frame({ a, b, radius = .024, color = SILVER }) {
  const beam = beamBetween(a, b);
  return <mesh position={beam.position} quaternion={beam.quaternion}>
    <cylinderGeometry args={[radius,radius,beam.length,10]}/>
    <meshStandardMaterial color={color} metalness={.56} roughness={.31}/>
  </mesh>;
}

function SidePanel({ points, color = SILVER }) {
  const signature = JSON.stringify(points);
  const geometry = useMemo(() => {
    const vertices = JSON.parse(signature);
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3));
    const indices = [];
    for (let i = 1; i < vertices.length - 1; i++) indices.push(0, i, i + 1);
    result.setIndex(indices);
    result.computeVertexNormals();
    return result;
  }, [signature]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} dispose={null}><meshStandardMaterial color={color} metalness={.44} roughness={.30} side={THREE.DoubleSide}/></mesh>;
}

function Seat({ position, rear = false, high = false, quality }) {
  const width = rear ? .34 : .45;
  const height = rear ? .43 : .56;
  return <group position={position} userData={{ part: 'coupe-seat' }}>
    <CabinSeat position={[0,0,0]} width={width} depth={rear?.37:.47} height={height} color={LEATHER} quality={quality} />
    {!rear && <Shell color={HONEY} roughness={.83} metalness={.02} segments={quality==='low'?8:12} steps={1}
      position={[0,.045,-.012]} stations={[{z:-.17,rx:width*.33,ry:.008,power:3},{z:0,rx:width*.36,ry:.013,power:3},{z:.16,rx:width*.30,ry:.008,power:3}]} />}
    {!rear && <Shell color={HONEY} roughness={.83} metalness={.02} segments={quality==='low'?8:12} steps={1}
      position={[0,.24,.075]} rotation={[-.13,0,0]}
      stations={[{z:-.022,rx:width*.28,ry:.18,power:3},{z:.025,rx:width*.28,ry:.18,power:3}]} />}
    {high && <SurfaceCurve color="#c9aa8b" radius={.003} points={[[-width*.30,.08,.02],[-width*.31,.26,.16],[-width*.23,.40,.23]]} />}
  </group>;
}

function DoorCard({ side, rear, mid, high }) {
  const z = rear ? .86 : -.48;
  return <group position={[side*(L.cabin.innerWidth/2-.016),0,z]} userData={{ part: 'coupe-door-card' }}>
    <Shell color={DARK} roughness={.78} metalness={.04} segments={high?18:mid?12:8} steps={high?2:1}
      stations={[{z:-.62,rx:.024,ry:.30,cy:-.15,power:4},{z:-.20,rx:.043,ry:.34,cy:-.15,power:4},{z:.29,rx:.044,ry:.33,cy:-.15,power:4},{z:.64,rx:.022,ry:.28,cy:-.16,power:4}]} />
    <Shell color={LEATHER} roughness={.87} segments={high?16:mid?12:8} steps={1} position={[-side*.038,0,0]}
      stations={[{z:-.52,rx:.013,ry:.13,cy:-.16,power:4},{z:0,rx:.022,ry:.15,cy:-.15,power:4},{z:.50,rx:.014,ry:.12,cy:-.16,power:4}]} />
    <SurfaceCurve color={WALNUT} radius={.013} points={[[-side*.052,.075,-.57],[-side*.058,.085,-.15],[-side*.053,.075,.55]]} />
    <SurfaceCurve color="#dfb887" radius={.005} points={[[-side*.058,.055,-.57],[-side*.064,.066,-.15],[-side*.059,.055,.55]]} />
    <SurfaceCurve color={CHROME} radius={.015} points={[[-side*.075,-.12,-.30],[-side*.10,-.11,-.15],[-side*.10,-.11,.02]]} />
    <Shell color="#41352e" segments={12} steps={1} position={[-side*.07,-.32,.16]}
      stations={[{z:-.25,rx:.008,ry:.06,power:4},{z:.25,rx:.008,ry:.06,power:4}]} />
    {mid && <mesh position={[-side*.07,-.04,-.43]}><boxGeometry args={[.02,.018,.13]}/><meshStandardMaterial color={CHROME} metalness={.7} roughness={.22}/></mesh>}
  </group>;
}

function TurbineVent({ x, y, z, mid }) {
  return <group position={[x,y,z]} userData={{ part: 'coupe-turbine-vent' }}>
    <mesh><torusGeometry args={[.052,.009,4,mid?8:6]}/><meshStandardMaterial color={CHROME} metalness={.72} roughness={.25}/></mesh>
    <mesh position={[0,0,-.007]}><circleGeometry args={[.046,mid?12:8]}/><meshStandardMaterial color="#24262a" roughness={.7}/></mesh>
    {mid && [0,Math.PI/3,-Math.PI/3].map(a => <mesh key={a} position={[0,0,.006]} rotation={[0,0,a]}><boxGeometry args={[.008,.083,.005]}/><meshStandardMaterial color={CHROME} metalness={.7} roughness={.26}/></mesh>)}
    <mesh position={[0,0,.013]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.012,.012,.012,6]}/><meshStandardMaterial color={CHROME} metalness={.7} roughness={.3}/></mesh>
  </group>;
}

function Dashboard({ exterior, statusRef, night, mid, quality, wheelsRef, steer }) {
  const { dashY, dashZ, steering } = L.cabin;
  return <group userData={{ part: 'coupe-dashboard' }}>
    <Shell color={DARK} metalness={.04} roughness={.73} segments={24} steps={2}
      stations={[{z:dashZ-.12,rx:.82,ry:.085,cy:dashY-.08,power:5},{z:dashZ+.025,rx:.94,ry:.09,cy:dashY-.11,power:5},{z:dashZ+.16,rx:.91,ry:.065,cy:dashY-.14,power:4}]} />
    <Shell color={WALNUT} metalness={.10} roughness={.55} segments={22} steps={1} position={[0,-.12,-.75]}
      stations={[{z:-.025,rx:.88,ry:.040,power:5},{z:.025,rx:.89,ry:.040,power:5}]} />
    <SurfaceCurve color="#d3aa75" radius={.006} points={[[-.90,-.21,-.71],[-.30,-.205,-.71],[.3,-.205,-.71],[.90,-.20,-.72]]} />
    {[[-.43,.50],[.27,.77]].map(([x,width]) => <group key={x} position={[x,.28,-.765]}>
      <mesh><boxGeometry args={[width,.23,.028]}/><meshStandardMaterial color="#080a0c" metalness={.28} roughness={.2}/></mesh>
      {exterior && <mesh position={[0,0,.016]}><planeGeometry args={[width-.025,.204]}/><meshBasicMaterial color="#163049"/></mesh>}
    </group>)}
    {!exterior && <>
      <InstrumentDisplay mode="coupeClassic" position={[-.43,.28,-.744]} width={.47} height={.20} statusRef={statusRef} night={night} accent="#accde4" />
      <InstrumentDisplay mode="roadnav" position={[.27,.28,-.744]} width={.74} height={.20} statusRef={statusRef} night={night} accent="#88a9ba" />
    </>}
    {[-.82,-.27,-.09,.09,.27,.82].map((x,i) => <TurbineVent key={i} x={x} y={-.09} z={dashZ+.225} mid={mid} />)}
    <CabinSteering position={steering} radius={.172} tilt={-.36} wheelsRef={wheelsRef} steer={steer} statusRef={statusRef} quality={quality} />
  </group>;
}

function Console({ mid }) {
  return <group userData={{ part: 'coupe-console' }}>
    <Shell color={LEATHER} roughness={.83} segments={18} steps={2}
      stations={[{z:-.75,rx:.14,ry:.07,cy:-.28,power:4},{z:-.22,rx:.20,ry:.09,cy:-.25,power:5},{z:.38,rx:.21,ry:.08,cy:-.23,power:5},{z:.68,rx:.18,ry:.07,cy:-.24,power:4}]} />
    <Shell color={WALNUT} roughness={.45} metalness={.1} segments={16} steps={1} position={[0,-.14,-.29]}
      stations={[{z:-.34,rx:.12,ry:.014,power:4},{z:.34,rx:.17,ry:.015,power:4}]} />
    <mesh position={[0,-.08,-.42]} rotation={[-.15,0,0]}><boxGeometry args={[.085,.11,.07]}/><meshStandardMaterial color={CHROME} metalness={.65} roughness={.25}/></mesh>
    {mid && [0,.13].map(z => <mesh key={z} position={[.08,-.10,z]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.047,.008,4,10]}/><meshStandardMaterial color={CHROME} metalness={.7} roughness={.26}/></mesh>)}
    <Shell color={WALNUT} roughness={.5} segments={16} steps={1} position={[0,-.31,1.09]}
      stations={[{z:-.19,rx:.12,ry:.065,power:4},{z:.19,rx:.12,ry:.065,power:4}]} />
  </group>;
}

export default function CoupeCabin({ statusRef, night = false, quality = 'medium', exterior = false, wheelsRef, steer = 0 }) {
  const mid = quality !== 'low', high = quality === 'high';
  const w = L.windshield;
  const leftFront = [[-.94,.30,-.97],[-.77,.74,-.46],[-.77,.74,.34],[-.96,.30,.34]];
  const leftRear = [[-.96,.30,.39],[-.77,.74,.39],[-.71,.62,1.14],[-.94,.30,1.37]];
  const right = pane => pane.map(([x,y,z]) => [-x,y,z]);
  const rear = [[-.88,.19,1.95],[.88,.19,1.95],[.64,.69,1.43],[-.64,.69,1.43]];
  return <group userData={{ part: 'coupe-cabin' }}>
    <StaticBatch version={quality}>
      <mesh position={[0,L.cabin.floorY+.035,.20]}><boxGeometry args={[1.79,.065,2.56]}/><meshStandardMaterial color="#2b2826" roughness={.91}/></mesh>
      <Shell color={SILVER} metalness={.44} roughness={.28} segments={quality==='high'?24:quality==='medium'?18:12} steps={quality==='high'?2:1}
        stations={[{z:-.46,rx:.74,ry:.082,cy:.724,power:4},{z:-.12,rx:.79,ry:.080,cy:.764,power:4},{z:.54,rx:.79,ry:.082,cy:.763,power:4},{z:1.04,rx:.73,ry:.077,cy:.731,power:4},{z:1.36,rx:.66,ry:.065,cy:.669,power:4},{z:1.60,rx:.57,ry:.047,cy:.603,power:4}]} />
      <CabinPane corners={w} color="#55707b" opacity={.34} quality={quality}/>
      <CabinPane corners={rear} color="#4e6873" opacity={.38} quality={quality}/>
      {[leftFront,leftRear,right(leftFront),right(leftRear)].map((pane,i) => <CabinPane key={i} corners={pane} color="#546d76" opacity={.37} quality={quality}/>)}
      <Frame a={w[0]} b={w[3]} radius={.033}/><Frame a={w[1]} b={w[2]} radius={.033}/>
      <Frame a={w[3]} b={w[2]} radius={.024}/>
      {[-1,1].map(side => <group key={side}>
        <SidePanel points={[[side*.94,.17,-1.04],[side*.95,.30,-.96],[side*.97,.30,.36],[side*.94,.17,.36]]}/>
        <SidePanel points={[[side*.94,.17,.37],[side*.97,.30,.38],[side*.94,.30,1.39],[side*.94,.17,1.50]]}/>
        <SidePanel points={[[side*.73,.75,1.02],[side*.70,.67,1.23],[side*.88,.29,1.78],[side*.95,.29,1.43],[side*.80,.63,1.08]]}/>
        <Frame a={[side*.77,.74,.37]} b={[side*.97,.30,.37]} radius={.023} color="#38383a" />
        <Frame a={[side*.71,.62,1.14]} b={[side*.94,.30,1.43]} radius={.045}/>
        <Frame a={[side*.64,.69,1.43]} b={[side*.88,.19,1.95]} radius={.034}/>
        <SurfaceCurve color={SILVER} radius={.018} points={[[side*.94,.30,-1.04],[side*.97,.30,-.37],[side*.97,.30,.40],[side*.94,.30,1.42]]}/>
        <mesh position={[side*1.13,.19,-.89]} rotation={[0,side*.2,0]}><boxGeometry args={[.13,.10,.20]}/><meshStandardMaterial color={SILVER} metalness={.45} roughness={.26}/></mesh>
        <mesh position={[side*1.15,.195,-.88]}><boxGeometry args={[.012,.062,.13]}/><meshStandardMaterial color="#253a44" metalness={.32} roughness={.17}/></mesh>
      </group>)}
      <Dashboard exterior={exterior} statusRef={statusRef} night={night} mid={mid} quality={quality} wheelsRef={wheelsRef} steer={steer}/>
      <Console mid={mid}/>
      <group userData={{ part: 'coupe-rear-bench' }}>
        <mesh position={[0,-.20,1.02]} scale={[.86,.075,.29]}><sphereGeometry args={[1,quality==='low'?10:16,6]}/><meshStandardMaterial color={LEATHER} roughness={.84}/></mesh>
        <mesh position={[0,.04,1.28]} scale={[.86,.26,.07]}><sphereGeometry args={[1,quality==='low'?10:16,6]}/><meshStandardMaterial color={LEATHER} roughness={.84}/></mesh>
      </group>
      {L.cabin.frontSeats.map((position,i) => <Seat key={`front-${i}`} position={position} high={high} quality={quality}/>)}
      {L.cabin.rearSeats.map((position,i) => <Seat key={`rear-${i}`} position={position} rear high={high} quality={quality}/>)}
      {[-1,1].flatMap(side => [false,true].map(rearDoor => <DoorCard key={`${side}-${rearDoor}`} side={side} rear={rearDoor} mid={mid} high={high}/>))}
    </StaticBatch>
    {!exterior && <Mirrors vehicle="coupe" quality={quality}/>}
  </group>;
}
