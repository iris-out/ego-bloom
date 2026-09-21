import { hitsAnyBuilding } from './solidIndex.js';
import { hitsVehicle } from './carPhysics.js';
import { hitsSphere } from './airTraffic.js';

/** 포구는 모델 좌표에서 그대로 옮긴 값이다. turret 은 차체 원점에서 본 포탑 중심,
 * pivot 은 포탑 중심에서 본 포신 회전축, reach 는 회전축에서 포구 끝까지의 길이다.
 * 모델(models/Tank 등) 의 포탑 group, 포신 group, 포구 mesh 를 옮기면 이 표도 같이 옮긴다.
 * barrels 는 쌍열 포의 좌우 간격이고 발사 순서대로 번갈아 쓴다. */
export const GROUND_GUNS={
  tank:{speed:150,cooldown:1.15,blast:8,turret:[0,.75,-.3],pivot:[0,.14,-1.02],reach:3.325},
  howitzer:{speed:115,cooldown:1.8,blast:11,turret:[0,.8,-.3],pivot:[0,.55,-1.3],reach:2.9},
  armored:{speed:230,cooldown:.16,blast:3,turret:[0,.75,-.3],pivot:[0,.32,-.5],reach:3.415},
  // 대공포다. 쌍열 기관포답게 분당 750발로 쏜다. 탄속이 가장 빠르고 낙차가 가장 작다.
  // 움직이는 항공기를 맞히려면 탄이 곧게 날아야 한다. gravity 를 적지 않은 기종은 GROUND_GRAVITY 를 쓴다.
  aa:{speed:400,cooldown:60/750,blast:2.4,gravity:3.36,turret:[0,.78,-.2],pivot:[0,.34,-.6],reach:3.06,barrels:[-.17,.17]},
};
/** 기본 포탄 중력이다. 기종이 gravity 를 적지 않으면 이 값을 쓴다. reticle.GROUND_GRAVITY 와 같다. */
export const GROUND_GRAVITY=9.8;
/** 기종별 포탄 중력이다. 발사와 조준선이 같은 값을 읽는다. */
export const shellGravity=(vehicle)=>GROUND_GUNS[vehicle]?.gravity??GROUND_GRAVITY;

/** 분당 발사 수다. 화면과 카드가 읽는 값이고 cooldown 한 곳에서 파생한다. */
export const roundsPerMinute=(vehicle)=>{const spec=GROUND_GUNS[vehicle];return spec?Math.round(60/spec.cooldown):0;};
const finite=(n,f=0)=>Number.isFinite(n)?n:f;
export const isCombatVehicle=vehicle=>vehicle in GROUND_GUNS;
// shots 는 누적 발사 수다. 남의 화면이 이 숫자의 증가만 보고 예광을 만든다.
export function createGroundArsenal(){return{shells:[],blasts:[],cooldown:0,nextId:1,hits:[],airHits:[],shots:0};}
/** 기종별 조준 한계다. 포탑은 360도 돌지만 앙각은 포의 종류를 따른다.
 * 자주포는 곡사포라 전차보다 높이 든다. */
export const AIM_LIMITS = Object.freeze({
  tank: { yaw: Math.PI, pitch: [-0.12, 0.5] },
  howitzer: { yaw: Math.PI, pitch: [-0.05, 1.05] },
  armored: { yaw: Math.PI, pitch: [-0.12, 0.62] },
  // 대공포는 하늘을 봐야 한다. 거의 수직까지 든다.
  aa: { yaw: Math.PI, pitch: [-0.08, 1.45] },
});

/** -PI 와 PI 사이로 감는다. 포탑이 먼 길로 돌지 않게 한다. */
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** 방향키 조준 속도다. 포탑은 초당 약 51도, 포신은 약 26도 움직인다.
 * 전차 포탑이 실제로 이 정도 속도라 조준이 손에 붙는다. */
export const AIM_RATE = Object.freeze({ yaw: 0.9, pitch: 0.45 });

/** 방향키로 포탑을 돌린다. 좌우는 포탑, 위아래는 포신이고 기종별 앙각 한계를 지킨다.
 * 순수 함수이며 dt 를 곱하므로 프레임 수가 달라도 같은 속도로 움직인다.
 */
export function aimKeyboard(aim, yawInput = 0, pitchInput = 0, dt = 0, vehicle = 'tank') {
  const limits = AIM_LIMITS[vehicle] || AIM_LIMITS.tank;
  const step = Math.max(0, Math.min(finite(dt), 0.1));
  const yaw = wrap(finite(aim?.yaw) + Math.max(-1, Math.min(1, finite(yawInput))) * AIM_RATE.yaw * step);
  const raw = finite(aim?.pitch) + Math.max(-1, Math.min(1, finite(pitchInput))) * AIM_RATE.pitch * step;
  return { yaw, pitch: Math.max(limits.pitch[0], Math.min(limits.pitch[1], raw)) };
}

/** 포인터 한 픽셀이 움직이는 각(라디안) 이다. 1인칭에서 포탑이 곧 시점이라
 * 화면 절반을 끌면 대략 90도 돌아가는 값으로 잡았다. */
export const AIM_SENSITIVITY = Object.freeze({ yaw: 0.0032, pitch: 0.0026 });

/** 마우스와 터치의 상대 조준이다. 앙각 한계는 기종이 정한다.
 *
 * 부호는 시점 조작 규약을 따른다. 오른쪽으로 끌면 오른쪽을 보고 위로 끌면 위를 본다.
 * muzzlePoint 의 heading 이 +yaw 에서 왼쪽을 향하고 화면 y 는 아래로 증가하므로 둘 다 뺀다.
 * 예전에는 둘 다 더해 좌우와 위아래가 모두 뒤집혀 있었고, 앙각 한계도 -0.12~0.5 로 박혀 있어
 * 대공포가 마우스로는 하늘을 겨누지 못했다. */
export function aimGroundWeapon(aim,dx=0,dy=0,vehicle='tank'){
  const limits=AIM_LIMITS[vehicle]||AIM_LIMITS.tank;
  return {
    yaw:wrap(finite(aim?.yaw)-finite(dx)*AIM_SENSITIVITY.yaw),
    pitch:Math.max(limits.pitch[0],Math.min(limits.pitch[1],finite(aim?.pitch)-finite(dy)*AIM_SENSITIVITY.pitch)),
  };
}

/** 마우스 포인터가 가리키는 월드 지점을 조준한다. 반환 yaw 는 차체 heading
 * 기준 상대각이다. 모델의 turretYaw 와 stepGroundWeapons 가 같은 기준을 쓴다. */
export function aimAtPoint(pose, target, vehicle = 'tank') {
  const limits = AIM_LIMITS[vehicle] || AIM_LIMITS.tank;
  const dx = finite(target?.x) - finite(pose?.x);
  const dz = finite(target?.z) - finite(pose?.z);
  const flat = Math.hypot(dx, dz);
  // 차체와 같은 자리를 가리키면 방향이 없다. 정면으로 둔다.
  if (flat < 1e-6) return { yaw: 0, pitch: Math.max(limits.pitch[0], Math.min(limits.pitch[1], 0)) };
  // heading 0 이 -Z 를 보므로 월드 방위는 atan2(-dx, -dz) 다.
  const world = Math.atan2(-dx, -dz);
  const yaw = Math.max(-limits.yaw, Math.min(limits.yaw, wrap(world - finite(pose?.heading))));
  const dy = finite(target?.y) - finite(pose?.y, 1.2);
  const pitch = Math.max(limits.pitch[0], Math.min(limits.pitch[1], Math.atan2(dy, flat)));
  return { yaw, pitch };
}

/** 포구의 월드 좌표와 발사 방향이다. 차체 heading 으로 포탑 중심을, 포탑 yaw 로 포신 회전축을,
 * 앙각으로 포구를 차례로 옮겨 모델의 포신 끝과 같은 자리에 둔다. shot 은 쌍열 포의 좌우 선택이다. */
export function muzzlePoint(pose={},aim={},vehicle='tank',shot=0){
  const spec=GROUND_GUNS[vehicle]||GROUND_GUNS.tank;
  const heading=finite(pose.heading),yaw=heading+finite(aim.yaw),pitch=finite(aim.pitch);
  const [tx,ty,tz]=spec.turret,[px,py,pz]=spec.pivot;
  const barrels=spec.barrels||[0],side=barrels[Math.abs(Math.trunc(finite(shot)))%barrels.length];
  // 차체 국소 +X 는 heading 만큼 돌아간 (cos, -sin), 앞(-Z) 은 (-sin, -cos) 다.
  const hullRight={x:Math.cos(heading),z:-Math.sin(heading)},hullAhead={x:-Math.sin(heading),z:-Math.cos(heading)};
  const gunRight={x:Math.cos(yaw),z:-Math.sin(yaw)},gunAhead={x:-Math.sin(yaw),z:-Math.cos(yaw)};
  const forward={x:gunAhead.x*Math.cos(pitch),y:Math.sin(pitch),z:gunAhead.z*Math.cos(pitch)};
  const hinge={
    x:finite(pose.x)+hullRight.x*tx-hullAhead.x*tz+gunRight.x*px-gunAhead.x*pz,
    y:finite(pose.y,1.2)+ty+py,
    z:finite(pose.z)+hullRight.z*tx-hullAhead.z*tz+gunRight.z*px-gunAhead.z*pz,
  };
  return {
    x:hinge.x+forward.x*spec.reach+gunRight.x*side,
    y:hinge.y+forward.y*spec.reach,
    z:hinge.z+forward.z*spec.reach+gunRight.z*side,
    forward,
    hinge,
  };
}

export function stepGroundWeapons(previous,{dt=0,fire=false,pose={},aim={},vehicle='tank',buildings=[],traffic=[],airTargets=[]}={}){
  const step=Math.max(0,Math.min(.05,finite(dt))),spec=GROUND_GUNS[vehicle];
  const state={...previous,shells:[],blasts:[],hits:[],airHits:[],cooldown:Math.max(0,finite(previous.cooldown)-step)};
  const active=[...(previous.shells||[])];
  // 0.1초 대공포 쿨다운은 60Hz 합산에서 1e-16 정도 양수로 남을 수 있다.
  // 그 오차로 마지막 한 발을 건너뛰면 제원보다 느리게 발사된다.
  if(spec&&fire&&state.cooldown<=1e-9){
    const {x,y,z,forward}=muzzlePoint(pose,aim,vehicle,state.shots||0);
    active.push({id:state.nextId++,x,y,z,vx:forward.x*spec.speed,vy:forward.y*spec.speed,vz:forward.z*spec.speed,age:0,vehicle});
    state.cooldown=spec.cooldown;state.shots=(state.shots||0)+1;
  }
  for(const shell of active){
    // 낙차는 기종이 정한다. 조준선(reticle.groundImpact) 이 같은 값을 읽어야 표식이 맞는다.
    const moved={...shell,age:shell.age+step,vy:shell.vy-shellGravity(shell.vehicle)*step};moved.x+=moved.vx*step;moved.y+=moved.vy*step;moved.z+=moved.vz*step;
    // 공중 목표를 먼저 본다. 지상 판정보다 앞에 둬야 하늘에서 맞은 탄이 땅까지 내려가지 않는다.
    const aircraft=airTargets.find(box=>hitsSphere(shell,moved,box));
    if(aircraft){
      state.blasts.push({id:state.nextId++,x:moved.x,y:moved.y,z:moved.z,age:0,life:.9,size:spec?.blast||6});
      state.airHits.push({index:aircraft.index,weapon:vehicle,x:moved.x,y:moved.y,z:moved.z});
      continue;
    }
    const target=traffic.find(box=>hitsVehicle(shell,moved,box,.8));
    const impact=target||moved.y<=.25||hitsAnyBuilding(shell,moved,buildings);
    if(impact){state.blasts.push({id:state.nextId++,x:moved.x,y:Math.max(.3,moved.y),z:moved.z,age:0,life:.9,size:spec?.blast||6});if(target)state.hits.push(target);continue;}
    if(moved.age<4)state.shells.push(moved);
  }
  state.blasts=[...(previous.blasts||[]),...state.blasts].map(b=>({...b,age:b.age+step})).filter(b=>b.age<b.life);
  return state;
}

/** 한 발이 시선에 얹는 반동(라디안) 이다. 연사가 빠른 포일수록 한 발을 약하게 둔다.
 * 대공포는 분당 750발이라 기본값 그대로면 조준경이 하늘에서 계속 튄다.
 * 읽는 곳은 카메라(CarMode) 뿐이지만 값 자체는 포의 제원이라 여기 둔다. */
export const RECOIL_KICK=Object.freeze({armored:.008,aa:.0298,default:.035});
export const recoilKick=(vehicle)=>RECOIL_KICK[vehicle]??RECOIL_KICK.default;

/** 광학 조준경 자리다. out 은 포신 회전축에서 포신 방향으로 나가는 거리, rise 는 포신 축 위로
 * 올리는 높이다. out 을 포구(reach) 보다 크게 두어 차체, 포탑, 포신이 모두 카메라 뒤에 남는다.
 * 각 값은 모델의 차체 앞끝과 포구 자리에서 나왔다(괄호는 차체 원점 기준 z). */
export const SCOPE_EYE=Object.freeze({
  // 차체 코 -3.35, 회전축 -1.32, 포구 -4.65
  tank:{out:3.7,rise:.12},
  // 차체 코 -3.85, 회전축 -1.6, 포구 -4.5
  howitzer:{out:3.3,rise:.12},
  // 차체 코 -3.4, 회전축 -0.8, 포구 -4.22
  armored:{out:3.8,rise:.1},
  // 차체 코 -3.3, 회전축 -0.8, 포구 -3.86
  aa:{out:3.4,rise:.1},
});

/** 조준경 카메라의 월드 좌표와 보는 방향이다. 포신을 세워도 조준경이 포신 위에 남도록
 * 위쪽은 월드 Y 가 아니라 포신 축에 수직인 방향을 쓴다. 순수 함수다. */
export function scopePoint(pose={},aim={},vehicle='tank'){
  const spec=SCOPE_EYE[vehicle]||SCOPE_EYE.tank;
  const {hinge,forward}=muzzlePoint(pose,aim,vehicle);
  const yaw=finite(pose.heading)+finite(aim.yaw),pitch=finite(aim.pitch);
  const ahead={x:-Math.sin(yaw),z:-Math.cos(yaw)},cos=Math.cos(pitch),sin=Math.sin(pitch);
  const up={x:-ahead.x*sin,y:cos,z:-ahead.z*sin};
  return {
    x:hinge.x+forward.x*spec.out+up.x*spec.rise,
    y:hinge.y+forward.y*spec.out+up.y*spec.rise,
    z:hinge.z+forward.z*spec.out+up.z*spec.rise,
    forward,
  };
}

/** 차종별 전고다. 바퀴나 궤도 최하단에서 지붕까지이며 models/ 의 실루엣 주석에서 끌어왔다
 * (세단 지붕 0.85, SUV 1.02, 오픈카 0.55, 트럭 2.0, 전차 1.6, 자주포 1.9, 장갑차와 대공포 1.5,
 * 모두 최하단 -0.9 기준). traffic.TRAFFIC_BODY 와 같은 역할이고, 남이 쏜 포탄이 내 차 위를
 * 지나갈 때 맞지 않게 하는 데만 쓴다. */
export const HULL_FLOOR=.9;
export const HULL_HEIGHT=Object.freeze({
  sedan:1.75,suv:1.92,convertible:1.45,truck:2.9,motorcycle:1.8,
  tank:2.5,howitzer:2.8,armored:2.4,aa:2.4,
});

/** 차체 상자에 세로를 채운다. pose 의 y 는 차체 원점(바퀴 최하단 위 HULL_FLOOR) 이라
 * 그대로 바닥으로 쓰면 상자가 한 층 떠 있다. 전고를 모르는 탈것은 예전처럼 세로를 보지
 * 않는 상자를 그대로 돌려준다. */
export function hullBox(box){
  const height=box&&HULL_HEIGHT[box.key];
  if(!height)return box;
  return {...box,y:finite(box.y)-HULL_FLOOR,height};
}
