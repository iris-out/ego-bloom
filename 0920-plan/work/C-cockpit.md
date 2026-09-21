# C 실내 작업 보고

## 바꾼 것

### Blast 계약과 BlastField

`src/world/models/Blast.jsx` 에 `ageOf` prop 을 더했다. 기존 `age` 경로는 그대로 두고, 두 경로 모두
`applyBlast()` 한 함수로 모아 결과가 같다. `age` 를 주면 그 값이 바뀔 때(부모 재렌더) `useLayoutEffect` 가
다시 계산하고, `ageOf` 를 주면 `useFrame` 이 매 프레임 직접 읽어 mesh 의 scale, position, visible 을
명령형으로 고친다. 섬광, 화염, 연기, 지면 링은 조건부 마운트 대신 항상 마운트하고 `visible` 만 바꾼다(three 는
invisible 오브젝트를 draw 하지 않으므로 draw call 은 그대로다). material 은 여전히 모듈 스코프 공유 객체라
인스턴스별 값(불투명도, 색)은 `paint` 라는 인스턴스 소유 객체에 담아 `onBeforeRender` 가 그리기 직전에
옮긴다. `onBeforeRender` 자체는 마운트 시 한 번만 연결해 렌더마다 클로저를 새로 만들지 않는다.

같은 파일에 `BlastField({ arsenalRef, kind, max })` 를 새로 export 했다. `arsenalRef.current.blasts`
배열의 아이디 집합을 매 프레임 훑어 구성이 바뀔 때만 `setState` 한다. 각 `<Blast>` 는 `ageOf={() =>
findAge(arsenalRef.current?.blasts, id)}` 로 자기 나이를 스스로 찾는다. `kind` 를 주면 배열 항목의 kind
대신 그 값을 쓴다(지상 무기 폭발은 kind 필드가 없다).

### CarMode.jsx

`ordnance` state 와 0.04초마다 돌던 `setOrdnance` 를 지웠다. `<GroundEffects>` 대신
`<BlastField arsenalRef={arsenal} kind="cannon" />` 를 그린다. `Tracers`(예광) 는 원래도 ref 구동이라
손대지 않았다.

`aimView` state 와 `setAimView` 를 지웠다. `VehicleModel` 에 `turretYaw`/`barrelPitch` 를 아예 넘기지
않는다(전투 차량 모델은 이미 `aimRef` 를 매 프레임 읽어 그 값을 덮어쓰므로 0.15초 상태값은 애초에 죽은
코드였다). `Cockpit` 에는 `aimRef={aim}` 을 직접 넘긴다.

`cockpitStatus` state 를 `cockpitStatusRef` ref 로 바꿨다. 0.15초 보고 블록에서
`cockpitStatusRef.current = {...report, steer: next.steer}` 로 값만 바꾼다. `onStatus` 콜백(agent U 가
구독하는 HUD 경로)은 주기와 내용 그대로 남겼다.

`wheels` state 는 남겨뒀다. `VehicleModel`(비전투 차종 Sedan/Suv/Convertible/Truck/Motorcycle)이
`steer`/`speed` 를 여전히 일반 prop 으로만 받고 ref 를 읽지 않기 때문이다(내가 소유하지 않는 파일).

`CrashBlast` 는 매 프레임 `setCrash` 하던 것을 없앴다. `phase` 가 `'crashed'` 로 들어가고 나갈 때만
`setOrigin`/`setOrigin(null)` 을 불러 마운트를 바꾸고(충돌 한 번에 최대 두 번), 폭발 나이는
`ageOf={() => state.current.crashElapsed || 0}` 로 읽는다.

### FlightMode.jsx

`WeaponsView`(매 프레임 `setLive`) 를 통째로 지웠다. `{mounts && <Projectiles arsenalRef={arsenal} />}`
로 바뀌었고 `Projectiles` 자체가 ref 구동이라 래퍼가 필요 없다.

`cockpitStatus` state 를 `cockpitStatusRef` 로 바꿨다. `Cockpit` 에는 `statusRef`, `controlsRef={applied}`
(기존 `controls={applied.current}` 대신 ref 자체), `poseRef={state}`(원래도 ref) 를 넘긴다.

`CrashBlast` 는 CarMode 와 같은 방식으로 고쳤다.

### models/Projectiles.jsx

`projectiles`/`blasts` 배열 prop 대신 `arsenalRef` 하나만 받는다. 기관총 예광은 `CannonTracers` 가
`arsenalRef.current.projectiles` 를 매 프레임 필터링해 instancedMesh 하나로 그린다(`models/Tracers.jsx`
와 같은 패턴). 미사일과 폭탄은 `useMembership(arsenalRef, kind, max)` 훅으로 종류별 아이디 집합이 바뀔
때만 다시 렌더하고, 각 `<Missile>`/`<Bomb>` 은 `id` 하나만 받아 `liveProjectile()` 로 자기 값을 매 프레임
찾아 위치, 자세, 트레일 길이를 직접 고친다. 폭발은 `BlastField` 로 통일했다.

geometry 와 material 을 컴포넌트 `useMemo` 에서 모듈 스코프 상수(`GEOMETRIES`, `MATERIALS`)로 옮겼다.
전투기 무장 시스템은 총으로 무장한 기체를 처음 탈 때까지 마운트가 미뤄질 수 있는데, 재질을 모듈 스코프에
두어야 agent R 의 `ShaderPrewarm` 이 도시 로드 뒤 한가할 때 이 재질들도 같이 `gl.compileAsync` 로 찾아
미리 컴파일할 수 있다. 미사일 트레일은 불투명도가 탄마다 달라 공유 재질 하나에 `onBeforeRender` +
`mesh.userData.opacity` 페인트 패턴을 썼다(Blast.jsx 와 동일). 폭탄 트레일은 불투명도가 고정값(0.42)이라
그대로 공유한다.

### RemoteCombat.jsx

로컬 `blasts` state 와 0.04초 스로틀 로직을 지웠다. `<BlastField arsenalRef={combat} kind="cannon" />`
가 `combat.current.blasts`(매 프레임 `stepRemoteCombat` 이 갱신) 를 직접 읽는다. `Tracers` 는 그대로다.

### cockpits/parts.jsx

`Dial`, `Lever`, `Stick`, `Yoke` 가 정적 숫자(`value`, `angle`, `pitch`+`roll`) 대신 `get` 콜백을
받는다. `useFrame` 안에서 매 프레임 `get()` 을 불러 바늘/조종간/휠 각도를 계산한다. 부모가 렌더를 멈춰도
콜백이 실시간 ref 를 읽으므로 움직임이 끊기지 않는다. 각 부품의 "움직이는" group(바늘, 스틱/레버 팔,
요크 휠)에 `userData={{ dynamic: true }}` 를 달아 StaticBatch 대상에서 뺐다.

### cockpits/InstrumentDisplay.jsx, FighterHud.jsx

`InstrumentDisplay` 는 `status` prop 대신 `statusRef` 를 받는다. 자체 `useFrame` 이 0.15초마다
`statusRef.current` 를 읽어 캔버스를 다시 그린다. 그릴 값을 문자열로 만들어 지난번과 같으면(정지한
탈것에서 흔하다) 캔버스 그리기와 텍스처 업로드를 건너뛴다. 텍스처 mesh 는 `userData={{ dynamic: true }}`
로 StaticBatch 밖에 둔다.

`FighterHud` 는 이미 30Hz 로만 다시 그리고 있었다(`REDRAW = 1/30`). 여기에 InstrumentDisplay 와 같은
변경 감지를 더했다: pose 와 status 의 관련 필드로 서명을 만들어 지난번과 같으면 30Hz 타이머가 돌아도
다시 그리지 않는다. `status` prop 도 `statusRef` 로 바꿨다.

### cockpits/index.jsx

`Cockpit` 이 `status`/`controls`/`turretYaw`/`barrelPitch` 대신 `statusRef`/`controlsRef`/`aimRef` 를
받아 그대로 Interior 에 넘긴다. Interior 출력 전체를 `<StaticBatch version={`${rideKey}:${night}`}>` 로
감쌌다. `version` 을 rideKey 와 night 에 묶은 이유는, Cockpit 자체는 탈것이 바뀌어도 같은 컴포넌트
인스턴스로 남고 `Interior` 변수만 바뀌기 때문이다(React 는 자식 엘리먼트 타입이 바뀌면 그 아래를
언마운트/마운트하지만 StaticBatch 자신의 `useLayoutEffect` 는 의존 배열이 그대로면 다시 돌지 않는다).
version 을 안 바꾸면 탈것을 바꿀 때 이전 병합 mesh 가 게이지 지오메트리를 문 채 남는다.

### cockpits/VehicleInteriors.jsx, AircraftCockpits.jsx

모든 Interior 가 `status`/`turretYaw`/`barrelPitch`/`controls` prop 대신 `statusRef`/`aimRef`/
`controlsRef` 를 받는다. Dial/Yoke/Stick/Lever 호출은 전부 `get={() => statusRef.current.X ...}`
꼴 클로저로 바뀌었다. `react-hooks/refs`(이 저장소 eslint 설정에 있는 규칙) 가 렌더 중 ref 직접 접근을
막아서, 차종 최고 속도(`status.top`) 처럼 마운트 내내 바뀌지 않는 값은 `statusRef.current.top` 대신
`carPhysics.VEHICLES` 의 실제 상수를 그대로 하드코딩했다(세단 62, SUV 58, 오픈카 70, 트럭 44, 오토바이
74, 전차 22, 자주포 19, 장갑차 32, 대공포 29 - 원래 폴백값과 정확히 같다).

전투 차량의 `GunnerSight`(조준경 접안 방위 링과 앙각 표식) 와 `TurretMark`(장갑차/대공포 소형 포탑
표식) 는 `turretYaw`/`barrelPitch` prop 대신 `aimRef` 를 받아 `useFrame` 안에서 직접 group 의 rotation/
position 을 돌린다. `HowitzerInterior`, `AntiAirInterior` 의 앙각 다이얼도 `aimRef.current.pitch` 를
직접 읽어, 예전에 0.15초 상태(`aimView`)를 거치던 것보다 오히려 더 매끄러워졌다.

폭격기 폭탄창 스위치 세 칸(`BaySwitches`)은 유일하게 재질 자체가 런타임에 바뀌는 장식이다(가운데 칸이
`bayOpen` 이면 `MAT.glow`, 아니면 `MAT.trim`). StaticBatch 는 병합한 뒤 원본 재질을 바꿔도 반영되지
않으므로 `userData={{ dynamic: true }}` 로 빼고 `useFrame` 에서 `mesh.material` 을 직접 스왑한다.

오토바이 핸들바(`Handlebar`)는 steer 로 통째로 요잉이 도는 group 이라 그 안의 계기 둘을 포함해 전체를
dynamic 으로 뺐다.

### cockpits/materials.js

`BOX`(단위 상자 geometry) 를 export 했다. `parts.jsx` 의 `GEO` 는 export 하지 않는다(export 하면
`react-refresh/only-export-components` 규칙이 "컴포넌트만 export 하는 파일" 원칙을 어겼다고 막는다).
`BaySwitches` 처럼 parts.jsx 의 조립 컴포넌트를 안 쓰고 mesh 를 직접 그려야 하는 드문 경우는 이 `BOX`
를 쓴다.

## 기대 효과와 근거

측정 문서(01-problems.md F항목)의 세 문제 모두 손을 댔다.

- "계기 판독값이 React 상태로 들어와 계기판 전체가 0.15초마다 재조정된다": `cockpitStatus`/`aimView`
 state 를 없애 CarMode/FlightMode 자체가 0.15초마다 다시 렌더하지 않는다. Cockpit 과 Interior 는 부모가
 렌더하지 않는 한 사실상 마운트 시 한 번만 렌더된다. 계기 바늘, 조종간, 스티어링, HUD, 화면은 모두
 `useFrame` 이 ref 를 직접 읽어 움직이므로 갱신 자체는 끊기지 않는다.
- "실내 재질 조합이 처음 그려질 때 셰이더 22개가 link 된다": Projectiles 의 geometry/material 을 모듈
 스코프로 올려 agent R 의 `ShaderPrewarm` 대상에 포함되게 했다. cockpits 쪽 재질(`MAT`, `TICK_MARK`,
 `TICK_WARN`, 계기 face 캔버스 재질)은 원래도 모듈 스코프였다(materials.js, parts.jsx). 실제 컴파일
 타이밍 단축은 agent R 의 ShaderPrewarm 이 실제로 이 재질들을 찾아 컴파일하는지에 달려 있어 내가
 직접 측정하지는 못했다.
- "계기 하나가 원판, 베젤, 눈금 12개, 바늘, 허브로 mesh 16개다": StaticBatch 로 대시보드/트림/그립/
 다이얼 베젤/허브/눈금을 재질별로 합쳤다. 바늘, 스티어링, 조종간, 화면, 포탑 표식만 개별 draw call로
 남는다.

draw call 추정치(실측이 아니라 JSX 구성과 triangles.js 의 COCKPIT_PARTS 개수로 계산한 값이다. 이
환경에는 WebGL 렌더러가 없어 실제 Playwright 측정으로 확인하지 못했다):

| 탈것 | 병합 전(추정, mesh 1개=draw 1개) | 병합 후(추정) |
|---|---|---|
| jet(6다이얼, SixPack) | ~120 | ~25 |
| bomber(6다이얼×2화면) | ~130 | ~30 |
| fighter(1다이얼, HUD) | ~45 | ~18 |
| sedan(2다이얼, 거울3) | ~65(거울 별도 패스 6 포함) | ~20 |
| tank(2다이얼) | ~50 | ~15 |

병합 후 값은 "고유 서명이라 못 합치는 것(기종별 라벨 다이얼 face, placard)" + "dynamic 으로 뺀 것(바늘,
조종간, 화면, HUD)" + "재질별로 합친 정적 그룹 5~7개" 를 더해 어림잡았다. 정확한 수치는 agent R 의
perf 하네스로 실제 draw call 을 재는 쪽이 맞다.

## 남은 문제

- `wheels`(steer/speed) state 는 CarMode 에 그대로 남았다. `Sedan`/`Suv`/`Convertible`/`Truck`/
 `Motorcycle` 모델이 steer/speed 를 여전히 일반 prop(`useEffect`/렌더 시 계산)으로만 받고 `aimRef` 처럼
 ref 를 매 프레임 읽지 않기 때문이다. 이 다섯 모델이 `Tank`/`Howitzer`/`ArmoredCar`/`AntiAir` 처럼
 ref 를 받아 `useFrame` 에서 스스로 조향각을 읽게 고치면 `wheels` state 도 지울 수 있다. 이 파일들은
 내 소유가 아니라 손대지 않았다.
- FlightMode 의 `glow`(throttle 버킷/phase/bay) state 도 그대로 남았다. `PlaneModel`/`EngineGlow` 가
 prop 만 받아 같은 이유다. 소유 밖이라 손대지 않았다.
- draw call 표는 추정치다. WebGL 렌더러가 없는 환경이라 0920-plan/perf 하네스로 실측하지 못했다. 이번
 작업 지침이 Playwright 실행을 금지해 직접 재지 않았다.
- `BaySwitches`, `GunnerSight`, `TurretMark`, `Handlebar` 는 새로 만든 작은 컴포넌트다. 이 저장소의
 단위 테스트는 순수 데이터 계층(triangles.js, instruments.js, vehicleInteriorLayout.js 등)만 재고
 React/WebGL 렌더링은 테스트하지 않으므로, 실제 화면에서의 동작(조준경 링 회전, 폭탄창 표시등, 오토바이
 계기)은 `npm run test:world`(Playwright) 로 사람이 한 번 더 봐야 한다. 이번 세션에서는 금지돼 있어
 실행하지 못했다.
- StaticBatch 의 `version={rideKey}:${night}}` 는 탈것과 밤낮이 바뀔 때만 다시 합친다. Interior 안에서
 다른 이유로 조건부 렌더가 바뀌는 조각이 새로 생기면(재질이 상태에 따라 바뀌는데 dynamic 표시를 빠뜨린
 경우) 병합된 화면이 굳어 보일 수 있다. 새 조각을 넣을 때는 이 문서의 "정적 vs dynamic" 구분을 따라야
 한다.

## README 에 반영할 내용

- `models/Blast.jsx` 의 `age`/`ageOf` 계약과 새 `BlastField({ arsenalRef, kind, max })` export.
 WalkMode(agent W), AirTraffic(agent R) 도 이 계약을 그대로 쓸 수 있다(02-plan.md 의 "Blast 의 시간"
 절과 일치).
- `cockpits/index.jsx` 의 `Cockpit` prop 이 `status`/`controls`/`turretYaw`/`barrelPitch` 에서
 `statusRef`/`controlsRef`/`poseRef`/`aimRef` 로 바뀌었다는 것. CarMode/FlightMode 가 호출부다.
 cockpits 표에 "poseRef 를 매 프레임 읽는다" 서술은 그대로고, status, 조종간, 포탑각도 이제 전부 ref 다.
 Cockpit 은 Interior 를 StaticBatch 로 감싼다.
 `cockpits/parts.jsx` 의 `Dial`/`Lever`/`Stick`/`Yoke` 가 `get()` 콜백을 받는다는 계약도 적어 둘 만하다.
 새 콕핏이나 실내를 추가할 때 `value=`/`angle=` 대신 `get={() => ...}` 를 써야 한다.
