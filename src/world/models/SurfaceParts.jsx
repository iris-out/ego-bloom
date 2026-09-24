import { useSurfaceMaterial } from './useSurfaceMaterial.js';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { sectionShell, airfoilGeometry, ductGeometry } from './vehicleSurfaces.js';

// Geometry is owned by each mounted source, never by StaticBatch's merged copy.
// Numeric authoring data are serialized so a parent prop render does not rebuild it.
function useSurface(factory, data) {
  const signature = JSON.stringify(data);
  const geometry = useMemo(() => factory(JSON.parse(signature)), [factory, signature]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}
const shell = ({stations, segments, steps}) => sectionShell(stations, {segments, steps});
const wing = stations => airfoilGeometry(stations);
const duct = options => ductGeometry(options);

export function Shell({ stations, color, roughness = .34, metalness = .32, segments = 32, steps = 5, ...props }) {
  const geometry = useSurface(shell, {stations, segments, steps});
  const material=useSurfaceMaterial({color,metalness,roughness});
  return <mesh {...props} geometry={geometry} material={material} dispose={null} castShadow receiveShadow/>;
}
export function Airfoil({ stations, color, ...props }) {
  const geometry = useSurface(wing, stations);
  const material=useSurfaceMaterial({color,roughness:.4,metalness:.3,side:THREE.DoubleSide});
  return <mesh {...props} geometry={geometry} material={material} dispose={null} castShadow/>;
}
export function Duct({ radius, length, wall = .065, color, ...props }) {
  const geometry = useSurface(duct, {radius, length, wall});
  const material=useSurfaceMaterial({color,metalness:.48,roughness:.32,side:THREE.DoubleSide});
  return <group {...props}>
    <mesh geometry={geometry} material={material} dispose={null} castShadow/>
    <mesh position={[0,0,-length*.12]} rotation={[0,Math.PI,0]}><circleGeometry args={[radius*.74,32]}/><meshStandardMaterial color="#172127" roughness={.7}/></mesh>
    <mesh position={[0,0,-length*.15]} rotation={[-Math.PI/2,0,0]}><coneGeometry args={[radius*.22,length*.2,20]}/><meshStandardMaterial color="#63717a" metalness={.65} roughness={.35}/></mesh>
  </group>;
}
/** Welded armor is still planar: compound sloped faces and narrow bevels replace
 * stacked rectangular hulls, with authored widths staying inside existing bounds. */
export function ArmorShell({ scale = [1,1,1], color, ...props }) {
  return <Shell {...props} scale={scale} color={color} metalness={.22} roughness={.67} segments={12} steps={1}
    stations={[{z:-.5,rx:.38,ry:.24,cy:-.12,power:4},{z:-.31,rx:.5,ry:.43,cy:-.035,power:5},{z:.3,rx:.5,ry:.47,cy:0,power:5},{z:.5,rx:.43,ry:.36,cy:-.06,power:4}]}/>;
}

const fender = ({radius,width}) => {
  const shape=new THREE.Shape();
  const r=radius;
  shape.absarc(0,0,r+.035,.2,Math.PI-.2,false);
  shape.absarc(0,0,r-.012,Math.PI-.2,.2,true);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2,curveSegments:20});
  g.translate(0,0,-width/2);g.rotateY(Math.PI/2);return g;
};
export function Fender({ radius, width, color, ...props }) {
  const geometry=useSurface(fender,{radius,width});
  const material=useSurfaceMaterial({color,metalness:.35,roughness:.3});
  return <mesh {...props} geometry={geometry} material={material} dispose={null}/>;
}

const trackLoop = ({length,height,width}) => {
  const r=height/2, a=length/2-r, wall=.055;
  const path=(p,rr,reverse=false)=>{p.moveTo(-a,-rr);p.lineTo(a,-rr);p.absarc(a,0,rr,-Math.PI/2,Math.PI/2,false);p.lineTo(-a,rr);p.absarc(-a,0,rr,Math.PI/2,Math.PI*1.5,false);p.closePath();if(reverse)p.curves.reverse();return p;};
  const shape=path(new THREE.Shape(),r);
  // ShapeUtils determines hole winding; no reliance on scene DoubleSide.
  const hole=new THREE.Path();hole.moveTo(-a,-r+wall);hole.absarc(-a,0,r-wall,-Math.PI/2,-Math.PI*1.5,true);hole.lineTo(a,r-wall);hole.absarc(a,0,r-wall,Math.PI/2,-Math.PI/2,true);hole.closePath();shape.holes.push(hole);
  const g=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false,curveSegments:16});g.translate(0,0,-width/2);g.rotateY(Math.PI/2);return g;
};
export function TrackLoop({ length, height, width, color, ...props }) {
  const geometry=useSurface(trackLoop,{length,height,width});
  const material=useSurfaceMaterial({color,metalness:.25,roughness:.8});
  return <mesh {...props} geometry={geometry} material={material} dispose={null} castShadow/>;
}

const surfaceCurve=({points,radius})=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),24,radius,6,false);
export function SurfaceCurve({ points, radius=.025, color, ...props }) {
  const geometry=useSurface(surfaceCurve,{points,radius});
  const material=useSurfaceMaterial({color,metalness:.18,roughness:.52});
  return <mesh {...props} geometry={geometry} material={material} dispose={null}/>;
}
export function CanopyFrame({rx,ry,rz,color, ...props}) {
  return <group {...props}>
    {[-.52,.55].map(t=><SurfaceCurve key={t} color={color} radius={.023} points={Array.from({length:13},(_,i)=>{const a=i*Math.PI/12,r=Math.sqrt(1-t*t);return [Math.cos(a)*rx*r,Math.sin(a)*ry*r,t*rz];})}/>)}
    {[-1,1].map(side=><SurfaceCurve key={side} color={color} radius={.02} points={[-.8,-.4,0,.4,.8].map(t=>[side*rx*Math.sqrt(1-t*t),0,t*rz])}/>)}
  </group>;
}
