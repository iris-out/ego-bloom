import { useEffect, useMemo } from 'react';
import { FOUR_VEHICLE_LAYOUT } from './fourVehicleLayout.js';
import { VehicleWheels } from './FourVehicleParts.jsx';
import { createBmwClsBody } from './bmwClsGeometry.js';
import { flatPolygonGeometry } from './carGeometry.js';
import { Shell, SurfaceCurve } from './SurfaceParts.jsx';
import StaticBatch from '../StaticBatch.jsx';
import ConvertibleCabin from '../cockpits/ConvertibleCabin.jsx';

const L = FOUR_VEHICLE_LAYOUT.convertible;
const ROSE = '#a86678', SHADE = '#76434e', BRIGHT = '#c28b96';
const INK = '#16191d', CHROME = '#b8b1ad';

function Face({ outline, z, color, metalness = .2, roughness = .4 }) {
  const signature = JSON.stringify(outline);
  const geometry = useMemo(() => flatPolygonGeometry(JSON.parse(signature), z), [signature,z]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} dispose={null}>
    <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} side={2}/>
  </mesh>;
}

export default function Convertible({ wheelsRef, steer = 0, speed = 0, firstPerson = false, paint = ROSE, shade = SHADE, highlight = BRIGHT, wheelLayout = L, wheelProps }) {
  const body = useMemo(() => createBmwClsBody('convertible'), []);
  useEffect(() => () => Object.values(body).forEach(geometry => geometry.dispose()), [body]);
  return <group userData={{ part: 'convertible-model' }}>
    <StaticBatch>
      {Object.entries(body).map(([key,geometry]) => <mesh key={key} geometry={geometry} dispose={null} userData={{ part: `convertible-${key}` }}>
        <meshStandardMaterial color={paint} metalness={.42} roughness={.29} side={2}/>
      </mesh>)}
      {[-1,1].map(side => <group key={side}>
        <SurfaceCurve points={[[side*.76,.23,-1.10],[side*.79,.28,-1.45],[side*.70,.275,-2.05],[side*.61,.21,-2.37]]} color={highlight} radius={.012}/>
        <SurfaceCurve points={[[side*1.012,.06,-2.17],[side*1.071,.15,-1.47],[side*1.05,.13,-.80],[side*1.061,.15,.87],[side*1.043,.12,1.65]]} color={highlight} radius={.011}/>
        <SurfaceCurve points={[[side*.93,-.19,-2.38],[side*.98,-.39,-2.25],[side*1.04,-.49,-1.94]]} color={shade} radius={.012}/>
        <Face z={-2.411} color="#111a21" outline={side<0
          ? [[-.93,.09],[-.56,.10],[-.43,.01],[-.68,-.045],[-.95,-.01]]
          : [[.43,.01],[.56,.10],[.93,.09],[.95,-.01],[.68,-.045]]}/>
        <SurfaceCurve points={[[side*.91,.073,-2.420],[side*.74,.078,-2.420],[side*.55,.045,-2.420]]} color="#eff5f4" radius={.013}/>
        <SurfaceCurve points={[[side*.89,.025,-2.422],[side*.76,.006,-2.422],[side*.64,-.021,-2.422]]} color="#a8d4dc" radius={.008}/>
        <Face z={-2.420} color={INK} outline={side<0
          ? [[-.89,-.21],[-.65,-.20],[-.52,-.46],[-.90,-.44]]
          : [[.65,-.20],[.89,-.21],[.90,-.44],[.52,-.46]]}/>
        <SurfaceCurve points={[[side*1.015,.11,-1.01],[side*1.073,-.18,-.99],[side*1.032,-.50,-.97]]} color={shade} radius={.006}/>
        <SurfaceCurve points={[[side*1.032,.16,1.17],[side*1.064,-.15,1.18],[side*1.015,-.50,1.19]]} color={shade} radius={.006}/>
        <mesh position={[side*1.073,.055,-.45]}><boxGeometry args={[.023,.025,.18]}/><meshStandardMaterial color={CHROME} metalness={.75} roughness={.24}/></mesh>
        <SurfaceCurve points={[[side*.90,.09,2.35],[side*.63,.14,2.395],[side*.34,.11,2.397]]} color="#b62437" radius={.035}/>
        <SurfaceCurve points={[[side*.90,.13,2.355],[side*.60,.16,2.403],[side*.36,.13,2.403]]} color="#e54d5a" radius={.008}/>
        {[-.12,.12].map(offset => <mesh key={offset} position={[side*(.56+offset),-.44,2.37]} rotation={[Math.PI/2,0,0]}>
          <torusGeometry args={[.056,.014,8,18]}/><meshStandardMaterial color={CHROME} metalness={.78} roughness={.24}/>
        </mesh>)}
      </group>)}
      {[-1,1].map(side => <group key={`kidney-${side}`}>
        <Face z={-2.424} color="#080c0e" metalness={.34} outline={side<0
          ? [[-.42,.085],[-.065,.085],[-.07,-.43],[-.34,-.49],[-.46,-.35]]
          : [[.065,.085],[.42,.085],[.46,-.35],[.34,-.49],[.07,-.43]]}/>
        <SurfaceCurve color="#b6b1ae" radius={.014} points={side<0
          ? [[-.42,.08,-2.423],[-.065,.08,-2.423],[-.07,-.42,-2.423],[-.34,-.48,-2.423],[-.46,-.34,-2.423],[-.42,.08,-2.423]]
          : [[.065,.08,-2.423],[.42,.08,-2.423],[.46,-.34,-2.423],[.34,-.48,-2.423],[.07,-.42,-2.423],[.065,.08,-2.423]]}/>
        {[-.19,-.27,-.35].map(y => <mesh key={y} position={[side*.25,y,-2.432]}><boxGeometry args={[.27,.012,.008]}/><meshStandardMaterial color="#3f4549" metalness={.4} roughness={.4}/></mesh>)}
      </group>)}
      <Face z={-2.425} color={INK} outline={[[-.52,-.50],[.52,-.50],[.36,-.58],[-.36,-.58]]}/>
      <Face z={2.419} color="#25262a" outline={[[-.83,-.29],[.83,-.29],[.77,-.53],[-.77,-.53]]}/>
      <Face z={2.426} color="#c5bdba" outline={[[-.24,.06],[.24,.06],[.24,-.13],[-.24,-.13]]}/>
      <Shell color={shade} metalness={.38} roughness={.32} segments={20} steps={1} position={[0,.18,2.14]}
        stations={[{z:-.03,rx:.82,ry:.026,power:5},{z:.03,rx:.78,ry:.026,power:5}]} />
      <SurfaceCurve color={highlight} radius={.010} points={[[-.75,.22,1.77],[-.35,.23,1.80],[.35,.23,1.80],[.75,.22,1.77]]}/>
    </StaticBatch>
    <VehicleWheels layout={wheelLayout} wheelProps={wheelProps} wheelsRef={wheelsRef} steer={steer} speed={speed}/>
    <group visible={!firstPerson} userData={{ part: 'camera-intersection' }}>
      <StaticBatch><ConvertibleCabin exterior wheelsRef={wheelsRef} steer={steer}/></StaticBatch>
    </group>
  </group>;
}
