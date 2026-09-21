/** Art-directed Korean seasonal palette, not a weather/astronomy forecast.
 * Dates always use Asia/Seoul; colors interpolate daily between seasonal anchors.
 */
const anchors=[
 [1,15,'겨울','#a7b5ab','#b1bab0','#cad9e4'],[3,10,'초봄','#8ea986','#aabb96','#d8e7df'],
 [4,20,'봄','#94b77f','#b1c99a','#e4e8d6'],[6,20,'여름','#5e9a70','#8bb591','#c4e5e8'],
 [8,20,'늦여름','#739762','#9db286','#d8e4cc'],[9,12,'초가을','#98a66a','#b1b991','#e8d9be'],
 [10,25,'가을','#bd834b','#b5a27b','#ead0b3'],[11,25,'늦가을','#9b8866','#afa18a','#dcd5c8'],
 [12,20,'겨울','#a7b5ab','#b1bab0','#cad9e4'],
];
export function blendColor(a,b,t){
 const mix=[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0'));
 return `#${mix.join('')}`;
}
export function getSeason(date=new Date()) {
 const value=Number.isFinite(date.getTime())?date:new Date('2026-09-12T00:00:00Z');
 const fields=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value).map(p=>[p.type,p.value]));
 const year=Number(fields.year),day=Date.UTC(year,Number(fields.month)-1,Number(fields.day));
 const points=[{a:anchors.at(-1),time:Date.UTC(year-1,11,20)},...anchors.map(a=>({a,time:Date.UTC(year,a[0]-1,a[1])})),{a:anchors[0],time:Date.UTC(year+1,0,15)}];
 const next=points.findIndex(p=>p.time>day),left=points[next-1],right=points[next];
 const t=(day-left.time)/(right.time-left.time);
 const month=Number(fields.month),d=Number(fields.day);
 const label=month===9?'초가을':month===10?'가을':month===11?'늦가을':month>=12||month<=2?'겨울':month===3?'초봄':month<=5?'봄':month===8&&d>=20?'늦여름':'여름';
 return {dateKey:`${fields.year}-${fields.month}-${fields.day}`,label,leaf:blendColor(left.a[3],right.a[3],t),ground:blendColor(left.a[4],right.a[4],t),horizon:blendColor(left.a[5],right.a[5],t)};
}
const LIGHT={
 day:{zenith:'#427fad',horizon:'#c6deeb',sun:'#fff3d5',ambient:1.35,intensity:2.8,direction:[-.45,.63,-.62],glow:.2},
 dawn:{zenith:'#778bab',horizon:'#edc6a4',sun:'#ffd4a1',ambient:1.05,intensity:1.65,direction:[.74,.065,-.67],glow:.7},
 sunset:{zenith:'#635e88',horizon:'#f1a36f',sun:'#ffac62',ambient:1.0,intensity:1.8,direction:[-.74,.055,-.67],glow:.9},
 night:{zenith:'#030a20',horizon:'#071331',sun:'#c3d4ef',ambient:.2,intensity:.3,direction:[-.48,.43,-.76],glow:.015},
};
export function getAtmosphere(mode,season,weather='clear') {
 const base=LIGHT[mode]||LIGHT.day,cloudy=weather!=='clear';
 return {...base,horizon:mode==='night'?base.horizon:blendColor(base.horizon,season.horizon,.18),
 fog:mode==='night'?'#04091a':blendColor(base.horizon,season.horizon,.18),
 intensity:base.intensity*(cloudy?.55:1),glow:base.glow*(cloudy?.45:1)};
}

/** 시간대 기본값은 KST 현재 시각을 따른다. 사용자가 설정에서 바꾸면 그 값이 이긴다. */
export const TIME_BANDS = Object.freeze([
 { key: 'dawn', from: 5, to: 7 }, { key: 'day', from: 7, to: 17 },
 { key: 'sunset', from: 17, to: 19 }, { key: 'night', from: 19, to: 5 },
]);

export function getTimeOfDay(date = new Date()) {
 if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return 'day';
 const rawHour = Number(new Intl.DateTimeFormat('en-US',
  { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).format(date));
 if (!Number.isFinite(rawHour)) return 'day';
 const hour = rawHour % 24; // 일부 환경은 자정을 24 로 준다.
 // 밤은 자정을 넘으므로 from > to 인 구간을 따로 본다.
 const band = TIME_BANDS.find(({ from, to }) => from < to ? hour >= from && hour < to : hour >= from || hour < to);
 return band ? band.key : 'day';
}
