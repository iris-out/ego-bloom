#!/usr/bin/env bash
# 개선 전 빌드와 개선 후 빌드를 번갈아 잰다. 같은 시간대에 A, B, A, B 로 돌려 GPU 온도와
# 다른 프로세스의 영향을 양쪽에 고르게 나눈다.
# 사용: compare.sh <before-dist> <after-dist> <label> [rounds] [scenes]
set -euo pipefail
BEFORE=$1 AFTER=$2 LABEL=$3 ROUNDS=${4:-2} SCENES=${5:-orbit,walk,car,flight}
HERE=$(cd "$(dirname "$0")" && pwd)
cd "$HERE"
# 다른 브라우저가 GPU 를 쓰고 있으면 숫자가 열 배까지 틀린다. 시작 전에 알린다.
if pgrep -f -- '--type=gpu-process' | xargs -r -I{} cat /proc/{}/cmdline 2>/dev/null | tr '\0' ' ' | grep -q '/opt/google/chrome'; then
  echo "warning: desktop Chrome GPU process is running; check foreignGpuPct in results" >&2
fi
if ss -ltn 2>/dev/null | grep -q ':4177 '; then echo "port 4177 busy; stop the old preview server first" >&2; exit 1; fi
for round in $(seq 1 "$ROUNDS"); do
  for side in before after; do
    dist=$BEFORE; [ "$side" = after ] && dist=$AFTER
    PERF_DIST=$dist PERF_LABEL="$LABEL-$side-$round" PERF_SCENES=$SCENES PERF_SECONDS=${PERF_SECONDS:-6} \
      timeout 900 npx playwright test --config=perf.config.js > "/tmp/perf-$LABEL-$side-$round.log" 2>&1 || echo "run $side $round failed" >&2
  done
done
node summarize.mjs "$LABEL" "$ROUNDS"
