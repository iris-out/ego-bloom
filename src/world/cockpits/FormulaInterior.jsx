import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import InstrumentDisplay from './InstrumentDisplay.jsx';
import Mirrors from './Mirrors.jsx';
import { Hands, Panel, Pedals, PushButton, Seat } from './parts.jsx';
import { at, cabin } from './cabinLayout.js';
import { ROAD_CABINS } from './vehicleInteriorLayout.js';
import { detailLevel } from './detail.js';
import StaticBatch from '../StaticBatch.jsx';
import { MAT } from './materials.js';

function ShiftLights({ statusRef }) {
  const lights = useRef([]);
  useFrame(() => {
    const rpm = Number(statusRef?.current?.rpm) || 0;
    for (let index = 0; index < lights.current.length; index += 1) {
      const cap = lights.current[index]?.children?.[1]?.children?.[1];
      if (cap) cap.material = rpm >= 4200 + index * 550 ? (index > 4 ? MAT.warn : MAT.glow) : MAT.face;
    }
  });
  return [-3, -2, -1, 0, 1, 2, 3].map((step, index) => <group key={step} ref={(node)=>{lights.current[index]=node;}}>
    <PushButton position={at('formula', [step * 0.032, -0.135, -0.552])} size={0.018} />
  </group>);
}

/** 포뮬러 전용 낮은 운전석이다. 외장의 헤일로와 노즈는 남기고 실내에는 패딩, 콤팩트 휠,
 * 통합 화면만 둔다. 휠과 손은 같은 dynamic 가지 안쪽에서 다시 정적 병합한다. */
export default function FormulaInterior({ statusRef, night = false, quality = 'medium' }) {
  const wheel = useRef();
  const { mid, high } = detailLevel(quality);
  const spec = ROAD_CABINS.formula;
  useFrame((_, delta) => {
    if (!wheel.current) return;
    const target = -(Number(statusRef?.current?.steer) || 0) * spec.wheel.ratio;
    wheel.current.rotation.z += (target - wheel.current.rotation.z) * (1 - Math.exp(-delta * 16));
  });
  return <group>
    <Mirrors vehicle="formula" layout="formula" quality={quality} />
    {/* 모노코크 욕조와 어깨 패딩. 중앙은 비워 앞 노즈와 바퀴가 보인다. */}
    <Panel material="dark" position={cabin('formula', [0, -0.67, -0.48])} scale={[0.72, 0.10, 0.80]} />
    {[-1, 1].map(side => <group key={side}>
      <Panel material="shell" position={cabin('formula', [side * 0.37, -0.39, -0.43])}
        scale={[0.10, 0.30, 0.74]} rotation={[0, 0, side * -0.08]} />
      <Panel material="leather" position={cabin('formula', [side * 0.31, -0.32, -0.40])}
        scale={[0.08, 0.18, 0.52]} rotation={[0, 0, side * -0.08]} />
    </group>)}
    <Panel material="shell" position={at('formula', [0, -0.26, -0.60])} scale={[0.70, 0.20, 0.035]} />
    <Panel material="trim" position={at('formula', [0, -0.14, -0.57])} scale={[0.38, 0.03, 0.05]} />
    <InstrumentDisplay mode="cluster" statusRef={statusRef} night={night} accent="#55d6bd"
      position={at('formula', spec.display.slice(0, 3))} width={spec.display[3]} height={spec.display[4]} />
    {/* 화면 윗줄의 변속등이다. 실제 RPM은 화면이 보여 주고 이 줄은 빠른 주변시 판독용이다. */}
    <ShiftLights statusRef={statusRef} />
    <group ref={wheel} position={at('formula', [0, spec.wheel.y, spec.wheel.z])}
      rotation={[spec.wheel.tilt, 0, 0]} userData={{ dynamic: true }}>
      <StaticBatch version={`${mid}`}>
        {/* 상하를 잘라낸 사각 레이싱 휠과 양쪽 그립이다. */}
        <Panel material="trim" position={[0, 0.11, 0]} scale={[0.34, 0.055, 0.045]} />
        <Panel material="trim" position={[0, -0.11, 0]} scale={[0.34, 0.055, 0.045]} />
        {[-1, 1].map(side => <Panel key={side} material="grip" position={[side * 0.16, 0, 0]}
          scale={[0.06, 0.24, 0.055]} />)}
        <Panel material="trim" scale={[0.20, 0.12, 0.05]} />
        {mid && <Hands radius={0.18} />}
      </StaticBatch>
    </group>
    {mid && <Pedals position={at('formula', spec.pedals)} count={2} spacing={0.13} />}
    {mid && <Seat position={cabin('formula', [0, -0.38, 0.48])} width={0.46} depth={0.72} height={0.42} material="fabric" />}
    {high && <Panel material="metal" position={cabin('formula', [0, -0.03, 0.68])} scale={[0.34, 0.04, 0.12]} />}
  </group>;
}
