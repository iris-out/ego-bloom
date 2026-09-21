import { buildWorld } from './shared/worldLayout.js';
const MIX=[['Champion',31],['Master',79],['Diamond',118],['Platinum',98],['Gold',109],['Silver',39],['Bronze',98]];
const SCORES={Champion:3.9e8,Master:6e7,Diamond:2.5e7,Platinum:9e5,Gold:9e4,Silver:2e4,Bronze:3e3};
const creators=(count)=>{const total=MIX.reduce((s,[,n])=>s+n,0),rows=[];for(const [t,sh] of MIX){const many=Math.round(count*sh/total);for(let i=0;i<many&&rows.length<count;i++)rows.push({id:t+'-'+i,tier_name:t,elo_score:SCORES[t]+i});}for(let i=rows.length;i<count;i++)rows.push({id:'f'+i,tier_name:'Bronze',elo_score:1000+i});return rows;};
for(const n of [572,1000])console.log(n, buildWorld(creators(n))[0].cityExtent);
