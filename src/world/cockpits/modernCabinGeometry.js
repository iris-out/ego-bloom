import * as THREE from 'three';
export { MODERN_DISPLAYS } from './modernCabinLayout.js';
/** Continuous glass, no box seam between the instrument and navigation displays. */
export function curvedDisplayGeometry(width,height,bow,segments=24) {
  const p=[],uv=[],ix=[];
  for(let row=0;row<2;row++)for(let i=0;i<=segments;i++){
    const u=i/segments,x=(u-.5)*width;p.push(x,(row-.5)*height,bow*(2*u-1)**2);uv.push(u,row);
  }
  for(let i=0;i<segments;i++){const a=i,b=i+1,c=i+segments+1,d=c+1;ix.push(a,b,d,a,d,c);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
export function steeringRimGeometry(radius,segments=48,radialSegments=6) {
  const points=Array.from({length:24},(_,i)=>{const a=i*Math.PI*2/24;return new THREE.Vector3(Math.cos(a)*radius,Math.max(-.82,Math.sin(a)) *radius,0);});
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),segments,.016,radialSegments,true);
}
