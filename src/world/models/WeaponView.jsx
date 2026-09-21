import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Block from './ModelBlock';
import StaticBatch from '../StaticBatch';
import { ADS_SCALE, ANCHOR, HIP_REST, HIP_SCALE, adsRest } from '../weaponSights.js';
import { actionPose, reloadPose } from '../weaponMotion.js';

/** 1인칭 도보 모드 무기 뷰모델이다. 카메라의 자식으로 붙어 카메라 로컬 좌표계를 그대로 쓴다.
 * 원점이 눈, -Z 가 화면 앞, +X 가 오른쪽이다. 화면 오른쪽 아래에 작게 든다.
 * 도보는 near 가 0.05 라 총이 잘리지 않는다. 깊이는 화면에서 보이는 크기로만 정한다.
 * 뷰모델은 그림자를 만들지 않는다.
 *
 * 움직이지 않는 조각은 StaticBatch 로 묶어 draw call 을 줄인다. 슬라이드, 볼트, 펌프,
 * 탄창, 총구 화염, 움직이는 손처럼 매 프레임 ref 로 바뀌는 가지만 dynamic 으로 남긴다.
 * recoil/walk/aim/reload 는 더 이상 props 로 받지 않는다. WalkMode 가 매 프레임 채우는
 * live ref 를 여기서 직접 읽어, 총을 바꾸지 않는 한 이 컴포넌트가 다시 렌더되지 않는다.
 */
const HALF_PI = Math.PI / 2;

/** 눈에서 너무 멀면 1인칭인데도 총이 장난감처럼 작아 보인다. 화면 오른쪽 아래
 * 구석에 조금 더 가까이 든 자세로 옮겨 무게감을 준다. 정조준 자세와 화면 중앙 조준선이
 * 어긋나지 않도록, 겨눌 때는 weaponSights.adsRest 가 가늠쇠를 화면 정중앙에 맞춘 자세를 준다. */
const GUN_Z = {
  pistol: ANCHOR.pistol[2],
  smg: ANCHOR.smg[2],
  sniper: ANCHOR.sniper[2],
  shotgun: ANCHOR.shotgun[2],
};

const RECOIL_MAX_Z = 0.07;
const RECOIL_TILT = 0.09;
const FIST_PUNCH_Z = 0.14;
const RECOIL_LERP = 10;
const WALK_SWAY_X = 0.018;
const WALK_SWAY_Y = 0.01;
const WALK_FREQ = 8.5;
const MAX_STEP = 0.05;
const ADS_LERP = 12;
const FLASH_SECONDS = 0.055;
const SHOT_RECOIL_DELTA = 0.055;
/** 재장전 모션이다. reload 는 0(시작)~1(끝) 진행도를 받아 사인 곡선으로 숙였다 든다.
 * 절반 지점에서 가장 깊이 숙이므로 진행도가 아니라 숙인 정도를 직접 만든다. */
const RELOAD_LERP = 7;
const RELOAD_DIP = 0.05;
const RELOAD_TILT = 0.36;
const RELOAD_ROLL = 0.16;

const SKIN = '#c9a48a';
const GLOVE = '#3a3f42';
const METAL_DARK = '#2a3134';
const METAL = '#394649';
const WOOD = '#6b4f3a';
const LENS = '#385c6d';
// 도트 사이트의 붉은 점이다. 화면 조준점(--down) 과 같은 뜻을 갖는 색이다.
const DOT = '#e0503c';
// 산탄총 관형 탄창에 넣는 셸의 색이다.
const SHELL = '#b3402a';

/** 총열 아래 손전등이다. 무기마다 총열 길이가 달라 z 만 따로 둔다. */
const TORCH_Z = { pistol: -0.3, smg: -0.42, sniper: -0.5, shotgun: -0.46 };
const TORCH_LENS = '#ffe9b0';

const SIDES = [-1, 1];
const FINGER_X = [-0.045, -0.015, 0.015, 0.045];

const RIGHT_HAND_POS = [0.02, 0.05, -0.05];
const LEFT_HAND_POS = [-0.26, -0.14, -0.12];

/* Sedan, Motorcycle 와 같은 규약이다. castShadow, receiveShadow 를 끈 Block 이다. */
function Part(props) {
  return <Block castShadow={false} receiveShadow={false} {...props} />;
}

/** 총 아래에 물린 손전등이다. on 이 참이면 렌즈가 빛난다.
 * 실제로 도시를 비추는 빛은 WalkMode 의 spotLight 다. 여기서는 등 몸체만 그린다.
 */
function Torch({ weapon, on }) {
  const z = TORCH_Z[weapon];
  if (z == null) return null;
  return <group position={[0.06, -0.06, z]}>
    <mesh rotation={[HALF_PI, 0, 0]}>
      <cylinderGeometry args={[0.026, 0.026, 0.12, 10]} />
      <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.4} />
    </mesh>
    <mesh position={[0, 0, -0.065]}>
      <circleGeometry args={[0.024, 12]} />
      <meshStandardMaterial color={on ? TORCH_LENS : LENS} emissive={TORCH_LENS}
        emissiveIntensity={on ? 1.6 : 0} roughness={0.2} />
    </mesh>
  </group>;
}

/** 쥔 손이다. detailed 가 참이면 손가락 마디와 너클을 더 세밀하게 그린다.
 * 손목 밴드가 원점에서 가장 카메라 쪽(z=0)에 있고, 손가락은 전부 -Z 로 뻗는다.
 * 토러스는 기본값 그대로 Z 축을 둘러싸야 손목을 감는 커프스로 보인다. 회전을 주면
 * 팔찌가 옆으로 누워 허공에 뜬 고리처럼 보인다.
 */
function Hand({ side = 1, scale = 1, detailed = false }) {
  return <group scale={scale}>
    <mesh>
      <torusGeometry args={[0.05, 0.013, 6, 12]} />
      <meshStandardMaterial color={METAL_DARK} roughness={0.6} />
    </mesh>
    <Part position={[0, 0, -0.07]} scale={[0.1, 0.07, 0.09]} color={GLOVE} />
    {detailed && FINGER_X.map((x) => <mesh key={`knuckle-${x}`} position={[x * side, 0.035, -0.09]}>
      <sphereGeometry args={[0.014, 8, 6]} />
      <meshStandardMaterial color={GLOVE} roughness={0.5} />
    </mesh>)}
    {FINGER_X.map((x) => <group key={x} position={[x * side, -0.04, -0.13]}>
      <Part position={[0, 0, 0]} scale={[0.022, 0.028, 0.045]} color={GLOVE} />
      {detailed && <Part position={[0, -0.008, -0.04]} scale={[0.019, 0.022, 0.036]} color={GLOVE} />}
    </group>)}
    <group position={[0.06 * side, -0.015, -0.08]} rotation={[0, 0, side * 0.5]}>
      <Part position={[0, 0, 0]} scale={[0.024, 0.045, 0.028]} color={GLOVE} />
      <Part position={[0, -0.028, -0.022]} scale={[0.02, 0.03, 0.026]} color={SKIN} />
    </group>
  </group>;
}

/** 손목에서 화면 가장자리까지 이어지는 팔이다. 손만 총에 얹으면 공중에 뜬 물체처럼
 * 보이므로 장갑 커프와 전완을 한 덩어리로 둔다. */
function GrippingHand({ side = 1, position, rotation = [0, 0, 0], scale = 0.8 }) {
  return <group position={position} rotation={rotation}>
    <Part position={[side * 0.025, -0.18, 0.19]} scale={[0.11, 0.28, 0.13]} rotation={[0.28, 0, side * 0.08]} color={SKIN} />
    <Part position={[side * 0.018, -0.07, 0.07]} scale={[0.12, 0.10, 0.13]} rotation={[0.18, 0, side * 0.08]} color={GLOVE} />
    <Hand side={side} scale={scale} detailed />
  </group>;
}

/** 총구 조명은 섬광과 같이 켜고 끈다. 켜는 순간 광원 개수가 바뀌어 도시 재질이 다시
 * 컴파일되는 것은 ShaderPrewarm 이 미리 만들어 막는다. 늘 켜 두면 도보가 13% 느려진다. */
const FLASH_LIGHT = { color: '#ffb34d', intensity: 0.8, distance: 0.7, decay: 2 };

/** 총구에서 실제 발사 순간에만 보이는 작은 발광 콘이다. WalkMode 의 live recoil
 * 값이 바로 줄어들어 연사 중에도 프레임 하나를 오래 가리지 않는다. */
function MuzzleFlash({ flashRef, position }) {
  return <group ref={flashRef} position={position} visible={false} userData={{ dynamic: true }}>
    <mesh rotation={[HALF_PI, 0, 0]} position={[0, 0, -0.045]}>
      <coneGeometry args={[0.045, 0.15, 5]} />
      <meshBasicMaterial color="#ffd270" toneMapped={false} />
    </mesh>
    <pointLight {...FLASH_LIGHT} />
  </group>;
}


/** 오른손 회전의 쉬는 자세다. 찌를 때는 여기서 PUNCH_ROT 만큼 더 돈다. */
const FIST_REST_ROT = [0.1, -0.15, 0.05];
/** 찌르는 순간 더해지는 회전이다. 손목이 안으로 감기며 주먹이 정면을 보게 튼다. */
const FIST_PUNCH_ROT = [-0.22, -0.3, 0.1];

/** 장갑 낀 주먹 두 개다. 오른손이 크게 앞에, 왼손이 왼쪽 아래에 살짝 보인다.
 * punchRef 로 감싼 오른손만 recoil 에 맞춰 앞으로 뻗으며 손목을 튼다. 정지 회전은
 * 부모가 매 프레임 덮어쓰므로 여기서는 그리지 않는다.
 */
function Fist({ punchRef }) {
  return <StaticBatch>
    <group ref={punchRef} position={RIGHT_HAND_POS} userData={{ dynamic: true }}>
      <StaticBatch><Hand side={1} scale={1.18} detailed /></StaticBatch>
    </group>
    <group position={LEFT_HAND_POS} rotation={[0.05, 0.2, -0.1]}>
      <Hand side={-1} scale={0.9} detailed />
    </group>
  </StaticBatch>;
}

/** 권총이다. 슬라이드, 총열, 가늠쇠, 가늠자, 그립, 방아쇠, 탄창, 세레이션, 쥔 손 두 개를 둔다.
 * 슬라이드(actionRef) 와 탄창(magazineRef) 만 매 프레임 움직이므로 그 둘만 dynamic 으로 남기고
 * 나머지는 StaticBatch 로 묶는다. 슬라이드 안쪽도 그 자체로는 서로 움직이지 않으므로 한 번 더 묶는다. */
function Pistol({ actionRef, magazineRef, flashRef }) {
  return <group>
    <StaticBatch>
      <Part position={[0, -0.1, 0.16]} scale={[0.075, 0.24, 0.11]} rotation={[0.22, 0, 0]} color={GLOVE} />
      {SIDES.map((side) => <Part key={side} position={[side * 0.04, -0.08, 0.16]} scale={[0.006, 0.16, 0.09]} rotation={[0.22, 0, 0]} color={METAL_DARK} />)}
      <Part position={[0, -0.02, 0.09]} scale={[0.012, 0.05, 0.012]} color={METAL_DARK} />
      <mesh position={[0, -0.06, 0.07]} rotation={[0, HALF_PI, 0]}>
        <torusGeometry args={[0.032, 0.007, 6, 12]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.4} />
      </mesh>
      <Part position={[0, -0.005, -0.05]} scale={[0.02, 0.02, 0.05]} color={METAL_DARK} />
      {/* 슬라이드 세레이션. 뒤쪽에 세로 홈을 등간격으로 낸다. */}
      {[0.02, 0.05, 0.08, 0.11].map((z) => <Part key={z} position={[0, 0.03, z]} scale={[0.052, 0.05, 0.008]} color={METAL_DARK} />)}
      {/* 탄창 멈치 */}
      <Part position={[0.04, -0.04, 0.13]} scale={[0.012, 0.022, 0.022]} color={METAL} />
      {/* 총열 아래 레일 */}
      <Part position={[0, -0.03, -0.12]} scale={[0.036, 0.014, 0.12]} color={METAL_DARK} />
      <GrippingHand side={1} position={[0.02, -0.09, 0.18]} rotation={[0.22, -0.08, 0.02]} scale={0.82} />
      <GrippingHand side={-1} position={[-0.045, -0.02, -0.015]} rotation={[0.14, 0.08, -0.06]} scale={0.72} />
    </StaticBatch>
    <group ref={actionRef} userData={{ dynamic: true }}>
      <StaticBatch>
        <Part position={[0, 0.05, -0.08]} scale={[0.09, 0.075, 0.36]} color={METAL} />
        <mesh position={[0, 0.05, -0.28]} rotation={[HALF_PI, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.1, 10]} />
          <meshStandardMaterial color={METAL_DARK} metalness={0.6} roughness={0.3} />
        </mesh>
        <Part position={[0, 0.095, 0.06]} scale={[0.05, 0.018, 0.02]} color={METAL_DARK} />
        {SIDES.map((side) => <Part key={side} position={[side * 0.014, 0.1, 0.06]} scale={[0.014, 0.018, 0.02]} color={METAL_DARK} />)}
        {[0.02, -0.01, -0.04].map((z) => <Part key={z} position={[0, 0.09, z]} scale={[0.09, 0.006, 0.01]} color={METAL_DARK} />)}
        {/* The low front post is SIGHT_POINT.pistol; do not add a second, higher post. */}
        <Part position={[0, 0.055, -0.2]} scale={[0.012, 0.022, 0.014]} color={METAL_DARK} />
        {[-0.016, 0.016].map((x) => <Part key={x} position={[x, 0.055, 0.13]} scale={[0.01, 0.02, 0.012]} color={METAL_DARK} />)}
      </StaticBatch>
    </group>
    <group ref={magazineRef} userData={{ dynamic: true }}>
      <Part position={[0, -0.24, 0.17]} scale={[0.07, 0.03, 0.1]} color={METAL_DARK} />
      <Part position={[0, -0.26, 0.17]} scale={[0.075, 0.02, 0.105]} color={METAL} />
    </group>
    <MuzzleFlash flashRef={flashRef} position={[0, 0.05, -0.35]} />
  </group>;
}

/** 기관단총이다. 상부 리시버, 소염기, 접이식 개머리판, 수직 손잡이, 곡선 탄창, 조준기, 장전 손잡이를 둔다.
 * 상부 리시버(actionRef) 와 탄창(magazineRef) 만 매 프레임 움직이므로 그 둘만 dynamic 으로 두고
 * 나머지 전부를 StaticBatch 하나로 묶는다. */
function Smg({ actionRef, magazineRef, flashRef }) {
  return <StaticBatch>
    <group ref={actionRef} userData={{ dynamic: true }}><Part position={[0, 0.06, -0.14]} scale={[0.1, 0.09, 0.5]} color={METAL} /></group>
    <Part position={[0, -0.02, 0.12]} scale={[0.09, 0.14, 0.24]} color={GLOVE} />
    {/* 탄창 결합부와 급탄구 */}
    <Part position={[0, -0.09, 0.06]} scale={[0.062, 0.02, 0.075]} color={METAL_DARK} />
    <group ref={magazineRef} userData={{ dynamic: true }}>
      <Part position={[0, -0.2, 0.06]} scale={[0.055, 0.18, 0.07]} rotation={[0.16, 0, 0]} color={METAL_DARK} />
      <Part position={[0, -0.3, 0.08]} scale={[0.06, 0.02, 0.075]} color={METAL} />
    </group>
    <mesh position={[0, 0.06, -0.44]} rotation={[HALF_PI, 0, 0]}>
      <cylinderGeometry args={[0.02, 0.02, 0.16, 10]} />
      <meshStandardMaterial color={METAL_DARK} metalness={0.6} roughness={0.3} />
    </mesh>
    <mesh position={[0, 0.06, -0.53]} rotation={[HALF_PI, 0, 0]}>
      <cylinderGeometry args={[0.028, 0.028, 0.07, 10]} />
      <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.4} />
    </mesh>
    {[0.5, 1.5].map((r) => <mesh key={r} rotation={[0, r * HALF_PI, 0]} position={[0, 0.06, -0.53]}>
      <boxGeometry args={[0.012, 0.06, 0.06]} />
      <meshStandardMaterial color={METAL_DARK} roughness={0.5} />
    </mesh>)}
    {/* 상부 피카티니 레일. 가로 홈을 등간격으로 낸다. */}
    <Part position={[0, 0.108, -0.16]} scale={[0.05, 0.012, 0.4]} color={METAL_DARK} />
    {[-0.32, -0.26, -0.2, -0.14, -0.08, -0.02].map((z) => <Part key={z} position={[0, 0.118, z]} scale={[0.052, 0.012, 0.016]} color={METAL} />)}
    {/* 도트 사이트. 몸체, 렌즈, 조도 조절 손잡이다. 렌즈 한가운데가 weaponSights.SIGHT_POINT.smg 다. */}
    <Part position={[0, 0.13, -0.06]} scale={[0.035, 0.05, 0.14]} color={METAL_DARK} />
    <mesh position={[0, 0.155, -0.06]}>
      <boxGeometry args={[0.05, 0.02, 0.12]} />
      <meshStandardMaterial color={LENS} transparent opacity={0.55} roughness={0.2} />
    </mesh>
    <mesh position={[0, 0.155, -0.115]} rotation={[HALF_PI, 0, 0]}>
      <cylinderGeometry args={[0.017, 0.017, 0.012, 10]} />
      <meshStandardMaterial color={DOT} emissive={DOT} emissiveIntensity={0.9} roughness={0.3} />
    </mesh>
    <mesh position={[0.03, 0.135, 0.0]} rotation={[0, 0, HALF_PI]}>
      <cylinderGeometry args={[0.016, 0.016, 0.022, 8]} />
      <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.45} />
    </mesh>
    {/* 탄피 배출구와 덮개 */}
    <Part position={[0.052, 0.075, -0.02]} scale={[0.008, 0.045, 0.1]} color={METAL_DARK} />
    {/* 조정간과 탄창 멈치 */}
    <Part position={[-0.052, 0.02, 0.08]} scale={[0.012, 0.03, 0.05]} color={METAL_DARK} />
    <Part position={[0.052, 0.02, 0.06]} scale={[0.012, 0.024, 0.024]} color={METAL} />
    {/* 멜빵 고리 두 개 */}
    {[-0.34, 0.3].map((z) => <mesh key={z} position={[-0.05, 0.02, z]} rotation={[0, HALF_PI, 0]}>
      <torusGeometry args={[0.016, 0.005, 5, 10]} />
      <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} />
    </mesh>)}
    {/* 총열 덮개 방열 구멍 */}
    {[-0.24, -0.3, -0.36].map((z) => [-1, 1].map((side) => <mesh key={`${z}-${side}`} position={[side * 0.052, 0.06, z]} rotation={[0, 0, HALF_PI]}>
      <cylinderGeometry args={[0.012, 0.012, 0.008, 8]} />
      <meshStandardMaterial color={METAL_DARK} roughness={0.7} />
    </mesh>))}
    <Part position={[0, 0.155, -0.24]} scale={[0.012, 0.03, 0.012]} color={METAL_DARK} />
    <Part position={[0, 0.155, 0.1]} scale={[0.012, 0.03, 0.012]} color={METAL_DARK} />
    <Part position={[0, -0.02, -0.05]} scale={[0.045, 0.16, 0.05]} rotation={[0.15, 0, 0]} color={GLOVE} />
    <Part position={[-0.005, -0.02, 0.36]} scale={[0.05, 0.05, 0.03]} color={METAL_DARK} />
    <Part position={[-0.005, 0.0, 0.44]} scale={[0.03, 0.03, 0.22]} rotation={[0, 0, 0.08]} color={METAL_DARK} />
    <Part position={[-0.005, 0.02, 0.58]} scale={[0.06, 0.05, 0.03]} color={GLOVE} />
    <mesh position={[0.05, 0.06, -0.03]} rotation={[HALF_PI, 0, 0]}>
      <cylinderGeometry args={[0.014, 0.014, 0.05, 8]} />
      <meshStandardMaterial color={METAL_DARK} metalness={0.4} roughness={0.5} />
    </mesh>
    <group position={[0, -0.14, 0.06]} rotation={[0.3, 0, 0]}>
      <Part position={[0, 0, 0]} scale={[0.05, 0.16, 0.05]} color={METAL_DARK} />
      <Part position={[0, -0.1, 0.01]} scale={[0.045, 0.1, 0.045]} rotation={[0.4, 0, 0]} color={METAL_DARK} />
    </group>
    <Part position={[0, -0.24, 0.1]} scale={[0.09, 0.03, 0.13]} color={METAL_DARK} />
    <Part position={[0, -0.005, 0.02]} scale={[0.018, 0.018, 0.05]} color={METAL_DARK} />
    <GrippingHand side={1} position={[0, -0.03, 0.08]} rotation={[0.15, -0.05, 0.03]} scale={0.82} />
    <GrippingHand side={-1} position={[0, -0.06, -0.22]} rotation={[0.16, 0.06, -0.03]} scale={0.76} />
    <MuzzleFlash flashRef={flashRef} position={[0, 0.06, -0.585]} />
  </StaticBatch>;
}

/** 볼트액션 저격총이다. 긴 총열, 큰 조준경(렌즈 두 장, 마운트 링 두 개), 볼트 손잡이,
 * 목재 개머리판, 양각대, 탄창, 쥔 손 두 개를 둔다.
 * 볼트(actionRef) 와 탄창(magazineRef) 만 매 프레임 움직이므로 그 둘만 dynamic 으로 두고
 * 나머지 전부를 StaticBatch 하나로 묶는다. */
function Sniper({ actionRef, magazineRef, flashRef }) {
  return <StaticBatch>
    <Part position={[0, 0.03, -0.02]} scale={[0.08, 0.09, 0.3]} color={METAL} />
    <mesh position={[0, 0.03, -0.42]} rotation={[HALF_PI, 0, 0]}>
      <cylinderGeometry args={[0.022, 0.026, 0.62, 12]} />
      <meshStandardMaterial color={METAL_DARK} metalness={0.6} roughness={0.25} />
    </mesh>
    <mesh position={[0, 0.03, -0.72]} rotation={[HALF_PI, 0, 0]}>
      <cylinderGeometry args={[0.03, 0.03, 0.03, 10]} />
      <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.4} />
    </mesh>
    <mesh position={[0, 0.14, -0.1]} rotation={[HALF_PI, 0, 0]}>
      <cylinderGeometry args={[0.032, 0.032, 0.36, 14]} />
      <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.3} />
    </mesh>
    <mesh position={[0, 0.14, -0.28]}>
      <circleGeometry args={[0.028, 14]} />
      <meshStandardMaterial color={LENS} emissive={LENS} emissiveIntensity={0.3} roughness={0.15} />
    </mesh>
    <mesh position={[0, 0.14, 0.08]}>
      <circleGeometry args={[0.02, 14]} />
      <meshStandardMaterial color={LENS} roughness={0.15} />
    </mesh>
    <mesh position={[0, 0.14, -0.2]} rotation={[HALF_PI, 0, 0]}>
      <torusGeometry args={[0.036, 0.012, 6, 14]} />
      <meshStandardMaterial color={METAL_DARK} metalness={0.4} roughness={0.4} />
    </mesh>
    <mesh position={[0, 0.14, 0.0]} rotation={[HALF_PI, 0, 0]}>
      <torusGeometry args={[0.036, 0.012, 6, 14]} />
      <meshStandardMaterial color={METAL_DARK} metalness={0.4} roughness={0.4} />
    </mesh>
    <group ref={actionRef} userData={{ dynamic: true }}>
      <mesh position={[0.05, 0.03, 0.02]}>
        <cylinderGeometry args={[0.016, 0.016, 0.09, 8]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0.11, 0.03, 0.02]}>
        <sphereGeometry args={[0.024, 10, 8]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
    <Part position={[0, -0.02, 0.15]} scale={[0.08, 0.1, 0.34]} color={WOOD} />
    <Part position={[0, 0.03, 0.32]} scale={[0.075, 0.03, 0.16]} color={WOOD} />
    <Part position={[0, -0.09, 0.42]} scale={[0.075, 0.09, 0.06]} color={WOOD} />
    <Part position={[0, -0.09, 0.05]} scale={[0.05, 0.17, 0.06]} rotation={[0.2, 0, 0]} color={WOOD} />
    <Part position={[0, -0.02, 0.02]} scale={[0.014, 0.05, 0.014]} color={METAL_DARK} />
    <mesh position={[0, -0.05, -0.01]} rotation={[0, HALF_PI, 0]}>
      <torusGeometry args={[0.03, 0.007, 6, 12]} />
      <meshStandardMaterial color={METAL_DARK} metalness={0.4} roughness={0.4} />
    </mesh>
    {SIDES.map((side) => <group key={side} position={[side * 0.03, -0.24, -0.28]} rotation={[0, 0, side * 0.35]}>
      <Part position={[0, 0, 0]} scale={[0.014, 0.16, 0.014]} color={METAL} />
      <Part position={[0, -0.09, 0]} scale={[0.018, 0.02, 0.018]} color={GLOVE} />
    </group>)}
    <Part position={[0, -0.16, -0.28]} scale={[0.04, 0.04, 0.04]} color={METAL_DARK} />
    <group ref={magazineRef} userData={{ dynamic: true }}><Part position={[0, -0.11, -0.05]} scale={[0.05, 0.14, 0.09]} color={METAL_DARK} /></group>
    {/* 조준경 영점 다이얼 두 개 */}
    <mesh position={[0, 0.185, -0.1]}><cylinderGeometry args={[0.022, 0.022, 0.03, 10]} /><meshStandardMaterial color={METAL} metalness={0.5} roughness={0.45} /></mesh>
    <mesh position={[0.045, 0.14, -0.1]} rotation={[0, 0, HALF_PI]}><cylinderGeometry args={[0.022, 0.022, 0.03, 10]} /><meshStandardMaterial color={METAL} metalness={0.5} roughness={0.45} /></mesh>
    {/* 노리쇠 홈과 탄피 배출구 */}
    <Part position={[0.042, 0.055, 0.02]} scale={[0.008, 0.04, 0.13]} color={METAL_DARK} />
    {/* 개머리판 치크피스 */}
    <Part position={[0, 0.06, 0.26]} scale={[0.07, 0.05, 0.2]} rotation={[0.06, 0, 0]} color={WOOD} />
    {/* 멜빵 고리 */}
    {[-0.36, 0.36].map((z) => <mesh key={z} position={[0, -0.12, z]} rotation={[0, HALF_PI, 0]}>
      <torusGeometry args={[0.016, 0.005, 5, 10]} />
      <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} />
    </mesh>)}
    <GrippingHand side={1} position={[0, -0.03, 0.10]} rotation={[0.18, -0.08, 0.02]} scale={0.84} />
    <GrippingHand side={-1} position={[0, -0.04, -0.25]} rotation={[0.14, 0.05, -0.02]} scale={0.78} />
    <MuzzleFlash flashRef={flashRef} position={[0, 0.03, -0.755]} />
  </StaticBatch>;
}

/** 펌프액션 산탄총이다. 리시버, 총열, 관형 탄창, 비드 사이트, 개머리판, 배출구, 쥔 손 둘을 둔다.
 * 슬라이드나 볼트가 없어 actionRef 대신 포어엔드(pumpRef) 가 발사마다 뒤로 갔다 앞으로 온다.
 * 지지 손은 포어엔드를 쥔 채 pumpRef 하나로 같이 움직인다. 관형 탄창에 넣는 셸 하나(magazineRef)
 * 는 재장전마다 한 발씩 들어가는 것처럼 오르내린다. */
function Shotgun({ pumpRef, magazineRef, flashRef }) {
  return <group>
    <StaticBatch>
      <Part position={[0, 0.05, -0.05]} scale={[0.09, 0.09, 0.34]} color={METAL} />
      <mesh position={[0, 0.06, -0.46]} rotation={[HALF_PI, 0, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.55, 10]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.35} />
      </mesh>
      {/* 관형 탄창 튜브. pump 포어엔드가 이 위를 감싸며 왕복한다. */}
      <mesh position={[0, -0.01, -0.38]} rotation={[HALF_PI, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.48, 8]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.4} roughness={0.4} />
      </mesh>
      {/* 비드 사이트. weaponSights.SIGHT_POINT.shotgun 과 같은 자리다. */}
      <mesh position={[0, 0.1, -0.74]}>
        <sphereGeometry args={[0.012, 8, 6]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* 탄피 배출구 */}
      <Part position={[0.05, 0.06, -0.06]} scale={[0.02, 0.04, 0.1]} color={METAL_DARK} />
      {/* 개머리판 */}
      <Part position={[0, 0.02, 0.28]} scale={[0.07, 0.09, 0.32]} rotation={[0.08, 0, 0]} color={WOOD} />
      <Part position={[0, -0.07, 0.34]} scale={[0.07, 0.07, 0.06]} color={WOOD} />
      <mesh position={[0, -0.05, 0.02]} rotation={[0, HALF_PI, 0]}>
        <torusGeometry args={[0.03, 0.007, 6, 12]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.4} roughness={0.4} />
      </mesh>
      <Part position={[0, -0.03, -0.01]} scale={[0.012, 0.05, 0.012]} color={METAL_DARK} />
      <Part position={[0, -0.08, 0.05]} scale={[0.06, 0.13, 0.08]} rotation={[0.18, 0, 0]} color={GLOVE} />
      <GrippingHand side={1} position={[0, -0.05, 0.08]} rotation={[0.16, -0.05, 0.02]} scale={0.82} />
    </StaticBatch>
    {/* 포어엔드다. 쏠 때마다 pumpRef 가 z 로 뒤로 뺐다 되돌린다. 지지 손이 같이 딸려 간다.
     * 뒤로 빠지는 z 는 매 프레임 절대값으로 다시 쓰이므로, 제자리 오프셋은 감싸는 group 에 둔다. */}
    <group position={[0, -0.02, -0.3]}>
      <group ref={pumpRef} userData={{ dynamic: true }}>
        <StaticBatch><Part position={[0, 0, 0]} scale={[0.05, 0.05, 0.22]} color={WOOD} /></StaticBatch>
        <GrippingHand side={-1} position={[0, 0.01, 0.02]} rotation={[0.12, 0.06, -0.04]} scale={0.78} />
      </group>
    </group>
    {/* 관형 탄창에 넣는 셸 한 발이다. 재장전마다 밀려 들어가는 것처럼 움직인다. */}
    <group position={[0.05, -0.03, -0.1]}>
      <group ref={magazineRef} userData={{ dynamic: true }}>
        <mesh rotation={[HALF_PI, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.06, 8]} />
          <meshStandardMaterial color={SHELL} roughness={0.6} />
        </mesh>
      </group>
    </group>
    <MuzzleFlash flashRef={flashRef} position={[0, 0.06, -0.735]} />
  </group>;
}

/** 무기를 바꾸지 않는 한 다시 만들지 않는다. live 가 아직 없을 때(마운트 첫 프레임 등)의 안전한 기본값이다. */
const EMPTY_LIVE = Object.freeze({ recoil: 0, walk: 0, aim: 0, reload: 0 });

/** torch 가 참이면 총열 아래 손전등의 렌즈가 빛난다.
 * recoil/walk(걸음)/aim(정조준 0~1)/reload(재장전 진행도, 0 시작~1 끝) 는 더 이상 props 가 아니라
 * live ref 로 받는다. WalkMode 가 매 프레임 값만 바꿔 쓰므로, 이 컴포넌트는 weapon 이나 torch 가
 * 실제로 바뀔 때만 다시 렌더된다. 애니메이션은 아래 useFrame 이 ref 를 직접 읽어 만든다. */
export default function WeaponView({ weapon = 'fist', torch = false, live }) {
  const rootRef = useRef(null);
  const recoilGroupRef = useRef(null);
  const scaleRef = useRef(null);
  const punchRef = useRef(null);
  const actionRef = useRef(null);
  const pumpRef = useRef(null);
  const magazineRef = useRef(null);
  const flashRef = useRef(null);
  const smoothedRecoil = useRef(0);
  const smoothedAim = useRef(0);
  const smoothedReload = useRef(0);
  const previousRecoil = useRef(0);
  const flashLife = useRef(0);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, MAX_STEP);
    const values = live?.current || EMPTY_LIVE;
    const target = Math.min(1, Math.max(0, values.recoil));
    // WalkMode only publishes recoil after a real shot. A rising edge is a
    // reliable shot event even though the view model receives no audio/state
    // callback, and keeps a flash from lingering through recoil recovery.
    if (target > previousRecoil.current + SHOT_RECOIL_DELTA) flashLife.current = FLASH_SECONDS;
    previousRecoil.current = target;
    flashLife.current = Math.max(0, flashLife.current - dt);
    smoothedRecoil.current += (target - smoothedRecoil.current) * Math.min(1, dt * RECOIL_LERP);
    const wantAim = weapon === 'fist' ? 0 : Math.min(1, Math.max(0, values.aim));
    smoothedAim.current += (wantAim - smoothedAim.current) * Math.min(1, dt * ADS_LERP);
    const ads = smoothedAim.current;
    smoothedReload.current += (Math.min(1, Math.max(0, values.reload)) - smoothedReload.current) * Math.min(1, dt * RELOAD_LERP);
    // 진행도 0~1 을 사인 곡선에 넣으면 절반에서 가장 깊이 숙였다가 끝에서 다시 든다.
    const reloadMotion = reloadPose(weapon, smoothedReload.current);
    const reloadDip = reloadMotion.dip;
    const action = actionPose(weapon, smoothedRecoil.current);
    const t = clock.elapsedTime;

    if (rootRef.current) {
      // 겨누는 동안에는 흔들림도 같이 줄어든다. 총이 중앙으로 오면서 조용해진다.
      const sway = values.walk * (1 - ads * 0.8);
      const aimed = adsRest(weapon);
      const restX = HIP_REST[0] + (aimed[0] - HIP_REST[0]) * ads;
      const restY = HIP_REST[1] + (aimed[1] - HIP_REST[1]) * ads;
      rootRef.current.position.x = Math.min(0.42, restX + Math.sin(t * WALK_FREQ) * WALK_SWAY_X * sway);
      rootRef.current.position.y = restY + Math.abs(Math.sin(t * WALK_FREQ * 0.5)) * WALK_SWAY_Y * sway - reloadDip * RELOAD_DIP;
      rootRef.current.position.z = HIP_REST[2] + (aimed[2] - HIP_REST[2]) * ads;
      rootRef.current.rotation.x = reloadDip * RELOAD_TILT;
      rootRef.current.rotation.z = reloadDip * RELOAD_ROLL;
    }
    if (scaleRef.current) {
      const hip = HIP_SCALE[weapon] || 1;
      const zoomed = ADS_SCALE[weapon] || hip;
      scaleRef.current.scale.setScalar(hip + (zoomed - hip) * ads);
    }
    if (recoilGroupRef.current) {
      recoilGroupRef.current.position.z = GUN_Z[weapon] + smoothedRecoil.current * RECOIL_MAX_Z;
      recoilGroupRef.current.rotation.x = smoothedRecoil.current * RECOIL_TILT;
    }
    if (actionRef.current) {
      actionRef.current.position.z = action.slide + action.bolt + reloadMotion.bolt;
      actionRef.current.rotation.x = action.kick * 0.035;
    }
    if (pumpRef.current) pumpRef.current.position.z = action.pump;
    if (magazineRef.current) {
      magazineRef.current.position.y = -reloadMotion.magazineTravel;
      magazineRef.current.position.z = reloadMotion.magazineTravel * 0.32;
      magazineRef.current.rotation.x = reloadMotion.magazineTravel * 2.1;
    }
    if (flashRef.current) {
      flashRef.current.visible = flashLife.current > 0;
      flashRef.current.scale.setScalar(0.6 + action.flash * 0.7);
    }
    if (punchRef.current) {
      // 찌를 때 팔이 앞으로 뻗으며 손목이 안으로 감겨 정면을 보게 튼다.
      punchRef.current.position.z = RIGHT_HAND_POS[2] - smoothedRecoil.current * FIST_PUNCH_Z;
      punchRef.current.rotation.set(
        FIST_REST_ROT[0] + FIST_PUNCH_ROT[0] * smoothedRecoil.current,
        FIST_REST_ROT[1] + FIST_PUNCH_ROT[1] * smoothedRecoil.current,
        FIST_REST_ROT[2] + FIST_PUNCH_ROT[2] * smoothedRecoil.current,
      );
    }
  });

  return <group ref={rootRef} position={HIP_REST}>
    {weapon === 'fist' && <Fist punchRef={punchRef} />}
    {weapon === 'pistol' && <group ref={recoilGroupRef} position={ANCHOR.pistol}><group ref={scaleRef} scale={HIP_SCALE.pistol}><Pistol actionRef={actionRef} magazineRef={magazineRef} flashRef={flashRef} /><Torch weapon="pistol" on={torch} /></group></group>}
    {weapon === 'smg' && <group ref={recoilGroupRef} position={ANCHOR.smg}><group ref={scaleRef} scale={HIP_SCALE.smg}><Smg actionRef={actionRef} magazineRef={magazineRef} flashRef={flashRef} /><Torch weapon="smg" on={torch} /></group></group>}
    {weapon === 'sniper' && <group ref={recoilGroupRef} position={ANCHOR.sniper}><group ref={scaleRef} scale={HIP_SCALE.sniper}><Sniper actionRef={actionRef} magazineRef={magazineRef} flashRef={flashRef} /><Torch weapon="sniper" on={torch} /></group></group>}
    {weapon === 'shotgun' && <group ref={recoilGroupRef} position={ANCHOR.shotgun}><group ref={scaleRef} scale={HIP_SCALE.shotgun}><Shotgun pumpRef={pumpRef} magazineRef={magazineRef} flashRef={flashRef} /><Torch weapon="shotgun" on={torch} /></group></group>}
  </group>;
}
