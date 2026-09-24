import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MAT } from './materials.js';
import { displaySize, drawInstrument } from './instruments.js';

/** 계기 화면 한 장이다. 캔버스 한 장과 텍스처 한 장, 평면 하나와 베젤 하나만 쓴다.
 * 글자마다 Three 메시를 만들지 않는다. 그림은 instruments.js 가 그리고 여기서는 텍스처만 관리한다.
 *
 * statusRef 는 부모가 매 프레임 갱신하는 ref 다. 여기서는 일반 화면은 0.15초, 차량 전용 계기는 30Hz로 읽고,
 * 그리는 값이 지난번과 같으면 캔버스도 다시 그리지 않는다. 언마운트에서 텍스처와 캔버스를 놓는다.
 */

/** 화면은 자체 발광한다. 낮에는 주변광에 묻히지 않을 만큼, 밤에는 읽을 만큼만 올린다. */
const GLOW = Object.freeze({ day: 0.62, night: 1.15 });
/** 다시 그리는 주기다. status 보고 주기(0.15초) 와 맞춰 두면 놓치는 값이 없다. */
const REDRAW = 0.15;
const FAST_MODES = new Set(['coupeClassic', 'teslaDriver', 'ferrariTach']);

const PLANE = new THREE.PlaneGeometry(1, 1);
const BEZEL = new THREE.BoxGeometry(1, 1, 1);

export default function InstrumentDisplay({
  mode, statusRef, position = [0, 0, 0], rotation = [0, 0, 0],
  width = 0.34, height = 0.17, accent = '#83eda0', night = false, title = '',
}) {
  // 크기는 mode 가 정한다. 크기 객체는 모듈 상수라 mode 가 같으면 캔버스도 그대로다.
  const size = displaySize(mode);
  const screen = useMemo(() => {
    // 서버 렌더나 테스트에는 document 가 없다. 그때는 텍스처 없이 베젤만 남는다.
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { canvas, context, texture };
  }, [size]);

  useEffect(() => () => { screen?.texture.dispose(); }, [screen]);

  const last = useRef(0);
  const drawn = useRef('');
  /* eslint-disable react-hooks/immutability -- Three 텍스처는 명령형 객체다. 다시 그렸다고 알리는 길이 이 플래그뿐이다. */
  useFrame(({ clock }) => {
    if (!screen) return;
    if (clock.elapsedTime - last.current < (FAST_MODES.has(mode) ? 1 / 30 : REDRAW)) return;
    last.current = clock.elapsedTime;
    const status = statusRef?.current || {};
    // 그릴 값이 지난번과 같으면 캔버스와 텍스처 업로드를 건너뛴다. 정지한 탈것에서 흔하다.
    const signature = `${mode}|${title}|${accent}|${night}|${JSON.stringify(status)}`;
    if (signature === drawn.current) return;
    drawn.current = signature;
    drawInstrument(screen.context, mode, status, accent, title);
    screen.texture.needsUpdate = true;
  });
  /* eslint-enable react-hooks/immutability */

  return <group position={position} rotation={rotation}>
    <mesh geometry={BEZEL} material={MAT.trim} scale={[width + 0.02, height + 0.02, 0.012]} />
    {screen && <mesh geometry={PLANE} position={[0, 0, 0.008]} scale={[width, height, 1]} userData={{ dynamic: true }}>
      <meshStandardMaterial map={screen.texture} emissive="#ffffff" emissiveMap={screen.texture}
        emissiveIntensity={night ? GLOW.night : GLOW.day} roughness={0.4} toneMapped={false} />
    </mesh>}
  </group>;
}
