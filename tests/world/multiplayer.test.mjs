import test from 'node:test';
import assert from 'node:assert/strict';
import { validPose, createWorldRoom } from '../../src/world/multiplayer.js';

function fixture(options = {}) {
  const handlers={};let status;const sent=[];const tracked=[];
  let presence={me:[{session:'me'}],other:[{session:'other'}]};
  const channel={on(type,filter,fn){handlers[`${type}:${filter.event}`]=fn;return this;},subscribe(fn){status=fn;return this;},
    track:async payload=>{tracked.push(payload);return 'ok';},presenceState:()=>presence,send:async message=>{sent.push(message);return 'ok';}};
  let removed=0;const client={channel:()=>channel,removeChannel:async()=>{removed++;}};
  const states=[];const peerStates=[];let now=0;
  const room=createWorldRoom(client,{id:'me',onChange:s=>states.push(s),onPeers:p=>peerStates.push(p),now:()=>now,...options});
  return {room,handlers,states,peerStates,sent,tracked,presence:value=>{presence=value;},
    subscribe:()=>status('SUBSCRIBED'),disconnect:()=>status('CHANNEL_ERROR'),time:n=>{now=n;},removed:()=>removed};
}
const pose={x:1,y:20,z:3,heading:0,pitch:0,roll:0,phase:'airborne'};
// kind 가 없는 payload 는 차량 이전 버전의 항공기 pose 다. 기본값으로 채워 받는다.
const normalized={...pose,kind:'flight',key:'jet',hull:1,shots:0,rockets:0,turret:0,barrel:0};
test('rejects malformed and unbounded network coordinates',()=>{
  assert.deepEqual(validPose(pose),normalized);
  for(const bad of [{...pose,x:NaN},{...pose,y:Infinity},{...pose,z:1e20},{...pose,phase:'bad'},null])assert.equal(validPose(bad),null);
});
test('차량과 도보 pose 를 받고 탈것 키, 체력, 발사 수를 다듬는다',()=>{
  const car=validPose({...pose,phase:'drive',kind:'car',key:'tank',hull:2.5,shots:7.2,turret:1,barrel:-0.2});
  assert.equal(car.kind,'car');
  assert.equal(car.key,'tank');
  assert.equal(car.hull,1);
  assert.equal(car.shots,0);
  assert.equal(car.turret,1);
  // 모르는 키와 모르는 종류는 기본값으로 접힌다. 남이 보낸 값이 모델 선택에 그대로 쓰이지 않는다.
  assert.equal(validPose({...pose,phase:'drive',kind:'car',key:'ufo'}).key,'sedan');
  assert.equal(validPose({...pose,kind:'ufo',key:'tank'}).kind,'flight');
  assert.equal(validPose({...pose,phase:'walk',kind:'walk',key:'tank'}).key,'walk');
  assert.equal(validPose({...pose,phase:'sinking',kind:'car',key:'sedan'}).phase,'sinking');
  assert.equal(validPose({...pose,hull:0.25,shots:3}).hull,0.25);
});
test('presence counts sessions, remote poses exclude self, stale peers expire and disconnect clears count',async()=>{
  const f=fixture();await f.subscribe();f.handlers['presence:sync']();
  assert.equal(f.states.at(-1).count,2);
  f.handlers['broadcast:flight']({payload:{id:'other',seq:1,pose}});
  assert.equal(f.peerStates.at(-1).length,1);
  f.handlers['broadcast:flight']({payload:{id:'other',seq:0,pose:{...pose,x:100}}});
  assert.equal(f.peerStates.at(-1)[0].pose.x,1);
  f.handlers['broadcast:flight']({payload:{id:'me',seq:2,pose}});
  assert.equal(f.peerStates.at(-1).length,1);
  f.time(6000);f.room.tick();assert.equal(f.peerStates.at(-1).length,0);
  f.disconnect();assert.equal(f.states.at(-1).count,null);assert.equal(f.states.at(-1).status,'offline');
  assert.deepEqual(f.states.at(-1).roster,[]);
  f.room.close();assert.equal(f.removed(),1);
});
test('flight exit sends removal and offline ticks do not broadcast',async()=>{
 const f=fixture();await f.subscribe();f.room.setPose(pose);f.room.tick();
 assert.deepEqual(f.sent.at(-1).payload.pose,normalized);
 f.room.setPose(null);f.room.tick();assert.equal(f.sent.at(-1).payload.pose,null);
 f.disconnect();const count=f.sent.length;f.room.tick();assert.equal(f.sent.length,count);f.room.close();
});
test('presence carries the pilot profile and sanitizes what other sessions send',async()=>{
  const f=fixture({identity:{name:'하늘빛',plane:'fighter'}});
  await f.subscribe();
  // since 는 입장 시각이라 값이 매번 다르다. 있는지만 본다. origin 은 서버가 준 회선 키다.
  const first=f.tracked.at(-1);
  assert.ok(Number.isFinite(first.since));
  assert.deepEqual({...first,since:0},{session:'me',since:0,name:'하늘빛',plane:'fighter',kind:'flight',ride:null,origin:''});
  f.presence({me:[{session:'me',name:'하늘빛',plane:'fighter'}],other:[{session:'other',name:'가'.repeat(30),plane:'ufo'}]});
  f.handlers['presence:sync']();
  const roster=f.states.at(-1).roster;
  assert.deepEqual(roster.find(entry=>entry.id==='me'),{id:'me',name:'하늘빛',plane:'fighter',ride:null});
  const other=roster.find(entry=>entry.id==='other');
  assert.equal(other.name.length,12);
  assert.equal(other.plane,'jet');
  f.handlers['broadcast:flight']({payload:{id:'other',seq:1,pose}});
  assert.equal(f.peerStates.at(-1)[0].plane,'jet');
  assert.equal(f.peerStates.at(-1)[0].name,other.name);
  f.room.close();
});
test('empty nicknames fall back to a session name and identity changes re-track',async()=>{
  const f=fixture();await f.subscribe();f.handlers['presence:sync']();
  assert.equal(f.states.at(-1).roster.find(entry=>entry.id==='other').name,'Player OTHE');
  f.room.setIdentity({name:'  하늘  ',plane:'bomber',kind:'car',ride:'tank'});
  assert.deepEqual({...f.tracked.at(-1),since:0},{session:'me',since:0,name:'  하늘  ',plane:'bomber',kind:'car',ride:'tank',origin:''});
  f.presence({me:[{session:'me',name:'하늘',plane:'bomber',kind:'car',ride:'tank'}]});
  f.handlers['presence:sync']();
  assert.deepEqual(f.states.at(-1).roster[0].ride,{kind:'car',key:'tank'});
  f.disconnect();const count=f.tracked.length;
  f.room.setIdentity({name:'무시',plane:'jet'});
  assert.equal(f.tracked.length,count);
  f.room.close();
});
test('unchanged status, count, roster do not trigger onChange again',async()=>{
  const f=fixture();await f.subscribe();f.handlers['presence:sync']();
  const before=f.states.length;
  f.handlers['presence:sync']();
  assert.equal(f.states.length,before);
});
test('broadcast reception only updates peers, never status, count or roster',async()=>{
  const f=fixture();await f.subscribe();f.handlers['presence:sync']();
  const before=f.states.length;
  f.handlers['broadcast:flight']({payload:{id:'other',seq:1,pose}});
  assert.equal(f.states.length,before);
  assert.equal(f.peerStates.at(-1).length,1);
});
