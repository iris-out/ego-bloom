import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BlastField } from './models/Blast';
import Tracers from './models/Tracers';
import { REMOTE_SHELL_MAX, createRemoteCombat, stepRemoteCombat } from './remoteCombat.js';

/** 상대가 쏜 포탄을 그리고, 내 차체에 닿은 만큼 피해를 쌓는다.
 * 탄도 계산은 remoteCombat.js 가 전부 맡고 이 컴포넌트는 프레임과 렌더만 잇는다.
 *
 * selfRef 는 내 탈것의 충돌 상자를 담은 ref 다. 주행 모드가 매 프레임 적는다.
 * incomingRef 는 한 방향 대기열이다. 여기서 더하고 주행 모드가 읽은 뒤 0 으로 비운다.
 * 폭발은 combat ref 를 BlastField 가 직접 읽으므로 이 컴포넌트는 React 상태를 갖지 않는다.
 */
export default function RemoteCombat({ peersRef, buildings = [], extent = 180, selfRef, incomingRef }) {
  const combat = useRef(createRemoteCombat());
  useFrame((_, delta) => {
    if (!peersRef) return;
    const next = stepRemoteCombat(combat.current, {
      dt: delta, peers: peersRef.current.map((peer) => ({ id: peer.id, ...peer.pose })),
      self: selfRef?.current || null, buildings, extent,
    });
    combat.current = next;
    if (next.damage > 0 && incomingRef?.current) {
      incomingRef.current.amount += next.damage;
      incomingRef.current.weapon = next.weapon;
      incomingRef.current.hits = [...(incomingRef.current.hits || []), ...next.hits];
    }
  });
  if (!peersRef) return null;
  return <>
    <Tracers shellsRef={combat} max={REMOTE_SHELL_MAX} />
    <BlastField arsenalRef={combat} kind="cannon" />
  </>;
}
