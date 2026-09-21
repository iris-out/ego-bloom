import { ArrowLeftRight, Zap } from 'lucide-react';
import { boostStages } from './boostStages.js';

/** 요격기 부스트 안내다. 우하단 무장 칸 위에 붙는다. Shift 는 누르는 동안,
 * Q 는 단계 전환이라는 것과 지금 고른 단계를 한 번에 읽게 한다.
 * 속도와 연료 배수는 boostStages 표에서 온다. 여기에 숫자를 적지 않는다. */
export default function BoostStages({ plane, boost = false, overdrive = false }) {
  const stages = boostStages(plane);
  if (stages.length < 2) return null;
  const picked = overdrive ? 'overdrive' : 'boost';
  const current = stages.find((stage) => stage.key === picked);
  return <div className="wui-stage">
    {/* 보이는 줄은 시각 안내라 감추고, 같은 내용을 한 문장으로 읽힌다.
     * role="status" 라 Q 로 단계를 바꾸면 그 문장만 다시 읽어 준다. */}
    <span className="wui-sr" role="status">
      {`Shift 를 누르는 동안 부스트, Q 로 단계 전환. 고른 단계 ${current.ko}, 계기 ${current.kmh}킬로미터, 연료 ${current.burn}배`}
    </span>
    <p className="wui-stage-row" data-active={boost ? 'true' : 'false'} aria-hidden="true">
      <Zap size={13} /><span>부스트<em>누르는 동안</em></span><kbd>SHIFT</kbd>
    </p>
    <p className="wui-stage-row" aria-hidden="true">
      <ArrowLeftRight size={13} />
      <span className="wui-stage-pick">
        {stages.map((stage) => <b key={stage.key} data-picked={stage.key === picked ? 'true' : 'false'}>
          {stage.ko}<i>{stage.kmh}</i>
        </b>)}
      </span>
      <kbd>Q</kbd>
    </p>
  </div>;
}
