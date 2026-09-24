import Convertible from './Convertible.jsx';
import { FOUR_VEHICLE_LAYOUT } from './fourVehicleLayout.js';
import { Airfoil, Fender, Shell, SurfaceCurve } from './SurfaceParts.jsx';
import StaticBatch from '../StaticBatch.jsx';

const PAINT = '#49aca0', DARK = '#143a3e', CARBON = '#20292d', GOLD = '#d6ab59';
const BASE = FOUR_VEHICLE_LAYOUT.convertible;
const LAYOUT = { ...BASE, wheels: { ...BASE.wheels, track: 1.035 } };
const WHEELS = { width: .38, spokes: 3, spokeColor: GOLD };

/** The donor's passenger tub, glass, eye point and wheel contact stay unchanged. */
export default function DriftCar({ wheelsRef, steer = 0, speed = 0, firstPerson = false }) {
  return <group userData={{ part: 'drift-model' }}>
    <Convertible wheelsRef={wheelsRef} steer={steer} speed={speed} firstPerson={firstPerson}
      paint={PAINT} shade={DARK} highlight="#93d5ba" wheelLayout={LAYOUT} wheelProps={WHEELS}/>
    <group userData={{ part: 'drift-kit' }}>
      <StaticBatch>
        {[-1, 1].map(side => <group key={side}>
          {[BASE.wheels.frontZ, BASE.wheels.rearZ].map(z => <group key={z}>
            <Fender userData={{ part: 'drift-fender' }} position={[side * 1.1, -.5, z]}
              radius={.49} width={.26} color={PAINT}/>
            <SurfaceCurve color={DARK} radius={.009} points={Array.from({ length: 13 }, (_, i) => {
              const angle = .22 + i * (Math.PI - .44) / 12;
              return [side * 1.241, -.5 + Math.sin(angle) * .52, z + Math.cos(angle) * .52];
            })}/>
            {[.38, .94, 1.57, 2.20, 2.76].map(angle => <mesh key={angle}
              position={[side * 1.242, -.5 + Math.sin(angle) * .505, z + Math.cos(angle) * .505]}
              rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[.007, .007, .008, 6]}/>
              <meshStandardMaterial color={GOLD} metalness={.75} roughness={.33}/>
            </mesh>)}
          </group>)}
          <Shell position={[side * 1.09, -.56, -.08]} color={CARBON} segments={12} steps={1}
            stations={[{ z: -.85, rx: .05, ry: .025, power: 4 }, { z: -.66, rx: .10, ry: .04, power: 4 },
              { z: .72, rx: .10, ry: .04, power: 4 }, { z: .85, rx: .05, ry: .025, power: 4 }]}/>
          <SurfaceCurve color={GOLD} radius={.011}
            points={[[side * 1.08, -.38, -.9], [side * 1.095, -.35, -.45], [side * 1.085, -.19, .55], [side * 1.09, -.17, .79]]}/>
          <Shell position={[side * .63, .42, 1.99]} color={CARBON} segments={8} steps={1}
            stations={[{ z: -.10, rx: .027, ry: .20, cy: -.025, power: 4 },
              { z: .055, rx: .027, ry: .23, cy: .005, power: 4 }, { z: .105, rx: .018, ry: .19, cy: .03, power: 4 }]}/>
          <Shell position={[side * 1.13, .67, 2.18]} color={DARK} segments={12} steps={1}
            stations={[{ z: -.22, rx: .015, ry: .065, cy: .025, power: 4 },
              { z: -.14, rx: .018, ry: .10, power: 4 }, { z: .20, rx: .018, ry: .10, power: 4 },
              { z: .26, rx: .012, ry: .045, cy: -.02, power: 4 }]}/>
        </group>)}
        <Airfoil userData={{ part: 'drift-wing' }} color={CARBON}
          stations={[{ x: -1.12, y: .67, front: 1.99, back: 2.42, thickness: .065, camber: -.02 },
            { x: 0, y: .65, front: 1.96, back: 2.40, thickness: .07, camber: -.02 },
            { x: 1.12, y: .67, front: 1.99, back: 2.42, thickness: .065, camber: -.02 }]}/>
        <Shell color={CARBON} segments={24} steps={1} position={[0, -.575, -2.37]}
          stations={[{ z: -.12, rx: .96, ry: .018, power: 5 }, { z: -.075, rx: 1.14, ry: .025, power: 5 },
            { z: .17, rx: 1.08, ry: .025, power: 5 }]}/>
        <SurfaceCurve color={GOLD} radius={.009}
          points={[[-1.08, -.548, -2.39], [-.87, -.548, -2.47], [0, -.548, -2.475], [.87, -.548, -2.47], [1.08, -.548, -2.39]]}/>
        {[-.66, -.33, 0, .33, .66].map(x => <Shell key={x} color={CARBON} position={[x, -.51, 2.24]}
          segments={8} steps={1} stations={[{ z: -.16, rx: .012, ry: .015, power: 4 },
            { z: .12, rx: .012, ry: .07, cy: -.025, power: 4 }, { z: .20, rx: .009, ry: .045, cy: -.015, power: 4 }]}/>)}
      </StaticBatch>
    </group>
  </group>;
}
