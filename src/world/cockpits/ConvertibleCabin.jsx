import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FOUR_VEHICLE_LAYOUT } from '../models/fourVehicleLayout.js';
import { CabinPane, CabinSeat, CabinSteering } from '../models/FourVehicleParts.jsx';
import { Shell } from '../models/SurfaceParts.jsx';
import { beamBetween } from '../models/carGeometry.js';
import StaticBatch from '../StaticBatch.jsx';
import InstrumentDisplay from './InstrumentDisplay.jsx';
import Mirrors from './Mirrors.jsx';

const L = FOUR_VEHICLE_LAYOUT.convertible;
const INK = '#181b20', LEATHER = '#272329', PALE = '#c8bcb1', ROSE = '#9d6070', METAL = '#b5b0ad';

function SurfaceCurve({ points, radius = .01, color }) {
  const signature = JSON.stringify(points);
  const geometry = useMemo(() => new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(JSON.parse(signature).map(p => new THREE.Vector3(...p))),
    10, radius, 3, false,
  ), [signature, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} dispose={null}><meshStandardMaterial color={color} roughness={.43} metalness={.28}/></mesh>;
}

function Frame({ a, b, radius = .025, color = ROSE }) {
  const beam = beamBetween(a, b);
  return <mesh position={beam.position} quaternion={beam.quaternion}>
    <cylinderGeometry args={[radius, radius, beam.length, 10]} />
    <meshStandardMaterial color={color} metalness={.43} roughness={.32} />
  </mesh>;
}

function SportSeat({ position, rear = false, high = false, quality }) {
  const width = rear ? .40 : .46;
  return <group position={position} userData={{ part: 'convertible-seat' }}>
    <CabinSeat position={[0, 0, 0]} width={width} depth={rear ? .37 : .46} height={rear ? .42 : .59} color={LEATHER} sport quality={quality} />
    <Shell color={PALE} roughness={.8} metalness={.03} segments={quality==='low'?8:12} steps={1}
      position={[0, .045, -.015]} stations={[{z:-.16,rx:width*.29,ry:.009,power:3},{z:0,rx:width*.33,ry:.015,power:3},{z:.17,rx:width*.27,ry:.01,power:3}]} />
    {!rear && <Shell color={PALE} roughness={.82} metalness={.02} segments={quality==='low'?8:12} steps={1}
      position={[0, .26, .075]} rotation={[-.13,0,0]}
      stations={[{z:-.035,rx:width*.25,ry:.20,power:3},{z:.04,rx:width*.27,ry:.20,power:3}]} />}
    {!rear && <>
      {high && [-1,1].map(side => <SurfaceCurve key={side} color="#8e8582" radius={.004}
        points={[[side*.12,.10,.02],[side*.13,.24,.15],[side*.12,.41,.23]]} />)}
    </>}
  </group>;
}

function DoorCard({ side, mid }) {
  const x = side * (L.cabin.innerWidth / 2 - .015);
  return <group position={[x, 0, .12]} userData={{ part: 'convertible-door-card' }}>
    <Shell color={INK} roughness={.76} metalness={.05} segments={mid?20:12} steps={2}
      stations={[{z:-1.11,rx:.025,ry:.25,cy:-.17,power:4},{z:-.52,rx:.055,ry:.31,cy:-.18,power:5},{z:.36,rx:.05,ry:.30,cy:-.18,power:5},{z:.94,rx:.025,ry:.25,cy:-.18,power:4}]} />
    <Shell color={LEATHER} roughness={.82} segments={16} steps={1} position={[-side*.045,0,0]}
      stations={[{z:-.88,rx:.013,ry:.10,cy:-.10,power:4},{z:-.18,rx:.020,ry:.12,cy:-.10,power:4},{z:.67,rx:.014,ry:.10,cy:-.10,power:4}]} />
    <SurfaceCurve color={METAL} radius={.009} points={[[-side*.055,.09,-.99],[-side*.06,.10,-.32],[-side*.052,.09,.73]]} />
    <SurfaceCurve color={PALE} radius={.018} points={[[-side*.076,-.18,-.57],[-side*.11,-.13,-.39],[-side*.12,-.13,-.17]]} />
    <Shell color="#15171a" segments={12} steps={1} position={[-side*.083,-.31,.16]}
      stations={[{z:-.29,rx:.012,ry:.055,power:4},{z:.29,rx:.012,ry:.055,power:4}]} />
    {mid && <mesh position={[-side*.09,-.07,-.52]}><boxGeometry args={[.025,.016,.15]}/><meshStandardMaterial color={METAL} metalness={.72} roughness={.28}/></mesh>}
  </group>;
}

function Dashboard({ exterior, statusRef, night, mid, quality, wheelsRef, steer }) {
  const { dashY, dashZ, steering } = L.cabin;
  return <group userData={{ part: 'convertible-dashboard' }}>
    <Shell color={INK} metalness={.08} roughness={.69} segments={24} steps={2}
      stations={[{z:dashZ-.12,rx:.78,ry:.08,cy:dashY-.08,power:5},{z:dashZ+.02,rx:.90,ry:.095,cy:dashY-.12,power:5},{z:dashZ+.18,rx:.88,ry:.08,cy:dashY-.15,power:4}]} />
    <Shell color={LEATHER} roughness={.78} segments={20} steps={1} position={[0,-.17,-.71]}
      stations={[{z:-.025,rx:.81,ry:.055,power:5},{z:.025,rx:.82,ry:.055,power:5}]} />
    <SurfaceCurve color={ROSE} radius={.008} points={[[-.87,-.23,-.66],[-.3,-.22,-.67],[.4,-.22,-.67],[.87,-.21,-.69]]} />
    {/* Two close black glasses form the continuous, slightly curved BMW display. */}
    {[[-.42,.44],[.18,.72]].map(([x,width]) => <group key={x} position={[x,.265,-.735]}>
      <mesh><boxGeometry args={[width,.225,.025]}/><meshStandardMaterial color="#080b10" metalness={.26} roughness={.23}/></mesh>
      {exterior && <mesh position={[0,0,.015]}><planeGeometry args={[width-.024,.195]}/><meshBasicMaterial color="#19374a"/></mesh>}
    </group>)}
    {!exterior && <>
      <InstrumentDisplay mode="executiveCluster" position={[-.42,.265,-.714]} width={.41} height={.19} statusRef={statusRef} night={night} accent="#70bdec" />
      <InstrumentDisplay mode="roadnav" position={[.18,.265,-.714]} width={.68} height={.19} statusRef={statusRef} night={night} accent="#75b9d4" />
    </>}
    {mid && [-.55,-.40,.63,.78].map(x => <mesh key={x} position={[x,-.13,-.655]}>
      <boxGeometry args={[.12,.017,.012]}/><meshStandardMaterial color="#525b60" metalness={.6} roughness={.36}/>
    </mesh>)}
    <CabinSteering position={steering} radius={.173} tilt={-.36} wheelsRef={wheelsRef} steer={steer} statusRef={statusRef} quality={quality} />
  </group>;
}

function Console({ high }) {
  return <group userData={{ part: 'convertible-console' }}>
    <Shell color={LEATHER} roughness={.72} metalness={.05} segments={high?16:12} steps={1}
      stations={[{z:-.70,rx:.14,ry:.06,cy:-.30,power:4},{z:-.22,rx:.20,ry:.09,cy:-.28,power:5},{z:.34,rx:.19,ry:.08,cy:-.26,power:5},{z:.73,rx:.17,ry:.07,cy:-.28,power:4}]} />
    <Shell color="#171a1f" roughness={.25} metalness={.25} segments={high?12:8} steps={1} position={[0,-.18,-.20]}
      stations={[{z:-.31,rx:.13,ry:.012,power:4},{z:.31,rx:.17,ry:.012,power:4}]} />
    <mesh position={[-.075,-.11,-.42]} rotation={[-.18,0,0]}><boxGeometry args={[.075,.12,.085]}/><meshStandardMaterial color="#8d9298" metalness={.68} roughness={.27}/></mesh>
    <mesh position={[.09,-.14,-.11]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.058,.058,.023,18]}/><meshStandardMaterial color={METAL} metalness={.68} roughness={.23}/></mesh>
    {[.12,.25].map(z => <mesh key={z} position={[-.07,-.13,z]} rotation={[Math.PI/2,0,0]}>
      <torusGeometry args={[.047,.008,6,16]}/><meshStandardMaterial color="#8d9298" metalness={.72} roughness={.28}/>
    </mesh>)}
    {high && Array.from({length:7},(_,i) => <mesh key={i} position={[.13,-.13,-.40+i*.052]}>
      <boxGeometry args={[.014,.008,.026]}/><meshStandardMaterial color={METAL} metalness={.7} roughness={.28}/>
    </mesh>)}
  </group>;
}

export default function ConvertibleCabin({ statusRef, night = false, quality = 'medium', exterior = false, wheelsRef, steer = 0 }) {
  const mid = quality !== 'low', high = quality === 'high';
  const w = L.windshield;
  return <group userData={{ part: 'convertible-cabin' }}>
    <StaticBatch version={quality}>
      {/* Tub lining remains below the belt, keeping both rear seats open to view. */}
      <mesh position={[0,L.cabin.floorY+.035,.14]}><boxGeometry args={[1.75,.065,2.30]}/><meshStandardMaterial color="#202126" roughness={.9}/></mesh>
      <mesh position={[0,-.30,1.30]}><boxGeometry args={[1.70,.33,.075]}/><meshStandardMaterial color={LEATHER} roughness={.79}/></mesh>
      <CabinPane corners={w} color="#7191a1" opacity={.19} quality={quality} />
      <Frame a={w[0]} b={w[3]} radius={.026}/><Frame a={w[1]} b={w[2]} radius={.026}/>
      <Frame a={w[3]} b={w[2]} radius={.021} color="#26232a" />
      <Frame a={w[0]} b={w[1]} radius={.018} color="#252329" />
      {[-1,1].map(side => <group key={side}>
        <mesh position={[side*1.085,.15,-.80]} rotation={[0,side*.22,0]}><boxGeometry args={[.15,.105,.23]}/><meshStandardMaterial color={ROSE} metalness={.45} roughness={.3}/></mesh>
        <mesh position={[side*1.095,.155,-.785]}><boxGeometry args={[.012,.065,.17]}/><meshStandardMaterial color="#222d34" metalness={.3} roughness={.18}/></mesh>
        <SurfaceCurve color={ROSE} radius={.022} points={[[side*.94,.12,-.96],[side*.98,.135,-.30],[side*1.0,.15,.57],[side*.93,.13,1.34]]}/>
      </group>)}
      <Dashboard exterior={exterior} statusRef={statusRef} night={night} mid={mid} quality={quality} wheelsRef={wheelsRef} steer={steer} />
      <Console high={high} />
      {L.cabin.frontSeats.map((position,i) => <SportSeat key={`front-${i}`} position={position} high={high} quality={quality}/>)}
      {L.cabin.rearSeats.map((position,i) => <SportSeat key={`rear-${i}`} position={position} rear quality={quality}/>)}
      {[-1,1].map(side => <DoorCard key={side} side={side} mid={mid} />)}
    </StaticBatch>
    {!exterior && <Mirrors vehicle="convertible" quality={quality} />}
  </group>;
}
