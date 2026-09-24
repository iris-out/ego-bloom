import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import * as THREE from 'three';
const hooks={useMemo:fn=>fn(),useRef:initial=>({current:initial}),useEffect:()=>{},useLayoutEffect:()=>{},useFrame:()=>{},memo:fn=>fn,useThree:()=>({gl:{},scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera()}),createPortal:children=>children};
const cache=new Map();
export function modelElement(type,props={},...children){
 props||={};if(typeof type==='function')return type({...props,children});
 const constructor=THREE[type?.[0]?.toUpperCase()+type?.slice(1)];
 if(type?.endsWith('Geometry'))return new constructor(...(props.args||[]));
 if(type?.endsWith('Material'))return new constructor();
 const node=new THREE.Object3D();node.userData=props.userData||{};node.visible=props.visible!==false;
 for(const key of ['position','rotation','scale'])if(props[key]){if(typeof props[key]==='number')node[key].setScalar(props[key]);else node[key].fromArray(props[key]);}
 if(props.quaternion){if(Array.isArray(props.quaternion))node.quaternion.fromArray(props.quaternion);else node.quaternion.copy(props.quaternion);}
 if(props.geometry)node.geometry=props.geometry;
 for(const child of children.flat(Infinity))if(child instanceof THREE.Object3D)node.add(child);else if(child?.isBufferGeometry)node.geometry=child;
 return node;
}
export async function loadModelFixture(path){
 path=resolve(path);if(cache.has(path))return cache.get(path);
 let source=await readFile(path,'utf8');const names=[],values=[];
 const imports=[...source.matchAll(/import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/g)];
 for(const match of imports){
  const [,binding,specifier]=match;let dependency;
  if(specifier==='react'||specifier==='@react-three/fiber')dependency=hooks;
  else if(specifier==='three')dependency=THREE;
  else if(/StaticBatch|ModelFinish|EngineGlow/.test(specifier))dependency={default:props=>modelElement('group',{},props.children)};
  else {
   let target=resolve(dirname(path),specifier);if(!extname(target))target+='.jsx';
   dependency=target.endsWith('.jsx')||target.endsWith('useSurfaceMaterial.js')?await loadModelFixture(target):await import(pathToFileURL(target));
  }
  if(binding.startsWith('* as ')){names.push(binding.slice(5).trim());values.push(dependency);}
  else if(binding.startsWith('{'))for(const item of binding.slice(1,-1).split(',')){const [original,alias]=item.trim().split(/\s+as\s+/);if(original){names.push(alias||original);values.push(dependency[original]);}}
  else{names.push(binding.trim());values.push(dependency.default);}
  source=source.replace(match[0],'');
 }
 const exports=[];source=source.replace(/export default function (\w+)/g,(_,name)=>{exports.push(`default:${name}`);return `function ${name}`;});
 source=source.replace(/export (function|const) (\w+)/g,(_,kind,name)=>{exports.push(name);return `${kind} ${name}`;});
 const {code}=await transformWithOxc(source,'fixture.jsx',{jsx:{runtime:'classic',pragma:'h',pragmaFrag:'Fragment'}});
 const result=new Function('h','Fragment',...names,`${code};return {${exports.join(',')}};`)(modelElement,'fragment',...values);cache.set(path,result);return result;
}
export function modelTriangles(root){let total=0;root.traverse(n=>{if(n.geometry)total+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;});return total;}
