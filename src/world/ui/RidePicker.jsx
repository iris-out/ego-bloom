import { useEffect } from 'react';
import { Play, Timer, X } from 'lucide-react';
import { RIDE_GROUPS, rideOf } from '../rideSpecs.js';
import { isArmed } from '../health.js';
import { TIME_ATTACK_SECONDS } from '../timeAttack.js';
import RideArt from './rideArt.jsx';
import './ridePicker.css';

const BAR_LABELS = [['speed', '속도'], ['agility', '선회'], ['stability', '안정']];

function Bars({ bars }) {
  return <div className="wui-bars">
    {BAR_LABELS.map(([key, ko]) => <div className="wui-bar" key={key}>
      <span>{ko} {Math.round(bars[key] * 100)}</span>
      <i><em style={{ transform: `scaleX(${bars[key]})` }} /></i>
    </div>)}
  </div>;
}

/** 탈것 선택 시트다. 도시가 뒤에 계속 보여야 하므로 modal 이 아니다.
 * 항공기, 차량, 도보 세 그룹은 rideSpecs 가 정하고 여기서 개수를 세지 않는다. */
export default function RidePicker({ group, onGroup, selected, onSelect, onLaunch, onClose }) {
  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  const active = RIDE_GROUPS.find((entry) => entry.key === group) || RIDE_GROUPS[0];
  const ride = selected?.kind === active.key ? rideOf(selected.kind, selected.key) : null;

  return <section className="wui-picker" role="dialog" aria-modal="false" aria-label="탈것 선택">
    <div className="wui-picker-head">
      <div className="wui-picker-title">
        <span className="wui-picker-eyebrow">EGO WORLD <span aria-hidden="true">/</span> HANGAR</span>
        <h2>어디로 떠날까요?</h2>
        <p>오늘의 이동 수단을 고르세요.</p>
      </div>
      <button type="button" className="wui-picker-close" aria-label="탈것 선택 닫기" onClick={onClose}>
        <X size={18} aria-hidden="true" />
      </button>
    </div>

    <div className="wui-picker-tabs" role="tablist" aria-label="탈것 종류">
      {RIDE_GROUPS.map((entry) => <button type="button" key={entry.key} className="wui-picker-tab"
        role="tab" aria-selected={entry.key === active.key}
        onClick={() => onGroup(entry.key)}>
        <span>{entry.ko}</span><small>{String(entry.rides.length).padStart(2, '0')}</small>
      </button>)}
    </div>

    <div className="wui-picker-body">
      <div className="wui-picker-catalog">
        <div className="wui-picker-section-head"><span>{active.ko} 선택</span><span>{String(active.rides.length).padStart(2, '0')} AVAILABLE</span></div>
        <div className="wui-ride-grid">
          {active.rides.map((entry, index) => <button type="button" key={entry.key} className="wui-ride-card"
            aria-pressed={selected?.kind === entry.kind && selected?.key === entry.key}
            onClick={() => onSelect({ kind: entry.kind, key: entry.key })}>
            <span className="wui-ride-index">{String(index + 1).padStart(2, '0')}</span>
            <RideArt rideKey={entry.key} />
            <span className="wui-ride-name">{entry.ko}</span>
            <span className="wui-ride-code">{entry.code}</span>
          </button>)}
        </div>
      </div>
      <div className="wui-picker-detail" aria-live="polite">
        <div className="wui-picker-section-head"><span>선택 정보</span><span>SPEC / 01</span></div>
        {ride ? <>
          <div className="wui-picker-detail-art"><RideArt rideKey={ride.key} /></div>
          <div className="wui-picker-detail-name"><span>{ride.code}</span><h3>{ride.ko}</h3></div>
          <p className="wui-ride-note">{ride.note}</p>
          <Bars bars={ride.bars} />
        </> : <div className="wui-picker-empty"><span aria-hidden="true">+</span><p>{active.ko}를 선택하면<br />상세 정보가 표시됩니다.</p></div>}
      </div>
    </div>

    <div className="wui-picker-foot">
      <span className="wui-picker-foot-label">{ride?.eyebrow || 'SELECT YOUR RIDE'}</span>
      {/* 무장한 탈것만 타임어택을 연다. 쏠 무기가 없으면 점수를 낼 수 없다. */}
      {ride && isArmed(ride.kind, ride.key) && <button type="button" className="wui-launcher wui-launcher-attack"
        onClick={() => onLaunch({ kind: ride.kind, key: ride.key, mode: 'timeAttack' })}>
        <Timer size={15} aria-hidden="true" />타임어택 {Math.round(TIME_ATTACK_SECONDS / 60)}분
      </button>}
      <button type="button" className="wui-launcher" disabled={!ride}
        onClick={() => ride && onLaunch({ kind: ride.kind, key: ride.key })}>
        <Play size={15} aria-hidden="true" />출발
      </button>
    </div>
  </section>;
}
