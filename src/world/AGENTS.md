# 오픈월드 모델링 수정 지침

이 디렉터리를 수정하기 전에 [README.md](README.md)의 모듈 표와 변경 영향 표를 읽는다.
사용자의 명시적인 새 디자인 요청은 아래의 기존 디자인 보존 규칙보다 우선한다.

- 목적이 버그 수정·조작·네트워크 작업이면 건물/비행기 실루엣, 티어 색, 높이 정책을 함께 바꾸지 않는다.
- 모델 원본을 수정한다. 주차·로컬 비행·원격 비행용 Jet를 각각 복제하지 않는다.
- `models/`는 시각 모델만 맡는다. 키보드, 카메라, 네트워크, 비행 상태 전이는 이곳에 넣지 않는다.
- `VehicleModel`의 선택 키는 `identity.VEHICLE_KEYS`와 항상 전부 맞춘다. 전차·자주포·APC 모델은 포탑 각도만 props로 받고 발사 판정은 `groundWeapons.js`에 둔다.
- 건물 좌표·티어 혼합·ELO 높이는 `../../shared/worldLayout.js`가, 도로·지구·공원·강 그래프는 `../../shared/urbanPlan.js`가 결정한다. `UrbanScenery`, `traffic`, `Map`에서 별도 격자를 만들거나 배율을 다시 적용하지 않는다.
- 도로, 나들목, 램프, 로터리, 교량 좌표는 `shared/urbanPlan.js`와 `shared/transit.js`가 교차에서 파생하며 렌더러나 다른 곳에 좌표를 박지 않는다.
- 자연지대 사분원과 연못 안에는 어떤 건물도 두지 않으며 세 겹의 제외(districtBlocks, worldLayout, fillerSlots)를 유지한다.
- 공항 시설과 충돌 상자는 `airportLayout.js` 한 곳에서만 바꾼다.
- 가로 시설 간격은 `roadFurniture.js` 표만 고친다.
- 실내, 총, 차량, 기체의 움직이지 않는 조각은 `StaticBatch` 로 묶는다. 바퀴, 포탑, 프로펠러, 로터, 폭탄창 문, 계기 바늘처럼 움직이는 가지는 `userData={{ dynamic: true }}` 로 빼 둔다.
- 매 프레임 바뀌는 값은 prop 이 아니라 ref 로 넘긴다. 계기는 `get()` 콜백, 차량은 `wheelsRef`, 기체는 `glowRef`, 실내는 `statusRef` 를 읽는다. 0.1초 주기 setState 도 도시 전체를 재조정시킨다.
- 조명을 껐다 켜지 않는다. 광원 개수는 three 의 셰이더 프로그램 캐시 키라서 그 순간 도시 재질이 통째로 다시 컴파일된다. 새 조명 조합이 필요하면 `ShaderPrewarm` 의 조합 목록에 넣어 미리 만들어 둔다.
- 본 화면 배치는 그림자를 던지지 않는다. 그림자는 `WorldScene` 의 `ShadowCasters` 가 그림자 절두체 근처 파트만 모아 던진다. 새 정적 배치를 더하면 caster 색인(`cityTiles.buildCasterIndex`) 에 들어가는지 확인한다.
- 건물과 구조물 충돌은 `solidIndex.hitsAnyBuilding` 하나만 쓴다. 배열을 직접 `some` 으로 훑지 않는다.
- 탄이 차량에 맞았는지는 `carPhysics.hitsVehicle` 하나만 쓴다. 상자에 바닥 `y` 와 `height` 를 반드시 채운다. 높이를 빼면 허공을 쏜 탄이 땅 위 차를 부순다.
- 앞바퀴가 도는 방향은 `models/carGeometry.steerAngle` 이 정한다. 모델에서 `steer * MAX_STEER` 를 직접 쓰지 않는다. 부호를 잘못 두면 바퀴가 도는 쪽의 반대를 가리킨다.
- 조준선은 화면 중앙에 고정하지 않는다. `aimScreen.projectAim` 이 포구나 기수 방향을 투영한 자리를 `aimScreenStore` 에 쓰고 `ui/Reticle` 이 rAF 로 읽어 transform 만 바꾼다. 프레임마다 state 로 올리지 않는다.
- 1인칭에서 눈앞을 막는 외장 조각은 캐빈 group 으로 옮겨 숨긴다. 외장을 통째로 언마운트하지 않는다.
- 랜덤한 모양은 ID 기반의 결정적인 값으로 만든다. 모델 생성/렌더마다 `Math.random()`을 호출해 배치를 바꾸지 않는다.
- 대량 반복 장식은 공유 geometry/material + instancing을 유지한다. 창문마다 mesh 또는 DOM을 생성하지 않는다.
- `createBatches().add()`의 owner ID, shape/material 키, 좌표계, 리소스 소유권은 README의 계약을 따른다.
- 공항·공공건물의 위치나 크기를 바꾸면 README 변경 영향 표의 충돌·미니맵·해안선 코드를 함께 확인한다.
- 주석/문서만 바꿀 때는 불필요한 새 테스트를 만들지 않는다. 코드 변경은 관련 기존 단위 테스트·lint·빌드로 검증한다. 시각 모델 변경은 건물 컬렉션과 비행 화면도 확인한다.
- 테스트가 없는 실루엣·재질 변경을 검증했다고 주장하지 않는다. 현재 테스트 범위와 실제 확인 범위를 구분해 보고한다.
