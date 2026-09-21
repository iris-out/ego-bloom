/** Celestial bodies follow the camera to stay distant; clouds remain in world
 * space. Preserve this split when changing scenery or the flight camera.
 * Counts are quality-budgeted; do not replace batched clouds/stars with DOM.
 */
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { skyVertex, skyFragment } from './shaders/atmosphere';

/** 불투명 물체 정렬에서 하늘의 자리다. 도시(0) 뒤, 1인칭 거울(1000) 앞이다. */
const SKY_ORDER = 999;

// 인덱스만으로 정해지는 결정적 해시다. Math.random() 을 쓰지 않아 매 렌더마다 같은 하늘이 나온다.
const hash = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

// 별은 반지름 1900 의 껍질에 고정돼 있다. 거리로 나누면 1픽셀 미만이 되어 사라진다.
// 화면 픽셀 크기를 그대로 준다.
const starVertex = `attribute float aSize,aBrightness;uniform float uScale;varying float vBrightness;
void main(){vBrightness=aBrightness;vec4 mv=modelViewMatrix*vec4(position,1.0);
gl_PointSize=aSize*uScale;gl_Position=projectionMatrix*mv;}`;
const starFragment = `uniform vec3 uColor;uniform float uOpacity;varying float vBrightness;
void main(){vec2 uv=gl_PointCoord-0.5;float d=length(uv);if(d>0.5)discard;
float alpha=smoothstep(0.5,0.0,d)*vBrightness*uOpacity;gl_FragColor=vec4(uColor,alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

function SkyEffects({ timeOfDay, weather, quality, extent, atmosphere }) {
  const sky = useRef(), clouds = useRef();
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const cloudy = weather !== 'clear';
  const night = timeOfDay === 'night';
  const cloudCount = ({ low: 7, medium: 14, high: 22 }[quality]) * (cloudy ? 3 : 1);
  const stars = useMemo(() => {
    const count = { low: 420, medium: 900, high: 1700 }[quality];
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const brightness = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = i * 2.399963, y = 0.08 + (i + 0.5) / count * 0.92;
      const radius = Math.sqrt(1 - y * y);
      positions.set([Math.cos(theta) * radius * 1900, y * 1900, Math.sin(theta) * radius * 1900], i * 3);
      // 밝은 별은 드물고 흐린 별이 많아야 낱개 점이 아니라 하늘로 읽힌다.
      sizes[i] = 1.3 + Math.pow(hash(i * 3.11 + 1), 3.2) * 3.6;
      brightness[i] = 0.3 + Math.pow(hash(i * 7.71 + 5), 2.2) * 0.7;
    }
    return { count, positions, sizes, brightness };
  }, [quality]);
  useLayoutEffect(() => {
    const transform = new THREE.Object3D();
    for (let i = 0; i < cloudCount; i++) {
      const cluster = Math.floor(i / 3), lobe = i % 3;
      const span = Math.max(460, extent * 1.7);
      transform.position.set(Math.sin(cluster * 2.399) * span + lobe * 25, 270 + cluster % 4 * 15 + (lobe === 1 ? 8 : 0), Math.cos(cluster * 4.117) * span + lobe * 8);
      transform.scale.set(38 + cluster % 3 * 8, 10 + (lobe === 1 ? 7 : 0), 23 + cluster % 4 * 4);
      transform.rotation.set(0, cluster, 0); transform.updateMatrix(); clouds.current.setMatrixAt(i, transform.matrix);
    }
    clouds.current.instanceMatrix.needsUpdate = true;
    clouds.current.computeBoundingSphere();
  }, [cloudCount, extent]);
  useFrame(({ camera, clock }) => {
    sky.current.position.copy(camera.position);
    clouds.current.position.x = Math.sin(clock.elapsedTime * 0.015) * 35;
  });
  /** uniforms 객체는 한 번만 만들고 값만 바꾼다. three 는 셰이더 프로그램을 만들 때
   * 잡아 둔 uniforms 객체를 계속 쓰므로, 새 객체로 갈아 끼우면 화면에 반영되지 않는다.
   * 시간대를 바꿔도 하늘이 낮에 멈춰 있던 원인이다. */
  const uniforms=useMemo(()=>({uZenith:{value:new THREE.Color()},uHorizon:{value:new THREE.Color()},
    uSunColor:{value:new THREE.Color()},uSunDirection:{value:new THREE.Vector3(0,1,0)},
    uNight:{value:0},uGlow:{value:0},uCloud:{value:0}}),[]);
  const starUniforms=useMemo(()=>({uColor:{value:new THREE.Color('#e5edff')},uOpacity:{value:.85},uScale:{value:1}}),[]);
  useLayoutEffect(()=>{
    uniforms.uZenith.value.set(atmosphere.zenith);
    uniforms.uHorizon.value.set(atmosphere.horizon);
    uniforms.uSunColor.value.set(atmosphere.sun);
    uniforms.uSunDirection.value.set(...atmosphere.direction).normalize();
    // Three 의 uniform 값은 의도적으로 바꿔 쓰는 상태다. Ocean 의 물결 시간과 같은 규약이다.
    /* eslint-disable react-hooks/immutability */
    uniforms.uNight.value=night?1:0;
    uniforms.uGlow.value=atmosphere.glow;
    uniforms.uCloud.value=cloudy?1:0;
    starUniforms.uOpacity.value=cloudy?.34:.92;
    starUniforms.uScale.value=pixelRatio;
    /* eslint-enable react-hooks/immutability */
  },[uniforms,starUniforms,atmosphere,night,cloudy,pixelRatio]);
  const cloudColor = night ? '#627483' : weather === 'rain' ? '#929fa9' : '#f1f0e8';
  return <>
    <group ref={sky}>
      {/* 불투명 물체 가운데 마지막(거울 1000 보다는 앞) 에 그린다. 먼저 그리면 도시에 가려질 화소까지
          하늘 셰이더를 다 돌린다. 깊이는 쓰지 않으므로 투명 물체와 별은 그 위에 얹힌다. */}
      <mesh renderOrder={SKY_ORDER} frustumCulled={false}>
        <sphereGeometry args={[2400,32,16]}/>
        <shaderMaterial vertexShader={skyVertex} fragmentShader={skyFragment} side={THREE.BackSide} depthWrite={false}
          uniforms={uniforms}/>
      </mesh>
      {night && <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars.positions,3]}/>
          <bufferAttribute attach="attributes-aSize" args={[stars.sizes,1]}/>
          <bufferAttribute attach="attributes-aBrightness" args={[stars.brightness,1]}/>
        </bufferGeometry>
        <shaderMaterial vertexShader={starVertex} fragmentShader={starFragment} uniforms={starUniforms}
          transparent depthWrite={false}/>
      </points>}
    </group>
    <instancedMesh ref={clouds} args={[null, null, cloudCount]}>
      <icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color={cloudColor} roughness={1} transparent opacity={cloudy ? 0.94 : 0.83} depthWrite={false} />
    </instancedMesh>
  </>;
}

export default memo(SkyEffects);
