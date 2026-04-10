# 개발자 레퍼런스 — Ego Bloom 구현 상세

> 시시각각 변하는 구현 상세. 변경 시 이 문서를 업데이트할 것.

## ELO 계산 공식 (v4.2) — `src/utils/tierCalculator.js`

```js
score = (totalInteractions × 3.0)
      + (followers × 300.0)
      + (top20CharInteractions × 0.5)
      + (avgInteractions × 20.0)
      + (voicePlayCount × 100.0)
      + smallRosterBonus    // 캐릭터 10개 미만, 최대 15%
      + shortTenureBonus    // 활동 180일 미만, 최대 10%
```

## 핵심 유틸 함수 (`tierCalculator.js`)

```js
getCharacterTier(interactionCount)
// → { tier: "B|A|S|R|SR|X", color, nextThreshold, progress }

getCreatorTier(score)
// → { tier, subdivision: "I|II|III|IV", progress, minScore, maxScore }

calculateCreatorScore(stats, characters)
// → number (ELO)

toKST(dateInput)
// → Date (KST 기준, Asia/Seoul)

formatNumber(num)
// → "1.2B" | "3.4M" | "56K" | "789"

calculatePercentile(messageCount)
// → 상대적 순위 텍스트
```

## 크리에이터 티어 구간

| 티어 | ELO 범위 |
|------|---------|
| 브론즈 | 0 – 11,999 |
| 실버 | 12,000 – 84,999 |
| 골드 | 85,000 – 868,499 |
| 플래티넘 | 868,500 – 3,908,249 |
| 다이아몬드 | 3,908,250 – 17,369,999 |
| 마스터 | 17,370,000 – 78,164,999 |
| 챔피언 | 78,165,000+ |

각 티어는 4→1 세분화 (예: 브론즈 IV, 브론즈 III ...)

## 캐릭터 티어 구간

| 티어 | 인터랙션 수 |
|------|-----------|
| B | 0 – 999 |
| A | 1,000 – 9,999 |
| S | 10,000 – 99,999 |
| R | 100,000 – 999,999 |
| SR | 1,000,000 – 9,999,999 |
| X | 10,000,000+ |

## 페이지별 로직 흐름

### HomePage (`src/routes/HomePage.jsx`)
```
1. localStorage에서 recentSearches 로드
2. /data/ranking_latest.json fetch → topTags 상위 5개 추출
3. /api/get-rankings fetch → topCreators 상위 5개 추출
4. ego-bloom-visited 미설정 시 DataCollectionModal 표시
5. 긴급 공지 10초 후 자동 닫기
6. 검색 실행 → /profile?creator=@handle 라우팅
```

### ProfilePage (`src/routes/ProfilePage.jsx`)
```
1. URL 쿼리 파라미터에서 creator 파싱
2. @handle 형식이면 /api/resolve-handle 호출 → UUID 획득
3. localStorage 캐시 확인 (30분 TTL)
   - 캐시 hit: 즉시 렌더링
   - 캐시 miss: API 호출
4. 병렬 fetch:
   - GET /api/zeta/users/{id}             → profile
   - GET /api/zeta/creators/{id}/stats    → stats
   - GET /api/zeta/plots (200개씩, 최대 10페이지) → characters
5. characters를 interactionCountWithRegen 기준 정렬
6. calculateCreatorScore(stats, characters) → ELO 점수
7. getCreatorTier(score) → 티어 메타데이터
8. computeEarnedTitles(input) → 획득 배지 목록
9. localStorage에서 selectedBadges 로드 (없으면 상위 4개 자동 선택)
10. sessionStorage에서 rankingMap 조회 → creatorRank
11. 결과 캐시 저장 (30분 TTL)
```

### RankingPage (`src/routes/RankingPage.jsx`)
```
1. /data/ranking_latest.json fetch → hashtagData 저장
2. 탭 선택에 따라 CreatorRankingView 또는 TrendView 렌더링
3. CreatorRankingView: /api/get-rankings 호출, 페이지네이션
4. TrendView: combined/trending/best/new/interaction 표시
```

### TierPage (`src/routes/TierPage.jsx`)
```
- 완전 정적 페이지, API 호출 없음
- CREATOR_TIERS 배열 import → 언랭크 필터링 후 역순 정렬
- ELO 계산 공식 정적 표시
```

### WorldPage (`src/routes/WorldPage.jsx`)
```
1. /api/get-world-data fetch → buildings (Top 1000, BFS 그리드 배치)
2. KST 현재 시각 → timeOfDay 설정 (night/dawn/day/sunset)
3. InstancedMesh 1000개: height = log10(elo_score) * 12 (범위 6–120)
4. 데스크탑: WASD 키보드 / 모바일: JoystickControls (nipplejs)
5. 빌딩 클릭 → selectedCreator HUD 표시
```

## ProfilePage 상태 목록

| 상태 | 타입 | 설명 |
|------|------|------|
| `profile` | object | 크리에이터 기본 정보 |
| `stats` | object | 팔로워/인터랙션/보이스 스탯 |
| `characters` | array | 캐릭터 플롯 배열 |
| `activeTab` | string | `summary` / `detail` / `stats` / `achievements` |
| `loading` | boolean | 로딩 상태 |
| `error` | string | 에러 메시지 |
| `selectedBadges` | array | 선택된 배지 (최대 8개) |
| `creatorRank` | number | 전체 랭킹 순위 |

## API 엔드포인트

```
GET /api/resolve-handle?handle=@{handle}       // handle → UUID
GET /api/zeta/users/{id}                        // 크리에이터 프로필
GET /api/zeta/creators/{id}/stats               // 스탯
GET /api/zeta/plots?creatorId={id}&orderBy=INTERACTION_COUNT_WITH_REGEN&page=N
GET /api/get-rankings                           // Top 100 ELO, Supabase
GET /api/get-world-data                         // Top 1000 월드 데이터
POST /api/update-creator                        // Supabase upsert
GET /data/ranking_latest.json                   // 사전 생성 해시태그 랭킹
```

## 배지 시스템 (`src/data/badges.js`)

총 50개 배지, 3카테고리:

**핵심 배지 (2개):** `sunae` (순애보), `ntr` (사랑 파괴자)

**컨텐츠 배지 (태그 기반, 14개):**
`fantasy`, `cyber`, `mesu`, `unlimit`, `furry`, `iljin`, `jjindda`, `hero`, `academy`, `hyeongwan`, `pipye`, `sihanbu`, `guwon`, `original`

**제작 배지 (연속 제작 기반, 3개):**
| 배지 | 조건 | 이모지 | color |
|------|------|--------|-------|
| `streak_3` | 3일 연속 캐릭터 제작 | 🔥 작심삼일 | orange |
| `streak_7` | 7일 연속 캐릭터 제작 | 🏃 작심칠일 | amber |
| `streak_14` | 14일 연속 캐릭터 제작 | ⛓️ 현생을 사세요 | violet |

**성취 배지 (스탯 기반, 31개) 주요 예시:**
| 배지 | 조건 |
|------|------|
| `newbie` | 활동 3개월 미만 |
| `oneyear` | 365일 이상 |
| `fertile` | 캐릭터 100+ |
| `factory` | 캐릭터 150+ |
| `hattrick` | 100만+ 캐릭터 3개 이상 |
| `superstar` | 팔로워 10,000+ |
| `lonely` | 인터랙션 1000+, 팔로워 0 |
| `100m_zeta` | 단일 캐릭터 1억+ |

### `computeEarnedTitles` 입력/출력
```js
// 입력
{
  characters: [{ id, name, hashtags, tags, interactionCountWithRegen, createdAt, isLongDescriptionPublic }],
  stats: { plotInteractionCount, followerCount, voicePlayCount }
}

// 출력
[{ id, emoji, title, desc, color: { bg, border, text, dot }, earned: bool, chars: [...] }]
```

## localStorage 함수 (`src/utils/storage.js`)

```js
// 최근 검색
getRecentSearches()           // string[] (최대 4)
addRecentSearch(query)        // LRU push
removeRecentSearch(query)     // 제거

// 배지 선호도
getCreatorBadge(creatorId)    // string|null
saveCreatorBadge(creatorId, badgeId)  // LRU 저장 (최대 50)

// 내 프로필
getMyProfileId()              // string|null
setMyProfileId(id)
removeMyProfile()
getMyProfileCache()           // { ...profile, _cachedAt }
setMyProfileCache(data)
isMyProfileStale()            // boolean (3시간 TTL)
```

## ranking_latest.json 구조

```json
{
  "updatedAt": "ISO8601",
  "combined": [{ "tag": "string", "score": 0 }],
  "trending": [{ "tag": "string", "score": 0 }],
  "best": [{ "tag": "string", "score": 0 }],
  "new": [{ "tag": "string", "score": 0 }],
  "interaction": [{ "tag": "string", "score": 0 }],
  "genres": [{ "tag": "string", "score": 0, "pct": 0 }]
}
```
- 각 배열: Top 30 태그
- 태그 점수 = `(101 - rank) × type_weight` (TRENDING: 3×, BEST: 2×, NEW: 1×)
- 금지 태그: `hl`, `언리밋`

## 프로필 카드 PNG 내보내기 (`src/utils/imageUtils.js`)

```js
import { toPng } from 'html-to-image'
toPng(cardDomNode, options) // → PNG Blob → 다운로드/공유
```

## GitHub Actions 자동화

```
트리거: 매일 UTC 15:00 (KST 00:00)
→ node scripts/fetch_ranking.js
→ Zeta API /plots/ranking?type=TRENDING|BEST|NEW&limit=100
→ 태그 점수 집계 + 금지 태그 필터링
→ public/data/ranking_latest.json 업데이트
→ 변경사항 있으면 git commit + push
→ Vercel 자동 배포
```
