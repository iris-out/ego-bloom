import { useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { retainMaterialEnvironment } from './materialEnvironment.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// One neutral reflection resource per renderer, shared by local/parked/remote
// models. It is assigned to their own materials: scene.environment and buildings
// remain untouched. A microtask release also handles StrictMode effect replay.
const environments = new WeakMap();
function acquire(renderer) {
  let entry=environments.get(renderer);
  if(!entry) {
    const generator=new THREE.PMREMGenerator(renderer), room=new RoomEnvironment();
    const target=generator.fromScene(room,.06);
    room.dispose();generator.dispose();
    entry={target,users:0};environments.set(renderer,entry);
  }
  entry.users++;
  return {texture:entry.target.texture,release:()=>{
    entry.users--;
    queueMicrotask(()=>{if(entry.users===0&&environments.get(renderer)===entry){environments.delete(renderer);entry.target.dispose();}});
  }};
}
export default function ModelFinish({ children, version }) {
  const root=useRef(), renderer=useThree(state=>state.gl);
  useLayoutEffect(()=>{
    const resource=acquire(renderer), materials=new Map();
    root.current.traverse(node=>{
      for(const material of Array.isArray(node.material)?node.material:[node.material]) {
        if(!material?.isMeshStandardMaterial || materials.has(material))continue;
        materials.set(material,retainMaterialEnvironment(material,resource.texture));
      }
    });
    return ()=>{for(const release of materials.values())release();resource.release();};
  },[renderer,version]);
  return <group ref={root}>{children}</group>;
}
