import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HUD, drawFlightHud } from './instruments.js';

/** 전투기 HUD 다. 기체 로컬 좌표의 combiner 자리에 투명한 평면 한 장을 두고
 * 캔버스 텍스처를 갱신한다. 기체와 같은 공간에 있으므로 고개를 돌리면 시야 밖으로 나간다.
 *
 * 자세는 매 프레임 바뀌므로 poseRef 에서 직접 읽는다. HUD 하나 때문에 월드를 다시 렌더하지 않는다.
 * 잔탄과 탄착 거리는 statusRef 로 받아 같은 그림에 함께 그린다.
 * 30Hz 로만 다시 그리고, 그 주기에도 그릴 값이 지난번과 같으면 건너뛴다.
 */

/** 다시 그리는 주기다. 초당 30장이면 자세 변화가 끊겨 보이지 않는다. */
const REDRAW = 1 / 30;

const PLANE = new THREE.PlaneGeometry(1, 1);

/** 기본 크기는 combiner 유리(aircraftDetail 의 HUD_COMBINER.fighter.glass) 와 같다.
 * 사다리 평면이 유리보다 크면 상이 유리 밖 허공에 뜬다. 호출자는 유리 크기를 그대로 넘긴다.
 * 기본 위치도 유리 바로 앞이다. combiner group 안에 두므로 유리 면에서 6mm 띄운다. */
export default function FighterHud({ poseRef, statusRef, position = [0, 0, 0.006], width = 0.30, height = 0.24, visible = true, weapons = 'stores' }) {
  const last = useRef(0);
  const drawn = useRef('');

  const screen = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = HUD.size;
    canvas.height = HUD.size;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { canvas, context, texture };
  }, []);

  useEffect(() => () => { screen?.texture.dispose(); }, [screen]);

  /* eslint-disable react-hooks/immutability -- Three 텍스처는 명령형 객체다. 다시 그렸다고 알리는 길이 이 플래그뿐이다. */
  useFrame(({ clock }) => {
    if (!screen || !visible) return;
    if (clock.elapsedTime - last.current < REDRAW) return;
    last.current = clock.elapsedTime;
    const pose = poseRef?.current || {};
    const status = statusRef?.current || {};
    // 비행 중에는 자세가 늘 바뀌어 거의 매번 다시 그리지만, 활주로에 서 있을 때는
    // 값이 그대로라 캔버스와 텍스처 업로드를 건너뛴다.
    const signature = `${weapons}|${pose.pitch}|${pose.roll}|${pose.speed}|${pose.y}|${pose.heading}|${pose.climb}|${pose.throttle}|`
      + `${status.cannonAmmo}|${status.missileAmmo}|${status.range}|${status.hull}`;
    if (signature === drawn.current) return;
    drawn.current = signature;
    drawFlightHud(screen.context, pose, status, weapons);
    screen.texture.needsUpdate = true;
  });
  /* eslint-enable react-hooks/immutability */

  if (!screen) return null;
  return <mesh geometry={PLANE} position={position} scale={[width, height, 1]} visible={visible}>
    {/* combiner 유리에 비친 상이라 뒤가 비쳐야 한다. 깊이를 쓰지 않고 더해 그린다. */}
    <meshBasicMaterial map={screen.texture} transparent depthWrite={false}
      blending={THREE.AdditiveBlending} toneMapped={false} />
  </mesh>;
}
