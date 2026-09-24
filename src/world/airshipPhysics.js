import { CEILING, FLIGHT_GROUND, flightBoundary, GUARD_RELEASE } from './flightPhysics.js';
import { hitsAnyBuilding } from './solidIndex.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value)));
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
export const AIRSHIP = Object.freeze({ maxSpeed: 22, climbSpeed: 6, turnRate: .28, radius: 18 });

/** Gondola origin, on the open apron north of the terminal and west of the runway. */
export function createAirshipState(extent = 180) {
  return { x: finite(extent,180) + 55, y: FLIGHT_GROUND, z: -150,
    heading: 0, pitch: 0, roll: 0, vx: 0, vy: 0, vz: 0,
    speed: 0, climb: 0, throttle: 0, phase: 'runway', message: '' };
}

// Overlapping swept spheres approximate the envelope, tail and gondola. Each
// query uses the shared collision index, including explicitly zero-margin walls.
const HULL = [[0,8,-11,5],[0,8,-5,5],[0,8,1,5],[0,8,7,5],[0,8,12,5],[0,0,-3,2],[0,14,12,2]];
const point = (s, [x,y,z]) => ({ x:s.x + x*Math.cos(s.heading)+z*Math.sin(s.heading), y:s.y+y, z:s.z-x*Math.sin(s.heading)+z*Math.cos(s.heading) });
function collision(from,to,buildings) {
  for (const p of HULL) if (hitsAnyBuilding(point(from,p),point(to,p),buildings,null,{margin:0,roofMargin:0,radius:p[3]})) return true;
  return false;
}
const crash = state => ({...state,phase:'crashed',speed:0,vx:0,vy:0,vz:0,climb:0,throttle:0,crashElapsed:0,message:'충돌 · 3초 후 계류장으로 돌아갑니다'});

/** Throttle drives horizontal propellers; pitch commands vertical speed.
 * Neutral lift automatically balances buoyancy, so releasing W/S holds altitude. */
export function stepAirship(previous, input = {}, delta = 0, extent = 180, buildings = []) {
  const dt = clamp(delta,0,.05), state = {...previous};
  if (!['x','y','z','heading','pitch','roll','vx','vy','vz'].every(k=>Number.isFinite(state[k]))) return createAirshipState(extent);
  if (state.phase === 'crashed') {
    state.crashElapsed=finite(state.crashElapsed)+dt;
    if (state.crashElapsed >= 3-1e-9) return createAirshipState(extent);
    return state;
  }
  state.throttle=clamp(input.throttle,0,1);
  const lift=clamp(input.pitch,-1,1), turn=clamp(finite(input.roll)+finite(input.yaw),-1,1);
  state.heading=wrap(state.heading-turn*AIRSHIP.turnRate*dt);
  state.pitch+=(lift*.035-state.pitch)*(1-Math.exp(-dt*1.2));
  state.roll+=(-turn*.065-state.roll)*(1-Math.exp(-dt*1.2));
  const speed=input.brake?0:state.throttle*AIRSHIP.maxSpeed;
  const blend=1-Math.exp(-dt*(input.brake?1.5:.42));
  state.vx+=(-Math.sin(state.heading)*speed-state.vx)*blend;
  state.vz+=(-Math.cos(state.heading)*speed-state.vz)*blend;
  state.vy+=(lift*AIRSHIP.climbSpeed-state.vy)*(1-Math.exp(-dt*2.5));
  const radius=Math.hypot(state.x,state.z), limit=flightBoundary(extent);
  state.guard=state.guard?radius>limit*GUARD_RELEASE:radius>limit;
  if(state.guard) {
    const gain=1-Math.exp(-dt);
    state.vx+=(-state.x/Math.max(1,radius)*AIRSHIP.maxSpeed-state.vx)*gain;
    state.vz+=(-state.z/Math.max(1,radius)*AIRSHIP.maxSpeed-state.vz)*gain;
    state.message='비행 구역 이탈 · 자동으로 도시 안쪽으로 돌아갑니다';
  } else state.message='';
  // Grounded airships stay moored until lift is commanded.
  if(state.phase==='runway' && lift<=0) state.vx=state.vz=0;
  state.x+=state.vx*dt;state.y+=state.vy*dt;state.z+=state.vz*dt;
  if(collision(previous,state,buildings))return crash(state);
  if(state.y<=FLIGHT_GROUND) {
    state.y=FLIGHT_GROUND;state.vy=0;state.vx=0;state.vz=0;state.phase='runway';
  } else state.phase='airborne';
  if(state.y>CEILING+FLIGHT_GROUND) {state.y=CEILING+FLIGHT_GROUND;state.vy=Math.min(0,state.vy);}
  state.speed=Math.hypot(state.vx,state.vz);state.climb=state.vy;
  return state;
}

/** Sightseeing autopilot stays above the city and follows a gentle outer orbit. */
export function stepAirshipAutopilot(previous,state,{extent=180,dt=0}={}) {
  if(state.phase==='crashed')return {ap:{...previous,mode:'depart'},input:{throttle:0,pitch:0,roll:0}};
  const altitude=150, angle=Math.atan2(state.z,state.x), radius=Math.hypot(state.x,state.z)||1;
  const pull=clamp((extent+150-radius)/140,-.8,.8);
  const dx=-Math.sin(angle)+Math.cos(angle)*pull, dz=Math.cos(angle)+Math.sin(angle)*pull;
  const heading=Math.atan2(-dx,-dz);
  return {ap:{...previous,mode:state.y<altitude-10?'depart':'cruise',elapsed:finite(previous.elapsed)+clamp(dt,0,.05)},
    input:{throttle:state.y<45?0:.65,pitch:clamp((altitude-state.y)*.05-state.climb*.12,-1,1),roll:clamp(-wrap(heading-state.heading)*1.5,-1,1),yaw:0,brake:false}};
}
