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
| `models/riverfront.js` | `plan.riverfront`의 보행 표면을 공유 삼각형 메시로 바꾸고 공원·문화홀·정자 장식을 인스턴싱 | 부지·경로·충돌 좌표를 여기서 다시 생성하지 않음 |
| `cityModels.js` | 7개 티어 × 3종 건물의 순수 배치 데이터 생성, 색·품질 예산 | Three/React/네트워크에 의존하지 않음 |
| `civicModels.js` | 은행·경찰서·공원·광장 장식 배치 | 생성기의 공공 부지 예약과 일치시킬 것 |
| `models/Jet.jsx` | 작은 제트의 유일한 시각 원본 | 주차·AI 항공기·기존 원격 기체가 사용. 플레이어 선택 목록에는 없음 |
| `models/Fighter.jsx`, `models/Helicopter.jsx` | 조종사가 고르는 전투기, 헬기 실루엣 | Jet 과 같은 원점, 축, 접지면 -1.9 를 지킬 것. 헬기만 로터를 스스로 돌린다 |
| `models/Bomber.jsx` | 폭격기 실루엣과 폭탄창 문 | bay 0~1 로 문이 열린다. 투하 판정은 `weapons.js` 가 한다 |
| `models/Interceptor.jsx` | Me 262 형태의 요격기 | 연료와 부스트를 쓰는 유일한 기종이다. 부스트 단계가 둘이고 Q 로 바꾼다. 기관포는 기수에 모여 있다 |
| `models/PropFighter.jsx` | 프로펠러 전투기 실루엣 | 프로펠러는 throttle 로 돌고 빠를수록 원판이 진해진다. 기관총만 단다 |
| `models/PlaneModel.jsx` | 기체 키 하나를 모델 하나로 잇는 선택기 | 주차, 조종, 원격 기체가 모두 이곳을 거친다. 스로틀, 단계, 폭탄창은 `glowRef` 하나로 받는다. 정적 부품은 `StaticBatch` 로 묶고 프로펠러와 로터, 폭탄창 문만 dynamic 이다 |
| `models/Sedan.jsx`, `models/Suv.jsx`, `models/Convertible.jsx`, `models/Truck.jsx` | 승용차 계열 시각 원본 | 바퀴와 측면 실루엣 헬퍼는 `models/carParts.jsx`, `models/carGeometry.js` 를 함께 쓴다. 원점, 축, 접지면 -0.9 는 Sedan 과 같다 |
| `models/fourVehicleLayout.js`, `models/FourVehicleParts.jsx` | M4 컨버터블·CLS 쿠페·849 슈퍼카·모델 S의 공통 절대 좌표와 바퀴·좌석·핸들·유리 | 차체와 실내가 같은 좌석/눈/유리 앵커를 쓴다. 차종별 외장과 실내는 각각의 모델 및 Cabin 파일에 둔다 |
| `cockpits/ConvertibleCabin.jsx`, `CoupeCabin.jsx`, `SupercarCabin.jsx`, `ElectricCabin.jsx` | 네 승용차의 1인칭/외부 캐빈 원본 | 외장은 같은 컴포넌트를 `exterior`로 쓰고, 조향·계기 값은 ref에서 읽는다. 전기차 계기는 실제 구동/회생 값만 표시한다 |
| `cockpits/Mirrors.jsx` / `cockpits/mirrorLayout.js` | 승용차 1인칭의 룸미러와 사이드미러 | 가상 거울이다. 카메라의 자식으로 화면 위쪽에 평평하게 붙고 깊이 검사를 꺼 실내 위에 그린다. 뒤 카메라 한 대를 낮은 해상도 render target 에 몇 프레임에 한 번 그리고 거울 셋이 한 장을 나눠 쓴다. 그림자 맵은 다시 만들지 않는다. 품질별 해상도와 주기는 `MIRROR_PASS` 다. 그리는 프레임은 `mirrorSchedule` 이 정하고 그동안 도시는 `cityLod` 로 먼 단계에 둔다 |
| `identity.js` | 닉네임 정리, 전체 기체 키와 플레이어 선택 키, 로컬 저장 | `PLANE_KEYS`는 Jet을 포함해 씬·Presence 호환성을 유지하고 `SELECTABLE_PLANE_KEYS`는 Jet을 제외한다. 저장된 Jet 선택은 전투기로 바꾼다 |
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
| `RemoteActors.jsx` / `multiplayer.js` | 상대 항공기와 차량 보간, 통신과 접속 상태 | 동일한 `PlaneModel`, `VehicleModel` 사용, 상대끼리 물리 충돌 없음. 포즈는 50ms 마다 보내며 비행 속도도 검증해 전달한다. 상대 차량은 `wheelsRef` 없이 prop 으로만 받는다 |
| `RemoteCombat.jsx` / `remoteCombat.js` | 상대 발사의 예광과 폭발 렌더, 순수 탄도와 피탄 판정 | 누적 발사 수와 비행 속도로 탄도를 다시 계산한다. 피해 판정은 맞는 쪽이 하며, 공중 표적은 상대 이동을 포함한 선분으로 검사한다 |
| `worldScores.js` / `ui/WorldScoreboard.jsx` | 세션 점수 검증·순위, 피격 순서에 따른 치명타 소유자, 멀티 점수표 | 플레이어 처치는 피해자 life 확인을 거치며 PLAYER와 AI 소계를 따로 표시한다. 탈것 교체로 초기화하지 않는다 |
| `ActorLabels.jsx` / `actorLabels.js` | 실제 AI 교통 좌표의 고정 DOM 라벨 풀과 거리·화면 범위 제한 | 지상은 trafficFrame, 공중은 airTrafficPose를 읽는다. solidIndex 가림 판정, 16개 상한을 유지한다. PLAYER는 RemoteActors의 보간된 위치에 붙인다 |
| `health.js` | 전투 탈것의 체력, 피해, 수리 | 표에 없는 탈것은 내구도 0 이고 어떤 무기로도 부서지지 않는다 |
| `cockpits/instruments.js` | 계기 화면과 전투기 HUD 의 그림, 판독값 | 순수 함수다. 없는 값은 지어내지 않고 `—` 로 적는다. 단위 변환은 여기 한 곳이다 |
| `cockpits/InstrumentDisplay.jsx` / `cockpits/FighterHud.jsx` | 캔버스 텍스처 계기판 / 전투기 combiner HUD | 화면 한 장은 평면 하나와 베젤 하나다. 둘 다 ref 를 읽어 값이 바뀔 때만 다시 그린다. HUD 는 30Hz 다 |
| `cockpits/index.jsx` / `cockpits/parts.jsx` | 탈것 키 하나를 실내 하나로 잇는 선택기 / 실내 공용 조각 | `Cockpit` 은 `statusRef`, `controlsRef`, `aimRef` 를 받고 실내 전체를 `StaticBatch` 로 감싼다. `Dial`, `Yoke`, `Stick`, `Lever` 는 값 대신 `get()` 콜백을 받아 매 프레임 스스로 읽는다 |
| `models/VehicleModel.jsx` | 차종 키 하나를 모델 하나로 잇는 선택기 | 조향과 속도는 `wheelsRef` 로 매 프레임 읽는다. 정적 부품은 `StaticBatch` 로 묶고 바퀴, 조향부, 포탑만 dynamic 이다 |
| `carPhysics.js` / `carGauges.js` / `ui/CarGauges.jsx` | 차량별 자동변속 상태 / 3인칭 속도계와 회전계 계산 / SVG 계기 | 차량마다 `gears` 비율과 실제 `gear`·`rpm` 상태를 쓴다. 슈퍼카는 8단, 최고 8500 RPM, 레드존 8000 RPM, 10000 RPM 눈금이다 |
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

### 도로·교통 계약

- `shared/roadProfile.js`의 도로별 정책을 도색과 AI가 함께 읽는다. 큰길·고가는 왕복 6차선(편도 3차선)이며 `roadLaneLayout`이 중앙분리대와 가장자리 여유를 제외한 차선 중심·구분선 위치를 계산한다. low도 차선 수는 유지하고 점선만 단순화한다.
- AI 자유 주행 목표는 골목 20~30, 이면도로·집산로 35~50, 큰길 60~90, 고속도로 75~90km/h다. 시뮬레이션에는 m/s로 변환해 넣고 차량별 편차가 상한을 넘지 않게 한다. 곡선·유턴·교차로·양보 시에는 목표 범위 아래로 감속할 수 있다.
- 교량 도색은 넓어진 상판 폭이 아니라 원본 도로의 차도 폭·종류를 따른다. 교량이 접속부 도색까지 맡고 `UrbanScenery.roadMarkingSpans`가 겹치는 육상 도색을 제외한다. 난간·기단·조명은 접속 도로의 clearance를 지키며, 장식 조명에는 실제 Light를 추가하지 않는다.
- 도로 중심선과 높이의 원본은 `createUrbanPlan()` 하나다. `plan.routes`는 지상 교통 경로이고 `plan.highwayRoutes`는 고가 교통 경로다. 장면·교통·미니맵이 별도 격자나 열린 방사 고속도로 회로를 만들지 않는다.
- `plan.highwayRoutes`의 `kind`, `elevated`, `deckY`를 차선 폭·속도·차량 높이에 그대로 쓴다. 고가 차량의 타이어 접촉면은 상판 중심 `deckY`에 두께 절반 0.6을 더한 높이다. `trafficFrame`, `trafficPose`, 충돌 상자, 인스턴스 렌더와 체력 막대가 모두 이 `y`를 소비한다.
- `trafficBoxes`를 받는 위협·충돌·명중 판정은 반드시 차량의 `y`/`height`까지 소비한다. X/Z 근접 필터링은 broad phase로만 쓰고, 도보 충돌을 포함한 최종 판정에서 지상과 고가 차량을 다시 분리한다.
- `roadClearance(plan)`은 계획 객체별로 캐시되는 공통 도로 점유 검사다. 점 장식은 `pointClear`, 높이가 있는 나무·기둥은 실제 평면 반경과 아래/위 높이를 넣은 `columnClear`, 난간·도색처럼 선을 따라가는 부재는 `clearSpans`를 쓴다. 고가·램프 생성기는 자기 도로만 제외하도록 `sourceRoad`를 넘긴다.
- 폴리라인 램프의 마이터 모서리·테이퍼·선택 횡방향은 `shared/roadRibbon.js`가 유일한 원본이다. `addRamp` 호출자는 `addRoadTriangle`을 넘기고, 장면은 모든 램프의 canonical 삼각형을 공유 정점의 단일 `ramp-road` surface mesh로 합친다. 상판과 물리 노면은 같은 삼각형을 쓰며, 밑면과 실제 바깥 둘레 벽만 따로 그려 내부 삼각형 벽·변환 오차 틈을 만들지 않는다. 난간은 평균 폭이 아니라 inset 리본의 실제 3D 모서리를 따라가고, 평평한 합류 테이퍼의 안쪽은 전체를 비운다.
- 교각 충돌 상자는 실제 기둥 반경과 차량 충돌 여유를 포함해 지상 차선 밖에 있어야 한다. `roofMargin: 0`으로 상판 위 차량을 보이지 않는 지붕 여유가 막지 않게 한다. 고가 아래 `density: 'deck'` NPC는 보이는 저층 모델의 실제 높이만 충돌시킨다.
- `plan.roundabouts`의 현재 레코드는 원형 링크가 아니라 직선 간선이 만나는 열린 교차면이다. 중앙 섬·돌기둥·원형 연석을 만들지 않는다. 실제 원형 주행 링크가 canonical network에 생기기 전에는 교통이 임의로 원을 돌지 않는다.
- 교차로 감속과 양보는 같은 높이의 경로끼리만 적용한다. X/Z가 겹쳐도 지상 차량과 고가 차량은 서로 제동시키지 않는다. 차량 번호·시각·도시 크기에 따른 결정적 배정과 품질별 앞 번호 안정성은 유지한다.

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
| 전투기 미사일 포착과 유도 | `missileLock.js`(거리, 원뿔, 2초 규칙), `lockStore.js`, `ui/LockBox.jsx`, `weapons.js` 의 `MISSILE.turn`, `MISSILE.proximity`, `steerMissile`, missile-lock 단위 테스트 |
| 엔진 음색 | `engineSound.ENGINES` 의 harmonics/sub/airHz 와 `engineTargets`, `FlightMode`/`CarMode` 의 voice 수명, engine-sound 단위 테스트 |
| 폭발음 겹침 | `sound.effectOut`, `soundLimits.VOICE_RULES`, `engineSound` 의 `engineOut`, sound-limits 단위 테스트 |
| 항공 무장의 지상 판정 | `weapons.stepWeapons` 의 traffic 과 hits, `FlightMode` 의 GROUND_STRAFE_*, `carPhysics.hitsVehicle` |
| 공중 충돌 | `airTraffic.collidesWith`, `downAirTraffic`, `FlightMode` 의 SELF_RADIUS 와 peersRef |
| 포탄 낙차 | `groundWeapons.GROUND_GUNS.<기종>.gravity` 와 `shellGravity`, `stepGroundWeapons`, `reticle.groundImpact` 와 `dropLadder` |
| 명중 표시 | `sound.playTick`, `ui/HitMarker` 의 흰 명중과 빨간 격추 표식, `ui/Reticle` 과 `ui/FpsCrosshair` 의 소비, `FlightMode`/`CarMode`/`WalkMode` 의 airHits 와 kills 카운터 |
| 탄의 차량 명중 | `carPhysics.hitsVehicle`(x, y, z 3축 슬랩) 과 `VEHICLE_LIFT`, `traffic.TRAFFIC_BODY`, `weapons`/`groundWeapons` 의 traffic 판정, `remoteCombat.hitsSelf` 의 내 차 상자 |
| 앞바퀴 조향 방향 | `models/carGeometry.steerAngle` 한 곳이 부호를 정한다. 바퀴 group 을 가진 모델 일곱과 `steering` 단위 테스트 |
| 조준선 자리 | `aimScreen.projectAim`, `aimScreenStore`, `CarMode`/`FlightMode` 의 매 프레임 기록, `ui/Reticle` 의 rAF 루프와 `.wui-reticle` transform |
| 제작자 라벨 거리·높이 | `creatorProximity.labelReach`·`creatorLabelAnchor`·`driveCardScale`·`driveCardScreenPosition`·`LABEL_SCALE`, `labelCandidates` 의 가로 화면 범위, `NearbyCreators` 의 주행 외벽 추적과 거리별 화면 크기, proximity·label-candidates 단위 테스트·주행 브라우저 테스트 |
| 주행 내비게이션 | `navigationMap` 의 헤딩업 투영·속도별 반경·티어 마커, `Map` 의 navigation 모드, `carStatus` 의 x/z/heading/speed, `WorldPage` 차량 HUD 연결 |
| 포뮬러 차종 | `carPhysics.VEHICLES.formula`, `models/Formula`, `cockpits/FormulaInterior`, `eyePoints`, `engineSound`, `mirrorLayout`, `triangles`, `rideArt`, Space 핸드브레이크·드리프트 테스트 |
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
| 차종 추가·삭제 | `identity.VEHICLE_META`, `VEHICLES`, `eyePoints`, `engineSound.ENGINES`, `VehicleModel`, `cockpits/index`, `triangles.COCKPIT_PARTS`/`QUALITY_PARTS`, `groundWeapons.HULL_HEIGHT`, `ui/rideArt`, `CarMode.LAMP_REACH`, 거울이 있으면 `mirrorLayout.REAR_CAMERA`, car·first-person·mirrors 단위 테스트. M4/CLS/849/모델 S는 `fourVehicleLayout`에서 차체·좌석·눈 좌표를 함께 바꾼다 |
| 기종 추가·삭제 | `identity.PLANE_META`, `PLANES`, `planeDimensions`, `hardpoints`, `EngineGlow` 프리셋, `PlaneModel`, `eyePoints`, `cockpits/index`, `triangles.COCKPIT_PARTS`, `ui/rideArt`, `reticle.RETICLE`, `health`, 관련 단위 테스트 |
| 포구 위치와 포 속도 | `GROUND_GUNS` 의 `turret`, `pivot`, `reach`(모델의 포탑 group, 포신 group, 포구 mesh 와 같은 값), `muzzlePoint`, `remoteCombat` 예광 시작점, `Tracers.SHELL_SCALE`, muzzle 단위 테스트 |
| 체력과 피해 수치 | `health.js` 의 `HULL`, `DAMAGE`, `RideHud` 차체 게이지, `health` 단위 테스트 |
| 실내 계기 배치 | `cockpits/AircraftCockpits`, `cockpits/VehicleInteriors`(실내 전체 조각은 `cabin`, 운전자 앞 조각은 `at`), `eyePoints`, `CarMode`의 외장 표시 조건, `triangles.js`의 `COCKPIT_PARTS`, 콕핏 예산 테스트 |
| 4/5인승 절차형 실내 예산 | `triangles.js`의 기존 공통 상한 1800/4500/9000은 유지한다. 네 좌석을 보이는 오픈카 low만 3300, 다섯 좌석·네 도어 카드를 보이는 쿠페 low/medium만 4800/7000으로 제한한다. 나머지 신차·기존 차는 공통 상한을 쓴다. 수치는 실제 Cabin 마운트 지오메트리와 live 화면/거울 몫에서 잰다 |
| 3인칭 카메라 거리와 각 | `CarMode` 의 `CHASE`, 휠 범위, `ui/CarGauges` 자리와 미니맵 위치 |
| 도보 무기와 이동 수치 | `walkPhysics.js` 의 `WALK_WEAPONS`(pellets, tube 포함), 정조준과 지구력과 점프 상수, `ui/WalkHud` 표시, `ui/FpsCrosshair` 조준선, `sound.js` 음색, walk 단위 테스트 |
| pose payload 필드와 PvP 피격 | `validPose` 의 속도 검증, `FlightMode` 와 `CarMode` 의 `onPose`, 50ms 전송 주기, `RemoteActors`, `remoteCombat` 의 탄속 상속과 상대 이동 선분 판정 |
| 지형/수면 높이 | `UrbanScenery`, `Ocean`, `flightPhysics` 지상 충돌 |
| GPU 품질 예산 | `QUALITY`, `useResources`, `Cars`, `Ocean`, `SkyEffects`, 단위 테스트와 1000명 브라우저 장면 |

공항은 X=`extent+110`, 활주로 시각 치수는 28×540, 착륙 판정은 중심에서 X ±13, Z ±270이다. 유도로 자리를 내려고 터미널 단지를 활주로에서 20 더 서쪽에 두었고 공항 땅은 서쪽으로 160, 동쪽으로 70 이다(`airportLayout.AIRPORT_GROUND`). 차량과 도보는 동쪽 공항 터미널 앞에서 출발한다. 공항로는 동쪽에만 있고 Z=30 에서 둑(`CAUSEWAY`) 을 건너 외곽 순환로에 T 자로 붙는다. 서쪽 공항은 해변과 강 하구가 막고 있어 도로가 없다. 물은 Y=-2.8이다. 현재 충돌은 단순화된 상자와 지상 평면을 사용하며 실제 지붕·언덕·날개 형상을 정밀하게 따라가지 않는다. 이 차이를 모르고 시각 모델의 크기만 바꾸면 충돌과 화면이 어긋날 수 있다.

## 확인 방법과 한계

### 강변 보행 표면과 충돌

`shared/riverfrontPlan.js`의 `plan.riverfront`가 강변 부지, 보행 경로, 바닥 삼각형, 구조물, 장애물과 차량 진입 차단 상자의 단일 출처다. `UrbanScenery`는 `road-bridge`를 제외한 모든 `riverfront.surfaces` 삼각형을 그대로 그린다. 도로 교량은 기존 교량 모델이 이미 같은 높이의 상판을 그린다. 섬의 땅도 `shared/river.js`가 물 판정에 쓰는 polygon으로 그리므로 물과 보행 바닥 경계가 일치한다. 낮은 품질에서도 같은 표면과 장애물을 유지하고 나무 등 장식만 줄인다.

강변 기존 녹지는 높이 `.13`, 새 부지 바닥은 `.16`, 보행로는 `.19`로 계획 단계에서 구분한다. 렌더러는 이 공유 삼각형의 높이를 그대로 쓰고 겹치는 섬 바닥·데크에서는 그리기 순서로 보행로를 앞에 둔다. 세 정자는 문화섬 동쪽의 물 위에 붙은 데크에 서며 바닥 상자의 윤곽은 공유 바닥과 일치하고 상단은 삼각형 바로 아래에 둔다. 문화홀 야외 무대의 상단도 별도 보행 삼각형으로 공유한다. 보행 바닥 조회는 계획별로 32m 격자를 한 번 만들어 해당 칸의 삼각형만 확인한다.

`riverfront.obstacles`는 공통 `solids`에 들어가 도보·차량·비행 충돌에 쓰인다. 정자 기둥과 난간, 섬 연결 데크의 난간도 이 공유 목록에서 렌더링하며 첫 정자 남쪽 난간 중앙 6m는 진입로로 비운다. 보행 충돌은 눈과 발 위 `.6m`, `.7m`의 몸통 높이에서 확인하므로 낮은 데크 난간과 조금 더 높은 정자 난간을 실제 높이만으로 막는다. `riverfront.vehicleBarriers`는 차량용 `Drive` 입력에만 더한다. 눈에 보이는 두 진입 기둥 사이로 사람은 지나가고 차량은 중앙 차단 상자에 막힌다. 높이가 지정된 장애물의 `bottom`과 `height`는 실제 수직 범위이며 `solidIndex`와 도보 갇힘 판정이 함께 읽는다. `bottom`이 없는 기존 건물은 종전의 바닥 `-2`, 상단 `height` 기준을 유지한다. SVG 지도는 이 계획의 부지·보행로·정자와 문화홀 윤곽을 읽으며, 보행로를 차량 도로로 표시하거나 AI 경로에 추가하지 않는다.

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
- `NearbyCreators.jsx` / `creatorProximity.js`: 비행기는 건물 체적과의 거리로 카드 투명도를 계산한다. 비행 중 최대 3장, 일반 탐색 최대 6장. 주행 중은 높은 건물 옥상 대신 카메라보다 4m 위이면서 카메라에 가장 가까운 외벽 위치를 따라간다. 카드 폭은 50m 이내 160px, 200m 이상 120px이고 사이 거리는 선형 보간한다. 가까운 옆 건물의 라벨이 화면 경계를 조금 벗어나도 후보에 넣고 화면 안쪽에 붙인다. 카메라만 돌려도 거리가 바뀐 것으로 계산하지 않는다. 카드의 pointer-events는 꺼서 비행 조작을 방해하지 않는다.

### 지상 차량 가속 기준

`carPhysics.VEHICLES.accel`은 정지 근처의 전진 가속 기준이다. 전속력에서는 구름·공기 저항을 이기면서 각 차종의 `top`에 접근하도록 구동력을 낮춘다. 내연기관은 실제 단수가 올라갈 때 잠깐 구동력이 끊기고, 단일 감속기의 전기차에는 변속 끊김이 없다. `carStatus`는 차종별 최고 RPM·레드존·다이얼 눈금도 전달한다. `tests/world/car-acceleration.test.mjs`는 도로 위 정지 상태에서 전속력으로 가속해 목표 속도를 지나는 시간을 30/60/120 Hz에서 검사한다.

| 차종 | 목표 | 성격 |
| --- | --- | --- |
| 세단 / SUV / 쿠페 / 슈퍼카 / 오픈카 | 0–100 km/h: 5.5 / 6.0 / 4.9 / 2.4 / 4.4초 | 이 프로젝트의 차량별 주행 목표 |
| 포뮬러 | 0–100 km/h: 2.7초 | [Red Bull의 0–97 km/h 약 2.6초 설명](https://www.redbull.com/int-en/worlds-fastest-filming-drone-build)에서 추정한 게임 목표, 공식 0–100 기록은 아님 |
| 전기차 / 오토바이 | 0–100 km/h: 3.2 / 3.21초 | [모델 S 롱레인지 듀얼 모터 제원](https://www.auto-data.net/en/tesla-model-s-facelift-2021-long-range-100-kwh-670hp-dual-motor-awd-42384) / [BMW S 1000 RR 제원](https://www.bmw-motorrad.co.uk/en/models/sport/s1000rr/technicaldata.html) |
| 드리프트 튜닝카 / 트럭 | 0–100 km/h: 4.0 / 18초 | 게임 밸런스 목표 |
| 전차 / 자주포 | 0–32 km/h: 7 / 9초 | 게임 밸런스 목표 |
| 장갑차 / 대공포 | 0–60 km/h: 12 / 14초 | 게임 밸런스 목표 |

### 1인칭 실내 시야

항공기 캐노피는 앞유리 가장자리의 가는 기둥과 상부 프레임으로 구성한다. 기둥의 깊이를 실내 길이만큼 늘리면 측면 벽이 되어 시야를 가리므로 단면 두께를 유지한다. 계기판은 눈높이 아래에 두고 아날로그 계기와 화면의 투영 영역이 겹치지 않게 배치한다. 세단·SUV·오픈카·트럭은 1인칭 전용 실내에서 외장 캐빈을 숨기고, 오픈카는 얇은 후드와 매립 나셀을 쓴다. SUV 눈높이 `y=0.86`은 높은 착좌감을 위한 카메라·실내 기준값일 뿐 주행 충돌 상자나 차체 원점을 바꾸지 않는다. 포뮬러는 카메라와 겹치는 모노코크·사이드포드·외장 미러를 숨기고 전용 욕조, 사각 스티어링 휠, 디지털 화면, 변속등, 좌우 미러를 보여 준다. 오토바이는 개방형 외장을 유지한다.

### 멀티 플레이 점수 계약

- PLAYER 처치는 피해자가 소비한 명중 순서에서 체력을 0으로 만든 탄의 소유자에게만 준다. `life`는 재탑승·리셋·리스폰 때 새 값이며 이전 생명의 피해 대기열과 발사체를 버린다. 비무장 탈것과 도보의 기존 피탄 면역은 유지한다.
- 지상 AI는 세션의 숨김 Set에 처음 추가할 때 한 번, 공중 AI는 `applyAirHit`의 실제 격추 때 한 번 기록한다. 기존 지상 충돌 파괴는 AI 점수에 포함하고 공중 충돌은 점수를 주지 않는다. 지상 AI는 세션 내 재등장하지 않으며 공중 AI는 기존 재등장 주기를 따른다.
- 점수는 Broadcast와 Presence의 누적 값으로 전달한다. 재접속 중 UI는 연결 끊김을 표시하고 접속한 세션의 순위만 그린다. 새 입장은 새 UUID/0점이다. 늦게 들어온 참여자는 Presence에서 기존 소계를 읽는다.
- 이 프로토콜은 기존 클라이언트 판정과 Supabase Broadcast의 신뢰 범위를 유지한다. 메시지의 세션/생명/순서/형식 검사는 중복과 지연을 거르지만 악성 클라이언트를 막는 서버 권위 판정은 아니다. AI 파괴는 각 클라이언트의 로컬 시뮬레이션이며 서버가 공유하는 AI 전장 상태가 아니다.

### 드리프트 튜닝카와 관광 비행선

- `drift`는 오픈카 차체·실내·눈 좌표를 공유하고 `models/DriftCar.jsx`의 와이드 펜더, 전용 휠, 리어 윙을 더한다. 충돌 치수는 폭 2.5m·길이 5m다. 일반 조향은 접지 상태를 유지하며 Space 핸드브레이크를 잡아야 미끄러짐을 시작한다. 핸드브레이크 중에는 구동력을 낮춰 완만하게 감속하고, 놓은 뒤 가속으로 유지하거나 반대 조향·감속으로 접지를 회복한다.
- `driftEffects.js`와 `models/DriftEffects.jsx`는 실제 뒷바퀴 접지점에 월드 좌표 스키드 마크와 연기를 남긴다. 마크 320개/12초, 연기 64개/1.5초로 제한하고 두 번의 draw로 그린다. 멈춤·복귀·텔레포트에는 긴 자국을 연결하지 않으며, 일시정지 시 효과 시간도 멈춘다. 동작 줄이기는 연기를 끈다.
- `airship`은 `airshipPhysics.js`의 부력 기반 비행을 사용한다. W/S는 상승·하강, A/D 또는 Q/E는 선회, ↑/↓는 수평 추진 스로틀, Space는 감속이다. 조작을 놓으면 상승·하강 속도가 줄면서 고도를 유지한다. 자동 비행은 먼저 상승한 뒤 도시 외곽 관광 순항을 계속한다.
- 비행선 출발점은 동쪽 공항의 열린 계류 공간이다. 모델 원점은 곤돌라이며 눈 좌표는 `[0,.9,-5.2]`, 기낭 중심은 그 위에 있다. 건물 충돌은 `solidIndex.hitsAnyBuilding`의 반경 여유를 쓰는 연속 구들로 근사하며, 공중 충돌 구는 원점에서 y+7·반경 18이다. 비무장 기체로 무기·피격 체력 게이지를 표시하지 않는다.
- 비행선 실내는 독립 `AirshipCabin`을 쓰며 삼각형 수는 low/medium/high 820/948/972다. 기존 군용기 `aircraftDetail`의 캐노피·계기 배치 표를 공유하지 않는다. 드리프트 카의 실내 예산은 원본 오픈카와 같다.
