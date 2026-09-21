# AI traffic 결정성과 1인칭 shotgun 연구

두 주제를 조사했다. A 는 오픈월드 AI 차량이 네트워킹 없이 모든 브라우저에서 같은 배치로 보이게 하는 문제, B 는 도보 모드에 shotgun 을 추가하는 문제다. 각 절 끝에 이 저장소에 바로 적용할 수 있는 설계를 구체적인 숫자와 함수 시그니처로 정리했다.

## Topic A. 결정적 AI traffic

### 지금 코드의 제약

`src/world/traffic.js` 의 `trafficPose(index, time, extent)` 는 순수 함수다. 차량 위치는 (인덱스, 시간, 도시 크기) 만으로 정해지고 상태를 따로 들지 않는다. 지금은 차량마다 `4 + index%5` 라는 상수 속도로 `shared/urbanPlan.js` 의 `pointOnRoute` 가 반환하는 경로를 돈다. 같은 route, lane 을 쓰는 차량이라도 속도가 다르면 서로를 뚫고 지나간다. 브레이크 등은 실시간 속도 변화가 아니라 `laneCache` 가 route 마다 한 번 구해 둔 곡률 표(`LOOK_AHEAD=0.01`, `BRAKE_SAMPLES=100`)에서 임계값을 넘는 구간인지로만 켠다. 1000대를 이 방식으로 매 프레임 계산하면 8.7ms 가 드는데 예산은 3ms 다.

정정(구현 뒤): 8.7ms 는 단위 테스트 전체를 병렬로 돌릴 때 찍힌 값이다. 따로 재면 1000번에 0.1ms 안팎이었다. 아래 성능 추정은 이 값을 기준으로 다시 읽어야 한다. 실제 이득은 계산량보다 한 프레임에 여러 번 하던 계산을 한 번으로 줄인 데서 나온다.

### car-following 모델

Intelligent Driver Model(IDM) 은 앞차와의 간격, 속도차, 원하는 시간 간격(desired time headway)으로 가속도를 계산하는 연속 미분방정식 모델이다. 정체가 자연스럽게 생기고 사라지는 교통 흐름을 재현한 원 논문은 이렇다.

- Treiber, Hennecke, Helbing, "Congested traffic states in empirical observations and microscopic simulations", Physical Review E 62, 1805 (2000). https://link.aps.org/doi/10.1103/PhysRevE.62.1805
- Wikipedia 요약(공식과 파라미터표 포함): https://en.wikipedia.org/wiki/Intelligent_driver_model

IDM 은 매 스텝 이전 속도와 간격을 적분해 다음 속도를 구하는 상태 기반(stateful) 모델이다. 이 저장소의 요구조건인 "차량 위치가 (인덱스, 시간, 도시 크기)의 순수 함수"와는 바로 맞지 않는다. IDM 을 쓰려면 모든 브라우저가 t=0 부터 같은 고정 dt 로 같은 순서로 적분해야 값이 갈라지지 않는데, 이는 사실상 결정적 lockstep 시뮬레이션이다. 1000대를 매 프레임 서로 참조하며 적분하는 비용은 지금의 8.7ms 보다 커지면 커졌지 줄지 않는다. 따라서 IDM 자체를 그대로 들여오기보다 아래 "폐형(closed-form) 속도 프로파일" 쪽을 권한다.

### MOBIL 차선 변경

MOBIL(Minimizing Overall Braking Induced by Lane changes) 은 차선을 바꿀 때 안전 기준(뒤차를 위험하게 감속시키지 않는지)과 유인 기준(내 이득이 남의 손해보다 큰지)을 가속도 차이로 계산하는 일반 모델이다.

- Kesting, Treiber, Helbing, "General Lane-Changing Model MOBIL for Car-Following Models", Transportation Research Record 1999, 86-94 (2007). https://journals.sagepub.com/doi/10.3141/1999-10
- 저자 배포본 PDF: https://www.mtreiber.de/publications/MOBIL_TRB.pdf

MOBIL 도 다른 차의 실시간 가속도를 알아야 하므로 차량끼리 서로를 알지 못하는 순수 함수 설계와 어긋난다. 1000대가 매 프레임 주변 차를 찾아 안전, 유인 기준을 계산하면 spatial hashing 을 쓰더라도 예산을 넘기 쉽다. 이 저장소에는 실시간 동적 차선 변경 대신 정적 차선 배정(지금의 `index%4<2` 규칙)을 유지하도록 권한다. MOBIL 은 나중에 실제 충돌 회피가 필요해질 때 참고할 모델로만 남겨 둔다.

### constant time headway policy

앞차와의 목표 간격을 `s_des = δ + τ*v` (τ 는 시간 간격, δ 는 정지 간격)로 두는 정책이다. adaptive cruise control 문헌은 τ 를 대략 1에서 2초 범위로 쓴다.

- Swaroop, Rajagopal, "A review of constant time headway policy for automatic vehicle following", IEEE ITSC (2001). https://ieeexplore.ieee.org/document/948631/

이 저장소에서는 실시간으로 간격을 재는 대신, 한 route 를 도는 차량들에게 고정된 시간 오프셋을 나눠주는 용도로만 이 개념을 쓴다. 아래 설계의 SLOT_TIME 이 그것이다.

### 게임에서의 ambient traffic

Cities: Skylines 의 교통 시스템은 A* 경로탐색에 혼잡도, 제한속도, 방향을 넣어 점수를 매기고 first-come-first-served 로 교차로를 처리한다.

- "Game Design Deep Dive: Traffic systems in Cities: Skylines", Game Developer, 2015. https://www.gamedeveloper.com/design/game-design-deep-dive-traffic-systems-in-i-cities-skylines-i-
- "How Traffic Works in Cities: Skylines", Game Developer. https://www.gamedeveloper.com/design/how-traffic-works-in-cities-skylines

GTA 나 Just Cause 의 ambient traffic 을 다룬 GDC 발표나 1차 자료는 이번 검색에서 찾지 못했다. 커뮤니티 모드 문서만 나왔고 신뢰할 primary source 가 아니라서 이 문서에는 인용하지 않는다. 확인하지 못한 부분은 확인하지 못했다고 남긴다.

### 폐형 속도 프로파일과 곡률

레이싱 라인 최적화 분야는 코너에서 낼 수 있는 최대 속도를 곡률의 역수로 구한다. 최대 횡가속도 a_lat 를 정해 두면 `v(s) = sqrt(a_lat / kappa(s))` 로 각 경로 지점의 속도 상한이 나오고, 여기에 `t(s) = ∫ ds / v(s)` 를 적분해 위치를 시간의 함수로 뒤집을 수 있다.

- "Racing line optimization" 관련 자료가 공통으로 쓰는 관계식. 예: 자율주행 레이싱 경로계획 논문의 속도 프로파일 절. https://arxiv.org/pdf/2309.09186 (Spline-Based Minimum-Curvature Trajectory Optimization for Autonomous Racing)

이 접근은 상태가 필요 없다. 경로 하나마다 곡률에서 속도를, 속도에서 누적 시간 표를 한 번만 만들어 두면, 이후에는 시간을 표에서 찾아 위치를 얻는 순수한 표 탐색이 된다. `pointOnRoute` 가 이미 누적 길이 표에 이진 탐색을 쓰는 것과 같은 패턴이라 이 저장소에 자연스럽게 들어맞는다.

### time-shifted copies 로 겹침 막기

같은 속도 프로파일 `v(s)` 를 쓰는 두 차량이 있다고 하자. 위치를 시간의 함수 `s(t)` 로 뒤집으면 `v(s) > 0` 인 한 `s(t)` 는 시간에 대해 엄격히 증가하는 함수(bijection)다. 차량 B 가 차량 A 보다 시간 오프셋 `dt` 만큼 늦게 같은 프로파일을 탄다면 `s_A(t) = s(t)`, `s_B(t) = s(t - dt)` 이고, `s` 가 항상 증가하므로 `s_A(t) > s_B(t)` 가 모든 t 에서 성립한다. 속도가 구간마다 달라져도 두 차가 같은 자리에 오는 일은 없다. 이것이 "time-shifted copies of one profile keep gap = v*dt > 0" 의 근거다. 곡선을 도는 동안 잠깐 간격이 줄었다 늘었다 할 뿐 역전되지는 않는다.

### spatial hashing

이웃 탐색을 그리드 셀에 넣어 후보를 줄이는 기법이다. boid 같은 대규모 에이전트 시뮬레이션에서 표준으로 쓴다.

- "Efficient Boid Flocking in Multiplayer Games", spatial grid 를 이용한 이웃 탐색 최적화 설명. https://arnauld-alex.com/scaling-boids-for-multiplayer-games-fast-flocking-with-spatial-grids-and-zero-copy-optimization
- "Sparse Spatial Hash Grids: Efficient N-Dimensional Spatial Indexing". https://metafunctor.com/post/2025-11-11-sparse-spatial-hash/

이 저장소에는 차량끼리의 이웃 탐색이 필요 없다(차량은 서로를 모른다). 대신 아래 설계에서는 route 단위 bounding box 를 같은 발상으로 쓴다. 차량 1000대를 훑는 대신 route 수십 개의 상자만 먼저 걸러 카메라 반경 밖 route 전체를 건너뛴다.

### 이 프로젝트에 적용할 설계

핵심은 속도 프로파일을 route, 진행 방향, 차량 등급(vClass) 조합마다 한 번만 만들어 `route` 객체에 캐시하는 것이다. 지금의 `laneCache(plan, route)` 가 `route.lanes` 에 곡률 표를 붙여 두는 것과 같은 패턴이다.

```
function speedProfile(route, vClass, truck, direction)
// route.speedProfiles 캐시(Map, 키는 `${vClass}:${truck?1:0}:${direction}`)
// 반환값: { v: Float32Array(BRAKE_SAMPLES), t: Float32Array(BRAKE_SAMPLES+1), lap }
```

만드는 절차는 이렇다. `laneCache` 가 이미 구해 둔 `turn`(구간별 방위 변화)을 재사용해 `kappa_i = turn_i / (route.total / BRAKE_SAMPLES)` 로 실제 곡률을 얻는다. `v_i = clamp(min(v0, sqrt(aLatMax / max(kappa_i, eps))), vMin, v0)` 로 각 구간 속도를 정하고, `dt_i = (route.total/BRAKE_SAMPLES) / v_i`, `t[i+1] = t[i] + dt_i` 로 누적 시간 표를 쌓는다. `lap = t[BRAKE_SAMPLES]` 가 그 프로파일로 한 바퀴 도는 데 걸리는 시간이다.

숫자는 다음을 제안한다.

- v0(자유흐름 속도): 지금 쓰는 `4 + index%5` 값을 그대로 vClass 0~4 의 기준으로 쓴다.
- aLatMax: 승용차 3.2, 트럭(index%5===0) 2.0. 실측치가 아니라 튜닝할 설계 상수로 둔다. 확인된 출처가 없는 값이라는 점을 밝혀 둔다.
- vMin: `max(1.2, v0 * 0.25)`. 급커브에서 속도가 0에 가까워지면 `t(s)` 를 뒤집을 수 없으므로 바닥을 둔다.
- SLOT_TIME(고정 time headway): 1.6초. constant time headway 문헌이 쓰는 1~2초 범위 안이다. 같은 (route, lane, vClass) 를 쓰는 차량들에게 `s0 = (slotIndex * v0 * SLOT_TIME) % route.total` 을 초기 위치로 주고, 이를 `t[]` 표에서 찾은 시간으로 변환해 고정 오프셋 τ0 으로 쓴다. slotIndex 는 지금처럼 인덱스에서 파생한다.

포즈 조회는 `pointOnRoute` 의 이진 탐색과 같은 모양이다.

```
function sFromTime(profile, localTime)
// profile.t 에 이진 탐색(offsets 배열과 같은 패턴), 구간 안에서 선형 보간해 s 를 반환
```

`trafficPose` 는 `progress = direction * (time*(4+index%5)/...)` 대신 `s = sFromTime(profile, (time + tau0) % profile.lap)` 로 위치를 구하고, `pointOnRoute(route, s/route.total)` 은 그대로 쓴다. 트럭, 방향, 차선 배정 로직은 손대지 않는다.

브레이크 등은 프로파일 구간의 가속도 부호로 정한다.

```
accel_i = v[(i+1) % BRAKE_SAMPLES] - v[i]     // profile 생성 시 한 번만 계산해 저장
braking = clamp(-accel_i / (v0 * 0.4), 0, 1)  // 기존과 같은 0..1 세기 값
```

성능은 두 가지를 바꾼다. 첫째, route 마다 AABB(`route.bounds`, laneCache 와 같은 방식으로 캐시)를 만들어 `trafficBoxes` 가 차량을 하나씩 보기 전에 route 상자를 반경과 먼저 비교한다. 상자가 카메라 반경 밖이면 그 route 를 도는 차량 전부(전체 차량 수를 route 수로 나눈 만큼)를 건너뛴다. 둘째, 남은 차량만 `trafficPose` 를 부른다.

```
current : 1000대 x 8.7us = 8.7ms 측정값
개선 후(추정) : route 수 40~80개의 상자 비교(거의 0에 가까움)
             + 반경 안 차량 20~60대의 실제 pose 계산(이진 탐색 추가로 대당 10~11us)
             = 약 0.2~0.7ms
```

route 수와 반경 안 차량 수는 도시 크기와 카메라 위치에 따라 달라지므로 실측이 필요한 추정치다. 3ms 예산에는 여유 있게 들어온다.

선택 사항으로 남겨 둔 신호 없는 교차로 양보는 다음과 같이 설계하면 표를 다시 만들지 않고도 끼워 넣을 수 있다. `urbanPlan.js` 의 `withCrossings` 가 이미 route 의 점 목록에 다른 route 와 만나는 교차점을 끼워 넣으므로, 그 좌표에 `hashText` (같은 파일에 이미 있는 FNV 해시)를 적용해 그룹 0 또는 1을 고정으로 배정한다. 교차점을 공유하는 두 route 중 route.id 사전순이 빠른 쪽을 A, 나머지를 B 로 정해 A 는 `floor(time/CYCLE)%2 === group` 일 때, B 는 반대일 때 그 교차점 앞 18m 구간에서 속도를 vMin 으로 누른다. 이 값은 프로파일 표에 굽지 않고 조회 시점에 곱하는 보정으로 처리해야 표 재생성 없이 시간만으로 결정된다. CYCLE 은 16초를 제안한다. 이 부분은 구현 우선순위가 낮은 확장으로 남겨 둔다.

## Topic B. 1인칭 shotgun

### 관련 연구

pellet 수와 spread 는 게임마다 크게 다르다.

- Overwatch 의 Reaper shotgun 은 pellet 20개를 세 겹 고리로 고정 배치하고, 쏠 때마다 그 패턴 전체가 회전한다. https://us.forums.blizzard.com/en/overwatch/t/the-trigonometry-of-gun-spread-guide/208595 / 무기 일반 설명 https://overwatch.fandom.com/wiki/Weapon
- Valorant 의 Bucky 는 pellet 15개, Shorty 는 12개, Judge 도 12개를 쏜다. https://www.hotspawn.com/valorant/guide/valorant-complete-weapon-guide
- Apex Legends 는 총마다 pellet 패턴이 다르다. Mozambique 3개, Peacekeeper 11개, Mastiff 는 8개를 가로줄 모양으로 쏘며 정조준하면 그 줄이 좁아진다. https://esports.gg/guides/apex-legends/apex-legends-weapon-guide-anything-and-everything-shotguns/
- CS2 는 spread pattern 이 정적이다. Nova 는 위쪽으로 갈수록 좁아지는 wishbone 모양이고 Sawed-Off 는 spread 가 가장 커서 중거리에서는 2, 3발이 필요하다. https://counterstrike.fandom.com/wiki/Nova

damage falloff 는 대개 거리 구간을 나눠 선형으로 깎는다. GTFO 는 falloff 시작, 끝 거리 사이를 선형 보간한다. https://gtfo.fandom.com/wiki/Damage_Falloff . CS 계열은 다른 무기보다 shotgun 의 falloff 를 훨씬 가파르게 준다는 비교 글도 있다. https://zekevirant.medium.com/a-comparison-of-damage-falloff-in-pvp-fpss-7be74fbb131

pump-action 연사 속도는 기계적으로는 훨씬 빠르다. 이론상 pump 한 번을 0.25초에 돌리면 분당 240발까지 나오고, 실제 pump shotgun 인 Franchi SPAS-12 도 반자동 모드에서 분당 200~350발까지 낸다. https://en.wikipedia.org/wiki/Franchi_SPAS-12 . 게임에서 쓰는 0.8~1.0초 간격은 실제 기계 한계보다 훨씬 느리다. 슬라이드를 당기는 손 동작과 밸런스를 위해 일부러 늦춘 값이라고 보는 편이 맞다.

shell 단위로 장전하고 사격으로 끊을 수 있는 방식은 Half-Life 계열의 대표적인 특징이다. Half-Life 와 Half-Life 2 모두 shotgun 을 shell 한 발씩 넣고, 발사 키를 누르면 언제든 장전을 끊고 쏠 수 있다. https://combineoverwiki.net/wiki/Shotgun_(Half-Life) / https://combineoverwiki.net/wiki/Shotgun_(Half-Life_2)

ADS 는 대체로 spread 를 좁히고 recoil 을 눌러 준다. 총구가 발사마다 튀었다가 화면 중앙으로 되돌아오는 recoil, view kick 은 여러 FPS 가 공유하는 패턴이다. https://callofduty.fandom.com/wiki/Recoil

deterministic seeded pellet pattern 은 시드 하나로 같은 결과를 내는 noise 함수로 구현하는 편이 순수 난수보다 낫다. 상태가 없고, 되감기와 네트워크 재현에 강하다는 것이 요지다.

- Squirrel Eiserloh, "Math for Game Programmers: Noise-Based RNG", GDC 2017. https://www.gdcvault.com/play/1024365/Math-for-Game-Programmers-Noise

이 저장소의 `walkPhysics.js` `fireWeapon` 은 이미 비슷한 발상을 쓰고 있다. `Math.sin(seed * 41.7)`, `Math.sin(seed * 12.9898)`, `Math.cos(seed * 78.233)` 로 반동과 조준 흔들림을 시드에서 결정적으로 뽑아낸다. shader 에서 흔히 쓰는 sin 기반 해시와 같은 계열이다. shotgun 의 pellet 오프셋도 이 관용구를 그대로 늘려 쓰면 코드 스타일이 흔들리지 않는다.

### 이 프로젝트에 적용할 설계

`WALK_WEAPONS` 에 다음 항목을 추가한다. 필드 이름과 단위는 기존 표(rpm, mag, reserve, spread, recoil, range, reload, kick, sway, ads, hits)를 그대로 따르고, tube-fed shotgun 을 표시하는 `tube` 와 pellet 관련 필드 둘을 더한다.

```
shotgun: { ko: '샷건', rpm: 70, mag: 6, reserve: 24, spread: 0.02,
  pellets: 9, pelletSpread: 0.16, recoil: 0.06, range: 45,
  reload: 0.5, kick: 0.055, sway: 0.02, ads: 64, hits: 27, tube: true }
```

숫자 근거는 이렇다.

- rpm 70 은 발사 간격 60/70 = 0.857초다. 연구에서 본 게임 관행(0.8~1.0초)과 이 저장소의 다른 무기(smg 720rpm, pistol 260rpm) 사이에서 확실히 느린 총으로 자리잡는다.
- pellets 9 는 연구에서 본 8~12 범위 중간값이다.
- spread(조준 흔들림) 는 0.02 로 pistol(0.012)보다 살짝 크고 smg(0.03)보다 작다. 총신 자체의 흔들림이지 pellet 이 퍼지는 정도가 아니다. pellet 이 퍼지는 정도는 새 필드 pelletSpread(0.16 라디안)가 맡는다.
- range 45 는 pistol(120), smg(90)보다 짧다. pellet 이 퍼지는 각도 때문에 먼 거리에서는 자연스럽게 명중 pellet 수가 줄어들므로, 별도의 거리별 데미지 감쇠 곡선 없이도 spread 기하학만으로 falloff 효과가 생긴다. 목표가 사람이 아니라 차량 박스 하나이므로 부위별 배율이 필요 없는 이 저장소 사정에 맞는 단순화다.
- hits 27 은 pellet 9개가 전부 명중한 한 발이 27분의 9, 곧 3분의 1의 차량 체력을 깎는다는 뜻이다. 점사 3발이면 파괴된다. smg 는 15발(1/15씩)이 필요하므로 근접 화력은 shotgun 이 더 세지만, 먼 거리에서는 명중 pellet 수가 줄어 smg 보다 약해진다.
- reload 0.5, tube: true 는 shell 하나를 0.5초에 밀어 넣는다는 뜻이다. 6발을 빈 탄창에서 채우면 3.0초가 걸리지만 발사로 언제든 끊을 수 있다.
- ads 64 는 이 저장소에서 가장 zoom 이 약한 값이다(숫자가 클수록 화각이 넓어 덜 확대된다). bead 조준기 하나뿐인 pump shotgun 특성과 맞는다.

`tube: true` 처리를 위해 `startReload`, `stepWalk` 의 재장전 블록을 손봐야 한다. 지금은 `need = spec.mag - pouch.mag` 만큼을 한 번에 채운다. `tube` 가 참이면 한 번에 한 발만 채우고, 남은 발이 있고 탄창이 안 찼으면 같은 `spec.reload` 시간으로 다시 시작한다. `fireWeapon` 은 이미 `state.reloading > 0` 이면 사격을 막는데, `tube` 무기는 재장전 중에도 이미 약실에 한 발 있는 상태이므로 `pouch.mag > 0` 이면 재장전을 취소하고 그 자리에서 발사하도록 분기를 하나 추가해야 Half-Life 식 중단 가능한 재장전이 된다.

pellet 발사는 `fireWeapon` 안에서 `spec.pellets` 가 있을 때만 도는 루프로 넣는다.

```
fireWeapon(previous, { targets, buildings, seed }) -> { state, hit, hits }
```

`spec.pellets > 1` 이면 `for (let p = 0; p < spec.pellets; p++)` 로 돌며 각 pellet 의 seed 를 `seed + p * 0.6180339887`(황금비 간격, 기존 코드가 인덱스 오프셋에 쓰는 무리수 오프셋과 같은 발상)로 주고, 지금 있는 `Math.sin(seed*12.9898)`, `Math.cos(seed*78.233)` 흔들림 식을 그대로 재사용하되 폭을 `spec.spread` 대신 `spec.pelletSpread` 로 넓혀 쓴다. pellet 마다 독립적으로 `hitsVehicle` 판정을 해 명중한 것만 모아 `hits` 배열로 반환한다. 기존 호출부가 단일 `hit` 만 쓰고 있을 가능성을 생각해 `hit: hits[0] ?? null` 을 같이 반환해 하위호환을 유지한다.

sound.js 의 `SHOTS` 표에 항목을 더한다.

```
shotgun: { life: 0.24, cut: 1800, body: 130, gain: 0.3 }
```

life 를 길게, cut 을 낮게 잡아 pistol, smg 보다 굵고 낮은 총성을 낸다. 여기에 pump 를 당기는 기계음을 더한다. `playHit` 가 이미 두 음을 시간차(0.05초)를 두고 스케줄링하는 방식을 쓰므로 같은 방식으로 `playPumpRack()` 을 만들어 발사 후 0.18초, 0.30초 지점에 square 파형 두 개(예: 260Hz, 200Hz)를 짧게 울려 슬라이드가 뒤로 갔다 앞으로 오는 느낌을 준다.

muzzle flash 는 `WeaponView.jsx` 의 기존 `MuzzleFlash` 컴포넌트를 그대로 쓰되 원뿔을 더 굵고 길게(`coneGeometry` args 를 pistol 의 `[0.045, 0.15, 5]` 대신 `[0.07, 0.22, 6]`), 빛을 더 세게(`intensity` 0.8 대신 1.2) 잡는다. 명중 피드백은 기존 `playHit` 를 그대로 쓴다. 차량이 사라지는 순간에만 울리므로 pellet 개수와 상관없이 지금 로직을 바꾸지 않아도 된다.

procedural 모델은 `Pistol`, `Smg`, `Sniper` 와 같은 어휘로 만든다.

```
function Shotgun({ actionRef, pumpRef, magazineRef, flashRef })
```

- receiver: `Part` box, `METAL` 색, Smg 의 상부 리시버와 비슷한 비례([0.09, 0.09, 0.34] 안팎)
- barrel: `cylinderGeometry` 하나, `METAL_DARK`, 길이 0.55 안팎으로 pistol 보다 길고 sniper 보다 짧게
- magazine tube: barrel 아래 붙는 가는 `cylinderGeometry`(반지름 0.018), tube-fed 총임을 보여주는 핵심 디테일이라 smg 의 분리형 곡선 탄창과는 확실히 다르게 그린다
- pump fore-end: `WOOD` 또는 `GLOVE` 톤의 `Part` box, magazine tube 를 감싸는 형태. 발사마다 뒤로 갔다 앞으로 오는 애니메이션을 `pumpRef` 그룹(z 이동 폭 0.14 안팎, pistol 슬라이드의 `RECOIL_MAX_Z=0.07` 보다 크게)에 맡긴다
- ejection port: `METAL_DARK` 작은 box, receiver 옆면
- bead 조준기: muzzle 끝에 작은 `sphereGeometry`(`METAL`), 별도 가늠자 없이 이것 하나로 `weaponSights.js` 의 `SIGHT_POINT.shotgun` 을 정의한다
- stock: `WOOD` `Part` box, Sniper 의 치크피스보다 짧고 각진 pump shotgun 개머리판
- 손 두 개: 방아쇠 손은 receiver 옆에 `GrippingHand` 로 고정하고, 지지 손은 pump fore-end 를 쥔 채 같은 `pumpRef` 의 z 이동을 그대로 따라가게 해 손이 pump 를 실제로 당기는 것처럼 보이게 한다

`weaponSights.js` 에는 `ANCHOR.shotgun`, `SIGHT_POINT.shotgun`(bead 위치), `HIP_SCALE.shotgun`, `ADS_SCALE.shotgun` 을 추가해야 `adsRest` 가 이 총도 화면 중앙 정렬을 계산할 수 있다. `WeaponView.jsx` 의 `GUN_Z`, `TORCH_Z` 표에도 항목을 더하고, `weaponMotion.js` 의 `actionPose`, `reloadPose` 에 `shotgun` 분기를 추가해 pump 왕복과 shell 한 발씩 넣는 장전 딥(dip) 모션을 만든다. `WEAPON_KEYS` 에 `'shotgun'` 을 추가하면 무기 전환 UI 는 기존 구조를 그대로 탄다.
