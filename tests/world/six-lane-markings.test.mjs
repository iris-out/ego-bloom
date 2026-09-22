import test from 'node:test';
import assert from 'node:assert/strict';
import { roadMarkings } from '../../src/world/models/roadStructures.js';

// Missing the second divider on either half silently renders a four-lane road.
for (const [kind,width] of [['arterial',22],['highway',28]]) {
  for (const quality of ['low','medium','high']) test(`${kind} ${quality}: six usable lanes retain four divider alignments`,()=>{
    const parts=roadMarkings({x1:0,z1:0,x2:0,z2:200,kind,joinIn:0,joinOut:0},{width,quality});
    const xs=[...new Set(parts.filter(p=>p.material==='marking'&&Math.abs(p.position[0])<width/2-1).map(p=>Math.abs(p.position[0])))].sort((a,b)=>a-b);
    assert.equal(xs.length,2,'each direction needs two lane dividers, including low quality');
    const laneWidth=(width/2-.7-.65)/3;
    assert.ok(Math.abs(xs[0]-(.65+laneWidth))<1e-9);
    assert.ok(Math.abs(xs[1]-(.65+2*laneWidth))<1e-9);
    assert.ok(laneWidth>3,'trucks must fit without touching adjacent markings');
  });
}
