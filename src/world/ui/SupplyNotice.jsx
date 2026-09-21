import { PackageOpen } from 'lucide-react';

/** 보급 안내다. 탄약이나 연료가 바닥나면 화면 오른쪽 위에 계속 떠 있고,
 * 착륙해서 충전되면 스스로 사라진다. 충전은 weapons.js 와 flightPhysics 가 활주로에서 한다.
 * 여기서는 상태를 읽어 문장만 만든다. 재고를 여기서 세지 않는다. */

/** 0 이 된 무장의 이름이다. 값이 없는 무장은 애초에 표시하지 않는다. */
function dryList(status) {
  const out = [];
  if (status.cannonAmmo === 0) out.push('기관총');
  if (status.missileAmmo === 0) out.push('미사일');
  if (status.bombAmmo === 0) out.push('폭탄');
  return out;
}

export default function SupplyNotice({ status = {} }) {
  const dry = dryList(status);
  // 연료는 요격기만 갖는다. 없는 기종은 null 이라 조건이 서지 않는다.
  const noFuel = Number.isFinite(status.fuel) && status.fuel <= 0.005;
  if (!dry.length && !noFuel) return null;

  const parts = [];
  if (dry.length) parts.push(`${dry.join(', ')} 소진`);
  if (noFuel) parts.push('연료 소진');

  return <div className="wui-supply" role="status">
    <PackageOpen size={15} aria-hidden="true" />
    <span><b>{parts.join(' · ')}</b>활주로에 착륙하면 자동으로 충전된다</span>
  </div>;
}
