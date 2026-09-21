import { Users } from 'lucide-react';
import { PLANE_META, VEHICLE_META } from './identity.js';

const VISIBLE = 12;

/** 지금 타고 있는 탈것의 세 글자 코드다. 도시를 둘러보는 세션은 고른 기종을 보여준다. */
function rideCode(pilot) {
  if (pilot.ride?.kind === 'car') return VEHICLE_META[pilot.ride.key]?.code || 'CAR';
  if (pilot.ride?.kind === 'walk') return 'WLK';
  return PLANE_META[pilot.ride?.key || pilot.plane]?.code || 'JET';
}

export default function Roster({ roster = [], selfId }) {
  if (!roster.length) return null;
  // 내 기체를 맨 위에 두고 나머지는 이름순으로 고정한다. 목록이 매 초 튀지 않게 한다.
  const sorted = [...roster].sort((a, b) => Number(b.id === selfId) - Number(a.id === selfId) || a.name.localeCompare(b.name, 'ko'));
  const shown = sorted.slice(0, VISIBLE);
  return <aside className="world-roster" aria-label="접속 중인 조종사">
    <h2><Users size={12} aria-hidden="true" />조종사 {roster.length}</h2>
    <ul>{shown.map(pilot => <li key={pilot.id} data-self={pilot.id === selfId || undefined}>
      <i data-plane={pilot.ride?.key || pilot.plane}>{rideCode(pilot)}</i><span>{pilot.name}</span>
    </li>)}</ul>
    {roster.length > shown.length && <p>외 {roster.length - shown.length}명</p>}
  </aside>;
}
