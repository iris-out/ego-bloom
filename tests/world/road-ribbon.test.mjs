import test from 'node:test';
import assert from 'node:assert/strict';
import { roadRibbon } from '../../shared/roadRibbon.js';
import { createUrbanPlan, ROAD_WIDTH } from '../../shared/urbanPlan.js';

const EPS=1e-7;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const upward=([a,b,c])=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0])<0;

test('roadRibbon keeps literal tapered widths and source heights on a straight slope',()=>{
  const ribbon=roadRibbon([[0,0,0,10],[0,10,2,6]],{inset:1,offsetY:.4});
  assert.deepEqual(ribbon.sections.map(section=>section.center),[[0,.4,0],[0,2.4,10]]);
  assert.deepEqual(ribbon.sections.map(section=>section.width),[8,4]);
  assert.deepEqual(ribbon.sections[0].left,[-4,.4,0]);
  assert.deepEqual(ribbon.sections[0].right,[4,.4,0]);
  assert.deepEqual(ribbon.sections[1].left,[-2,2.4,10]);
  assert.deepEqual(ribbon.sections[1].right,[2,2.4,10]);
  assert.equal(ribbon.spans.length,1);
  assert.equal(ribbon.triangles.length,2);
  assert.equal(ribbon.spans[0].leftA,ribbon.sections[0].left);
  assert.equal(ribbon.spans[0].rightB,ribbon.sections[1].right);
  assert.ok(ribbon.triangles.every(upward),'ribbon triangles must wind upward');
});

test('roadRibbon shares one mitered transverse edge across curved spans',()=>{
  const ribbon=roadRibbon([[0,0,0,10],[0,10,0,10],[10,10,0,10]]);
  const corner=ribbon.sections[1];
  assert.ok(distance(corner.left,[-5,0,15])<EPS);
  assert.ok(distance(corner.right,[5,0,5])<EPS);
  assert.equal(ribbon.spans[0].leftB,corner.left);
  assert.equal(ribbon.spans[1].leftA,corner.left);
  assert.equal(ribbon.spans[0].rightB,corner.right);
  assert.equal(ribbon.spans[1].rightA,corner.right);
  assert.deepEqual(ribbon.triangles,ribbon.spans.flatMap(span=>span.triangles));
});

test('roadRibbon honors an explicit normalized transverse instead of its inferred miter',()=>{
  const ribbon=roadRibbon([[0,0,0,10],[0,10,0,10,[0,3]],[10,10,0,10]]);
  assert.deepEqual(ribbon.sections[1].left,[0,0,15]);
  assert.deepEqual(ribbon.sections[1].right,[0,0,5]);
});

test('every generated interchange taper pins its inner edge to the highway boundary',()=>{
  const halfHighway=ROAD_WIDTH.highway/2;
  for(const extent of [1000,1600,2164,3600]){
    const plan=createUrbanPlan(extent);
    for(const node of plan.interchanges.filter(item=>item.kind==='IC'))for(const [index,ramp] of node.ramps.entries()){
      const d=index<2?-1:1,s=index%2===0?-1:1;
      const ribbon=roadRibbon(ramp.points);
      const topIndex=ramp.points.findIndex(point=>Math.hypot(point[0]-ramp.to.x,point[1]-ramp.to.z)<EPS);
      assert.ok(topIndex>=0,`extent ${extent}: ${node.ko} ramp ${index} has no first deck point`);
      const outward=node.axis==='ns'?[0,s]:[s,0];
      const expected=node.axis==='ns'?[0,d]:[-d,0];
      for(let pointIndex=0;pointIndex<ramp.points.length;pointIndex++){
        if(pointIndex<topIndex)assert.equal(ramp.points[pointIndex][4],undefined);
        else assert.deepEqual(ramp.points[pointIndex][4],expected);
      }
      for(let pointIndex=topIndex;pointIndex<ramp.points.length;pointIndex++){
        const section=ribbon.sections[pointIndex];
        const inward=[section.left,section.right].sort((a,b)=>
          (a[0]-node.x)*outward[0]+(a[2]-node.z)*outward[1]
          -((b[0]-node.x)*outward[0]+(b[2]-node.z)*outward[1]))[0];
        const boundary=(inward[0]-node.x)*outward[0]+(inward[2]-node.z)*outward[1];
        assert.ok(Math.abs(boundary-halfHighway)<EPS,
          `extent ${extent}: ${node.ko} ramp ${index} point ${pointIndex} misses deck edge by ${(boundary-halfHighway).toFixed(9)}`);
      }
    }
  }
});

test('roadRibbon bounds near-hairpin miters and skips horizontal duplicate instability',()=>{
  const ribbon=roadRibbon([[0,0,0,10],[0,10,1,10],[0,10,2,10],[.001,0,3,10]]);
  for(const section of ribbon.sections){
    for(const edge of [section.left,section.right]){
      assert.ok(edge.every(Number.isFinite));
      assert.ok(distance(edge,section.center)<=20+EPS,'miter escaped its four-half-width bound');
    }
  }
  assert.ok(ribbon.triangles.every(upward),'degenerate turn changed top winding');
});
