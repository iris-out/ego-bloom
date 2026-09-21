# X 모델링 작업 보고

## 바꾼 것

### StaticBatch 적용

`Sedan.jsx`, `Suv.jsx`, `Convertible.jsx`, `Truck.jsx`, `Motorcycle.jsx`(승용차 계열)와
`Jet.jsx`, `Fighter.jsx`, `Interceptor.jsx`, `Helicopter.jsx`, `Bomber.jsx`, `PropFighter.jsx`
(항공기)를 모두 `StaticBatch`로 감쌌다. 정적이 아닌 부분만 `userData={{ dynamic: true }}`로 뺐다.

- Sedan, Suv, Convertible, Truck: 앞바퀴(조향+회전) group, 뒷바퀴(회전) group, 스티어링 휠 group.
- Motorcycle: 뒷바퀴만 뺀 나머지는 정적 병합 대상이지만, 앞바퀴/포크/핸들바/계기/윈드스크린이
 통째로 조향 각도만큼 도는 group(`frontGroup`)은 그 자체가 회전하므로 최상위 병합에서 빼고,
 그 안의 정적 부품(포크, 트리플 클램프, 윈드스크린, 계기, 클립온 바, 핸들 그립, 헤드램프 등)은
 `StaticBatch`를 한 번 더 중첩해 따로 합쳤다. 실제 회전 대상(`frontWheel`, `rearWheel`)만
 개별 draw call로 남는다. 마운트 첫 프레임 전에도 조향각이 맞도록 `initialSteerAngle`을
 render 시점에 props(`steer`)로 한 번 계산해 group의 초깃값으로 준다(useFrame이 그 뒤를 잇는다).
- Tank, Howitzer, ArmoredCar, AntiAir: StaticBatch를 적용하지 않았다. 지침에 명시된 대상이
 아니고, 이번 작업 범위를 벗어난다.
- Bomber: 폭탄창 문 두 짝(group)만 dynamic이다. 나머지(동체, 날개, 미익, 엔진 나셀, 랜딩기어)는
 하나로 합쳤다.
- PropFighter: 프로펠러 허브(group)와 회전 원판(mesh)만 dynamic이다.
- Helicopter: 메인 로터, 테일 로터 group만 dynamic이다. 블레이드 깜빡임을 가리는 반투명
 원판은 불투명도가 고정값이라 정적으로 남겼다.
- EngineGlow: 배기 group 전체를 `userData={{ dynamic: true }}`로 표시했다. 매 프레임 위치,
 크기, 불투명도가 바뀌므로 PlaneModel을 감싸는 어떤 상위 StaticBatch(예: 공항의 주기 제트)에도
 절대 병합되면 안 된다.
- 투명 유리(GLASS_OPACITY)나 고정 emissive 램프처럼 값이 상수인 재질은 그대로 병합 대상에
 넣었다. 시간에 따라 값이 바뀌는 재질(EngineGlow, 계기판 텍스처 등)만 뺐다.

### 바퀴 조향/회전을 ref로

`CarMode`의 `wheels` state(`{steer, speed}`)를 지우고 `wheelsRef` ref로 바꿨다. 매 프레임
`state.current = next` 직후 `wheelsRef.current = { steer: next.steer, speed: next.speed }`로
값만 바꾼다(0.15초 보고 주기가 아니라 매 프레임이다. 새 조향값 지연이 사실상 없다).

`VehicleModel`은 `steer`/`speed` 대신 `wheelsRef`를 받아 그대로 전달한다. 기존 `steer`/`speed`
props는 그대로 남겨(fallback) `RemoteActors.jsx`(원격 차량, ref 없이 기본값 0으로만 호출)가
깨지지 않게 했다.

아홉 개 차량 모델(Sedan, Suv, Convertible, Truck, Motorcycle, Tank, Howitzer, ArmoredCar,
AntiAir) 모두 Tank의 aimRef 패턴을 그대로 따른다. 기존 `useEffect(() => {...}, [steer])`는
원격 차량(ref 없음) 경로의 fallback으로 남겨두고, 새 useFrame이 `wheelsRef.current`가 있으면
매 프레임 그 값으로 조향각과 바퀴 회전을 덮어쓴다. 없으면 마지막 prop 값을 계속 쓴다.
ArmoredCar, AntiAir는 조향(steer)도 같은 방식으로 덮어쓴다. Tank, Howitzer는 조향이 없으므로
속도(궤도 회전)만 덮어쓴다.

### 엔진 배기(EngineGlow), 프로펠러, 폭탄창 문을 ref로

`FlightMode`의 `glow` state(`{throttle, phase, bay}`)를 지우고 `glowRef` ref로 바꿨다.
`stepWeapons` 뒤(`arsenal.current.bayOpen`이 갱신된 다음) 매 프레임
`glowRef.current = { throttle, phase, bay }`로 값만 바꾼다. 0.1/0.25 단위로 반올림하던 버킷도
없앴다. ref라 렌더를 다시 돌리지 않으므로 반올림으로 재렌더 빈도를 줄일 필요가 없어졌고,
오히려 매 프레임 실제값을 그대로 넘겨 배기 불꽃과 폭탄창 문이 더 매끄럽게 움직인다.

`PlaneModel`은 `glowRef`를 받아 기체 모델과 `EngineGlow` 양쪽에 그대로 넘긴다. `Bomber`(bay),
`PropFighter`(throttle, phase)만 이 ref를 실제로 읽는다. Jet, Fighter, Interceptor, Helicopter는
원래도 throttle/phase/bay를 쓰지 않는다. `EngineGlow`도 `glowRef`가 있으면 매 프레임 그 값을
읽고, 없으면(주기 비행기, 원격 기체) prop을 그대로 쓴다.

부수적으로 발견한 것: 기존 `FlightMode`는 `PlaneModel`에 `bay`를 아예 넘기지 않았다
(`throttle`, `phase`만 넘겼다). `glow` state에는 `bay` 값이 있었지만 실제로는 3인칭 폭격기
외장 모델의 폭탄창 문에 전달된 적이 없었다. `glowRef`로 통째로 넘기면서 이 경로가 처음으로
연결됐다. 조종석 계기의 폭탄창 표시등(`BaySwitches`, agent C가 만듦)은 이 문제와 무관하게
원래도 동작했다.

### VehicleHealthBar

`trafficPose(index, time, extent)`를 차마다 따로 부르던 것을 `trafficFrame(trafficCount, time,
extent)` 한 번으로 바꿨다. `WalkMode`가 `trafficCount` prop을 새로 넘긴다. `WalkMode`의 다른
호출(`trafficBoxes`)이 이미 매 프레임 같은 `(count, time, extent)`로 `trafficFrame`을 채워
두므로, 체력 막대가 여러 개 떠 있어도 이 프레임의 계산은 사실상 캐시를 읽는 것과 같다.
`index`가 `trafficCount`보다 커지면(품질을 낮춰 차 수가 줄어드는 드문 경우) 막대는 마지막
위치에 그대로 남는다. 원래 `trafficPose`는 count와 무관하게 항상 계산했으므로 이 차이가
있다.

### 그 밖에 확인한 것

`CarMode`, `FlightMode`의 useFrame 안에는 이제 매 프레임 도는 setState가 하나도 남지 않았다
(`zoomed`, `scope`는 포인터/키 이벤트에서만 바뀐다). `wheels`, `glow`를 지우면서 두 파일 모두
0.15초 주기 setState가 사라졌다.

## 기대 효과와 근거

01-problems.md의 측정 환경(WebGL 렌더러 없음)과 같은 제약이라 이번에도 draw call을 실측하지
못했다. C-cockpit.md의 계기판 병합과 같은 방식으로 mesh 개수를 세어 추정했다.

- Sedan(~65 mesh) → 병합 후 재질별 그룹 6~8개 + 동적 4개(앞바퀴 둘, 뒷바퀴 둘) + 스티어링 휠 1개.
- Motorcycle(~69 mesh) → 뒤쪽 정적 그룹 4~6개 + 앞쪽 중첩 정적 그룹 3~5개 + 동적 2개(앞뒤 바퀴).
 두 StaticBatch를 합쳐도 10개 안팎으로 줄어드는 셈이다.
- Jet, Fighter, Interceptor는 동적 부품이 전혀 없어 재질별 그룹 수(4~6개)로 거의 그대로 줄어든다.
- Helicopter는 로터 둘만 빼고 나머지가 합쳐진다.
- Bomber는 문 둘만 빼고 나머지(엔진 4발, 날개, 미익, 랜딩기어 포함)가 합쳐진다.

`wheels`/`glow` state 제거는 01-problems.md C항목("CarMode는 0.04초마다 setOrdnance...1인칭이면
setCockpitStatus, setWheels, setAimView도 부른다")의 마지막 남은 조각이다. C-cockpit.md가
`setOrdnance`, `setCockpitStatus`, `setAimView`를 이미 지웠고, 이번에 `setWheels`와
`FlightMode`의 `setGlow`까지 지워 두 파일의 useFrame에 setState가 완전히 없어졌다(포인터/키
이벤트 핸들러의 `setZoomed`, `setScope`는 그대로다. 사용자 입력에 반응하는 정상적인 state다).

## 화면에서 확인해야 할 것

WebGL 렌더러가 없는 환경이라 아래 전부 Playwright로 사람이 직접 봐야 한다. 이번 세션은
Playwright 실행이 금지돼 있어 시도하지 못했다.

- 바퀴 회전과 조향: 세단, SUV, 오픈카, 트럭, 오토바이를 3인칭으로 몰며 좌우로 꺾어 바퀴가
 따라 도는지, 정지 상태에서 바퀴가 미끄러지듯 보이지 않는지.
- 오토바이 기울기: 코너링 시 핸들바/포크/앞바퀴 뭉치가 자연스럽게 요잉으로 도는지, 계기판과
 윈드스크린이 뭉치와 함께 도는지(따로 놀지 않는지).
- 터렛 조준: 전차, 자주포, 장갑차, 대공포의 포탑/포신이 마우스와 방향키 양쪽에서 이전과 똑같이
 매끄러운지(이번에 손대지 않았으므로 회귀가 없어야 한다).
- 프로펠러/로터 회전: 프로펠러 전투기의 프로펠러가 스로틀에 따라 빨라지고 추락 시 멈추는지,
 헬기 메인/테일 로터가 계속 도는지.
- 폭탄창 문: 폭격기 3인칭에서 Space를 눌러 폭탄을 투하할 때 문이 실제로 열리는지(이번에
 처음 연결된 경로다. 열리지 않으면 회귀가 아니라 원래도 없던 기능이 이번에 생긴 것이니
 값이 이상한지부터 봐야 한다).
- 애프터버너 글로우: 전투기, 요격기가 애프터버너 구간에서 불꽃이 세지고 링이 뜨는지, 3인칭
 주기 상태(공항)에서는 안 보이는지.
- 야간 조명: 헤드램프/테일램프(CarMode의 Lights, 손대지 않음)가 밤에 밝아지는지. 이번 변경과
 무관하지만 정적 병합이 옆의 정적 램프 장식(전구 모양 작은 구체)을 건드리지 않았는지 함께
 확인한다.
- 원격 플레이어: 다른 세션이 탄 차량과 비행기가 3인칭에서 여전히 정상적으로 보이는지(포탑
 각도는 원래도 0.2초 주기라 매끄럽지 않을 수 있다. 이번에 악화되지는 않았어야 한다). 바퀴는
 원격 차량에서 원래도 회전하지 않았다(steer/speed를 안 보낸다). 이번에도 같다.
- 반투명 유리: 세단/SUV/오픈카/트럭의 앞유리, 옆유리, 실내에서 밖을 볼 때 겹침 순서가 이상하지
 않은지. 정적 병합이 여러 유리 조각을 하나의 mesh로 합치면서 삼각형 정렬 순서가 원본 mesh
 순서로 고정된다. 문제가 생기면 해당 파일의 유리 mesh에 `userData={{ dynamic: true }}`를
 추가해 병합에서 빼야 한다.

## 남은 문제

- Tank, Howitzer, ArmoredCar, AntiAir는 StaticBatch를 적용하지 않았다. 지침에 명시된 대상이
 아니라 손대지 않았지만, 이 넷도 조각 수가 40~55개 수준이라 같은 방식이 통할 가능성이 크다.
 포탑(turretRef)과 포신(barrelRef)만 dynamic으로 빼면 나머지 차체는 병합할 수 있어 보인다.
- draw call 감소치는 모두 추정이다. WebGL 렌더러가 없는 환경이라 0920-plan/perf 하네스로
 실측하지 못했다. 이번 작업 지침이 Playwright 실행을 금지해 직접 재지 않았다.
- Motorcycle의 중첩 StaticBatch는 이 저장소에서 처음 쓰는 패턴이다(부모 group이 회전하는
 채로 그 안에서 다시 StaticBatch를 쓴다). `staticBatch.js`의 `mergeStatic`이 `root`의
 `matrixWorld` 역행렬로 좌표를 상대화하므로 이론적으로는 부모 회전과 무관하게 안전하지만,
 실제 화면에서 확인한 적은 없다. 문제가 생기면 이 중첩을 풀고 앞쪽 뭉치 전체를 dynamic으로만
 두는 단순한 형태로 되돌릴 수 있다(draw call은 더 늘지만 안전하다).
- `wheelsRef`/`glowRef`는 CarMode/FlightMode가 로컬 플레이어를 그릴 때만 채운다. 원격 차량,
 주기 비행기, AirTraffic의 AI 항공기는 여전히 prop(steer/speed 없음, throttle/phase 고정값)
 경로를 쓴다. 이 경로는 이번 작업 전과 동작이 같다(원격 바퀴는 원래도 안 돌았다).
- `EngineGlow`가 `phase==='crashed'`일 때 더 이상 컴포넌트를 통째로 unmount하지 않고
 `visible=false`만 준다(렌더 중 ref를 읽어 조건부 return할 수 없어서다). geometry/material은
 계속 메모리에 남아 있지만 마운트/언마운트를 반복하던 것보다 오히려 가볍다. 시각적으로는
 차이가 없어야 한다.
- `tests/world/motorcycle-animation.test.mjs`는 import를 통째로 지우고 `new Function`으로
 Motorcycle.jsx를 다시 평가하는 특수한 하네스라, 새로 쓴 `StaticBatch`를 인식하지 못해
 깨졌다. 이 파일에 `StaticBatch`를 패스스루 shim으로 주입해 고쳤다(`Block`과 같은 방식).
 다른 모델 파일에 같은 하네스를 쓰는 테스트를 새로 만들 때는 이 점을 감안해야 한다.
- `src/world/README.md`의 `EngineGlow` 행("스로틀은 0.1 단위 버킷으로만 들어온다")이 이제
 틀렸다. `PlaneModel`도 이제 `glowRef`를 받는다는 점과 함께 메인 세션이 반영해야 한다.

## README 에 반영할 내용

- `models/VehicleModel.jsx`, `models/PlaneModel.jsx`의 계약이 바뀌었다: `wheelsRef`(steer,
 speed)와 `glowRef`(throttle, phase, bay)를 받으면 매 프레임 직접 읽고, 없으면(원격 차량,
 주기 비행기) 기존 `steer`/`speed`/`throttle`/`phase`/`bay` props를 그대로 쓴다. Cockpit의
 statusRef/aimRef와 같은 계약이다.
- `EngineGlow.jsx` 행의 "스로틀은 0.1 단위 버킷으로만 들어온다"를 지운다. 이제 매 프레임
 실제값을 그대로 읽는다.
- `staticBatch.js` / `StaticBatch.jsx` 행에 "중첩해 쓸 수 있다(회전하는 group 안에 다시
 StaticBatch를 둬도 안전하다, Motorcycle.jsx 참고)"를 덧붙일 만하다.
- 지상 차량, 항공기 모델 파일(Sedan/Suv/Convertible/Truck/Motorcycle, Jet/Fighter/
 Interceptor/Helicopter/Bomber/PropFighter) 행에 "정적 부품은 StaticBatch로 합치고, 회전, 
 개폐하는 부품만 dynamic으로 뺀다"는 원칙을 명시할 만하다.
