import { useEffect, useMemo } from 'react';
import { FOUR_VEHICLE_LAYOUT } from './fourVehicleLayout.js';
import { VehicleWheels } from './FourVehicleParts.jsx';
import { createBmwClsBody } from './bmwClsGeometry.js';
import { flatPolygonGeometry } from './carGeometry.js';
import { SurfaceCurve } from './SurfaceParts.jsx';
import StaticBatch from '../StaticBatch.jsx';
import CoupeCabin from '../cockpits/CoupeCabin.jsx';

const L = FOUR_VEHICLE_LAYOUT.coupe;
const SILVER = '#aeb1b4', LIGHT = '#d0d2d1', SHADOW = '#777e83';
const CHROME = '#cbd0d0', INK = '#20272c';

function Face({ outline, z, color, metalness = .2, roughness = .4 }) {
  const signature = JSON.stringify(outline);
  const geometry = useMemo(() => flatPolygonGeometry(JSON.parse(signature), z), [signature,z]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} dispose={null}>
    <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} side={2}/>
  </mesh>;
}

export default function Coupe({ wheelsRef, steer = 0, speed = 0, firstPerson = false }) {
  const body = useMemo(() => createBmwClsBody('coupe'), []);
  useEffect(() => () => Object.values(body).forEach(geometry => geometry.dispose()), [body]);
  return <group userData={{ part: 'coupe-model' }}>
    <StaticBatch>
      {Object.entries(body).map(([key,geometry]) => <mesh key={key} geometry={geometry} dispose={null} userData={{ part: `coupe-${key}` }}>
        <meshStandardMaterial color={SILVER} metalness={.48} roughness={.31} side={2}/>
      </mesh>)}
      {[-1,1].map(side => <group key={side}>
        {/* Long unbroken shoulder, modest wheel swell, and two distinct side doors. */}
        <SurfaceCurve color={LIGHT} radius={.011} points={[[side*.78,.24,-1.10],[side*.96,.22,-.55],[side*1.08,.19,.18],[side*1.085,.19,1.10],[side*1.025,.17,1.88]]}/>
        <SurfaceCurve color={SHADOW} radius={.007} points={[[side*1.075,-.17,-.69],[side*1.09,-.21,-.13],[side*1.09,-.20,.65],[side*1.078,-.19,1.05]]}/>
        <SurfaceCurve color={LIGHT} radius={.010} points={[[side*.79,.23,-1.10],[side*.83,.26,-1.51],[side*.77,.24,-2.20],[side*.68,.18,-2.49]]}/>
        {[-1.08,.37,1.48].map((z,i) => <SurfaceCurve key={i} color={SHADOW} radius={.006}
          points={[[side*1.02,.17,z],[side*1.095,-.10,z+.02],[side*1.05,-.50,z+.045]]}/>)}
        {[-.58,.80].map(z => <group key={z}>
          <mesh position={[side*1.108,.095,z]}><boxGeometry args={[.020,.022,.17]}/><meshStandardMaterial color={CHROME} metalness={.78} roughness={.24}/></mesh>
          <mesh position={[side*1.116,.082,z]}><boxGeometry args={[.009,.009,.11]}/><meshStandardMaterial color={SHADOW} metalness={.24} roughness={.45}/></mesh>
        </group>)}
        {/* Narrow tapered lights continue into the side fender. */}
        <Face z={-2.521} color="#17242c" outline={side<0
          ? [[-.96,.09],[-.65,.095],[-.45,.025],[-.55,-.025],[-.95,.02]]
          : [[.45,.025],[.65,.095],[.96,.09],[.95,.02],[.55,-.025]]}/>
        <SurfaceCurve color="#e9f2f1" radius={.010} points={[[side*.93,.07,-2.531],[side*.75,.071,-2.531],[side*.54,.02,-2.531]]}/>
        <Face z={-2.522} color={INK} outline={side<0
          ? [[-.94,-.20],[-.72,-.19],[-.64,-.45],[-.94,-.42]]
          : [[.72,-.19],[.94,-.20],[.94,-.42],[.64,-.45]]}/>
        <SurfaceCurve color="#a72530" radius={.033} points={[[side*.91,.12,2.47],[side*.69,.15,2.500],[side*.35,.13,2.503]]}/>
        <SurfaceCurve color="#ec5561" radius={.008} points={[[side*.90,.14,2.475],[side*.67,.17,2.510],[side*.35,.15,2.510]]}/>
        <mesh position={[side*.66,-.44,2.47]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.058,.014,8,18]}/><meshStandardMaterial color={CHROME} metalness={.78} roughness={.24}/></mesh>
      </group>)}
      {/* CLS face: one broad soft-edged grille rather than paired BMW kidneys. */}
      <Face z={-2.529} color="#141b1f" outline={[[-.52,.075],[.52,.075],[.62,-.15],[.47,-.37],[-.47,-.37],[-.62,-.15]]}/>
      <SurfaceCurve color={CHROME} radius={.016} points={[[-.52,.075,-2.527],[0,.088,-2.527],[.52,.075,-2.527],[.61,-.15,-2.527],[.47,-.37,-2.527],[-.47,-.37,-2.527],[-.61,-.15,-2.527],[-.52,.075,-2.527]]}/>
      {[-.03,-.15,-.27].map(y => <mesh key={y} position={[0,y,-2.530]}><boxGeometry args={[1.06,.012,.008]}/><meshStandardMaterial color="#666f73" metalness={.67} roughness={.3}/></mesh>)}
      <mesh position={[0,-.09,-2.520]}><sphereGeometry args={[.025,12,8]}/><meshStandardMaterial color={CHROME} metalness={.72} roughness={.28}/></mesh>
      <Face z={-2.535} color={INK} outline={[[-.60,-.48],[.60,-.48],[.42,-.56],[-.42,-.56]]}/>
      <Face z={2.525} color="#262c31" outline={[[-.80,-.25],[.80,-.25],[.70,-.52],[-.70,-.52]]}/>
      <Face z={2.530} color="#d0d0cb" outline={[[-.26,.06],[.26,.06],[.25,-.13],[-.25,-.13]]}/>
      <SurfaceCurve color={LIGHT} radius={.010} points={[[-.83,.215,2.20],[-.35,.222,2.22],[.35,.222,2.22],[.83,.215,2.20]]}/>
    </StaticBatch>
    <VehicleWheels layout={L} wheelsRef={wheelsRef} steer={steer} speed={speed}/>
    <group visible={!firstPerson} userData={{ part: 'camera-intersection' }}>
      <StaticBatch><CoupeCabin exterior wheelsRef={wheelsRef} steer={steer}/></StaticBatch>
    </group>
  </group>;
}
