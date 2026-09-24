import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transformWithOxc} from 'vite';
import {angleToScreen,dropLadder,reticleOf} from '../../src/world/reticle.js';
import {armamentOf} from '../../src/world/hardpoints.js';
const source=await readFile(new URL('../../src/world/ui/Reticle.jsx',import.meta.url),'utf8');
const {code}=await transformWithOxc(source.replace(/^import .*;$/gm,'').replace('export default function Reticle','function Reticle'),'Reticle.jsx',{jsx:{runtime:'classic',pragma:'h',pragmaFrag:'Fragment'}});
const h=(type,props,...children)=>typeof type==='function'?type({...props,children}):({type,props:props||{},children:children.flat(Infinity)});
const Reticle=new Function('h','Fragment','useEffect','useMemo','useRef','useState','angleToScreen','dropLadder','reticleOf','armamentOf','aimNow','getAimScreen','HitFlash','KillFlash',`${code};return Reticle;`)(h,'fragment',()=>{},fn=>fn(),()=>({current:null}),initial=>[typeof initial==='function'?initial():initial,()=>{}],angleToScreen,dropLadder,reticleOf,armamentOf,()=>0,()=>null,()=>null,()=>null);
function missileWings(node){if(!node||typeof node!=='object')return 0;return Number(node.props?.className==='wui-reticle-msl')+(node.children||[]).reduce((n,child)=>n+missileWings(child),0);}
test('actual helicopter/prop reticles omit missile wings even with legacy missile ammo in status',()=>{
 for(const rideKey of ['helicopter','prop','interceptor','shotgun'])assert.equal(missileWings(Reticle({kind:'flight',rideKey,status:{cannonAmmo:600,missileAmmo:6}})),0,rideKey);
 assert.equal(missileWings(Reticle({kind:'flight',rideKey:'fighter',status:{cannonAmmo:600,missileAmmo:6}})),1);
});
