import { Lightbulb } from 'lucide-react';
import { beamLabel } from '../headlights.js';

/** 전조등 안내다. 우하단 무장 칸 위에 붙는다. 지금 상태와 H 키를 한 줄로 읽게 한다.
 * BoostStages 와 같이 읽기만 하는 칸이라 우하단에서 시작한 3인칭 궤도 드래그를
 * 가로채지 않는다. */
export default function Headlights({ beam = 'off' }) {
  return <div className="wui-stage wui-beam">
    {/* 보이는 줄은 감추고 같은 내용을 한 문장으로 읽힌다. H 를 누르면 이 문장만 다시 읽는다. */}
    <span className="wui-sr" role="status">
      {`전조등 ${beamLabel(beam)}. H 로 꺼짐, 하향등, 상향등, 둘 다 순서로 전환`}
    </span>
    <p className="wui-stage-row" data-active={beam === 'off' ? 'false' : 'true'} aria-hidden="true">
      <Lightbulb size={13} />
      <span>전조등<em>{beamLabel(beam)}</em></span>
      <kbd>H</kbd>
    </p>
  </div>;
}
