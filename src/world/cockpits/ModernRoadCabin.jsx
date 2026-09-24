import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Shell } from '../models/SurfaceParts.jsx';
import { useSurfaceMaterial } from '../models/useSurfaceMaterial.js';
import { Panel, Knob, PushButton } from './parts.jsx';
import StaticBatch from '../StaticBatch.jsx';
import { at, cabin } from './cabinLayout.js';
import { drawInstrument } from './instruments.js';
import { MODERN_DISPLAYS, curvedDisplayGeometry, steeringRimGeometry } from './modernCabinGeometry.js';

const LEATHER='#51433d', INK='#171d24', ALUMINUM='#9ca5aa';
function Ribbon({ points, color, radius=.005, low=false }) {
  const signature=JSON.stringify(points);
  const geometry=useMemo(()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(JSON.parse(signature).map(p=>new THREE.Vector3(...p))),low?12:24,radius,low?3:4,false),[signature,radius,low]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const material=useSurfaceMaterial({color,emissive:color,emissiveIntensity:.65,roughness:.25});
  return <mesh geometry={geometry} material={material} dispose={null}/>;
}
function CurvedDisplay({vehicle,statusRef,night}) {
  const spec=MODERN_DISPLAYS[vehicle];
  const geometry=useMemo(()=>curvedDisplayGeometry(spec.width,spec.height,spec.bow),[spec]);
  const backing=useMemo(()=>curvedDisplayGeometry(spec.width+.022,spec.height+.022,spec.bow),[spec]);
  const screen=useMemo(()=>{
    if(typeof document==='undefined')return null;
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    return {texture,ctx:canvas.getContext('2d')};
  },[]);
  const backingMaterial=useSurfaceMaterial({color:"#050709",metalness:.4,roughness:.22,side:THREE.DoubleSide});
  const screenMaterial=useMemo(()=>new THREE.MeshBasicMaterial({map:screen?.texture||null,color:night?"#b8cde5":"#ffffff",toneMapped:false}),[screen,night]);
  useEffect(()=>()=>screenMaterial.dispose(),[screenMaterial]);
  const last=useRef(-1),signature=useRef('');
  useEffect(()=>()=>{geometry.dispose();backing.dispose();screen?.texture.dispose();},[geometry,backing,screen]);
  /* eslint-disable react-hooks/immutability -- Canvas and Three textures are imperative render resources. */
  useFrame(({clock})=>{
    if(!screen)return;
    if(clock.elapsedTime-last.current<.15)return;last.current=clock.elapsedTime;
    const status=statusRef?.current||{},next=JSON.stringify(status);
    if(signature.current===next)return;signature.current=next;
    const c=screen.ctx;c.save();drawInstrument(c,'executiveCluster',status,'#9cdbf6');c.restore();
    c.save();c.translate(512,0);drawInstrument(c,'roadnav',status,vehicle==='suv'?'#9ea8ff':'#78ccea');c.restore();
    c.fillStyle='#050a10';c.fillRect(506,0,12,256);screen.texture.needsUpdate=true;
  });
  /* eslint-enable react-hooks/immutability */
  return <group position={at(vehicle,[spec.x,spec.y,spec.z])} userData={{part:vehicle==='sedan'?'g60-curved-display':'g45-curved-display'}}>
    <mesh geometry={backing} material={backingMaterial} position={[0,0,-.006]} dispose={null}/>
    {screen&&<mesh geometry={geometry} material={screenMaterial} dispose={null} userData={{dynamic:true}}/>}
    {[-.32,.32].map(x=><Panel key={x} material="dark" position={[x,-spec.height/2-.035,-.015]} scale={[.028,.07,.035]}/>)}
  </group>;
}
export function ModernDashboard({vehicle,spec,statusRef,night,high,mid=true}) {
  const suv=vehicle==='suv',y=suv?-.46:-.39,z=suv?-.94:-.81;
  const detail={segments:high?24:mid?16:8,steps:mid?2:1};
  return <group>
    <Shell {...detail} position={cabin(vehicle,[0,0,0])} color={INK} metalness={.12} roughness={.74}
      stations={[{z:spec.dashZ-.07,rx:spec.dashWidth*.47,ry:.045,cy:spec.dashTopY-.035,power:5},{z:z-.05,rx:spec.dashWidth/2,ry:.095,cy:y+.05,power:5},{z:z+.07,rx:spec.dashWidth*.48,ry:.06,cy:y-.04,power:4}]}/>
    <Shell {...detail} position={cabin(vehicle,[0,0,0])} color={suv?'#5f6164':LEATHER} roughness={.75} metalness={.05}
      stations={[{z:z-.02,rx:spec.dashWidth*.48,ry:.08,cy:y-.11,power:6},{z:z+.08,rx:spec.dashWidth*.49,ry:.09,cy:y-.11,power:5},{z:z+.12,rx:spec.dashWidth*.47,ry:.05,cy:y-.11,power:4}]}/>
    <group position={cabin(vehicle,[0,y-.025,z+.12])} userData={{part:suv?'g45-light-surround':'g60-interaction-bar'}}>
      <Shell segments={mid?16:8} steps={1} color={suv?'#30282f':'#416170'} roughness={.25} stations={[{z:-.012,rx:spec.dashWidth*.47,ry:.019,power:6},{z:.012,rx:spec.dashWidth*.47,ry:.019,power:6}]}/>
      <Ribbon low={!mid} color={suv?'#ff664b':'#73c7f0'} points={[[-spec.dashWidth*.47,0,0],[-.4,.004,.014],[.3,.004,.014],[spec.dashWidth*.47,.015,-.005]]}/>
      <Panel material="dark" position={[.05,-.043,.014]} scale={[spec.dashWidth*.88,.026,.014]}/>
      <PushButton position={[.12,-.035,.026]} size={.020} material="warn"/>
      {high&&Array.from({length:16},(_,i)=><Panel key={i} material="metal" position={[-spec.dashWidth*.43+i*spec.dashWidth*.86/15,-.002,.02]} scale={[.0015,.019,.003]} rotation={[0,0,i%2?.7:-.7]}/>)}
    </group>
    <CurvedDisplay vehicle={vehicle} statusRef={statusRef} night={night}/>
  </group>;
}
export function ModernConsole({vehicle,spec,high,mid=true}) {
  const box=spec.console,suv=vehicle==='suv',top=box.top,front=box.z-box.depth/2;
  return <group position={cabin(vehicle,[box.x,0,0])} userData={{part:suv?'g45-console':'g60-floating-console'}}>
    <Shell segments={mid?16:8} steps={mid?2:1} color={LEATHER} roughness={.76} metalness={.03}
      stations={[{z:front,rx:box.width*.43,ry:.08,cy:top-.065,power:4},{z:box.z,rx:box.width*.5,ry:.095,cy:top-.065,power:5},{z:box.z+box.depth/2,rx:box.width*.45,ry:.08,cy:top-.065,power:4}]}/>
    <Shell segments={mid?16:8} steps={mid?2:1} color="#101820" metalness={.4} roughness={.22}
      stations={[{z:front+.03,rx:box.width*.37,ry:.012,cy:top+.019,power:5},{z:box.z-.12,rx:box.width*.43,ry:.012,cy:top+.027,power:5},{z:box.z+.12,rx:box.width*.37,ry:.012,cy:top+.024,power:5}]}/>
    <Shell position={[-.07,top+.063,box.z-.23]} color={ALUMINUM} metalness={.7} roughness={.2} segments={mid?16:8} steps={1}
      stations={[{z:-.027,rx:.024,ry:.025,power:3},{z:.027,rx:.024,ry:.035,cy:.01,power:3}]}/>
    <Knob position={[.06,top+.06,box.z-.03]} radius={.053} height={.021} rotation={[-Math.PI/2,0,0]} material="metal" pointer={false}/>
    <Knob position={[.06,top+.072,box.z-.03]} radius={.046} height={.005} rotation={[-Math.PI/2,0,0]} material="dark" pointer={false}/>
    {[-1,1].map(side=><Ribbon low={!mid} key={side} color={suv?'#6d93fa':'#a1cad5'} radius={.0035} points={[[side*box.width*.37,top+.04,front+.03],[side*box.width*.43,top+.04,box.z-.17],[side*box.width*.38,top+.04,box.z+.11]]}/>)}
    {high&&[-.05,.05].map(x=><Knob key={x} position={[x,top+.015,front+.12]} rotation={[-Math.PI/2,0,0]} radius={.037} height={.012} material="dark" pointer={false}/>)}
  </group>;
}
export function ModernDoor({vehicle,spec,side,mid,high}) {
  const x=side*(spec.innerWidth/2-.008),y=(spec.floorY+spec.sillY)/2,z=spec.console.z,depth=spec.console.depth+.36,height=spec.sillY-spec.floorY;
  return <group position={cabin(vehicle,[x,0,0])}>
    <Shell segments={mid?16:8} steps={mid?2:1} color={INK} roughness={.7} metalness={.07} stations={[{z:z-depth/2,rx:.018,ry:height*.4,cy:y,power:5},{z:z-depth*.25,rx:.038,ry:height*.48,cy:y,power:5},{z:z+depth/2,rx:.025,ry:height*.44,cy:y,power:5}]}/>
    {mid&&<Shell position={[-side*.045,0,0]} color={LEATHER} roughness={.8} metalness={.05} segments={mid?16:8} steps={mid?2:1} stations={[{z:z-.32,rx:.035,ry:.03,cy:spec.sillY-.16,power:3},{z:z,rx:.065,ry:.055,cy:spec.sillY-.13,power:3},{z:z+.3,rx:.025,ry:.035,cy:spec.sillY-.14,power:3}]}/>}
    <Ribbon low={!mid} color={vehicle==='suv'?'#f27369':'#7bcbea'} points={[[-side*.036,spec.sillY-.04,z-depth*.46],[-side*.055,spec.sillY-.06,z-.18],[-side*.036,spec.sillY-.045,z+depth*.45]]}/>
    {mid&&<Panel material="metal" position={[-side*.055,spec.sillY-.09,z-.35]} scale={[.03,.018,.18]} rotation={[0,0,side*.12]}/>}
    {high&&[0,.05,.1].map(o=><PushButton key={o} position={[-side*.085,spec.sillY-.095,z-.1+o]} rotation={[-Math.PI/2,0,0]} size={.022}/>)}
  </group>;
}
export function ModernWheel({vehicle,spec,statusRef,high,mid=true}) {
  const ref=useRef(),wheel=spec.wheel;
  const material=useSurfaceMaterial({color:"#171c22",roughness:.78});
  const rim=useMemo(()=>steeringRimGeometry(wheel.radius,high?48:mid?32:16,mid?6:4),[wheel.radius,high,mid]);
  useEffect(()=>()=>rim.dispose(),[rim]);
  useFrame((_,dt)=>{if(ref.current){const target=-(Number(statusRef?.current?.steer)||0)*wheel.ratio;ref.current.rotation.z=THREE.MathUtils.damp(ref.current.rotation.z,target,14,Math.min(dt,.05));}});
  return <group position={at(vehicle,[wheel.x||0,wheel.y,wheel.z])} rotation={[wheel.tilt,0,0]}>
    <group ref={ref} userData={{dynamic:true,part:'modern-steering-wheel'}}><StaticBatch version={`${high}:${mid}`}>
      <mesh geometry={rim} material={material} dispose={null}/>
      <Shell color="#262b30" metalness={.06} roughness={.7} segments={mid?16:8} steps={1} stations={[{z:-.018,rx:.075,ry:.06,power:3},{z:.018,rx:.072,ry:.057,power:3}]}/>
      {[-1,1].map(side=><group key={side}>
        <Panel material="metal" position={[side*.115,-.025,-.003]} scale={[.115,.05,.018]} rotation={[0,0,-side*.12]}/>
        <Panel material="dark" position={[side*.12,-.022,.01]} scale={[.095,.033,.008]} rotation={[0,0,-side*.12]}/>
        {[0,1].map(i=><PushButton key={i} position={[side*(.09+i*.033),-.017,.02]} size={.012}/>)}
      </group>)}
      <Panel material="metal" position={[0,-.12,-.005]} scale={[.034,.13,.018]}/>
      <Panel material="dark" position={[0,-.113,.008]} scale={[.018,.11,.005]}/>
      <mesh position={[0,0,.026]}><circleGeometry args={[.023,20]}/><meshStandardMaterial color="#88939c" metalness={.6} roughness={.3}/></mesh>
    </StaticBatch></group>
  </group>;
}
export function ModernSeats({vehicle,spec}) {
  const seat=spec.seats;
  return <group>{[seat.driverX,seat.passengerX].map(x=><group key={x} position={cabin(vehicle,[x,seat.y,seat.z])}>
    <Shell color={LEATHER} roughness={.85} metalness={.02} segments={16} steps={2} stations={[{z:-seat.depth/2,rx:seat.width*.45,ry:.035,power:3},{z:0,rx:seat.width/2,ry:.075,power:3},{z:seat.depth/2,rx:seat.width*.45,ry:.06,power:3}]}/>
    <Shell position={[0,.28,seat.depth*.38]} rotation={[-.16,0,0]} color={LEATHER} roughness={.85} metalness={.02} segments={16} steps={2} stations={[{z:-.06,rx:seat.width*.39,ry:.25,cy:0,power:3},{z:0,rx:seat.width*.48,ry:.28,cy:0,power:3},{z:.075,rx:seat.width*.43,ry:.25,cy:0,power:3}]}/>
    <Shell position={[0,.62,seat.depth*.44]} color={LEATHER} roughness={.85} metalness={.02} segments={16} steps={1} stations={[{z:-.055,rx:.12,ry:.085,power:3},{z:.055,rx:.12,ry:.085,power:3}]}/>
  </group>)}</group>;
}
