# 0920 오픈월드 성능 작업

2026-09-20 에 `/world` 의 성능과 AI 차량, 1인칭 실내, 도보를 손보고 산탄총을 넣은 기록이다.

| 문서 | 내용 |
|---|---|
| [01-problems.md](01-problems.md) | 측정 환경, 기준 측정, 영역별 문제 |
| [02-plan.md](02-plan.md) | 우선순위, 파일 소유를 나눈 다섯 작업 흐름, 흐름 사이의 계약 |
| [03-results.md](03-results.md) | 개선 전후 측정, 무엇을 바꿨는지, 리뷰에서 고친 것, 남은 문제 |
| [research-rendering.md](research-rendering.md) | three.js 와 R3F 의 렌더링 성능 기법 조사 |
| [research-traffic-shotgun.md](research-traffic-shotgun.md) | 결정적 AI traffic 과 1인칭 shotgun 설계 조사 |
| [work/](work) | 작업 흐름별 상세 보고(교통, 렌더, 실내, 도보, 화면, 외장 모델) |
| [perf/](perf) | 측정 하네스와 결과 JSON |

## 다시 재는 방법

```sh
# 측정용 빌드(minify 를 꺼야 CPU profile 에 함수 이름이 나온다)
npx vite build --minify false --outDir /tmp/dist-a --emptyOutDir

# 한 벌만 재기
cd 0920-plan/perf
PERF_DIST=/tmp/dist-a PERF_LABEL=now PERF_SCENES=orbit,walk,shotgun,car,flight npx playwright test --config=perf.config.js

# 두 빌드를 번갈아 재고 표로 묶기
./compare.sh /tmp/dist-before /tmp/dist-after 비교이름 2 orbit,walk,car,flight
```

다른 브라우저가 같은 GPU 를 쓰면 같은 빌드가 열 배까지 다르게 나온다. 결과의 `foreignGpuPct` 가 0 인 표본만 쓴다.
