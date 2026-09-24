import { useEffect, useMemo } from 'react';
import StaticBatch from '../StaticBatch.jsx';
import { SurfaceCurve, Shell } from './SurfaceParts.jsx';
import { VehicleWheels } from './FourVehicleParts.jsx';
import { FOUR_VEHICLE_LAYOUT } from './fourVehicleLayout.js';
import { createFerrariTeslaBody } from './ferrariTeslaGeometry.js';
import ElectricCabin from '../cockpits/ElectricCabin.jsx';

const L=FOUR_VEHICLE_LAYOUT.electric, WHITE='#dce1e2', SHADE='#b4bec3', DARK='#15191c';
function Skin({geometry,color=WHITE}) {return <mesh geometry={geometry} dispose={null} castShadow receiveShadow><meshStandardMaterial color={color} metalness={.26} roughness={.29}/></mesh>;}
function Bar({position,scale,color,rotation}) {return <mesh position={position} scale={scale} rotation={rotation}><boxGeometry/><meshStandardMaterial color={color} metalness={.25} roughness={.43}/></mesh>;}

export default function Electric({wheelsRef,steer=0,speed=0,firstPerson=false}) {
  const geometry=useMemo(()=>createFerrariTeslaBody('electric'),[]);
  useEffect(()=>()=>Object.values(geometry).forEach(g=>g.dispose()),[geometry]);
  return <group userData={{part:'electric-model'}}>
    <StaticBatch>
      <Skin geometry={geometry.hood}/><Skin geometry={geometry.deck}/><Skin geometry={geometry.sides}/>
      <Skin geometry={geometry.floor} color="#30373c"/>
      {/* Continuous closed face, with a slim lower cooling slot only. */}
      <Shell color={WHITE} segments={26} steps={2} position={[0,-.35,-2.43]}
        stations={[{z:-.04,rx:.84,ry:.20,power:5},{z:.04,rx:.91,ry:.23,power:5}]}/>
      <Bar position={[0,-.50,-2.48]} scale={[1.03,.055,.018]} color={DARK}/>
      <Bar position={[0,-.57,-2.45]} scale={[1.51,.028,.025]} color={SHADE}/>
      {[-1,1].map(side=><group key={side}>
        <Bar position={[side*.75,-.085,-2.505]} scale={[.44,.07,.022]} color="#273238" rotation={[0,0,-side*.04]}/>
        <SurfaceCurve color="#e2f4ff" radius={.009} points={[[side*.52,-.056,-2.508],[side*.72,-.045,-2.512],[side*.93,-.079,-2.50]]}/>
        <Bar position={[side*1.064,.13,-.49]} scale={[.009,.026,.20]} color="#8b989c"/>
        <Bar position={[side*1.065,.13,.90]} scale={[.009,.026,.20]} color="#8b989c"/>
        <SurfaceCurve color={SHADE} radius={.008} points={[[side*1.04,-.01,-1.13],[side*1.065,.13,-.40],[side*1.065,.15,.90],[side*1.04,.12,1.57]]}/>
        <Bar position={[side*.75,.105,2.493]} scale={[.45,.065,.008]} color="#272c30"/>
        <Bar position={[side*.75,.110,2.502]} scale={[.42,.022,.008]} color="#c4222b"/>
        <Bar position={[side*.86,-.20,2.47]} scale={[.14,.10,.026]} color={WHITE}/>
      </group>)}
      <Bar position={[0,.07,2.495]} scale={[.43,.065,.010]} color={WHITE}/>
      <Bar position={[0,-.30,2.496]} scale={[1.52,.075,.010]} color={SHADE}/>
      <SurfaceCurve color="#b4bfc0" radius={.01} points={[[-.79,.27,1.54],[0,.30,1.62],[.79,.27,1.54]]}/>
    </StaticBatch>
    <group visible={!firstPerson} userData={{part:'camera-intersection'}}>
      <StaticBatch><ElectricCabin exterior wheelsRef={wheelsRef} steer={steer}/></StaticBatch>
    </group>
    <VehicleWheels layout={L} wheelsRef={wheelsRef} steer={steer} speed={speed}/>
  </group>;
}
