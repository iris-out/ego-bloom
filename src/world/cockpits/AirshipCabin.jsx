import * as THREE from 'three';
import Block from '../models/ModelBlock';
import StaticBatch from '../StaticBatch.jsx';
import InstrumentDisplay from './InstrumentDisplay.jsx';
import { Yoke, Lever } from './parts.jsx';

const CREAM = '#e3dcc6', TEAL = '#326f72', WOOD = '#755744', DARK = '#253b40';

/** Shared gondola interior; eye [0,.9,-5.2], floor -1.6, nose -Z.
 * The broad front pane has no centre pillar. Waist rails stay below the eye.
 * Exterior uses the same seats/frames with inexpensive dormant instruments. */
export default function AirshipCabin({ statusRef, controlsRef, night = false, quality = 'medium', exterior = false }) {
  const mid = quality !== 'low';
  return <group userData={{ part: 'airship-cabin' }}>
    <StaticBatch version={`${quality}:${exterior}`}>
      <Block position={[0,-1.66,-2.2]} scale={[3.3,.12,9.6]} color={WOOD}/>
      <Block position={[0,1.95,-2.2]} scale={[3.5,.15,9.8]} color={CREAM}/>
      <Block position={[0,-.97,-6.98]} scale={[3.3,1.25,.12]} color={TEAL}/>
      <Block position={[0,.05,-7]} scale={[3.35,.09,.09]} color={CREAM}/>
      <mesh position={[0,.94,-7]} userData={{ glass: true }}>
        <planeGeometry args={[3.3,1.72]}/>
        <meshStandardMaterial color="#acd3da" transparent opacity={exterior ? .24 : .07} depthWrite={false} side={THREE.DoubleSide} roughness={.19}/>
      </mesh>
      {[-1,1].map(side => <group key={side}>
        <Block position={[side*1.64,-1,-2.2]} scale={[.1,1.2,9.5]} color={TEAL}/>
        <Block position={[side*1.65,.03,-2.2]} scale={[.08,.1,9.55]} color={CREAM}/>
        {[-6.98,-3,.65,2.57].map(z => <Block key={z} position={[side*1.65,.97,z]} scale={[.075,1.9,.075]} color={CREAM}/>)}
        <mesh position={[side*1.65,.94,-2.2]} rotation={[0,Math.PI/2,0]} userData={{ glass: true }}>
          <planeGeometry args={[9.55,1.72]}/><meshStandardMaterial color="#acd3da" transparent opacity={exterior ? .24 : .055} depthWrite={false} side={THREE.DoubleSide} roughness={.2}/>
        </mesh>
        {[-2,.6].map(z => <group key={z}>
          <Block position={[side*.95,-1.05,z]} scale={[.93,.23,1.15]} color={CREAM}/>
          <Block position={[side*.95,-.53,z+.5]} scale={[.93,.96,.18]} color={TEAL}/>
          <Block position={[side*.95,-1.36,z]} scale={[.12,.5,.76]} color={DARK}/>
        </group>)}
      </group>)}
      <Block position={[0,-.52,2.6]} scale={[3.3,2.15,.12]} color={CREAM}/>
      <Block position={[0,-.01,-6.8]} scale={[2.65,.36,.3]} color={DARK}/>
      <Block position={[0,.205,-6.77]} scale={[2.75,.07,.4]} color={WOOD}/>
      <Block position={[0,-.94,-4.63]} scale={[.88,.23,.95]} color={TEAL}/>
      <Block position={[0,-.36,-4.2]} scale={[.88,1.05,.18]} color={TEAL}/>
      <Yoke position={[0,-.25,-6]} radius={.24} get={() => (controlsRef?.current?.roll || 0)*.65}/>
      <Lever position={[.99,.01,-6.54]} get={() => statusRef?.current?.throttle || 0} knob={TEAL}/>
      {exterior ? <Block position={[0,-.01,-6.639]} scale={[1.55,.27,.025]} color="#162c35"/> : <InstrumentDisplay mode="flight" title="AIRSHIP" position={[0,-.01,-6.636]} width={1.55} height={.27} statusRef={statusRef} night={night} accent="#99d8cc"/>}
      {mid && [-1.11,-.92,.92,1.11].map(x => <mesh key={x} position={[x,0,-6.62]} rotation={[Math.PI/2,0,0]}>
        <cylinderGeometry args={[.04,.04,.035,8]}/><meshStandardMaterial color={CREAM} metalness={.3} roughness={.5}/>
      </mesh>)}
      {quality === 'high' && [-1,1].map(side => <Block key={side} position={[side*1.58,-.55,-1.5]} scale={[.055,.045,5.5]} color={WOOD}/>)}
    </StaticBatch>
  </group>;
}
