import { useCallback, useRef } from 'react';
import { Bomb, Crosshair, Eye, Navigation, Repeat, RotateCcw, Rocket } from 'lucide-react';
import { PLANE_META, VEHICLE_META } from '../identity.js';
import { isCombatVehicle } from '../groundWeapons.js';
import { armamentOf } from '../hardpoints.js';
import { hasOverdrive } from '../flightPhysics.js';
import { useRideStatus } from '../rideStatusStore.js';
import BoostStages from './BoostStages.jsx';
import CarGauges from './CarGauges.jsx';
import KillFeed from './KillFeed.jsx';
import SupplyNotice from './SupplyNotice.jsx';
import BoostOverlay from './BoostOverlay.jsx';
import Reticle from './Reticle.jsx';
import WalkHud from './WalkHud.jsx';

/** 비행과 주행이 같은 HUD 를 쓴다. 계기는 하단 중앙 한 줄, 미니맵은 좌하단,
 * 무장은 우하단, 기종과 종료는 상단이다. FlightCockpit 과 CarHud 가 각자 갖고 있던
 * 같은 게이지 SVG 를 하나로 합쳤다.
 * 도보만 배치가 다르다. 체력, 무기, 잔탄을 WalkHud 가 FPS 배치로 그린다.
 * 홀드 발사 버튼과 스로틀 슬라이더는 터치 기기의 유일한 조작 수단이므로 지운다. */

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
    <span className="wui-hull-track"><i style={{ width: `${percent}%` }} /></span>
    <b>{percent}</b>HULL
  </div>;
}

function Readout({ label, value }) {
  return <div className="wui-readout"><b>{value}</b>{label}</div>;
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

function centreGauges(kind, status, throttle) {
  if (kind === 'flight') {
    return [
      <Readout key="spd" label="KM/H" value={Math.round(status.speed || 0)} />,
      <ThrottleDial key="thr" value={(throttle || 0) / 100} />,
      <Readout key="alt" label="ALT M" value={Math.round(status.altitude || 0)} />,
      <Readout key="hdg" label="HDG" value={String(Math.round(status.heading || 0)).padStart(3, '0')} />,
      // 연료는 요격기만 갖는다. 없는 기종은 칸을 만들지 않는다.
      ...(Number.isFinite(status.fuel)
        ? [<Readout key="fuel" label={fuelLabel(status)} value={Math.round(status.fuel * 100)} />]
        : []),
    ];
  }
  // 차량의 속도, 기어, 방위는 좌하단 아날로그 계기가 맡는다. 같은 숫자를 두 곳에 두지 않는다.
  if (kind === 'car') return [];
  return [];
}

export default function RideHud({
  kind, rideKey, pilotName, view, onView, onThrottle, onBrake,
  onFire, onAim, onReset, onExit, onAutopilot, autopilot, onWeapon, onReload, minimap, canSwap, onSwap, peers, help,
}) {
  // RideHud 는 DOM 이라 탈것 상태 전체를 구독해도 R3F 트리에는 영향이 없다.
  // throttle 도 별도 state 가 아니라 status.throttle 에서 뽑는다.
  const status = useRideStatus();
  const throttle = Math.round((status.throttle || 0) * 100);
  // 도보는 체력, 잔탄, 능력을 FPS 배치로 따로 그린다. 계기 줄과 무장 버튼을 쓰지 않는다.
  const fps = kind === 'walk';
  // 3인칭 주행은 좌하단 아날로그 계기를 쓴다. 1인칭은 실내 계기판이 같은 값을 보여준다.
  const dials = kind === 'car' && view !== 'first';
  // 무장 여부는 표 한 곳에서 나온다. 손으로 적은 목록은 탈것을 더할 때마다 빠뜨린다.
  const combat = kind === 'car' && isCombatVehicle(rideKey);
  // 무장한 기체마다 버튼이 다르다. 전투기는 기관총과 미사일, 프로펠러기는 기관총, 폭격기는 폭탄이다.
  const armed = kind === 'flight' && Boolean(armamentOf(rideKey)?.cannon);
  // 부스트 단계가 있는 기종만 Shift 와 Q 안내를 단다. 차량과 도보는 kind 에서 걸린다.
  const staged = kind === 'flight' && hasOverdrive(rideKey);
  const bombing = kind === 'flight' && rideKey === 'bomber';
  // 1인칭은 조종석 계기판이 숫자를 맡는다. 같은 숫자를 DOM 에 또 두면 계기판을 아무도 보지 않는다.
  const first = view === 'first';
  // 조준선은 aria-hidden 이므로 사거리는 계기 줄에도 넣어 스크린 리더가 읽게 한다.
  const range = (combat || armed || bombing) && Number.isFinite(status.range) ? Math.round(status.range) : null;

  return <>
    <div className="wui-hud-top">
      <span className="wui-tab" aria-label={`탑승 중 ${rideLabel(kind, rideKey)}`}>{rideLabel(kind, rideKey)}</span>
      <span className="wui-tab">{pilotName}</span>
      {Number.isFinite(peers) && <span className="wui-tab" aria-label={`같은 도시에 ${peers}명`}>접속 {peers}</span>}
      <span className="wui-tabs-spacer" />
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
      <button type="button" className="wui-tab" onClick={onExit}>종료<kbd>ESC</kbd></button>
    </div>

    <Reticle kind={kind} rideKey={rideKey} status={status} />

    {/* 전투 차량이 AI 차량을 부수면 도보와 같은 자리에 같은 줄이 뜬다. */}
    {!fps && <KillFeed kills={status.kills || 0} weapon={rideLabel(kind, rideKey)} label={status.killLabel}
      verb={kind === 'flight' ? '격추' : '파괴'} />}
    {!fps && <SupplyNotice status={status} />}
    <BoostOverlay active={!!status.boost} overdrive={!!status.overdrive} mach={Number(status.mach) || 0} />

    {fps && <WalkHud status={status} onFire={onFire} onAim={onAim} onWeapon={onWeapon} onReload={onReload} />}

    {fps ? null : first
      ? (Number.isFinite(status.hull) || range !== null) && <div className="wui-hud-hull" aria-label="계기">
        {Number.isFinite(status.hull) && <HullBar value={status.hull} />}
        {range !== null && <span className="wui-sr">{`탄착 거리 ${range}미터`}</span>}
      </div>
      : <div className="wui-hud-centre" aria-label="계기">
        {Number.isFinite(status.hull) && <HullBar value={status.hull} />}
        {centreGauges(kind, status, throttle)}
        {range !== null && <Readout label="RANGE M" value={range} />}
      </div>}
    {dials && <CarGauges status={status} />}
    {/* 도보는 우상단, 계기가 좌하단을 쓰는 차량은 그 위, 나머지는 좌하단이다. */}
    {minimap && <div className={fps ? 'wui-hud-map wui-hud-map-walk' : dials ? 'wui-hud-map wui-hud-map-raised' : 'wui-hud-map'}>{minimap}</div>}

    {kind === 'flight' && <ThrottleLever value={throttle} onChange={onThrottle} />}

    {!fps && <div className={kind === 'flight' ? 'wui-hud-arms wui-hud-arms-lever' : 'wui-hud-arms'}>
      {staged && <BoostStages plane={rideKey} boost={!!status.boost} overdrive={!!status.overdrive} />}
      {armed && <>
        <HoldButton icon={<Crosshair size={14} />} name="기관총" hotkey="SPACE"
          ammo={status.cannonAmmo ?? 0} disabled={!status.cannonAmmo}
          onHold={(active) => onFire?.('cannon', active)} />
        {rideKey === 'fighter' && <HoldButton icon={<Rocket size={14} />} name="미사일" hotkey="V"
          ammo={status.missileAmmo ?? 0} disabled={!status.missileAmmo}
          onHold={(active) => onFire?.('missile', active)} />}
      </>}
      {bombing && <HoldButton icon={<Bomb size={14} />} name={status.bayOpen ? '투하 중' : '폭탄'} hotkey="SPACE"
        ammo={status.bombAmmo ?? 0} disabled={!status.bombAmmo}
        onHold={(active) => onFire?.('bomb', active)} />}
      {combat && <HoldButton icon={<Crosshair size={14} />} name="발사" hotkey="SPACE"
        onHold={(active) => onFire?.(active)} />}
      {kind === 'car' && !combat && <HoldButton name="브레이크" hotkey="SPACE"
        onHold={(active) => onBrake?.(active)} />}
    </div>}

    <p className="wui-hud-message" aria-live="polite">{status.message || ''}</p>
  </>;
}
