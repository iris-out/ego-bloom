# 오픈월드 렌더링 성능 조사

이 문서는 /world 경로의 브라우저 오픈월드(제작자 건물 InstancedMesh 배치, NPC 건물, 도로, AI 차량 최대 1000대, 비행/운전/도보 1인칭)에 적용할 만한 렌더링 성능 기법을 조사한 결과다. 스택은 three 0.182.0(r182), @react-three/fiber 9.5, @react-three/drei 10.7, React 19, Vite 8 beta 다. three.js 는 2026년 9월 기준 r186 까지 나와 있어, 이 프로젝트가 쓰는 r182 는 최신에서 몇 버전 뒤처진 상태다.

조사 과정에서 프로젝트 코드를 직접 읽어 이미 적용된 기법과 남은 여지를 구분했다. 파일 경로를 적은 항목은 코드에서 직접 확인한 사실이고, 웹 출처는 각 절 끝의 출처 줄에 적었다.

## 1. Draw-call 감소: InstancedMesh, BatchedMesh, 병합, 텍스처 atlas

InstancedMesh 는 같은 geometry 와 material 을 쓰는 오브젝트 여러 개를 draw call 하나로 그린다. 인스턴스 수가 10만 개를 넘는 규모에서는 BatchedMesh 의 multi-draw 방식보다 InstancedMesh 가 더 빠르다는 것이 커뮤니티의 대체적인 결론이다.

BatchedMesh(r159 도입, r170 이후 기능 확장)는 material 은 같지만 geometry 가 서로 다른 오브젝트 여러 개를 하나의 batch 에 넣어 multi-draw 로 그린다. addGeometry() 로 geometry 를 등록하고 addInstance() 로 인스턴스를 만든다. geometry 종류가 2~4개를 넘어가고 오브젝트 수가 많지 않을 때(수만 개 이하) InstancedMesh 를 여러 개 쓰는 것보다 유리하다는 게 forum 의 정리다. perObjectFrustumCulled(기본 true)와 sortObjects(기본 true) 속성으로 batch 안에서 개별 오브젝트 단위 frustum culling 과 깊이 정렬을 켤 수 있다. 단 CPU 오버헤드가 커서 고CPU 사용량 문제가 보고된 이슈도 있다.

mergeGeometries(BufferGeometryUtils)는 다시 따로 움직이지 않을 정적 오브젝트 여러 개를 geometry 하나로 합쳐 draw call 을 하나로 줄인다. 한 번 합치면 개별 이동, 삭제가 불가능해진다는 게 비용이다.

텍스처 atlas 는 여러 텍스처를 한 장으로 묶어 텍스처 바인딩 전환 횟수를 줄인다. material 이 같아지는 만큼 batch 대상도 늘어난다.

이 프로젝트에서는 제작자 건물이 shape-material 조합마다 InstancedMesh 하나로 배치되고(`src/world/WorldScene.jsx` Instances 컴포넌트), shape 와 material 종류 자체가 제한돼 있어 draw call 폭발 위험은 낮다. AI 차량은 부위마다(차체, 유리, 적재함, 후미등, 바퀴, 전조등) InstancedMesh 6개를 쓰고 geometry 는 box 와 cylinder 두 종류뿐이라(`src/world/WorldScene.jsx` Cars 함수) BatchedMesh 로 옮길 이유가 약하다. NPC 건물이나 건물 파츠처럼 앞으로 geometry 종류가 크게 늘어나는 쪽이 생기면 그때 BatchedMesh 도입을 검토하는 편이 맞다.

출처
- https://threejs.org/docs/pages/BatchedMesh.html
- https://discourse.threejs.org/t/how-to-choose-between-instancedmesh-and-batchedmesh/81221
- https://discourse.threejs.org/t/significant-performance-drop-and-high-cpu-usage-with-batchedmesh/67324
- https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices

## 2. Culling: 인스턴스 단위 frustum culling 과 occlusion culling

three.js 의 InstancedMesh 는 인스턴스 하나하나가 아니라 InstancedMesh 전체를 하나의 덩어리로만 frustum culling 한다. r151 부터 InstancedMesh.frustumCulled 기본값이 true 로 바뀌었는데, 이는 boundingSphere 계산을 지원하게 되면서다. 인스턴스 위치를 setMatrixAt 으로 바꾼 뒤에는 computeBoundingSphere() 를 다시 불러야 컬링과 raycasting 이 올바르게 동작한다. 즉 전체를 한 덩어리로 취급하므로, 큰 InstancedMesh 하나에 도시 전체 건물을 담으면 화면 절반만 보여도 전체가 그려진다.

이를 피하는 실전 기법이 타일/청크 단위 instancing 이다. 공간을 구획으로 나눠 구획마다 별도 InstancedMesh 를 만들면, 구획별 boundingSphere 가 좁아져서 화면 밖 구획은 실제로 컬링된다.

인스턴스 단위 진짜 frustum culling, 정렬, LOD 가 필요하면 InstancedMesh2(three.ez) 같은 서드파티 확장이 있다. three.js 코어에는 없는 기능이라 새 의존성을 들이는 비용이 든다.

WebGL2 자체는 occlusion query(WebGLQuery)를 core API 로 지원한다. 하지만 three.js 는 WebGLRenderer 에 occlusion query 를 구현하지 않았고, WebGPURenderer 의 WebGPU/WebGL2 백엔드에만 구현했다. 즉 이 프로젝트처럼 WebGLRenderer 를 쓰는 한, occlusion culling 은 직접 만들어야 하고 three.js 코어의 지원을 기대할 수 없다.

이 프로젝트는 이미 이 절의 핵심을 적용해 두었다. `src/world/cityTiles.js` 가 배치를 공간 타일로 쪼개고, `src/world/WorldScene.jsx` 의 CityTiles/Instances 컴포넌트 주석에 "타일이 나뉘어 있으므로 computeBoundingSphere 가 좁은 구를 만들고 frustum culling 이 실제로 동작한다"고 명시돼 있다. AI 차량은 InstancedMesh 의 컬링을 아예 끄고(frustumCulled=false) 대신 반경 밖 차량을 매 프레임 앞쪽 슬롯에서 빼는 수동 가시성 컬링을 쓴다. 주석에 남은 개발 이력("예전에는 멀리 있는 차를 크기 0 으로 접어 두기만 해서... 헛도는 삼각형이 8만 개였다")을 보면 이미 이 문제를 겪고 고친 상태다. 남은 여지가 있다면 항공기(`src/world/airTraffic.js`)나 다른 아직 타일화되지 않은 배치가 있는지 정도다.

출처
- https://threejs.org/docs/pages/InstancedMesh.html
- https://github.com/mrdoob/three.js/wiki/Migration-Guide (r151 InstancedMesh.frustumCulled 기본값 변경)
- https://discourse.threejs.org/t/three-ez-instancedmesh2-enhanced-instancedmesh-with-frustum-culling-fast-raycasting-bvh-sorting-visibility-management-lod-skinning-and-more/69344
- https://discourse.threejs.org/t/ideas-on-performing-fast-per-instance-frustum-culling-on-instancedmesh/85156
- https://developer.mozilla.org/en-US/docs/Web/API/WebGLQuery
- https://github.com/mrdoob/three.js/pull/15450 (WebGL2 occlusion query 제안, WebGLRenderer 에는 미구현)

## 3. LOD 와 impostor

THREE.LOD 는 거리별로 다른 mesh 를 등록해 두면 카메라 거리에 따라 three.js 가 자동으로 바꿔 그리는 오브젝트다. drei 의 Detailed 컴포넌트는 이를 선언적으로 감싸, distances 배열 순서대로 자식 mesh 를 넣기만 하면 된다.

billboard impostor 는 먼 오브젝트를 카메라를 향하는 평면 하나(drei Billboard)로 대체해 정점 수를 극단적으로 줄이는 기법이다. 텍스처를 미리 구워야 해서 사전 작업 비용이 있고, 각도에 따라 입체감이 사라지는 단점이 있다.

HLOD(계층적 LOD)는 타일 단위로 개별 LOD 결과를 하나로 병합해 더 먼 거리에서 draw call 을 추가로 줄이는 기법이다. 큰 오픈월드에 유효하지만 구현 난이도가 높다.

이 프로젝트는 THREE.LOD 나 drei Detailed 를 쓰지 않고 손으로 짠 LOD 체계를 이미 갖췄다. `src/world/cityTiles.js` 주석에 "타일마다 상세 단계를 셋 두고 카메라 거리로 하나만 켠다. near 는 원본 모델 그대로고 mid 는 같은 모델에서 화면에 몇 픽셀도 안 되는 파트만 빠진다. far 에서는 제작자 건물이 티어별 축약형으로 바뀐다"고 돼 있다. 이는 사실상 수동 HLOD 에 가깝다. 지금 구조를 THREE.LOD/Detailed 로 바꿀 이유는 적고, far 실루엣보다 더 먼 지평선(있다면)에 billboard impostor 를 얹는 정도가 남은 선택지다.

출처
- https://github.com/pmndrs/drei/blob/master/docs/performances/detailed.mdx
- https://github.com/pmndrs/drei/blob/master/docs/abstractions/billboard.mdx

## 4. Shadow

shadow map 해상도가 커질수록 GPU 메모리와 대역폭 비용이 커진다. 512 를 4096 으로 올리면 텍스처 메모리가 64배 는다. shadow camera(주로 OrthographicCamera) 의 프러스텀을 실제로 그림자가 필요한 범위로 좁히면, 같은 해상도에서도 그림자가 또렷해지고 렌더 비용도 준다. 해상도를 올리는 것보다 프러스텀을 좁히는 쪽이 더 값싼 개선이라는 게 커뮤니티의 공통된 조언이다.

shadowMap.autoUpdate 를 false 로 두고 필요할 때만 needsUpdate = true 를 주면(drei BakeShadows 가 이를 감싼 컴포넌트) 정적인 장면에서 그림자를 매 프레임 다시 계산하지 않는다.

CSM(cascaded shadow map, three/addons/csm/CSM.js)은 카메라에서 가까운 구간은 고해상도, 먼 구간은 저해상도로 shadow map 을 여러 장 나눠 쓰는 기법이다. 넓은 오픈월드에서 화질 대비 비용이 좋지만 material 마다 CSM 콜백을 등록해야 해서 코드가 늘어난다.

통합 GPU 는 shadow map 렌더 패스 자체가 상대적으로 비싸다는 보고가 흔하다. 해상도와 프러스텀을 줄이는 쪽이 통합 GPU 대응에도 가장 값싸다.

이 프로젝트는 이미 이 절의 핵심 기법을 적용했다. `src/world/WorldScene.jsx` 의 shadowHalf 함수가 카메라 거리에 따라 shadow.left/right/top/bottom 을 매 프레임 다시 계산해 프러스텀을 좁히고, 품질 등급별로 mapSize 를 512에서 2048 사이로 바꾼다(shadow-bias=-0.0002, shadow-normalBias=0.3 도 튜닝돼 있다). 승용차 1인칭 룸미러(`src/world/cockpits/Mirrors.jsx`)는 미러 렌더 패스 동안 gl.shadowMap.autoUpdate 를 꺼 그림자를 다시 만들지 않고 본 화면 결과를 그대로 재사용한다. 남은 여지는 낮 시간대나 날씨 변화가 뚜렷한 장면에서 CSM 을 넣는 정도인데, 지금 구조로도 이미 충분히 값싸게 처리하고 있어 우선순위는 낮다.

출처
- https://threejs.org/manual/en/shadows.html
- https://discourse.threejs.org/t/how-do-i-fit-the-camera-frustum-inside-directional-light-space/56801
- https://github.com/pmndrs/drei/blob/master/docs/performances/bake-shadows.mdx
- https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shadowmap_csm.html

## 5. CPU 측: 할당, useFrame, 상태 관리

useFrame 안에서 new THREE.Vector3() 같은 객체를 매 프레임 만들면 GC 압박이 커진다. 컴포넌트 스코프에 객체를 하나 만들어 두고 .set() 으로 값만 갱신해 재사용하는 것이 R3F 공식 문서의 첫 번째 권고다.

useFrame 안에서 React 의 setState 를 부르면 그 값이 아무리 작아도 React 스케줄러를 매 프레임 태워 불필요한 렌더를 만든다. three.js 는 render loop 를 따로 갖고 있어서, 빠른 갱신은 ref 를 직접 mutate 하는 쪽이 정석이다. zustand 같은 상태 관리자를 쓸 때도 transient update(구독은 하되 렌더를 트리거하지 않는 방식)로 묶으면 R3F 프레임 루프와 부딪히지 않는다.

InstancedMesh 의 instanceMatrix 는 기본이 StaticDrawUsage 다. 자주 바뀌는 인스턴스라면 setUsage(DynamicDrawUsage) 로 GPU 업로드 힌트를 바꿔야 한다. r159 부터 BufferAttribute.updateRange 가 deprecated 되고 updateRanges 배열과 addUpdateRange(start, count) / clearUpdateRanges() 로 바뀌어, 바뀐 구간만 나눠서 부분 업로드할 수 있게 됐다(r169 에서 예전 updateRange API 완전히 제거).

이 프로젝트는 상태 관리 원칙을 상당 부분 이미 지키고 있다. `src/world/WalkMode.jsx` 의 메인 useFrame 은 setGun/onStatus 를 매 프레임 부르지 않고 0.12초 주기로 묶고, 값이 실제로 바뀌었을 때만 setGun 을 부른다. 다만 같은 파일의 Blasts 컴포넌트는 살아있는 blast 가 하나라도 있으면(총알 자국, 폭발 이펙트) 매 프레임 setLive 를 불러 React 가 `<Blast>` 트리를 매 프레임 재조정한다. 총을 쏴 blast 가 사라지지 않는 동안(BLAST_LIFE 초) 프레임마다 리렌더가 일어나는 구간이라, on-foot 모드 stutter 의 유력한 후보 중 하나다. live 배열을 ref 로 옮기고 Blast 의 위치, 투명도, 스케일을 useFrame 안에서 직접 mutate 하는 방식으로 바꾸면 이 경로의 React 렌더를 없앨 수 있다.

출처
- https://github.com/pmndrs/react-three-fiber/blob/master/docs/advanced/pitfalls.mdx
- https://threejs.org/docs/pages/BufferAttribute.html
- https://github.com/mrdoob/three.js/pull/27103 (addUpdateRange 다중 구간 지원)
- https://github.com/pmndrs/drei/issues/1742 (updateRange deprecation 이 드러난 실사례)

## 6. Shader compilation hitch

새 material 조합이 처음 화면에 그려지는 순간, 드라이버가 그 순간 셰이더를 컴파일한다. 이 컴파일이 메인 스레드를 막아 프레임 하나가 크게 늘어지는 현상을 "shader compilation stutter" 라고 부른다.

renderer.compileAsync(scene, camera, targetScene) 는 실제로 화면에 그리기 전에 미리 컴파일해 둔다. KHR_parallel_shader_compile 확장을 지원하는 브라우저에서는 컴파일 완료 여부를 논블로킹으로 확인할 수 있어, compile() 보다 compileAsync() 를 쓰는 것이 공식 문서의 권고다(r158 무렵 추가).

onBeforeCompile 로 셰이더를 바꾸는 material 은 customProgramCacheKey() 를 구현하지 않으면 three.js 가 캐시를 잘못 재사용하거나, 반대로 매번 새 프로그램을 만들어 컴파일 비용이 반복될 수 있다.

material 을 공유하면(모듈 스코프에 한 번만 만들어 재사용) 프로그램 개수 자체가 줄어든다. 인스턴스마다 새 material 을 만드는 코드가 있는지가 이 문제를 찾을 때 가장 먼저 볼 지점이다.

이 프로젝트에서 `src/world/models/Blast.jsx` 는 muzzle flash, 화염, 연기, 잔해에 쓰는 material 을 모듈 스코프 상수로 한 번만 만들어 재사용한다. 코드 자체는 material 을 공유하지만, 월드에 들어가 첫 발을 쏘기 전까지는 그 material 조합이 실제로 화면에 그려진 적이 없을 수 있다. 그 경우 첫 발사, 첫 폭발, 첫 무기 교체 시점에 컴파일 비용이 한꺼번에 몰려 정확히 "새 셰이더 첫 등장" 히치가 난다. 월드 진입 직후 로딩 단계에서 무기별 muzzle flash, blast, tracer material 을 화면 밖에 한 번 렌더하거나 renderer.compileAsync 로 미리 컴파일해 두면 이 히치를 없앨 수 있다. on-foot 모드 stutter 보고와 시점이 맞아떨어지는 유력한 원인이다.

출처
- https://threejs.org/docs/pages/Renderer.html (compileAsync)
- https://threejs.org/docs/pages/Material.html (customProgramCacheKey)
- https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices (병렬 셰이더 컴파일)

## 7. 해상도와 adaptive quality

setPixelRatio 를 window.devicePixelRatio 그대로 쓰면 고해상도 화면에서 프래그먼트 셰이더 비용이 배로 뛴다. 상한을 1.5~2 정도로 잡는 것이 일반적인 권고다.

drei PerformanceMonitor 는 일정 시간(기본 250ms, 10회 반복) 평균 fps 를 모아 미리 정한 bounds 를 벗어나면 onIncline/onDecline 콜백을 준다. AdaptiveDpr 은 그 factor 값을 읽어 dpr 을 자동으로 낮추거나 올린다. PerformanceMonitor 는 드래그 같은 상호작용 중에 일부러 품질을 낮추는 regress() 도 지원한다.

frameloop='demand' 는 변화가 있을 때만 다시 그리는 모드다. 정적인 뷰어류에는 잘 맞지만, 이 프로젝트처럼 AI 차량과 항공기가 쉬지 않고 움직이는 장면에는 맞지 않는다. 사실상 매 프레임 invalidate() 를 불러야 해서 이득이 없다.

이 프로젝트는 quality 등급(low/medium/high)마다 dpr 을 1, 1.5, 2 로 고정해 두고 사용자가 직접 고르는 구조다(`src/world/cityModels.js` QUALITY 표, `src/world/WorldScene.jsx` 의 Canvas dpr prop). PerformanceMonitor 와 AdaptiveDpr 은 코드에 없다. Radeon 780M 류 통합 GPU 나 소프트웨어 GL 처럼 사용자가 등급을 잘못 고르거나 고를 수 없는 상황에서는, PerformanceMonitor 로 실측 fps 가 계속 낮을 때 자동으로 한 단계 낮은 quality 로 내려가는 안전망을 붙이는 쪽이 새 인프라 없이 얻을 수 있는 값싼 개선이다.

출처
- https://github.com/pmndrs/drei/blob/master/docs/performances/performance-monitor.mdx
- https://github.com/pmndrs/drei/blob/master/docs/performances/adaptive-dpr.mdx
- https://github.com/pmndrs/react-three-fiber/blob/master/docs/advanced/scaling-performance.mdx

## 8. Canvas 텍스처 계기판

CanvasTexture 는 canvas 2D 로 그린 그림을 텍스처로 올린다. needsUpdate = true 를 줄 때마다 GPU 로 texImage2D 또는 texSubImage2D 업로드가 일어나고, 텍스처가 클수록 업로드 비용이 커진다. 실측 사례로는 3000x3000 텍스처 하나의 texSubImage2D 업로드가 1.5~3.5ms 걸렸다는 보고가 있다.

값이 바뀌었을 때만, 또는 10~15Hz 정도로 throttle 해서 다시 그리는 편이 매 프레임 그리는 것보다 훨씬 싸다. OffscreenCanvas + worker 로 그리기 작업을 메인 스레드 밖으로 옮길 수도 있지만, three.js 의 CanvasTexture 는 메인 스레드의 canvas 를 기대하므로 결과물을 다시 메인 스레드로 옮기는 절차가 필요해, 계기판 몇 장 규모에서는 이득 대비 복잡도가 크다.

이 프로젝트는 이미 한쪽에서는 이 원칙을 지키고 있다. `src/world/cockpits/InstrumentDisplay.jsx` 는 status 가 0.15초 주기로 오는 것에 맞춰 그 주기로만 다시 그린다고 주석에 명시돼 있다("프레임마다 그리지 않는다"). 반면 `src/world/cockpits/FighterHud.jsx` 는 useFrame(clock) 안에서 매 프레임 그리고 texture.needsUpdate = true 를 준다. 전투기 HUD 는 자세, 속도, 고도처럼 계속 바뀌는 값을 보여줘야 하지만, 실제 눈에 보이는 변화 주기(예: 30Hz)로만 다시 그려도 체감 차이는 거의 없고 업로드 횟수는 절반 이하로 준다.

승용차 1인칭 룸미러(`src/world/cockpits/Mirrors.jsx`)는 별도 렌더 패스를 품질별로 2~5프레임에 한 번만(MIRROR_PASS.every) 낮은 해상도 render target(320x120에서 512x192)에 그리고, 그 패스 동안 그림자 갱신도 끈다. 이 부분은 이미 모범 사례를 따르고 있어 추가로 손댈 필요가 적다.

출처
- https://bugzilla.mozilla.org/show_bug.cgi?id=1246410 (canvas to WebGL 업로드 저성능 보고)
- https://github.com/mrdoob/three.js/issues/31093 (texImage2D 대비 내장 텍스처 갱신 속도차 이슈)

## 9. Raycasting 과 picking

three-mesh-bvh 는 폴리곤 수가 많은 단일 mesh 에 대한 raycasting 을 BVH 로 가속한다. 8만 폴리곤 모델에 광선 500개를 60fps 로 쏠 수 있었다는 벤치마크가 공개돼 있다. acceleratedRaycast 함수를 Mesh.prototype.raycast 에 등록해 쓰며, firstHitOnly 옵션을 켜면 가장 가까운 교차점 하나만 찾아 더 빠르다. 다만 이 라이브러리는 복잡하고 폴리곤이 많은 mesh 를 겨냥한 것이라, 폴리곤이 단순한 오브젝트가 많은 경우에는 이득이 작다는 게 저자 쪽 설명이다.

씬 전체를 대상으로 THREE.Raycaster.intersectObjects 를 매 프레임 돌리는 대신, 미리 대상 후보를 좁히는 spatial hash grid(uniform grid)로 broad phase 를 두면 비용이 오브젝트 수가 아니라 격자 칸 수에 비례하게 줄어든다. 월드를 고정 크기 셀로 나누고 각 엔티티를 그 좌표가 속한 셀에 등록해 두는 방식이다.

이 프로젝트는 도보 사격(`src/world/walkPhysics.js` fireWeapon)과 차량 충돌 판정(`src/world/traffic.js` trafficBoxes) 모두 THREE.Raycaster 나 씬 traversal 을 쓰지 않는다. 대신 반경으로 미리 걸러낸 목표 목록(사실상 반경 broad phase)을 대상으로 순수 수학 계산(광선과 좌표 비교)만 한다. `src/world/NearbyCreators.jsx` 는 Raycaster 인스턴스를 useMemo 로 한 번만 만들어 재사용한다. 셋 다 이미 이 절의 권고를 따르고 있어서, on-foot stutter 의 원인이 raycasting 쪽일 가능성은 낮다.

출처
- https://github.com/gkjohnson/three-mesh-bvh
- https://discourse.threejs.org/t/three-mesh-bvh-a-plugin-for-fast-geometry-raycasting-and-spatial-queries/26394

## 10. 측정

renderer.info.render.calls, .triangles, .programs 로 draw call 수, 삼각형 수, 셰이더 프로그램 개수를 프레임마다 읽을 수 있다. 데스크톱은 draw call 100개 아래, 모바일은 50개 아래를 목표로 잡는 경우가 흔하다는 언급이 있으나 이 수치 자체는 장면마다 달라 참고치로만 볼 만하다.

stats-gl 은 fps, CPU, GPU 시간을 패널로 보여준다. r3f-perf 는 React Three Fiber 씬에 특화돼 셰이더, 텍스처, 정점 수까지 보여준다. spector.js 는 브라우저 확장으로 프레임 하나를 draw call 단위까지 캡처해, 각 단계에서 어떤 상태 변경과 업로드가 일어났는지 보여준다.

Chrome DevTools Performance 패널로 프레임 예산(60fps 라면 16.6ms)을 넘기는 구간을 스크립팅, 렌더링, GPU 로 나눠 볼 수 있다. 이번 조사에서 찾은 stutter 후보(Blasts 의 setLive 리렌더, FighterHud 의 매 프레임 텍스처 갱신, 첫 발사 시 셰이더 컴파일)는 모두 Performance 패널의 Long Task, Scripting 구간에서 눈으로 확인할 수 있는 종류다.

이 프로젝트의 package.json 에는 stats-gl, r3f-perf, spector 계열 의존성이 없다. renderer.info 를 읽는 코드도 보이지 않는다. 실제 stutter 원인을 확정하려면 이 중 하나를 dev 전용으로 붙여 실측하는 절차가 먼저 필요하다.

출처
- https://discourse.threejs.org/t/where-can-i-see-the-number-of-draw-calls-per-frame/4311
- https://www.npmjs.com/package/stats-gl
- https://github.com/utsubostudio/r3f-perf (r3f-perf 소개, 배포처는 npm 패키지 페이지로 재확인 권장)

## 11. three.js r170-r182 변경과 WebGPURenderer

r151 에서 InstancedMesh.frustumCulled 기본값이 true 로 바뀌었다(boundingSphere 계산 지원과 함께). r158 에서 BatchedMesh.applyGeometry() 가 addGeometry() 로 이름이 바뀌었고, 비슷한 시기에 compileAsync 가 추가돼 KHR_parallel_shader_compile 을 쓴다. r159 에서 BufferAttribute.updateRange 가 deprecated 되고 addUpdateRange 로 바뀌었다(2절, 5절 참고).

이 프로젝트가 실제로 쓰는 r182 changelog 에는 WebGPURenderer 의 shadow map 개선이 들어 있다. "shadow acne 를 막으려고 넣었던 bias 값을 줄이거나 빼야 할 수 있다"는 안내가 붙어 있는데, 이 변경은 WebGPURenderer 전용이라 이 프로젝트(WebGLRenderer 기반)에는 해당하지 않는다. r180-181 구간에서는 WebGPURenderer 의 renderAsync, computeAsync 등 비동기 메서드 이름이 정리(deprecate)됐다.

WebGPURenderer 로 옮길 가치가 있는가는 이 조사에서 가장 불확실한 항목이다. 검색 상위에 뜬 일부 블로그(utsubo.com, svilenkovic.com, appscale.blog, altersquare.io, vr.org 등)는 "r171 부터 WebGPU 가 production-ready", "2026년 1월 WebGPU 가 baseline"처럼 구체적인 날짜와 버전을 단정적으로 제시하지만, 출처가 마케팅 성격의 2차 콘텐츠라 신뢰도가 낮고 공식 changelog 로 교차 확인되지 않았다. 이 부분은 미검증으로 남긴다.

확인 가능한 사실만 놓고 보면, react-three-fiber 의 Canvas 는 기본으로 WebGLRenderer 를 만든다. WebGPURenderer 를 쓰려면 gl prop 에 비동기 초기화 함수를 직접 넘겨야 하고, 공식 문서 기준으로 이 설정 자체가 아직 손이 많이 간다는 이슈가 남아 있다(WebGPURenderer 와 pointLight 조합 버그 등). r3f v10 부터 renderer prop 으로 더 쉽게 WebGPU 를 켤 수 있게 될 예정이라는 언급이 있으나 이 프로젝트가 쓰는 v9.5 기준으로는 해당하지 않는다. WebGPURenderer 는 WebGPU 미지원 환경에서 WebGL2 로 자동 폴백하지만, 이 프로젝트가 신경 쓰는 소프트웨어 GL, 오래된 통합 GPU 환경일수록 WebGPU 경로 자체가 더 불안정할 위험이 있다. shadow, material, cockpit 렌더 타깃 코드를 전부 다시 검증해야 하는 비용도 크다.

이번 조사에서 찾은 on-foot 모드 stutter 후보(6절 셰이더 컴파일, 5절 React 리렌더, 8절 텍스처 갱신 빈도)는 모두 렌더러 종류와 무관한 원인이다. 지금 시점에 WebGPURenderer 로 옮기는 것은 우선순위가 아니라고 판단한다.

출처
- https://github.com/mrdoob/three.js/wiki/Migration-Guide
- https://github.com/mrdoob/three.js/releases/tag/r182
- https://github.com/pmndrs/react-three-fiber/issues/2853
- https://threejs.org/docs/pages/WebGLRenderer.html (compileAsync 문서에 언급된 KHR_parallel_shader_compile)

## 이 프로젝트에 적용할 우선순위

1. `src/world/WalkMode.jsx` Blasts 컴포넌트의 setLive 를 ref 기반 mutate 로 바꿔, blast 가 살아있는 동안 매 프레임 일어나는 React 리렌더를 없앤다. on-foot stutter 의 가장 유력한 원인이고 비용은 낮다.
2. 무기별 muzzle flash, blast, tracer material 을 월드 진입 로딩 단계에서 renderer.compileAsync 로 미리 컴파일해, 첫 발사 시 셰이더 컴파일 히치를 없앤다.
3. `src/world/cockpits/FighterHud.jsx` 의 텍스처 갱신을 매 프레임에서 30Hz 안팎으로 throttle 해 texImage2D 업로드 횟수를 줄인다.
4. renderer.info 와 dev 전용 r3f-perf 패널을 붙여 draw call, 삼각형, 프로그램 수를 실측하고 이번 조사의 추정을 검증한다.
5. drei PerformanceMonitor 로 실측 fps 를 모니터링해 통합 GPU, 소프트웨어 GL 환경에서 quality 등급을 자동으로 한 단계 낮추는 안전망을 추가한다.
6. Chrome DevTools Performance 패널로 on-foot 모드에서 Long Task 구간을 프로파일링해 1, 2, 3번 가설을 실제 스택트레이스로 확인한다.
7. 항공기(airTraffic.js)나 아직 타일화되지 않은 배치가 있는지 확인해, 있다면 cityTiles.js 와 같은 방식으로 공간 타일 단위 InstancedMesh 로 쪼갠다.
8. instanceMatrix 갱신 빈도가 높은 InstancedMesh(차량 등)에 setUsage(DynamicDrawUsage) 가 적용돼 있는지 점검한다.
9. BatchedMesh, THREE.LOD, three-mesh-bvh, WebGPURenderer 도입은 지금 구조가 이미 대체 기법을 손으로 구현해 둔 상태라 우선순위를 낮춘다.
10. shadow, CSM 관련 추가 투자는 지금도 프러스텀 피팅과 autoUpdate 제어가 돼 있어 보류하고, 다른 항목에서 실측 결과가 나온 뒤 재검토한다.
