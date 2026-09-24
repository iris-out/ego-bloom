import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Block from './ModelBlock';
import { Airfoil } from './SurfaceParts.jsx';
import StaticBatch from '../StaticBatch.jsx';
import AirshipCabin from '../cockpits/AirshipCabin.jsx';

const CREAM = '#e6e0c9', TEAL = '#326f72', GOLD = '#b69458', METAL = '#4d6063';
const FIN = [
  {x:-6.8,front:13.3,back:15.6,thickness:.07},
  {x:-2.2,front:9.4,back:16,thickness:.2},
  {x:0,front:9,back:16.2,thickness:.24},
  {x:2.2,front:9.4,back:16,thickness:.2},
  {x:6.8,front:13.3,back:15.6,thickness:.07},
];

function Propeller({ side, glowRef, throttle, phase }) {
  const rotor = useRef();
  useFrame((_, delta) => {
    const live = glowRef?.current;
    const power = Math.max(0, Math.min(1, Number(live?.throttle ?? throttle) || 0));
    const stopped = (live?.phase ?? phase) === 'crashed';
    if (rotor.current && !stopped) rotor.current.rotation.z = (rotor.current.rotation.z + side*(8+power*35)*Math.min(delta,.05)) % (Math.PI*2);
  });
  return <group position={[side*3.35,1.5,1.2]}>
    <StaticBatch>
      <mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.34,.4,1.5,16]}/><meshStandardMaterial color={TEAL} metalness={.3} roughness={.42}/></mesh>
      <Block position={[-side*.8,-.1,.25]} scale={[1.6,.13,.24]} color={METAL}/>
    </StaticBatch>
    <group ref={rotor} position={[0,0,-.87]} userData={{dynamic:true,part:'airship-propeller'}}>
      <StaticBatch>
        <mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.17,.22,.28,12]}/><meshStandardMaterial color={GOLD} metalness={.5} roughness={.38}/></mesh>
        {[0,Math.PI*2/3,Math.PI*4/3].map(angle => <group key={angle} rotation={[0,0,angle]}>
          <Block position={[0,.72,0]} scale={[.16,1.2,.06]} rotation={[0,.2,0]} color={METAL}/>
          <Block position={[0,1.26,0]} scale={[.16,.13,.062]} color={CREAM}/>
        </group>)}
      </StaticBatch>
    </group>
  </group>;
}

/** Unarmed sightseeing airship. Nose -Z; envelope radii 5/5/16 at y=8.
 * Skid contact -1.9 matches FLIGHT_GROUND. Cabin is shared across views.
 * Only propellers animate; no flight, weapon or input state lives here. */
export default function Airship({ glowRef, throttle = 0, phase = 'runway', firstPerson = false }) {
  return <group>
    <StaticBatch>
      <group position={[0,8,0]} scale={[5,5,16]} userData={{part:'airship-envelope'}}>
        <mesh rotation={[Math.PI/2,0,0]}><sphereGeometry args={[1,48,24]}/><meshStandardMaterial color={CREAM} roughness={.75} metalness={.04}/></mesh>
        {/* Narrow longitudinal woven strips follow the envelope all the way to each pole. */}
        {Array.from({length:12},(_,i) => <mesh key={i} rotation={[Math.PI/2,0,0]} scale={1.001}>
          <sphereGeometry args={[1,3,24,i*Math.PI/6,.035]}/><meshStandardMaterial color={i%3===0?TEAL:GOLD} roughness={.65} metalness={.1}/>
        </mesh>)}
      </group>
      <Airfoil position={[0,8,0]} stations={FIN} color={TEAL}/>
      <Airfoil position={[0,8,0]} rotation={[0,0,Math.PI/2]} stations={FIN} color={TEAL}/>
      {[-1,1].map(side => <group key={side}>
        {[-4,1.8].map(z => <Block key={z} position={[side*1.15,2.5,z]} scale={[.11,1.3,.13]} color={METAL}/>)}
        <Block position={[side*1.43,-1.82,-2]} scale={[.15,.16,8.8]} color={METAL}/>
        {[-5,1].map(z => <Block key={z} position={[side*1.43,-1.69,z]} scale={[.1,.25,.16]} color={METAL}/>)}
      </group>)}
    </StaticBatch>
    {[-1,1].map(side => <Propeller key={side} side={side} glowRef={glowRef} throttle={throttle} phase={phase}/>)}
    <group visible={!firstPerson} userData={{part:'airship-exterior-cabin'}}>
      <AirshipCabin exterior quality="low"/>
    </group>
  </group>;
}
