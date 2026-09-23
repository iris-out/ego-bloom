import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import PlaneModel from './models/PlaneModel';
import VehicleModel from './models/VehicleModel';
import { isArmed } from './health.js';
import { airHealthBarScale, showAirHealthBar } from './airTraffic.js';

/** 같은 도시에 있는 다른 세션의 탈것이다. 항공기, 차량, 도보를 한 곳에서 그린다.
 * 모델 원본은 PlaneModel 과 VehicleModel 이고 여기서 복제하지 않는다.
 *
 * 존재 여부, 기종, 단계만 이 주기로 반영한다. 위치와 자세 보간은 useFrame 이 매 프레임 처리한다. */
const SLOT_REFRESH_INTERVAL = 0.2;

function findPeer(peersRef, id) {
  return peersRef.current.find(peer => peer.id === id) || null;
}

function toSlots(peers) {
  return peers.map(peer => ({ id: peer.id, kind: peer.pose.kind, key: peer.pose.key, phase: peer.pose.phase, name: peer.name }));
}

function samePeerList(a, b) {
  if (a.length !== b.length) return false;
  return a.every((slot, index) => {
    const other = b[index];
    return slot.id === other.id && slot.kind === other.kind && slot.key === other.key
      && slot.phase === other.phase && slot.name === other.name;
  });
}

/** 상대 탈것의 시각 원본이다. 도보는 전용 모델이 없어 표식만 남긴다. */
function Body({ kind, rideKey, phase, turret, barrel }) {
  if (kind === 'car') return <VehicleModel vehicle={rideKey} turretYaw={turret.current} barrelPitch={barrel.current} />;
  if (kind === 'walk') return null;
  return <PlaneModel plane={rideKey} throttle={phase === 'airborne' ? 0.7 : 0} phase={phase} />;
}

/** kind/key/phase/name 은 slot 스냅샷 props 로 받는다(0.2초 주기 갱신).
 * 위치, 자세, 포탑 각도, 체력만 peersRef 에서 매 프레임 읽는다. */
function RemoteActor({ id, kind, rideKey, phase, name, peersRef }) {
  const group = useRef();
  const hull = useRef(null);
  const initialized = useRef(false);
  // 포탑 각도는 모델이 props 로 받으므로 매 프레임 state 로 올리지 않고 ref 를 공유한다.
  const turret = useRef(0), barrel = useRef(0);
  const armed = isArmed(kind, rideKey);
  useFrame(({ camera }, delta) => {
    const peer = findPeer(peersRef, id);
    if (!peer || !group.current) return;
    const object = group.current, pose = peer.pose;
    const snap = !initialized.current || Math.hypot(object.position.x - pose.x, object.position.y - pose.y, object.position.z - pose.z) > 160;
    const alpha = snap ? 1 : 1 - Math.exp(-Math.min(delta, .1) * 12);
    object.position.x += (pose.x - object.position.x) * alpha;
    object.position.y += (pose.y - object.position.y) * alpha;
    object.position.z += (pose.z - object.position.z) * alpha;
    for (const [axis, key] of [['x', 'pitch'], ['y', 'heading'], ['z', 'roll']]) {
      const diff = pose[key] - object.rotation[axis];
      object.rotation[axis] += Math.atan2(Math.sin(diff), Math.cos(diff)) * alpha;
    }
    turret.current = pose.turret; barrel.current = pose.barrel;
    // 체력 게이지는 DOM 을 직접 고친다. state 로 올리면 피격마다 상대 모델이 다시 렌더된다.
    if (hull.current) {
      const left = Math.max(0, Math.min(1, pose.hull));
      hull.current.style.width = `${Math.round(left * 100)}%`;
      hull.current.dataset.level = left <= 0.3 ? 'critical' : left <= 0.6 ? 'warn' : 'ok';
      if (kind === 'flight') {
        const bar = hull.current.parentElement;
        const range = camera.position.distanceTo(object.position);
        bar.style.display = showAirHealthBar(1 - left, false, range) ? 'block' : 'none';
        bar.style.transform = `scale(${airHealthBarScale(range)})`;
      }
    }
    initialized.current = true;
  });
  const label = kind === 'flight' ? 6 : 2.4;
  return <group ref={group} rotation-order="YXZ">
    <Body kind={kind} rideKey={rideKey} phase={phase} turret={turret} barrel={barrel} />
    <Html position={[0, label, 0]} center zIndexRange={[14, 1]} distanceFactor={kind === 'flight' ? undefined : 14} style={{ pointerEvents: 'none' }}>
      <span className="world-pilot-label" data-peer-id={id}>{name}</span>
      {armed && <span className={`world-peer-hull${kind === 'flight' ? ' world-peer-hull--air' : ''}`} aria-hidden="true"><i ref={hull} /></span>}
    </Html>
  </group>;
}

export default function RemoteActors({ peersRef }) {
  const [slots, setSlots] = useState([]);
  // 렌더 중 ref 를 읽지 않도록, 첫 프레임에 곧바로 갱신되게 큰 값으로 시작한다.
  const elapsed = useRef(SLOT_REFRESH_INTERVAL);
  useFrame((_, delta) => {
    if (!peersRef) return;
    elapsed.current += delta;
    if (elapsed.current < SLOT_REFRESH_INTERVAL) return;
    elapsed.current = 0;
    const next = toSlots(peersRef.current);
    setSlots(previous => samePeerList(previous, next) ? previous : next);
  });
  if (!peersRef) return null;
  return slots.map(slot => <RemoteActor key={slot.id} id={slot.id} kind={slot.kind} rideKey={slot.key}
    phase={slot.phase} name={slot.name} peersRef={peersRef} />);
}
