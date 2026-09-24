import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import StaticBatch from '../StaticBatch.jsx';
import { Shell } from '../models/SurfaceParts.jsx';
import { CabinPane, CabinSeat, CabinSteering } from '../models/FourVehicleParts.jsx';
import { FOUR_VEHICLE_LAYOUT } from '../models/fourVehicleLayout.js';
import InstrumentDisplay from './InstrumentDisplay.jsx';
import Mirrors from './Mirrors.jsx';

const L=FOUR_VEHICLE_LAYOUT.supercar,C=L.cabin;
const INK='#17191c',CARBON='#25282a',LEATHER='#26282b',RED='#bd151b',YELLOW='#d9b73f';
const FRONT=L.windshield;
function Bar({position,scale,color=INK,rotation}) {return <mesh position={position} scale={scale} rotation={rotation}><boxGeometry/><meshStandardMaterial color={color} roughness={.65} metalness={.14}/></mesh>;}
function TrimCurve({points,radius,color,quality}) {
  const signature=JSON.stringify(points);
  const geometry=useMemo(()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(JSON.parse(signature).map(p=>new THREE.Vector3(...p))),quality==='high'?24:quality==='low'?8:12,radius,quality==='high'?6:quality==='low'?3:4,false),[signature,radius,quality]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} dispose={null}><meshStandardMaterial color={color} roughness={.50}/></mesh>;
}
function Patch({corners,color}) {
  const signature=JSON.stringify(corners);
  const geometry=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(JSON.parse(signature).flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return g;},[signature]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} dispose={null}><meshStandardMaterial color={color} side={THREE.DoubleSide} metalness={.25} roughness={.34}/></mesh>;
}
function Screen({position,width,height,mode,statusRef,night,exterior}) {return exterior
  ? <Bar position={position} scale={[width+.02,height+.02,.016]} color="#0b1014"/>
  : <InstrumentDisplay mode={mode} statusRef={statusRef} position={position} width={width} height={height} night={night} accent="#e5ca81"/>;}

export default function SupercarCabin({statusRef,night=false,quality='medium',exterior=false,wheelsRef,steer=0}) {
  const high=quality==='high',mid=quality!=='low';
  return <group userData={{part:'supercar-cabin'}}>
    <StaticBatch version={quality}>
      {/* Shared floor, full depth side trim and a closed rear engine bulkhead. */}
      <Bar position={[0,C.floorY-.008,(C.frontZ+C.rearZ)/2]} scale={[C.innerWidth,.04,C.rearZ-C.frontZ]} color="#26282b"/>
      <Bar position={[0,-.16,C.rearZ-.03]} scale={[1.79,.77,.09]} color={CARBON}/>
      <Bar position={[0,.28,.89]} scale={[1.42,.10,.15]} color="#111315"/>
      <Shell color="#12171b" roughness={.90} metalness={.03} segments={mid?20:12} steps={mid?3:1}
        stations={[{z:-.40,rx:.64,ry:.012,cy:.49,power:4},{z:-.04,rx:.71,ry:.023,cy:.50,power:4},{z:.40,rx:.69,ry:.020,cy:.47,power:4},{z:.73,rx:.62,ry:.016,cy:.36,power:4},{z:.92,rx:.56,ry:.012,cy:.28,power:4}]}/>
      <CabinPane corners={FRONT} opacity={.21} color="#35505b"/>
      {[-1,1].map(side=><group key={side}>
        <TrimCurve quality={quality} color={RED} radius={.026} points={[[side*.86,.04,-.96],[side*.78,.31,-.60],[side*.70,.47,-.39]]}/>
        <TrimCurve quality={quality} color={INK} radius={.024} points={[[side*.70,.47,-.39],[side*.71,.49,.04],[side*.70,.47,.32],[side*.72,.33,.80]]}/>
        <CabinPane corners={[[side*.86,.09,-.85],[side*.70,.47,-.38],[side*.70,.47,.28],[side*.90,.10,.30]]} opacity={.70} color="#1a2932"/>
        <Patch color={RED} corners={[[side*.70,.47,.28],[side*.72,.33,.80],[side*1.04,.17,1.09],[side*.90,.10,.56]]}/>
        <Bar position={[side*.875,-.07,-.29]} scale={[.085,.23,1.23]} color={RED}/>
        <Bar position={[side*.866,.06,.43]} scale={[.09,.17,.77]} color={RED}/>
        <Bar position={[side*.78,-.40,.31]} scale={[.22,.30,.60]} color="#1d2023"/>
        <Bar position={[side*1.01,.12,-.68]} scale={[.29,.025,.035]} color={INK}/>
        <Bar position={[side*1.17,.16,-.68]} scale={[.11,.10,.15]} color={RED} rotation={[0,side*.15,0]}/>
      </group>)}
      <TrimCurve quality={quality} color={RED} radius={.029} points={[FRONT[3],[0,.50,-.38],FRONT[2]]}/>
      <Bar position={[0,.31,.86]} scale={[1.25,.045,.07]} color={INK}/>
      {/* Dash left and right are separate curved, supported structures. */}
      <group userData={{part:'supercar-dashboard'}}>
        <Shell color={LEATHER} metalness={.08} roughness={.76} segments={mid?22:12} steps={mid?3:1}
          position={[-.49,C.dashY-.10,C.dashZ+.09]} stations={[{z:-.16,rx:.33,ry:.095,power:4},{z:0,rx:.38,ry:.11,power:4},{z:.18,rx:.34,ry:.08,power:4}]}/>
        <Shell color={LEATHER} metalness={.08} roughness={.76} segments={mid?22:12} steps={mid?3:1}
          position={[.47,C.dashY-.10,C.dashZ+.09]} stations={[{z:-.16,rx:.35,ry:.075,power:4},{z:0,rx:.43,ry:.105,power:4},{z:.18,rx:.39,ry:.07,power:4}]}/>
        <TrimCurve quality={quality} color="#565b5b" radius={.009} points={[[-.80,.01,-.70],[-.54,.055,-.71],[-.13,.015,-.73],[.18,.03,-.73],[.74,.005,-.70]]}/>
        <Bar position={[-.52,-.20,-.74]} scale={[.10,.29,.09]} color={CARBON}/>
        <Bar position={[.46,-.23,-.75]} scale={[.10,.30,.10]} color={CARBON}/>
        <Screen position={[-.50,.15,-.704]} width={.38} height={.17} mode="ferrariTach" statusRef={statusRef} night={night} exterior={exterior}/>
        <Screen position={[.48,.12,-.696]} width={.32} height={.10} mode="roadnav" statusRef={statusRef} night={night} exterior={exterior}/>
        <Bar position={[0,-.33,-.51]} scale={[.22,.07,.63]} color={CARBON}/>
        <Bar position={[0,-.42,.04]} scale={[.29,.12,.76]} color={INK}/>
        <Bar position={[0,-.27,-.12]} scale={[.22,.025,.30]} color="#73787a"/>
        <Bar position={[0,-.27,-.12]} scale={[.15,.027,.25]} color="#151719"/>
        {[0,.055,.11].map(o=><Bar key={o} position={[-.065+o,-.24,-.17+o*.8]} scale={[.01,.024,.11]} color="#c4c6c0"/>)}
        {mid&&<Bar position={[.0,-.225,.075]} scale={[.10,.025,.07]} color={RED}/>}
      </group>
      {C.frontSeats.map((position,i)=><group key={i} position={position} userData={{part:'supercar-seat'}}>
        <CabinSeat position={[0,0,0]} width={.49} depth={.48} height={.63} color={LEATHER} sport quality={quality}/>
        <Bar position={[0,.055,-.055]} scale={[.24,.012,.27]} color={YELLOW}/>
        <Bar position={[0,.27,.106]} scale={[.21,.34,.012]} color={YELLOW} rotation={[-.12,0,0]}/>
        <Bar position={[0,.53,.179]} scale={[.15,.035,.012]} color={YELLOW}/>
        {high&&[-1,1].map(side=><TrimCurve key={side} quality={quality} color="#777978" radius={.004} points={[[side*.17,.09,-.18],[side*.18,.22,.07],[side*.16,.45,.14]]}/>)}
      </group>)}
      {[-1,1].map(side=><group key={side} userData={{part:'supercar-door-card'}}>
        <Bar position={[side*(C.innerWidth/2-.02),-.31,-.02]} scale={[.045,.44,1.50]} color={CARBON}/>
        <Bar position={[side*.865,-.10,-.08]} scale={[.035,.10,1.33]} color={LEATHER}/>
        <Bar position={[side*.826,-.24,-.15]} scale={[.05,.055,.55]} color="#777773"/>
        <Bar position={[side*.822,-.42,.21]} scale={[.05,.19,.56]} color="#101214"/>
        <Bar position={[side*.815,-.39,.12]} scale={[.013,.03,.41]} color="#606368"/>
        {mid&&<Bar position={[side*.818,-.075,-.55]} scale={[.028,.04,.15]} color="#a3a5a4"/>}
      </group>)}
    </StaticBatch>
    <CabinSteering position={C.steering} radius={.16} wheelsRef={wheelsRef} steer={steer} statusRef={statusRef} quality={quality}/>
    {!exterior&&<Mirrors vehicle="supercar" quality={quality}/>}
  </group>;
}
