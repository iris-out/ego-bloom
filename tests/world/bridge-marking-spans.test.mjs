import test from 'node:test';
import assert from 'node:assert/strict';
import * as scenery from '../../src/world/UrbanScenery.js';

test('land paint stops at bridge approaches without retaining overlapping paint',()=>{
  assert.equal(typeof scenery.roadMarkingSpans,'function');
  const road={x1:0,z1:0,x2:60,z2:80};
  const bridges=[{x1:12,z1:16,x2:30,z2:40},{x1:24,z1:32,x2:42,z2:56}];
  assert.deepEqual(scenery.roadMarkingSpans(road,bridges),[[0,.2],[.7,1]]);
  assert.deepEqual(scenery.roadMarkingSpans(road,[]),[[0,1]]);
  assert.deepEqual(scenery.roadMarkingSpans(road,[{x1:-6,z1:-8,x2:66,z2:88}]),[]);
  assert.deepEqual(scenery.roadMarkingSpans(road,[{x1:90,z1:120,x2:120,z2:160}]),[[0,1]]);
  assert.deepEqual(scenery.roadMarkingSpans(road,[{x1:20,z1:0,x2:20,z2:100}]),[[0,1]],
    'a bridge on a different leg of the same route must not erase crossing paint');
});
