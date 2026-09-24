import { Crosshair, Eye, Flashlight, Footprints, RefreshCw } from 'lucide-react';
import { MAX_HP, WALK_WEAPONS, WEAPON_KEYS } from '../walkPhysics.js';
import FpsCrosshair from './FpsCrosshair.jsx';
import KillFeed from './KillFeed.jsx';

/** 도보 모드 전용 HUD 다. 오버워치 배치를 따른다.
 * 화면 아래를 세 칸으로 나눠 왼쪽이 체력, 가운데가 무기와 능력, 오른쪽이 잔탄이다.
 * 조준선은 화면 중앙, 처치 기록은 오른쪽 위다. 숫자는 전부 WalkMode 가 보내는 상태에서 온다.
 */

/** 체력 막대를 나누는 칸 하나의 크기다. 오버워치처럼 눈금으로 남은 양을 읽는다. */
const HP_PER_PIP = 25;
const ABILITY_ICON = { sprint: Footprints, torch: Flashlight };

/** 눌러서 유지하는 버튼이다. 키보드가 없는 기기의 사격과 정조준 수단이다. */
function HoldPad({ label, hotkey, icon, onHold }) {
  const hold = (active) => (event) => { event.preventDefault(); onHold?.(active); };
  return <button type="button" className="wui-fps-pad" aria-label={`${label}, 단축키 ${hotkey}`}
    onPointerDown={hold(true)} onPointerUp={hold(false)} onPointerLeave={hold(false)}
    onPointerCancel={hold(false)} onContextMenu={(event) => event.preventDefault()}>
    {icon}<span>{label}</span>
  </button>;
}

/** 능력 칸이다. fill 은 0~1 이며 지구력이나 재장전 진행도를 아래에서 위로 채운다. */
function Ability({ kind, name, hotkey, fill = 1, active = false, dim = false }) {
  const Icon = ABILITY_ICON[kind];
  return <div className="wui-fps-ability" data-active={active ? 'true' : 'false'} data-dim={dim ? 'true' : 'false'}
    role="meter" aria-label={`${name} ${Math.round(fill * 100)}퍼센트`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fill * 100)}>
    <span className="wui-fps-ability-fill" style={{ height: `${Math.round(Math.max(0, Math.min(1, fill)) * 100)}%` }} />
    <Icon size={17} aria-hidden="true" />
    <b>{name}</b>
    <kbd>{hotkey}</kbd>
  </div>;
}

export default function WalkHud({ status = {}, onFire, onAim, onWeapon, onReload }) {
  const maxHp = Number.isFinite(status.maxHp) && status.maxHp > 0 ? status.maxHp : MAX_HP;
  const hp = Math.max(0, Math.min(maxHp, Number.isFinite(status.hp) ? status.hp : maxHp));
  const pips = Math.round(maxHp / HP_PER_PIP);
  const ratio = hp / maxHp;
  const level = ratio <= 0.25 ? 'critical' : ratio <= 0.5 ? 'warn' : 'ok';
  const spec = WALK_WEAPONS[status.weapon] || WALK_WEAPONS.pistol;
  const kills = status.kills || 0;
  const stamina = Number.isFinite(status.stamina) ? status.stamina : 1;
  const reloading = !!status.reloading;

  return <div className="wui-fps" data-level={level}>
    <FpsCrosshair spread={status.spread} aiming={status.aiming} weapon={status.weapon}
      hurt={status.hurt} hurtFrom={status.hurtFrom} kills={kills} />

    {/* 체력이 바닥나면 화면 가장자리를 붉게 물들인다. 숫자를 보지 않아도 알 수 있어야 한다. */}
    {level === 'critical' && <span className="wui-fps-vignette" aria-hidden="true" />}

    <KillFeed kills={kills} weapon={spec.ko} label={status.killLabel} />

    <div className="wui-fps-bar">
      <div className="wui-fps-health" role="meter" aria-label="체력"
        aria-valuemin={0} aria-valuemax={Math.round(maxHp)} aria-valuenow={Math.round(hp)}>
        <div className="wui-fps-health-value"><span>HEALTH</span><b>{Math.round(hp)}</b><small>/ {Math.round(maxHp)}</small></div>
        <span className="wui-fps-pips">
          {Array.from({ length: pips }).map((_, index) => {
            // 칸마다 채운 비율을 따로 계산한다. 마지막 한 칸이 반쯤 남는 것도 보인다.
            const filled = Math.max(0, Math.min(1, hp / HP_PER_PIP - index));
            return <i key={index}><em style={{ width: `${filled * 100}%` }} /></i>;
          })}
        </span>
      </div>

      <div className="wui-fps-kit">
        <div className="wui-fps-slots" role="group" aria-label="무기">
          {WEAPON_KEYS.map((key, index) => <button type="button" key={key} className="wui-fps-slot"
            aria-pressed={status.weapon === key} aria-label={`${WALK_WEAPONS[key].ko}, 단축키 ${index + 1}`}
            onClick={() => onWeapon?.(key)}>
            <span>{WALK_WEAPONS[key].ko}</span><kbd>{index + 1}</kbd>
          </button>)}
        </div>
        <div className="wui-fps-abilities">
          <Ability kind="sprint" name="달리기" hotkey="SHIFT" fill={stamina} active={!!status.running} dim={stamina <= 0.05} />
          <Ability kind="torch" name="손전등" hotkey="E" fill={status.torch ? 1 : 0} active={!!status.torch} />
        </div>
      </div>

      <div className="wui-fps-ammo" data-empty={status.mag === 0 ? 'true' : 'false'} data-reloading={reloading ? 'true' : 'false'}>
        <span className="wui-fps-ammo-name">{spec.ko}{status.aiming && <em>ADS</em>}</span>
        {spec.mag
          ? <span className="wui-fps-ammo-count"><b>{status.mag ?? 0}</b><i>/{status.reserve ?? 0}</i></span>
          : <span className="wui-fps-ammo-count"><b>∞</b></span>}
        {reloading && <span className="wui-fps-reload"><i style={{ width: `${Math.round((status.reloadAt || 0) * 100)}%` }} />재장전</span>}
      </div>

      {/* Attach touch actions to the bar so their clearance follows HUD scale and content height. */}
      <div className="wui-fps-touch">
        <HoldPad label="정조준" hotkey="우클릭" icon={<Eye size={16} aria-hidden="true" />} onHold={onAim} />
        <HoldPad label="사격" hotkey="좌클릭" icon={<Crosshair size={16} aria-hidden="true" />} onHold={onFire} />
        <button type="button" className="wui-fps-pad" aria-label="재장전, 단축키 R" onClick={() => onReload?.()}>
          <RefreshCw size={16} aria-hidden="true" /><span>재장전</span>
        </button>
      </div>
    </div>
  </div>;
}
