import { Zap } from 'lucide-react';

/** 부스트와 초음속 화면 효과다. 요격기가 Shift 를 누르고 있는 동안, 또는 마하를 넘는 동안 뜬다.
 * Q 로 고른 강화 단계는 배지 글자로만 구분한다. 효과를 따로 만들지 않는다.
 * 가장자리 비네팅, 바깥으로 흐르는 속도선, 배지 세 가지다.
 * 화각을 넓히는 줌아웃은 카메라가 맡는다. 여기서는 화면 위 레이어만 그린다.
 * 초음속이면 같은 레이어를 더 세게 쓰고 배지에 마하수를 적는다.
 * prefers-reduced-motion 에서는 속도선을 멈춘다. */
export default function BoostOverlay({ active = false, overdrive = false, mach = 0 }) {
  const sonic = mach >= 1;
  if (!active && !sonic) return null;
  return <div className="wui-boost" data-sonic={sonic ? 'true' : 'false'} aria-hidden="true">
    <span className="wui-boost-vignette" />
    <span className="wui-boost-streaks" />
    <span className="wui-boost-badge" role="status">
      <Zap size={14} aria-hidden="true" />{sonic ? `MACH ${mach.toFixed(2)}` : overdrive ? 'OVERDRIVE' : 'BOOST'}
    </span>
  </div>;
}
