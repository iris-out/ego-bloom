import { useEffect, useMemo } from 'react';
import StaticBatch from '../StaticBatch.jsx';
import { SurfaceCurve, Shell } from './SurfaceParts.jsx';
import { VehicleWheels } from './FourVehicleParts.jsx';
import { FOUR_VEHICLE_LAYOUT } from './fourVehicleLayout.js';
import { createFerrariTeslaBody } from './ferrariTeslaGeometry.js';
import SupercarCabin from '../cockpits/SupercarCabin.jsx';

const L=FOUR_VEHICLE_LAYOUT.supercar, RED='#c8161c', DARK_RED='#810c13', BLACK='#101216';
function Skin({geometry,color=RED}) {return <mesh geometry={geometry} dispose={null} castShadow receiveShadow><meshStandardMaterial color={color} metalness={.38} roughness={.28}/></mesh>;}
function Bar({position,scale,color,rotation}) {return <mesh position={position} scale={scale} rotation={rotation}><boxGeometry/><meshStandardMaterial color={color} metalness={.25} roughness={.42}/></mesh>;}

export default function Supercar({wheelsRef,steer=0,speed=0,firstPerson=false}) {
  const geometry=useMemo(()=>createFerrariTeslaBody('supercar'),[]);
  useEffect(()=>()=>Object.values(geometry).forEach(g=>g.dispose()),[geometry]);
  return <group userData={{part:'supercar-model'}}>
    <StaticBatch>
      <Skin geometry={geometry.hood}/><Skin geometry={geometry.deck}/><Skin geometry={geometry.sides}/>
      <Skin geometry={geometry.floor} color="#242526"/>
      {/* A recessed cross-car face keeps the nose low and visually wide. */}
      <Bar position={[0,-.19,-2.375]} scale={[1.76,.22,.024]} color={BLACK}/>
      <Bar position={[0,-.37,-2.378]} scale={[1.48,.045,.024]} color="#202427"/>
      {[-1,1].map(side=><group key={side}>
        <SurfaceCurve color="#f2ede7" radius={.013} points={[[side*.52,-.07,-2.37],[side*.72,-.06,-2.378],[side*.90,-.09,-2.36]]}/>
        <Bar position={[side*.84,-.46,-2.365]} scale={[.22,.07,.022]} color={BLACK}/>
        {/* Dark barrel sits behind an actual gap cut into the side skin. */}
        <group userData={{part:'supercar-side-intake'}}>
          <Bar position={[side*.905,-.29,.17]} scale={[.03,.33,.92]} color="#07090a"/>
          <SurfaceCurve color={RED} radius={.025} points={[[side*1.055,-.08,-.35],[side*1.08,-.055,.04],[side*1.09,-.085,.58],[side*1.07,-.36,.68]]}/>
          <SurfaceCurve color={DARK_RED} radius={.018} points={[[side*1.035,-.48,-.34],[side*1.10,-.48,.15],[side*1.08,-.42,.69]]}/>
          <Bar position={[side*.918,-.20,.18]} scale={[.018,.025,.63]} color="#34383a"/>
        </group>
        <SurfaceCurve color={DARK_RED} radius={.013} points={[[side*1.04,.025,-.80],[side*1.08,.055,-.23],[side*1.10,.11,.53],[side*1.09,.18,1.26]]}/>
        <mesh position={[side*.74,-.07,2.389]} scale={[.45,.032,.014]}><boxGeometry/>
          <meshStandardMaterial color="#e3232c" emissive="#e3232c" emissiveIntensity={.85} roughness={.28}/>
        </mesh>
        <Shell userData={{part:'supercar-tail-buttress'}} color={RED} segments={18} steps={3} position={[side*.77,0,0]}
          stations={[{z:.73,rx:.10,ry:.035,cy:.27,power:4},{z:1.15,rx:.17,ry:.09,cy:.28,power:4},{z:1.68,rx:.18,ry:.065,cy:.22,power:4},{z:1.94,rx:.11,ry:.025,cy:.18,power:4}]}/>
      </group>)}
      <Bar position={[0,-.18,2.369]} scale={[1.80,.28,.018]} color={BLACK}/>
      <Bar position={[0,.09,2.379]} scale={[.28,.04,.023]} color="#8e9293"/>
      <Bar position={[0,-.48,2.379]} scale={[1.39,.075,.025]} color="#24272b"/>
      <Bar position={[0,.292,1.45]} scale={[.68,.025,.69]} color="#111418"/>
      {[-.22,0,.22].map(x=><Bar key={x} position={[x,.311,1.46]} scale={[.012,.018,.59]} color="#44484a"/>)}
    </StaticBatch>
    <group visible={!firstPerson} userData={{part:'camera-intersection'}}>
      <StaticBatch><SupercarCabin exterior wheelsRef={wheelsRef} steer={steer}/></StaticBatch>
    </group>
    <VehicleWheels layout={L} wheelsRef={wheelsRef} steer={steer} speed={speed}/>
  </group>;
}
