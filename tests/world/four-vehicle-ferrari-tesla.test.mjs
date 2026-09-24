import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import * as THREE from 'three';
import { surfaceFixtures } from './model-surface-fixtures.mjs';
import { FOUR_VEHICLE_LAYOUT as L } from '../../src/world/models/fourVehicleLayout.js';
import { createFerrariTeslaBody } from '../../src/world/models/ferrariTeslaGeometry.js';
import { curvedPane } from '../../src/world/models/carGeometry.js';

function h(type, props={}, ...children) {
  props ||= {};
  if(typeof type==='function') return type({...props,children});
  if(type==='boxGeometry') return new THREE.BoxGeometry(...(props.args||[1,1,1]));
  if(type==='torusGeometry') return new THREE.TorusGeometry(...(props.args||[1,.1,8,16]));
  if(type==='meshStandardMaterial') return new THREE.MeshStandardMaterial({color:props.color||'#ffffff'});
  const flat=children.flat(Infinity).filter(Boolean);
  const geometry=props.geometry||flat.find(v=>v?.isBufferGeometry);
  const material=props.material||flat.find(v=>v?.isMaterial)||new THREE.MeshBasicMaterial();
  const node=type==='mesh'?new THREE.Mesh(geometry||new THREE.BoxGeometry(1,1,1),material):new THREE.Group();
  node.userData={type,...props.userData};
  if(props.position) node.position.fromArray(props.position);
  if(props.rotation) node.rotation.fromArray(props.rotation);
  if(props.scale) node.scale.fromArray(props.scale);
  if(props.visible===false) node.visible=false;
  for(const child of flat) if(child instanceof THREE.Object3D) node.add(child);
  return node;
}

const shell=surfaceFixtures(h).Shell;
function curve({points,radius=.02,color}) {
  const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),20,radius,5,false);
  return h('mesh',{geometry,material:new THREE.MeshStandardMaterial({color})});
}
function seat({position,width=.46,depth=.48,height=.62}) {
  return h('group',{position},
    h('mesh',{position:[0,0,0],scale:[width,.13,depth]},new THREE.BoxGeometry()),
    h('mesh',{position:[0,height*.43,depth*.34],scale:[width,height*.84,.13]},new THREE.BoxGeometry()));
}
function pane({corners}) {return h('mesh',{geometry:curvedPane(corners),material:new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),userData:{part:'glazing'}});}
function steering({position,yoke}) {return h('group',{position,userData:{part:yoke?'electric-yoke':'steering-wheel'}},
  h('mesh',{scale:[.35,.20,.04],position:[0,-.05,0]},new THREE.BoxGeometry()));}
function display({position,width,height,mode}) {return h('group',{position,userData:{mode}},
  h('mesh',{scale:[width,height,.012]},new THREE.BoxGeometry()));}
const fixtures={
  StaticBatch:({children})=>h('group',{},children),SurfaceCurve:curve,Shell:shell,
  CabinPane:pane,CabinSeat:seat,CabinSteering:steering,
  InstrumentDisplay:display,Mirrors:()=>h('group'),
  VehicleWheels:({layout})=>h('group',{},[-1,1].flatMap(side=>[layout.wheels.frontZ,layout.wheels.rearZ].map(z=>
    h('group',{position:[side*layout.wheels.track,layout.wheels.y,z],userData:{part:'wheel-hub'}})))),
};

async function component(file,name,bindings) {
  const source=await readFile(new URL(`../../src/world/${file}`,import.meta.url),'utf8');
  const clean=source.replace(/import[\s\S]*?from ['"][^'"]+['"];\n/g,'').replace(`export default function ${name}`,`function ${name}`);
  const {code}=await transformWithOxc(clean,`${name}.jsx`,{jsx:{runtime:'classic',pragma:'h',pragmaFrag:'Fragment'}});
  const keys=['h','Fragment','useEffect','useMemo',...Object.keys(bindings)];
  const values=[h,'fragment',()=>{},factory=>factory(),...Object.values(bindings)];
  return new Function(...keys,`${code}; return ${name};`)(...values);
}

async function mount(key,{firstPerson=false,exterior=true,quality='medium'}={}) {
  const title=key==='supercar'?'Supercar':'Electric';
  const Cabin=await component(`cockpits/${title}Cabin.jsx`,`${title}Cabin`,{
    ...fixtures,THREE,FOUR_VEHICLE_LAYOUT:L,
  });
  const Model=await component(`models/${title}.jsx`,title,{
    ...fixtures,FOUR_VEHICLE_LAYOUT:L,createFerrariTeslaBody,
    [`${title}Cabin`]:Cabin,
  });
  return exterior?Model({firstPerson}):Cabin({quality,exterior:false,statusRef:{current:{speed:16,gear:1,power:.3}}});
}

function all(root,part) {const out=[];root.traverse(n=>{if(n.userData.part===part) out.push(n);});return out;}
function xyz(node) {node.updateWorldMatrix(true,false);return node.getWorldPosition(new THREE.Vector3()).toArray();}
function near(a,b,tol=1e-6) {assert.ok(a.every((v,i)=>Math.abs(v-b[i])<tol),`${a} differs from ${b}`);}

test('curved body skins are finite, bounded, and leave actual wheel and intake openings',()=>{
  for(const key of ['supercar','electric']) {
    const g=createFerrariTeslaBody(key),layout=L[key];
    for(const mesh of Object.values(g)) {
      const p=mesh.attributes.position.array,n=mesh.attributes.normal.array;
      assert.ok([...p,...n].every(Number.isFinite));
      mesh.computeBoundingBox();
      assert.ok(mesh.boundingBox.min.z>=-layout.depth/2-.04);
      assert.ok(mesh.boundingBox.max.z<=layout.depth/2+.04);
      assert.ok(mesh.boundingBox.min.x>=-layout.width/2-.04);
      assert.ok(mesh.boundingBox.max.x<=layout.width/2+.04);
      assert.ok(mesh.boundingBox.min.y>=-.9-.001);
      assert.ok(mesh.boundingBox.max.y<=layout.height-.9+.04);
    }
    const sideMesh=new THREE.Mesh(g.sides,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    for(const z of [layout.wheels.frontZ,layout.wheels.rearZ]) {
      const ray=new THREE.Raycaster(new THREE.Vector3(0,layout.wheels.y,z),new THREE.Vector3(1,0,0));
      assert.equal(ray.intersectObject(sideMesh).length,0,`${key} arch is filled at ${z}`);
    }
    const eyeRay=new THREE.Raycaster(new THREE.Vector3(...layout.eye),new THREE.Vector3(0,0,-1));
    for(const geometry of Object.values(g)) {
      assert.equal(eyeRay.intersectObject(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}))).length,0,`${key} forward eye ray hits body`);
    }
    Object.values(g).forEach(mesh=>mesh.dispose());
  }
  const ferrari=createFerrariTeslaBody('supercar'),tesla=createFerrariTeslaBody('electric');
  const intakeRay=new THREE.Raycaster(new THREE.Vector3(0,-.29,.18),new THREE.Vector3(1,0,0));
  assert.equal(intakeRay.intersectObject(new THREE.Mesh(ferrari.sides,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}))).length,0);
  assert.ok(intakeRay.intersectObject(new THREE.Mesh(tesla.sides,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}))).length>0);
  Object.values(ferrari).forEach(mesh=>mesh.dispose());Object.values(tesla).forEach(mesh=>mesh.dispose());
});

test('mounted cabins have correct occupancy and identical physical anchors across camera modes',async()=>{
  for(const [key,seats,doors] of [['supercar',2,2],['electric',5,4]]) {
    const model=await mount(key),interior=await mount(key,{exterior:false});
    assert.equal(all(model,`${key}-seat`).length,seats);
    assert.equal(all(interior,`${key}-seat`).length,seats);
    assert.equal(all(model,`${key}-door-card`).length,doors);
    assert.equal(all(interior,`${key}-door-card`).length,doors);
    for(const part of [`${key}-seat`,`${key}-door-card`,`${key}-dashboard`]) {
      const a=all(model,part).map(xyz),b=all(interior,part).map(xyz);
      a.forEach((point,i)=>near(point,b[i]));
    }
    const hidden=await mount(key,{firstPerson:true});
    assert.equal(all(hidden,'camera-intersection').length,1);
    assert.equal(all(hidden,'camera-intersection')[0].visible,false);
    assert.equal(all(hidden,'wheel-hub').length,4);
    assert.equal(all(hidden,`${key}-cabin`).length,1);
    model.updateMatrixWorld(true);
    const forward=new THREE.Raycaster(new THREE.Vector3(...L[key].eye),new THREE.Vector3(0,0,-1),0,10);
    const opaque=[];
    model.traverse(node=>{if(node.isMesh&&node.userData.part!=='glazing') opaque.push(node);});
    assert.equal(forward.intersectObjects(opaque,false).length,0,`${key} forward view is blocked`);
  }
});

test('Ferrari has two recessed intakes and a closed rear bulkhead; Tesla has a landscape screen and open-top yoke',async()=>{
  const ferrari=await mount('supercar'),tesla=await mount('electric');
  assert.equal(all(ferrari,'supercar-side-intake').length,2);
  assert.equal(all(ferrari,'supercar-seat').length,2);
  assert.equal(all(ferrari,'supercar-door-card').length,2);
  assert.equal(all(tesla,'electric-yoke').length,1);
  assert.equal(all(tesla,'electric-exhaust').length,0);
  const screen=all(tesla,'electric-landscape-screen')[0];
  const box=new THREE.Box3().setFromObject(screen);
  const size=box.getSize(new THREE.Vector3());
  assert.ok(size.x>size.y*1.6,`center screen is not landscape: ${size.toArray()}`);
  assert.ok(all(tesla,'electric-seat').length===5);
});
