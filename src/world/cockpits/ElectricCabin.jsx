import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import StaticBatch from '../StaticBatch.jsx';
import { Shell } from '../models/SurfaceParts.jsx';
import { CabinPane, CabinSeat, CabinSteering } from '../models/FourVehicleParts.jsx';
import { FOUR_VEHICLE_LAYOUT } from '../models/fourVehicleLayout.js';
import InstrumentDisplay from './InstrumentDisplay.jsx';
import Mirrors from './Mirrors.jsx';

const L=FOUR_VEHICLE_LAYOUT.electric,C=L.cabin;
const INK='#1d2226',SOFT='#d4d7d2',SEAT='#e8e9e5',WOOD='#8a674a',WHITE='#dce1e2';
function Bar({position,scale,color=INK,rotation}) {return <mesh position={position} scale={scale} rotation={rotation}><boxGeometry/><meshStandardMaterial color={color} roughness={color===WOOD?.68:.75} metalness={.06}/></mesh>;}
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
  return <mesh geometry={geometry} dispose={null}><meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={.36} metalness={.18}/></mesh>;
}
const DRIVER_SCREEN=[-.56,.345,-.875],CENTER_SCREEN=[.11,.29,-.832],REAR_SCREEN=[0,-.12,.84];
function Screen({position,width,height,mode,statusRef,night,exterior}) {return exterior
  ? <Bar position={position} scale={[width+.02,height+.02,.018]} color="#10161b"/>
  : <InstrumentDisplay mode={mode} statusRef={statusRef} position={position} width={width} height={height} night={night} accent="#80c9ea"/>;}

export default function ElectricCabin({statusRef,night=false,quality='medium',exterior=false,wheelsRef,steer=0}) {
  const high=quality==='high',mid=quality!=='low';
  return <group userData={{part:'electric-cabin'}}>
    <StaticBatch version={quality}>
      <Bar position={[0,C.floorY-.018,(C.frontZ+C.rearZ)/2]} scale={[C.innerWidth,.045,C.rearZ-C.frontZ]} color="#303539"/>
      <Bar position={[0,.05,1.56]} scale={[1.80,.50,.08]} color={INK}/>
      <CabinPane corners={L.windshield} opacity={.23} color="#587581"/>
      <CabinPane corners={[[ -.67,.65,1.13],[.67,.65,1.13],[.76,.30,1.77],[-.76,.30,1.77]]} opacity={.46} color="#1d3039"/>
      {/* One sweeping glass roof flows into the fastback hatch. */}
      <Shell color="#121a21" metalness={.02} roughness={.92} segments={high?24:mid?16:12} steps={high?4:mid?2:1}
        stations={[{z:-.43,rx:.73,ry:.013,cy:.84,power:4},{z:.10,rx:.76,ry:.022,cy:.87,power:4},{z:.53,rx:.74,ry:.019,cy:.81,power:4},{z:1.04,rx:.67,ry:.017,cy:.66,power:4},{z:1.50,rx:.62,ry:.012,cy:.43,power:4},{z:1.78,rx:.58,ry:.010,cy:.29,power:4}]}/>
      <TrimCurve quality={quality} color={WHITE} radius={.023} points={[L.windshield[3],[0,.86,-.43],L.windshield[2]]}/>
      {[-1,1].map(side=><group key={side}>
        <TrimCurve quality={quality} color={WHITE} radius={.025} points={[[side*.91,.20,-1.13],[side*.84,.59,-.74],[side*.77,.84,-.43]]}/>
        <TrimCurve quality={quality} color={WHITE} radius={.023} points={[[side*.77,.84,-.43],[side*.76,.87,.25],[side*.72,.78,.64],[side*.66,.65,1.11],[side*.78,.29,1.75]]}/>
        <CabinPane corners={[[side*.91,.22,-1.05],[side*.77,.83,-.43],[side*.76,.83,.29],[side*.94,.24,.30]]} opacity={.65} color="#243a46"/>
        <CabinPane corners={[[side*.94,.24,.32],[side*.76,.83,.30],[side*.69,.67,.96],[side*.94,.25,1.02]]} opacity={.65} color="#243a46"/>
        <Patch color={WHITE} corners={[[side*.69,.67,.96],[side*.66,.54,1.28],[side*.84,.29,1.77],[side*.94,.25,1.02]]}/>
        <Bar position={[side*.855,.50,.30]} scale={[.055,.62,.06]} color={WHITE} rotation={[-.08,0,side*.04]}/>
        <Bar position={[side*.91,.21,-.27]} scale={[.09,.10,1.58]} color={WHITE}/>
        <Bar position={[side*.91,.21,1.11]} scale={[.09,.10,1.10]} color={WHITE}/>
        <Bar position={[side*1.16,.36,-.72]} scale={[.11,.09,.15]} color={WHITE}/>
      </group>)}
      <Bar position={[0,.30,1.77]} scale={[1.49,.035,.09]} color={INK}/>
      <group userData={{part:'electric-dashboard'}}>
        <Shell color={INK} segments={mid?24:14} steps={mid?3:1} position={[0,.11,C.dashZ]}
          stations={[{z:-.16,rx:.86,ry:.095,power:5},{z:0,rx:.93,ry:.14,power:5},{z:.18,rx:.91,ry:.08,power:5}]}/>
        <Bar position={[0,.19,-.787]} scale={[1.72,.035,.025]} color={WOOD}/>
        <Bar position={[0,.125,-.774]} scale={[1.72,.013,.020]} color="#090f12"/>
        <Bar position={[0,-.04,-.79]} scale={[1.64,.26,.06]} color={SOFT}/>
        <Bar position={[-.56,-.06,-.83]} scale={[.09,.26,.08]} color={SOFT}/>
        <Bar position={[.63,-.06,-.83]} scale={[.09,.26,.08]} color={SOFT}/>
        <Screen position={DRIVER_SCREEN} width={.38} height={.15} mode="teslaDriver" statusRef={statusRef} night={night} exterior={exterior}/>
        <group userData={{part:'electric-landscape-screen'}}>
          <Screen position={CENTER_SCREEN} width={.53} height={.30} mode="roadnav" statusRef={statusRef} night={night} exterior={exterior}/>
        </group>
      </group>
      <group userData={{part:'electric-console'}}>
        <Shell color={SOFT} segments={high?22:mid?16:12} steps={high?3:mid?2:1} position={[0,-.35,.00]}
          stations={[{z:-.60,rx:.22,ry:.12,power:5},{z:-.12,rx:.26,ry:.13,power:5},{z:.62,rx:.27,ry:.12,power:5},{z:.81,rx:.22,ry:.09,power:5}]}/>
        <Bar position={[0,-.22,-.16]} scale={[.38,.018,.45]} color="#252c30"/>
        <Bar position={[0,-.20,.31]} scale={[.40,.024,.26]} color="#a8ada9"/>
        {mid&&[-.095,.095].map(x=><mesh key={x} position={[x,-.181,.38]} rotation={[-Math.PI/2,0,0]}><torusGeometry args={[.066,.010,high?7:4,high?20:12]}/><meshStandardMaterial color="#444b4f" roughness={.55}/></mesh>)}
        <Bar position={[0,-.28,.75]} scale={[.28,.23,.08]} color={INK}/>
        <Screen position={REAR_SCREEN} width={.22} height={.13} mode="roadnav" statusRef={statusRef} night={night} exterior={exterior}/>
      </group>
      {C.frontSeats.map((position,i)=><group key={`front-${i}`} position={position} userData={{part:'electric-seat'}}>
        <CabinSeat position={[0,0,0]} width={.51} depth={.49} height={.66} color={SEAT} quality={quality}/>
        <Bar position={[0,.052,-.04]} scale={[.27,.008,.28]} color={SOFT}/>
        <Bar position={[0,.32,.11]} scale={[.26,.30,.012]} color={SOFT} rotation={[-.10,0,0]}/>
      </group>)}
      <Bar position={[0,-.46,1.07]} scale={[1.58,.22,.58]} color={SEAT}/>
      {C.rearSeats.map((position,i)=><group key={`rear-${i}`} position={position} userData={{part:'electric-seat'}}>
        {quality==='low' ? <>
          <Bar position={[0,.015,0]} scale={[i===1?.39:.46,.12,.43]} color={SEAT}/>
          <Bar position={[0,.26,.15]} scale={[i===1?.38:.45,.47,.10]} color={SEAT} rotation={[-.10,0,0]}/>
        </> : <>
          <CabinSeat position={[0,0,0]} width={i===1?.41:.48} depth={.43} height={.59} color={SEAT} quality={quality}/>
          <Bar position={[0,.25,.125]} scale={[i===1?.25:.27,.30,.01]} color={SOFT} rotation={[-.10,0,0]}/>
        </>}
      </group>)}
      {[-1,1].flatMap(side=>[-1,1].map(row=>{
        const z=row<0?-.48:1.04,depth=row<0?1.36:1.10;
        return <group key={`${side}-${row}`} userData={{part:'electric-door-card'}}>
          <Bar position={[side*(C.innerWidth/2-.026),-.28,z]} scale={[.047,.68,depth]} color={SOFT}/>
          <Bar position={[side*.89,.055,z]} scale={[.036,.035,depth-.06]} color={WOOD}/>
          <Bar position={[side*.88,-.17,z-.09]} scale={[.028,.06,.35]} color="#8b9497"/>
          {mid&&<Bar position={[side*.883,-.43,z+.20]} scale={[.022,.14,.40]} color="#b0b5b1"/>}
          {high&&<Bar position={[side*.878,-.13,z-.30]} scale={[.016,.025,.11]} color={INK}/>}
        </group>;
      }))}
    </StaticBatch>
    <CabinSteering position={C.steering} radius={.19} yoke wheelsRef={wheelsRef} steer={steer} statusRef={statusRef} quality={quality}/>
    {!exterior&&<Mirrors vehicle="electric" quality={quality}/>}
  </group>;
}
