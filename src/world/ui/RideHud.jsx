import { useCallback, useRef } from 'react';
import { Bomb, Crosshair, Eye, Navigation, Repeat, RotateCcw, Rocket } from 'lucide-react';
import { PLANE_META, VEHICLE_META } from '../identity.js';
import { hasOverdrive } from '../flightPhysics.js';
import { useRideStatus } from '../rideStatusStore.js';
import { hudPresentation } from './hudPresentation.js';
import { normalizeHudPreferences } from './hudPreferences.js';
import BoostStages from './BoostStages.jsx';
import Headlights from './Headlights.jsx';
import LockBox from './LockBox.jsx';
import CarGauges from './CarGauges.jsx';
import KillFeed from './KillFeed.jsx';
import SupplyNotice from './SupplyNotice.jsx';
import BoostOverlay from './BoostOverlay.jsx';
import Reticle from './Reticle.jsx';
import WalkHud from './WalkHud.jsx';
import './hybrid-hud.css';

/** The hybrid shell keeps the header, status, and controls in stable positions.
 * Each mode contributes only its real instruments. The projected reticle and
 * touch firing/throttle controls keep their existing data and callbacks. */

function ThrottleDial({ value }) {
  const percent = Math.max(0, Math.min(1, value));
  const circumference = 2 * Math.PI * 44;
  return <svg viewBox="0 0 100 100" width="46" height="46" aria-label={`스로틀 ${Math.round(percent * 100)}퍼센트`}>
    <circle cx="50" cy="50" r="44" fill="none" stroke="var(--line)" strokeWidth="6" />
    <circle cx="50" cy="50" r="44" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round"
      strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent * 0.75)}
      transform="rotate(-215 50 50)" />
    <text x="50" y="47" textAnchor="middle" fill="var(--fg)" fontSize="28" fontFamily="inherit">{Math.round(percent * 100)}</text>
    <text x="50" y="68" textAnchor="middle" fill="var(--fg-3)" fontSize="13" fontFamily="inherit">THR</text>
  </svg>;
}

/** 세로 스로틀 레버다. 위가 100%, 아래가 0% 이고 트랙을 끌거나 방향키로 움직인다.
 * 조종석 레버와 방향이 같아야 스로틀을 올린다는 말이 화면과 맞는다.
 */
function ThrottleLever({ value, onChange }) {
  const track = useRef(null);
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  const set = useCallback((clientY) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || !rect.height) return;
    onChange?.(Math.round(Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height)) * 100));
  }, [onChange]);
  const drag = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    set(event.clientY);
  };
  const move = (event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) set(event.clientY); };
  const key = (event) => {
    const step = event.shiftKey ? 25 : 5;
    const delta = Number(event.key === 'ArrowUp' || event.key === 'PageUp') - Number(event.key === 'ArrowDown' || event.key === 'PageDown');
    if (delta) { event.preventDefault(); onChange?.(Math.max(0, Math.min(100, percent + delta * step))); return; }
    if (event.key === 'Home') { event.preventDefault(); onChange?.(100); }
    if (event.key === 'End') { event.preventDefault(); onChange?.(0); }
  };
  return <div className="wui-lever">
    <span className="wui-lever-value">{percent}%</span>
    <div ref={track} className="wui-lever-track" role="slider" tabIndex={0}
      aria-label="비행기 스로틀, 올리기 + 또는 위 방향키, 내리기 - 또는 아래 방향키" aria-orientation="vertical"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
      onPointerDown={drag} onPointerMove={move} onKeyDown={key}>
      <span className="wui-lever-fill" style={{ height: `${percent}%` }} />
      <span className="wui-lever-notches" aria-hidden="true" />
      <span className="wui-lever-knob" style={{ bottom: `${percent}%` }} />
    </div>
    {/* 어느 키로 움직이는지 레버 옆에서 바로 읽히게 한다. 방향키도 같은 스로틀을 움직인다. */}
    <span className="wui-lever-keys" aria-hidden="true"><kbd>+</kbd><kbd>-</kbd></span>
    <span className="wui-lever-keys" aria-hidden="true"><kbd>방향키 ↑</kbd><kbd>↓</kbd></span>
    <span>THR</span>
  </div>;
}

/** 차체 게이지다. 무장 탈것만 받는다. 절반 아래는 경고색, 4분의 1 아래는 피격색이다. */
function HullBar({ value }) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  const level = percent <= 25 ? 'critical' : percent <= 50 ? 'warn' : 'ok';
  return <div className="wui-hull" data-level={level}
    role="meter" aria-label="차체 내구도" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
    <span className="wui-hull-label">차체 내구도</span>
    <span className="wui-hull-value"><b>{percent}</b><small>%</small></span>
    <span className="wui-hull-track"><i style={{ width: `${percent}%` }} /></span>
  </div>;
}

function Readout({ label, compactLabel = label, value }) {
  return <div className="wui-readout"><b>{value}</b><span className="wui-readout-label-full">{label}</span><span className="wui-readout-label-compact">{compactLabel}</span></div>;
}

/** 누르는 동안 참인 버튼이다. 키보드가 없는 기기에서 유일한 발사 수단이다. */
function HoldButton({ icon, name, hotkey, ammo, onHold, disabled }) {
  const hold = (active) => () => onHold?.(active);
  return <button type="button" className="wui-arm" disabled={disabled}
    aria-label={`${name}${hotkey ? `, 단축키 ${hotkey}` : ''}${Number.isFinite(ammo) ? `, 잔탄 ${ammo}` : ''}`}
    onPointerDown={hold(true)} onPointerUp={hold(false)} onPointerLeave={hold(false)}
    onPointerCancel={hold(false)} onContextMenu={(event) => event.preventDefault()}>
    {icon}<span>{name}</span>{Number.isFinite(ammo) && <b>{ammo}</b>}{hotkey && <kbd>{hotkey}</kbd>}
  </button>;
}

function rideLabel(kind, rideKey) {
  if (kind === 'walk') return '도보';
  const meta = kind === 'flight' ? PLANE_META[rideKey] : VEHICLE_META[rideKey];
  return meta?.ko || rideKey;
}

/** 연료 칸 이름이다. 부스트 단계를 여기서 알린다. 강화 단계는 고르기만 해도 알려야
 * Shift 를 누르기 전에 연료 2.5배를 각오할 수 있다. */
function fuelLabel(status) {
  if (!status.overdrive) return status.boost ? 'FUEL % BOOST' : 'FUEL %';
  return status.boost ? 'FUEL % OVERDRIVE' : 'FUEL % OD READY';
}

function FlightReadouts({ status, throttle }) {
  return <div className="wui-hud-centre wui-flight-panel" aria-label="비행 계기">
    <Readout label="속도 KM/H" compactLabel="SPD" value={Math.round(status.speed || 0)} />
    <Readout label="고도 M" compactLabel="ALT" value={Math.round(status.altitude || 0)} />
    <Readout label="방위 HDG" compactLabel="HDG" value={String(Math.round(status.heading || 0)).padStart(3, '0')} />
    <span className="wui-flight-throttle"><ThrottleDial value={throttle / 100} /></span>
    {Number.isFinite(status.fuel) && <Readout label={fuelLabel(status)} compactLabel="FUEL %" value={Math.round(status.fuel * 100)} />}
  </div>;
}

export default function RideHud({
  kind, rideKey, pilotName, view, onView, onThrottle, onBrake,
  onFire, onAim, onReset, onExit, onMenu, onAutopilot, autopilot, onWeapon, onReload, minimap, canSwap, onSwap, peers, help,
  hudScale = 1, highContrast = false, reducedMotion = false,
}) {
  // RideHud 는 DOM 이라 탈것 상태 전체를 구독해도 R3F 트리에는 영향이 없다.
  // throttle 도 별도 state 가 아니라 status.throttle 에서 뽑는다.
  const status = useRideStatus();
  const throttle = Math.round((status.throttle || 0) * 100);
  const presentation = hudPresentation(kind, rideKey, view, status);
  const { walking: fps, showCarGauges: dials, combatCar: combat, showCannon: armed,
    showBombs: bombing, showRange } = presentation;
  // 부스트 단계가 있는 기종만 Shift 와 Q 안내를 단다. 차량과 도보는 kind 에서 걸린다.
  const staged = kind === 'flight' && hasOverdrive(rideKey);
  // 조준선은 aria-hidden 이므로 사거리는 계기 줄에도 넣어 스크린 리더가 읽게 한다.
  const range = showRange ? Math.round(status.range) : null;
  const preferences = normalizeHudPreferences({ hudScale, highContrast, reducedMotion });

  return <div className="wui-hybrid" data-kind={kind} data-view={view}
    data-hud-contrast={preferences.highContrast ? 'high' : 'normal'}
    data-hud-motion={preferences.reducedMotion ? 'reduce' : 'normal'}
    style={{ '--wui-hud-scale': preferences.hudScale }}>
    <div className="wui-hud-top">
      <div className="wui-hud-identity">
        <span className="wui-hud-brand">CREATOR <b>CITY</b></span>
        <span className="wui-hud-ride" aria-label={`탑승 중 ${rideLabel(kind, rideKey)}`}>{rideLabel(kind, rideKey)}</span>
        {pilotName && <span className="wui-hud-pilot">{pilotName}</span>}
        {Number.isFinite(peers) && <span className="wui-hud-peers" aria-label={`같은 도시에 ${peers}명`}>접속 {peers}</span>}
      </div>
      <span className="wui-tabs-spacer" />
      <div className="wui-hud-actions">
      {canSwap && <button type="button" className="wui-tab" aria-label="기종 바꾸기" onClick={onSwap}>
        <Repeat size={14} aria-hidden="true" />기종 바꾸기
      </button>}
      {kind === 'flight' && <button type="button" className="wui-tab" aria-pressed={!!autopilot}
        onClick={() => onAutopilot?.(!autopilot)}><Navigation size={14} aria-hidden="true" />자동 비행<kbd>P</kbd></button>}
      {kind !== 'walk' && <button type="button" className="wui-tab" aria-pressed={view === 'first'}
        onClick={() => onView?.(view === 'first' ? 'third' : 'first')}>
        <Eye size={14} aria-hidden="true" />{view === 'first' ? '3인칭' : '1인칭'}<kbd>C</kbd>
      </button>}
      {/* 도보는 R 이 재장전이라 복귀 단축키를 알리지 않는다. 버튼은 그대로 둔다. */}
      <button type="button" className="wui-tab" aria-label="출발 지점으로 돌아가기" onClick={onReset}>
        <RotateCcw size={14} aria-hidden="true" />{!fps && <kbd>R</kbd>}
      </button>
      {/* 도움말은 이 줄 안에 둔다. 화면 구석에 띄우면 계기나 스로틀 레버와 겹친다. */}
      {help}
      <button type="button" className="wui-tab wui-hud-menu" onClick={onMenu || onExit}>{onMenu ? '메뉴' : '종료'}<kbd>ESC</kbd></button>
      </div>
    </div>

    <Reticle kind={kind} rideKey={rideKey} status={status} />
    {/* 미사일을 든 기종만 포착 네모를 띄운다. 자리와 진행도는 lockStore 가 들고 있다. */}
    <LockBox active={kind === 'flight' && rideKey === 'fighter'} />

    {/* 전투 차량이 AI 차량을 부수면 도보와 같은 자리에 같은 줄이 뜬다. */}
    {!fps && <KillFeed kills={status.kills || 0} weapon={rideLabel(kind, rideKey)} label={status.killLabel}
      verb={kind === 'flight' ? '격추' : '파괴'} />}
    {presentation.combatFlight && <SupplyNotice status={status} />}
    <BoostOverlay active={!!status.boost} overdrive={!!status.overdrive} mach={Number(status.mach) || 0} />

    {fps && <WalkHud status={status} onFire={onFire} onAim={onAim} onWeapon={onWeapon} onReload={onReload} />}

    {presentation.showHull && <div className="wui-hud-hull"><HullBar value={status.hull} /></div>}
    {range !== null && <span className="wui-sr">{`탄착 거리 ${range}미터`}</span>}
    {presentation.showFlightReadouts && <FlightReadouts status={status} throttle={throttle} />}
    {dials && <CarGauges status={status} />}
    {minimap && <div className={fps ? 'wui-hud-map wui-hud-map-walk' : 'wui-hud-map'}>{minimap}</div>}

    {kind === 'flight' && <ThrottleLever value={throttle} onChange={onThrottle} />}

    {!fps && <div className={kind === 'flight' ? 'wui-hud-arms wui-hud-arms-lever' : 'wui-hud-arms'}>
      {kind === 'car' && <Headlights beam={status.beam} />}
      {staged && <BoostStages plane={rideKey} boost={!!status.boost} overdrive={!!status.overdrive} />}
      {armed && <>
        <HoldButton icon={<Crosshair size={14} />} name="기관총" hotkey="SPACE"
          ammo={status.cannonAmmo ?? 0} disabled={!status.cannonAmmo}
          onHold={(active) => onFire?.('cannon', active)} />
        {presentation.showMissiles && <HoldButton icon={<Rocket size={14} />} name="미사일" hotkey="V"
          ammo={status.missileAmmo ?? 0} disabled={!status.missileAmmo}
          onHold={(active) => onFire?.('missile', active)} />}
      </>}
      {bombing && <HoldButton icon={<Bomb size={14} />} name={status.bayOpen ? '투하 중' : '폭탄'} hotkey="SPACE"
        ammo={status.bombAmmo ?? 0} disabled={!status.bombAmmo}
        onHold={(active) => onFire?.('bomb', active)} />}
      {combat && <HoldButton icon={<Crosshair size={14} />} name="발사" hotkey="SPACE"
        onHold={(active) => onFire?.(active)} />}
      {kind === 'car' && !combat && <HoldButton name={rideKey === 'drift' ? '드리프트' : '브레이크'} hotkey="SPACE"
        onHold={(active) => onBrake?.(active)} />}
    </div>}

    <p className="wui-hud-message" aria-live="polite">{status.message || ''}</p>
  </div>;
}
