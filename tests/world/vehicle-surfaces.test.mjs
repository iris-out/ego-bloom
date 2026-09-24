import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { airfoilGeometry, sectionShell, smoothProfile, ductGeometry, tireGeometry } from '../../src/world/models/vehicleSurfaces.js';
function valid(g) { const p=g.getAttribute('position'), n=g.getAttribute('normal'); assert.ok(p.count>10);for(const x of [...p.array,...n.array]) assert.ok(Number.isFinite(x)); for(let i=0;i<n.count;i++) assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.001);g.computeBoundingBox(); }
function outward(g, center){const p=g.getAttribute('position'),n=g.getAttribute('normal');let wrong=0;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).sub(center);if(v.dot(new THREE.Vector3().fromBufferAttribute(n,i))<-.001)wrong++;}assert.equal(wrong,0);}
test('bounded smooth profile retains stations without Catmull-Rom overshoot',()=>{const rows=[[.05,-4],[.8,-2],[1,0],[.5,3],[.05,5]];const out=smoothProfile(rows);assert.ok(out.length>rows.length*3);assert.deepEqual(out[0],rows[0]);assert.deepEqual(out.at(-1),rows.at(-1));for(const [r,z]of out){assert.ok(r>=.05&&r<=1);assert.ok(z>=-4&&z<=5);}});
test('closed fuselage loft has outward normals and bounded continuous cross sections',()=>{const g=sectionShell([{z:-3,rx:.05,ry:.05},{z:-1,rx:1,ry:.6},{z:1,rx:1.1,ry:.7},{z:3,rx:.1,ry:.1}]);valid(g);outward(g,new THREE.Vector3());assert.ok(g.boundingBox.max.x<=1.1001);assert.ok(g.boundingBox.max.y<=.7001);assert.ok(g.index.count<15000);g.dispose();});
test('airfoil has closed tips, rounded leading edge, sharp trailing edge and outward upper/lower faces',()=>{const g=airfoilGeometry([{x:1,front:-2,back:2,thickness:.4},{x:5,front:0,back:1,thickness:.08}]);valid(g);assert.ok(g.boundingBox.min.z>=-2);assert.ok(g.boundingBox.max.z<=2);assert.ok(g.boundingBox.max.y<=.21);const p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i++){if(Math.abs(p.getY(i))>.05 && p.getX(i)>1.01 && p.getX(i)<4.99)assert.ok(p.getY(i)*n.getY(i)>0);}assert.ok(g.index.count<10000);g.dispose();});
test('intake has a real recessed inner wall and open mouth',()=>{const g=ductGeometry({radius:.6,length:2,wall:.07});valid(g);assert.ok(g.boundingBox.min.z<=-1);assert.ok(g.boundingBox.max.z>=1);const p=g.attributes.position;assert.ok([...Array(p.count)].some((_,i)=>Math.hypot(p.getX(i),p.getY(i))<.54&&p.getZ(i)<-.5));g.dispose();});
test('tire preserves radius and full width while rounding shoulders',()=>{const g=tireGeometry(.42,.34);valid(g);assert.ok(Math.abs(g.boundingBox.max.y-.17)<1e-6);assert.ok(Math.abs(g.boundingBox.max.x-.42)<1e-6);assert.ok(g.index.count/3<2500);g.dispose();});

test('StaticBatch keeps scoped environment maps and intensities separate',async()=>{
  const {materialSignature}=await import('../../src/world/staticBatch.js');
  const a=new THREE.MeshStandardMaterial(),b=a.clone(),map=new THREE.Texture();
  assert.equal(materialSignature(a),materialSignature(b));b.envMap=map;
  assert.notEqual(materialSignature(a),materialSignature(b));a.envMap=map;
  assert.equal(materialSignature(a),materialSignature(b));b.envMapIntensity=.55;
  assert.notEqual(materialSignature(a),materialSignature(b));a.dispose();b.dispose();map.dispose();
});
