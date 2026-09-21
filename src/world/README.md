# 오픈월드 모델링 유지보수

목표는 **정교한 미니어처 도시**다. 모델은 절차적으로 생성하는 Three geometry이며 외부 GLB 파일이 원본이 아니다. 이 문서와 `AGENTS.md`는 Git 추적 대상이다. 저장소에서 무시되는 `CLAUDE.md`나 `docs/`에만 중요한 규칙을 남기지 않는다.

## 모듈과 책임

| 원본 | 역할 | 수정 시 주의 |
| --- | --- | --- |
| `../../shared/worldLayout.js` | 인원별 도시 크기, 지구별 블록 주소, 티어 혼합, ELO 높이 | 서버와 개발 서버의 공통 배치 규칙 |
| `../../shared/urbanPlan.js` | 7개 지구, 여백 간선 3, 외곽 순환로, 강변 집산로, 공항로, 나들목과 램프, 강·다리·공원·광장·랜드마크의 단일 그래프 | 장면·교통·미니맵이 함께 읽음 |
| `../../shared/nature.js` | 자연지대 사분원 4개, 연못 목록, inNature(), inPond() | 배치에서 건물 제외 |
| `../../shared/transit.js` | 나들목, 분기점, 로터리 목록 | urbanPlan 과 함께 사용 |
| `src/world/roadFurniture.js` | 가로등, 가로수, 가드레일 배치 생성 | 간격표는 문서와 한 곳 |
| `src/world/models/airportLayout.js` | 공항 시설 좌표와 충돌 상자, carSpawn, walkSpawn | 모든 공항 배치의 단일 출처 |
| `UrbanScenery.js` | 도시 그래프를 인스턴스 지형·도로·공원·공공건물로 변환 | 배치 좌표를 이 파일에서 다시 만들지 않음 |
| `cityModels.js` | 7개 티어 × 3종 건물의 순수 배치 데이터 생성, 색·품질 예산 | Three/React/네트워크에 의존하지 않음 |
| `civicModels.js` | 은행·경찰서·공원·광장 장식 배치 | 생성기의 공공 부지 예약과 일치시킬 것 |
| `models/Jet.jsx` | 작은 제트의 유일한 시각 원본 | 주차·조종·멀티플레이가 모두 사용 |
| `models/Fighter.jsx`, `models/Helicopter.jsx` | 조종사가 고르는 전투기, 헬기 실루엣 | Jet 과 같은 원점, 축, 접지면 -1.9 를 지킬 것. 헬기만 로터를 스스로 돌린다 |
| `models/Bomber.jsx` | 폭격기 실루엣과 폭탄창 문 | bay 0~1 로 문이 열린다. 투하 판정은 `weapons.js` 가 한다 |
| `models/Interceptor.jsx` | Me 262 형태의 요격기 | 연료와 부스트를 쓰는 유일한 기종이다. 부스트 단계가 둘이고 Q 로 바꾼다. 기관포는 기수에 모여 있다 |
| `models/PropFighter.jsx` | 프로펠러 전투기 실루엣 | 프로펠러는 throttle 로 돌고 빠를수록 원판이 진해진다. 기관총만 단다 |
| `models/PlaneModel.jsx` | 기체 키 하나를 모델 하나로 잇는 선택기 | 주차, 조종, 원격 기체가 모두 이곳을 거친다. 스로틀, 단계, 폭탄창은 `glowRef` 하나로 받는다. 정적 부품은 `StaticBatch` 로 묶고 프로펠러와 로터, 폭탄창 문만 dynamic 이다 |
| `models/Sedan.jsx`, `models/Suv.jsx`, `models/Convertible.jsx`, `models/Truck.jsx` | 승용차 계열 시각 원본 | 바퀴와 측면 실루엣 헬퍼는 `models/carParts.jsx`, `models/carGeometry.js` 를 함께 쓴다. 원점, 축, 접지면 -0.9 는 Sedan 과 같다 |
| `cockpits/Mirrors.jsx` / `cockpits/mirrorLayout.js` | 승용차 1인칭의 룸미러와 사이드미러 | 가상 거울이다. 카메라의 자식으로 화면 위쪽에 평평하게 붙고 깊이 검사를 꺼 실내 위에 그린다. 뒤 카메라 한 대를 낮은 해상도 render target 에 몇 프레임에 한 번 그리고 거울 셋이 한 장을 나눠 쓴다. 그림자 맵은 다시 만들지 않는다. 품질별 해상도와 주기는 `MIRROR_PASS` 다. 그리는 프레임은 `mirrorSchedule` 이 정하고 그동안 도시는 `cityLod` 로 먼 단계에 둔다 |
| `identity.js` | 닉네임 정리, 기체 키 목록, 로컬 저장 | 화면 표시와 Presence 검증이 같은 함수를 쓴다 |
| `hardpoints.js` | 기종별 엔진 노즐, 전투기 총구와 파일런 좌표 | 모델의 노즐이나 파일런을 옮기면 같이 옮긴다 |
| `autopilot.js` | 자동 비행. 외곽 순항 후 활주로 정렬과 착륙까지 조종 입력을 만든다 | 순수 함수다. 공항 건물 위치가 바뀌면 진입 경로를 다시 확인한다 |
| `rotorPhysics.js` | 헬기 비행 물리. 고정익과 상태 모양은 같고 양력만 로터에서 나온다 | 활주로 밖 평지에도 착지한다. 경착륙은 추락이다 |
| `weapons.js` | 발사체와 폭발의 순수 시뮬레이션 | Three, React, 네트워크에 의존하지 않는다. 건물은 부서지지 않는다. 기관총은 기종별 표(`gunOf`), 폭탄은 폭탄창이 다 열려야 나간다 |
| `groundWeapons.js` | 전차·자주포·APC 포탑 조준, 포탄·AI 차량 명중 판정 | Three/React와 분리된 순수 시뮬레이션 |
| `CarMode.jsx` / `carPhysics.js` | 지상 차량 조작·카메라·효과 / 주행·충돌 물리 | 전투 차량의 마우스 조준과 좌클릭/Space 발사를 연결 |
| `models/EngineGlow.jsx` | 기종별 배기와 애프터버너 | 스로틀은 `glowRef` 로 매 프레임 읽는다. 값이 바뀌어도 React 렌더가 돌지 않는다 |
| `models/Projectiles.jsx`, `models/Blast.jsx` | 예광탄, 미사일, 폭발 렌더링 | 월드 좌표를 그대로 받는다. 나이는 부모가 넘긴 `age` 이거나 `ageOf()` 로 매 프레임 스스로 읽는다. 추락 폭발도 같은 Blast 의 crash 종류다 |
| `models/Airport.jsx` | 활주로·격납고·관제탑·주차 기체 | 조작 및 충돌 로직을 소유하지 않음 |
| `models/ModelBlock.jsx` | 공항/제트용 단위 박스 | 도시 대량 배치의 instancing과 별도 경로 |
| `Ocean.jsx` | 해안 단면·바다·물고기·상어 | 수면과 공항 바닥 높이 확인 |
| `SkyEffects.jsx` | 태양·달·별·구름 | 천체는 카메라 추종, 구름은 도시 좌표 |
| `WorldScene.jsx` | 공유 리소스, 인스턴싱, 장면 조합, 정적 그림자 caster | 도로와 지형 생성은 `UrbanScenery` 에 위임한다. 본 화면 배치는 그림자를 던지지 않고 `ShadowCasters` 가 대신 던진다 |
| `traffic.js` / `TrafficCars.jsx` | AI 차량의 결정적 위치 계산 / instancing 렌더 | 위치는 (차 번호, 시간, 도시 크기) 의 순수 함수다. 차 수에 기대지 않는다. 렌더는 `trafficFrame` 한 벌을 읽는다 |
| `solidIndex.js` | 건물과 구조물 선분 충돌의 단일 출처 | 도보, 차량, 비행, 포탄, 조준 미리보기가 모두 `hitsAnyBuilding` 을 쓴다. 배열마다 격자를 캐시한다 |
| `staticBatch.js` / `StaticBatch.jsx` | 움직이지 않는 자식 mesh 를 재질별로 한 geometry 로 합친다 | 움직이는 가지는 `userData={{ dynamic: true }}` 로 빼 둔다. 합친 뒤의 재질 속성 변경은 반영되지 않는다 |
| `ShaderPrewarm.jsx` | 나중에 쓸 셰이더 프로그램을 한가할 때 미리 컴파일 | 조명 개수와 톤매핑이 프로그램 키라서 실내, 총, 폭발, 거울 조합을 미리 만든다. 탈것을 고르면 멈춘다 |
| `AdaptiveResolution.jsx` / `adaptiveResolution.js` | 렌더 해상도(dpr) 조절 껍데기 / 순수 판정 | 판정은 최근 3초에 33ms 를 넘긴 프레임의 비율로 한다. 품질 등급의 dpr 이 위 한도, 그 0.75 배가 아래 한도다. 한 번 바꾸면 8초, 세션당 3회까지다. 내림이 효과가 없으면 되돌리고 고정한다. dpr 의 주인은 이 컴포넌트이며 `Canvas` 는 `dpr={null}` 이다 |
| `mirrorSchedule.js` | 거울 패스와 그림자 caster 재구성을 다른 프레임에 둔다 | `worldFrame` 이 시각당 한 번 오르는 공용 번호를 준다. 두 판정이 같은 프레임에 겹치지 않는 것을 테스트가 묶는다 |
| `cityLod.js` | 거울 패스 동안 도시 상세 단계를 통째로 내린다 | `CityTiles` 하나가 등록하고 `Mirrors` 가 패스 앞뒤로 부른다. 패스가 끝나면 반드시 null 로 푼다 |
| `labelCandidates.js` | 제작자 라벨 후보 선정의 순수 함수 | 거리, 화면 밖, 가림, 상한, 선택 우선 규칙이 모두 여기 있다. `NearbyCreators` 는 좌표 변환만 넘긴다 |
| `rideStatusStore.js` | 탈것 상태를 React state 밖에 두는 외부 store | HUD 만 구독한다. 이 값을 페이지 state 로 들면 도시 전체가 초당 여덟 번 재조정된다 |
| `FlightMode.jsx` / `flightPhysics.js` | 로컬 조작·카메라·폭발 / 순수 비행 물리 | 모델 수정과 분리. 항력은 속도 제곱, 양력은 실속 속도 33 기준, 선회율은 속도에 반비례한다. 받음각이 `STALL_AOA` 0.36 을 넘으면 실속이고 기수각은 ±1.15 까지 꺾인다 |
| `RemoteActors.jsx` / `multiplayer.js` | 상대 항공기와 차량 보간, 통신과 접속 상태 | 동일한 `PlaneModel`, `VehicleModel` 사용, 상대끼리 물리 충돌 없음. 상대 차량은 `wheelsRef` 없이 prop 으로만 받는다 |
| `RemoteCombat.jsx` / `remoteCombat.js` | 상대 발사의 예광과 폭발 렌더, 순수 탄도와 피탄 판정 | 누적 발사 수만 받아 탄도를 각 브라우저가 다시 계산한다. 피해 판정은 맞는 쪽만 한다 |
| `health.js` | 전투 탈것의 체력, 피해, 수리 | 표에 없는 탈것은 내구도 0 이고 어떤 무기로도 부서지지 않는다 |
| `cockpits/instruments.js` | 계기 화면과 전투기 HUD 의 그림, 판독값 | 순수 함수다. 없는 값은 지어내지 않고 `—` 로 적는다. 단위 변환은 여기 한 곳이다 |
| `cockpits/InstrumentDisplay.jsx` / `cockpits/FighterHud.jsx` | 캔버스 텍스처 계기판 / 전투기 combiner HUD | 화면 한 장은 평면 하나와 베젤 하나다. 둘 다 ref 를 읽어 값이 바뀔 때만 다시 그린다. HUD 는 30Hz 다 |
| `cockpits/index.jsx` / `cockpits/parts.jsx` | 탈것 키 하나를 실내 하나로 잇는 선택기 / 실내 공용 조각 | `Cockpit` 은 `statusRef`, `controlsRef`, `aimRef` 를 받고 실내 전체를 `StaticBatch` 로 감싼다. `Dial`, `Yoke`, `Stick`, `Lever` 는 값 대신 `get()` 콜백을 받아 매 프레임 스스로 읽는다 |
| `models/VehicleModel.jsx` | 차종 키 하나를 모델 하나로 잇는 선택기 | 조향과 속도는 `wheelsRef` 로 매 프레임 읽는다. 정적 부품은 `StaticBatch` 로 묶고 바퀴, 조향부, 포탑만 dynamic 이다 |
| `carPhysics.js` / `carGauges.js` / `ui/CarGauges.jsx` | 차량별 자동변속 상태 / 3인칭 속도계와 회전계 계산 / SVG 계기 | 차량마다 `gears` 비율과 실제 `gear`·`rpm` 상태를 쓴다. 실내 RPM 다이얼의 레드존은 `REDLINE_RPM`과 같다 |
| `WalkMode.jsx` / `walkPhysics.js` | 1인칭 도보 조작, 카메라, 손전등 / 이동, 사격, 체력의 순수 규칙 | 좌클릭 사격, 우클릭 정조준, Space 점프, Q/C 피킹, E 손전등, 1~5 무기다. 목표와 위협은 모두 AI 차량이다. 총 자세는 `live` ref 로 매 프레임 읽는다 |
| `ui/WalkHud.jsx` / `ui/FpsCrosshair.jsx` | 도보 HUD(체력·무기·능력·잔탄) 와 조준선·조준경 | 오버워치 배치다. 숫자는 WalkMode 가 보내는 상태에서만 온다. 조준선 벌어짐은 `crosshairSpread` 가 정한다 |
| `sound.js` / `soundLimits.js` | 총성, 폭발, 기계음 / 겹침 규칙 | WebAudio 로 그때그때 만든다. 음원 파일을 두지 않고 없는 환경에서는 조용히 지나간다. 일회성 효과음은 리미터가 걸린 효과음 버스 하나로 모이고 엔진은 그 버스를 타지 않는다. 같은 소리를 아주 짧은 간격에 여러 번 부르면 `soundLimits` 가 하나로 합치고 동시 발성 수를 제한한다 |
| `reticle.js` / `ui/Reticle.jsx` / `models/AimMarker.jsx` | 탄도 조준 계산, DOM 조준선, 월드 탄착 표식 | 발사와 같은 상수와 같은 포구를 읽어 미리 굴려만 본다. 조준선은 기종마다 다르다 |
| `eyePoints.js` | 1인칭 눈높이, 탈것별 화각, 근접면 | 1인칭은 near 0.05 다. 0.5 면 조준경과 스티어링 휠이 잘린다 |
| `models/Tracers.jsx` | 내 포탄과 상대 포탄의 예광 | ref 를 매 프레임 읽는 instancedMesh 둘. 상태로 올리지 않는다 |

`WorldScene.jsx`의 지형·차량은 아직 내부 함수다. 전용 모델/리소스 파일로 더 분리할 여지는 있지만, 역할별 함수와 아래 변경 경계는 유지한다. 모델 보호를 위해 모든 함수를 파일 하나씩으로 나눌 필요는 없다.

## 보존할 디자인

| 티어 | 구분되는 실루엣 | 강조색 |
| --- | --- | --- |
| 브론즈 | 벽돌 몸체, 박공지붕, 굴뚝 | `#C98B5E` |
| 실버 | 발코니가 있는 주거형 타워, 옥상 정원 | `#B8C0CC` |
| 골드 | 단계적으로 좁아지는 3단 건물 | `#E8C04A` |
| 플래티넘 | 비대칭 테라스와 녹화 단 | `#6FD3C8` |
| 다이아몬드 | 팔각 유리 몸체와 뾰족한 상부 | `#6AA8FF` |
| 마스터 | 높이가 다른 쌍둥이 타워와 연결부 | `#C58CFF` |
| 챔피언 | 높은 중앙 타워, 왕관 형태의 여러 첨탑 | `#FF6B5B` |

모든 티어는 7개 지구에 섞인다. 중앙 지구는 평균 높이를 높여 읽기 쉬운 스카이라인을 만들지만 특정 티어를 한 구역에 가두지 않는다. 건물은 지구 회전을 적용한 4필지 블록으로 모이며 간선은 지구 사이 여백에만 곧게 놓이고 구조물은 도로가 만나는 자리에서 파생된다. 막다른 골목은 유지한다. `height`는 이미 ELO 변동과 티어 배율이 적용된 값이므로 모델에서 다시 곱하지 않는다.

## 배치·좌표·리소스 계약

- 도시 평면은 X/Z, 위쪽은 +Y. 기본 지면 상단은 Y=0. 숫자는 미니어처 도시의 월드 단위다.
- `createBatches().add(material, position, scale, owner, shape, rotation, color)`는 데이터를 추가할 뿐 GPU 객체를 생성하지 않는다. position은 월드 중심 좌표다. rotation은 보통 Y축 라디안이고 경사 구조물은 `[pitch, yaw, roll]` 배열을 쓴다. scale은 primitive의 배율이다. 박스/평면은 단위 폭이지만 원기둥·원뿔 등은 단위 반지름이므로 scale을 모두 외곽 치수로 해석하지 않는다.
- shape/material은 `WorldScene.useResources()`에 존재해야 한다. 새로운 키를 추가할 때 geometry/material 등록도 함께 한다.
- `owner`는 제작자 ID다. 시각 배치와 별도로 한 제작자당 단순한 picking box를 사용한다. 건물 클릭이 잘 된다고 모든 장식 mesh를 클릭 대상으로 바꾸지 않는다.
- 건물 함수의 `part()`는 지역 X/Z의 폭·깊이 차이와 회전을 적용하고 Y에 0.5를 더한다. 이 보정을 중복 적용하지 않는다.
- 창문은 얇은 박스가 아닌 `pane` 평면이다. 앞/뒤/옆 방향 회전은 단면 재질에서 창문이 보이게 하는 데 필요하다.
- 도시 공유 geometry/material은 `useResources()`가 만들고 해제한다. 인스턴스는 `dispose={null}`로 개별 해제를 막는다. 한 건물의 제거가 다른 건물의 공유 리소스를 파괴해서는 안 된다.
- Jet의 직접 만든 날개 geometry는 해당 Jet가 해제한다. JSX geometry는 React Three Fiber가 관리한다. 프레임마다 geometry/material을 새로 만들지 않는다.
- Jet 로컬 원점은 동체 중심, 코는 -Z, 날개는 X 방향이다. 부모가 위치와 YXZ 자세를 적용한다. 바퀴 하단 약 -1.9와 `FLIGHT_GROUND=2.1`이 활주로 착지 높이를 맞춘다.

## 함께 확인할 변경 지점

| 바꾸는 항목 | 함께 확인할 곳 |
| --- | --- |
| 필지 간격·도로·강·골목 | `urbanPlan`, `buildWorld`, `UrbanScenery`, `traffic`, `carPhysics`, `Map`, 배치 테스트, `shared/transit` |
| 건물 높이·외곽 크기 | `buildArchitecture`, `City` picking box, `NearbyLabels`, `focusPose`, `hitsBuilding` |
| 은행/경찰서/공원 위치 | `urbanPlan.landmarks`, `UrbanScenery`, `buildWorld`의 제외 반경, `Map`, `src/world/models/airportLayout` |
| 공항 위치·활주로 길이/폭 | `src/world/models/airportLayout`, `Airport`, `createFlightState`, `onRunway`, `FlightMode` 장애물, `Ocean` 공항 해안, `Map`, `getWorldBounds`, `carPhysics.inWater`, `controls.boundedTarget` |
| 나들목과 램프 | `shared/urbanPlan.rampAlignment`·`portalAlignment` 가 내는 `ramp.points` 하나가 메시, `roadSurface`, 가드레일, 교각, `roadIndex` 를 모두 먹인다. `shared/transit.interchanges`, `roadStructures.addRamp`, `UrbanScenery`, 배치 테스트 |
| 자연지대와 연못 | `shared/nature.js`, `UrbanScenery` 지형, `carPhysics.inWater`, `Map`, worldLayout 제외 |
| 가로 시설 | `roadFurniture` 간격표, `UrbanScenery` 부품 추가, 품질별 예산 |
| 비행기 원점·축·크기 | `Jet`, 주차 위치, `FLIGHT_GROUND`, 충돌 여유, `FlightMode`·`RemoteActors` 자세 |
| 차량 실루엣 크기 | `VEHICLES.width`, `VEHICLES.depth`, `vehicleBox`, `remoteCombat` 피탄 판정 |
| 차선 도색과 차선 수 | `roadStructures.LANE_PLAN`, `MARKING`, `UrbanScenery` 도로 루프, `PALETTE.centerline` |
| AI 차량 조각 구성 | `TrafficCars.CAR_PARTS`, `trafficPose` 의 width/depth, `traffic.TRAFFIC_BODY` 의 바닥과 전고, `QUALITY.cars` 와 draw call 예산 |
| AI 차량 속도와 간격 | `traffic.TRAFFIC_SPEED`, `TRAFFIC_GAP`, 곡률과 교차로 감속 상수, traffic 단위 테스트의 겹침과 순간이동 검사 |
| 그림자 caster | `cityTiles.buildCasterIndex` 와 `selectCasterCells`, `WorldScene.ShadowCasters`, `SunLight` 의 절두체 기록 |
| 미리 컴파일 대상 | `ShaderPrewarm` 의 조명 조합과 묶음 목록, 새로 추가한 실내나 무기의 재질 위치 |
| AI 항공기 궤도와 격추 | `airTraffic.js` 의 `SPEC`, `AIR_HITS`, `QUALITY.aircraft`, `AirTraffic.jsx`, `weapons.stepWeapons` 의 `airTargets`, air-traffic 단위 테스트 |
| 엔진 음색 | `engineSound.ENGINES` 의 harmonics/sub/airHz 와 `engineTargets`, `FlightMode`/`CarMode` 의 voice 수명, engine-sound 단위 테스트 |
| 폭발음 겹침 | `sound.effectOut`, `soundLimits.VOICE_RULES`, `engineSound` 의 `engineOut`, sound-limits 단위 테스트 |
| 항공 무장의 지상 판정 | `weapons.stepWeapons` 의 traffic 과 hits, `FlightMode` 의 GROUND_STRAFE_*, `carPhysics.hitsVehicle` |
| 공중 충돌 | `airTraffic.collidesWith`, `downAirTraffic`, `FlightMode` 의 SELF_RADIUS 와 peersRef |
| 포탄 낙차 | `groundWeapons.GROUND_GUNS.<기종>.gravity` 와 `shellGravity`, `stepGroundWeapons`, `reticle.groundImpact` 와 `dropLadder` |
| 명중 표시 | `sound.playTick`, `ui/HitMarker` 의 흰 명중과 빨간 격추 표식, `ui/Reticle` 과 `ui/FpsCrosshair` 의 소비, `FlightMode`/`CarMode`/`WalkMode` 의 airHits 와 kills 카운터 |
| 탄의 차량 명중 | `carPhysics.hitsVehicle`(x, y, z 3축 슬랩) 과 `VEHICLE_LIFT`, `traffic.TRAFFIC_BODY`, `weapons`/`groundWeapons` 의 traffic 판정, `remoteCombat.hitsSelf` 의 내 차 상자 |
| 앞바퀴 조향 방향 | `models/carGeometry.steerAngle` 한 곳이 부호를 정한다. 바퀴 group 을 가진 모델 일곱과 `steering` 단위 테스트 |
| 조준선 자리 | `aimScreen.projectAim`, `aimScreenStore`, `CarMode`/`FlightMode` 의 매 프레임 기록, `ui/Reticle` 의 rAF 루프와 `.wui-reticle` transform |
| 제작자 라벨 거리 | `creatorProximity.labelReach` 와 `LABEL_SCALE`, `NearbyCreators` 의 reachOf 와 distanceFactor, proximity 단위 테스트 |
| 도보 출발점과 벽 | `models/airportLayout.walkSpawn`, `walkPhysics.stepWalk` 의 축 분리 미끄러짐과 갇힘 탈출, walk 와 airport-layout 단위 테스트 |
| 포탑 조준 입력 | `groundWeapons.aimGroundWeapon`(마우스, 터치) 와 `aimKeyboard`(방향키), `AIM_LIMITS`, `CarMode` 의 pointer 처리 |
| 1인칭 총기 자세와 조준 | `weaponSights.js` 의 ANCHOR/SIGHT_POINT/HIP_REST, `models/WeaponView`, `ui/FpsCrosshair`, weapon-sights 단위 테스트 |
| 배율 조준경 | `eyePoints.COCKPIT_FOV.<기종>.scope`, `scopeFov`, `nextScope`, `CarMode` 의 Z 키, `ui/Reticle` 배율 표시 |
| AI 항공기 렌더 예산 | `AirTraffic.MODEL_BUDGET`, `MODEL_RANGE`, `QUALITY.aircraft`, 1000명 브라우저 장면 |
| 계기 속도와 마하 | `flightPhysics.SPEED_DISPLAY`, `MACH_KMH`, `SUPERSONIC_BURN`, `ui/BoostOverlay`, `sound.playSonicBoom`, fuel 단위 테스트 |
| 수렴 사격 거리 | `hardpoints.ARMAMENT.<기종>.converge`, `weapons.muzzleAim`, `reticle.airImpact`, plane-tuning 단위 테스트 |
| 상승 한계 | `flightPhysics.CEILING`, `rotorPhysics` 천장, `flightStatus.altitude`, flight-guard 단위 테스트 |
| 항공기 최고 속도 | `PLANES.maxSpeed`, `rideSpecs` 카드 막대, `autopilot` 목표 속도, flight 단위 테스트 |
| 연료와 부스트 | `PLANES.boostSpeed`, `fuelSeconds`, `flightStatus.fuel`, `ui/SupplyNotice`, fuel 단위 테스트 |
| 부스트 단계(강화 부스트) | `PLANES.overdriveSpeed`(계기 km/h 를 `speedOf` 로 적는다), `overdriveThrust`(그 속도의 항력보다 커야 상한에 닿는다), `OVERDRIVE_BURN`, `FlightMode` 의 Q 토글과 Z 러더, `RideHud.fuelLabel`, `BoostOverlay` 배지, `ui/boostStages` 표와 `ui/BoostStages` 우하단 안내, fuel 단위 테스트 |
| 3인칭 추적 거리 | `FlightMode` 의 `CHASE_DISTANCE`, 기체 외곽 치수 |
| 차종 추가·삭제 | `identity.VEHICLE_META`, `VEHICLES`, `eyePoints`(축마다 값이 겹치면 안 된다), `engineSound.ENGINES`, `VehicleModel`, `cockpits/index`, `triangles.COCKPIT_PARTS`, `ui/rideArt`, `CarMode.LAMP_REACH`, 거울이 있으면 `mirrorLayout.REAR_CAMERA`, car·first-person·mirrors 단위 테스트 |
| 기종 추가·삭제 | `identity.PLANE_META`, `PLANES`, `planeDimensions`, `hardpoints`, `EngineGlow` 프리셋, `PlaneModel`, `eyePoints`, `cockpits/index`, `triangles.COCKPIT_PARTS`, `ui/rideArt`, `reticle.RETICLE`, `health`, 관련 단위 테스트 |
| 포구 위치와 포 속도 | `GROUND_GUNS` 의 `turret`, `pivot`, `reach`(모델의 포탑 group, 포신 group, 포구 mesh 와 같은 값), `muzzlePoint`, `remoteCombat` 예광 시작점, `Tracers.SHELL_SCALE`, muzzle 단위 테스트 |
| 체력과 피해 수치 | `health.js` 의 `HULL`, `DAMAGE`, `RideHud` 차체 게이지, `health` 단위 테스트 |
| 실내 계기 배치 | `cockpits/AircraftCockpits`, `cockpits/VehicleInteriors`(실내 전체 조각은 `cabin`, 운전자 앞 조각은 `at`), `eyePoints`, `CarMode`의 외장 표시 조건, `triangles.js`의 `COCKPIT_PARTS`, 콕핏 예산 테스트 |
| 3인칭 카메라 거리와 각 | `CarMode` 의 `CHASE`, 휠 범위, `ui/CarGauges` 자리와 미니맵 위치 |
| 도보 무기와 이동 수치 | `walkPhysics.js` 의 `WALK_WEAPONS`(pellets, tube 포함), 정조준과 지구력과 점프 상수, `ui/WalkHud` 표시, `ui/FpsCrosshair` 조준선, `sound.js` 음색, walk 단위 테스트 |
| pose payload 필드 | `validPose`, `FlightMode` 와 `CarMode` 의 `onPose`, `RemoteActors`, `remoteCombat` |
| 지형/수면 높이 | `UrbanScenery`, `Ocean`, `flightPhysics` 지상 충돌 |
| GPU 품질 예산 | `QUALITY`, `useResources`, `Cars`, `Ocean`, `SkyEffects`, 단위 테스트와 1000명 브라우저 장면 |

공항은 X=`extent+110`, 활주로 시각 치수는 28×540, 착륙 판정은 중심에서 X ±13, Z ±270이다. 유도로 자리를 내려고 터미널 단지를 활주로에서 20 더 서쪽에 두었고 공항 땅은 서쪽으로 160, 동쪽으로 70 이다(`airportLayout.AIRPORT_GROUND`). 차량과 도보는 동쪽 공항 터미널 앞에서 출발한다. 공항로는 동쪽에만 있고 Z=30 에서 둑(`CAUSEWAY`) 을 건너 외곽 순환로에 T 자로 붙는다. 서쪽 공항은 해변과 강 하구가 막고 있어 도로가 없다. 물은 Y=-2.8이다. 현재 충돌은 단순화된 상자와 지상 평면을 사용하며 실제 지붕·언덕·날개 형상을 정밀하게 따라가지 않는다. 이 차이를 모르고 시각 모델의 크기만 바꾸면 충돌과 화면이 어긋날 수 있다.

## 확인 방법과 한계

성능은 `0920-plan/perf` 의 하네스로 잰다. minify 를 끈 production 빌드를 따로 만들어 장면별 fps, 프레임 분위수, draw call, 삼각형, 셰이더 link, React commit 수, CPU profile 을 뽑는다. 개선 전후는 `compare.sh` 로 같은 시간대에 번갈아 재고, 다른 브라우저가 GPU 를 함께 쓰면 결과가 열 배까지 틀리므로 `foreignGpuPct` 가 0 인 표본만 쓴다.

저장소 루트에서 실행한다.

```sh
npm run test:world:unit
npx eslint src/world src/routes/WorldPage.jsx shared/worldLayout.js
npm run build
npm run test:world
# 실제 Supabase 두 클라이언트: 로컬 설정 및 네트워크 필요
WORLD_REALTIME_TEST=1 npm run test:world
```

필요하면 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`을 설정한다. 미리보기 테스트는 빌드 산출물을 쓰므로 코드 변경 뒤 먼저 빌드한다.

단위 테스트는 배치 결정성, 도로/강/공공 부지 예약, 높은 랜드마크, 창문 geometry 예산, 카메라·비행·통신 규칙을 확인한다. 브라우저 테스트는 갤러리·선택·모바일·비행·멀티플레이를 확인한다. **모든 실루엣과 재질의 픽셀 스냅샷을 강제하는 테스트는 아니다.** 모델 모양을 바꿀 때는 21종 건물 컬렉션, 높은 마스터/챔피언, 주차/비행/상대 Jet, 모바일 화면을 직접 비교한다. 테스트를 통과했다는 이유만으로 시각적 훼손이 없다고 단정하지 않는다.

## 세부 등급 모델·계절·셰이더

- `modelVariant.js`: 기존 `getCreatorTier` 계산을 재사용한다. I/II는 모델 0, III는 1, IV는 2. API 캐시의 티어/점수가 맞지 않거나 점수가 없으면 ID로 결정적인 대체 모델을 고른다. 컬렉션의 `model_variant`는 21종을 모두 비교하기 위한 명시적 선택이다.
- 모델 0은 위 티어별 기본 실루엣이다. 나머지 모델(브론즈, 실버, 골드 7종씩, 플래티넘부터 챔피언까지 5종씩, 그랜드마스터는 마스터와 공유, 모두 41종)은 `models/tierBuildings.js`의 같은 `MODELS` 표에서 같은 `part()` 변환과 instancing 경로로 생성한다. 건물 종류를 추가할 때 모델마다 ELO 높이 배율을 다시 적용하지 않는다.
- `season.js`: `Asia/Seoul` 날짜로 나무·지면·대기 팔레트를 매일 보간한다. 9월은 초가을로 표시하며 9월 12일 기준 팔레트는 녹색과 누런 녹색이 섞인 분위기다. 특정 연도에 고정하지 않으며 KST 자정 경계를 테스트한다. 실제 날씨/천문 관측 자료는 아니다.
- `shaders/atmosphere.js`: 태양 원반·주변 산란·수평선 노을·달 표면을 그린다. 일출은 +X(동쪽), 노을은 -X(서쪽), 도시 directionalLight와 같은 광원 방향을 사용한다.
- `shaders/surfaces.js`: 기존 MeshStandardMaterial의 조명/그림자를 유지하면서 석재 입자감·유리 창살/반사·수면 normal 물결을 추가한다. Three r182의 shader chunk에 연결되므로 버전 변경 시 실제 브라우저의 shader compilation 오류를 검사한다.
- `NearbyCreators.jsx` / `creatorProximity.js`: 비행기는 건물 체적과의 거리로 카드 투명도를 계산한다. 비행 중 최대 3장, 일반 탐색 최대 6장. 카메라만 돌려도 거리가 바뀐 것으로 계산하지 않는다. 카드의 pointer-events는 꺼서 비행 조작을 방해하지 않는다.

### 1인칭 실내 시야

항공기 캐노피는 앞유리 가장자리의 가는 기둥과 상부 프레임으로 구성한다. 기둥의 깊이를 실내 길이만큼 늘리면 측면 벽이 되어 시야를 가리므로 단면 두께를 유지한다. 계기판은 눈높이 아래에 두고 아날로그 계기와 화면의 투영 영역이 겹치지 않게 배치한다. 세단도 1인칭에서는 전용 실내를 사용하며 외장 차체는 숨긴다. 오토바이는 개방형 외장을 유지한다.
