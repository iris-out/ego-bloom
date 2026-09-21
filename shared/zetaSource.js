/** 제타 공개 API 를 서버가 직접 읽어 제작자 지표를 만든다.
 *
 * 예전에는 브라우저가 읽은 수치를 그대로 받아 저장했다. Origin 헤더는 브라우저 밖에서
 * 임의로 보낼 수 있으므로 그 방식은 아무나 남의 ELO 를 조작할 수 있었다. 지금은 id 만 받고
 * 수치는 이 모듈이 상류에서 다시 읽는다.
 *
 * 호스트와 User-Agent 는 scripts/fetch_ranking.js 와 같다. fetch 를 주입할 수 있어
 * 단위 테스트가 네트워크 없이 돈다. Three, React, Supabase 에 기대지 않는다.
 */

export const ZETA_API_BASE = 'https://api.zeta-ai.io/v1';
export const USER_AGENT = 'EGO-BLOOM Ranking Service/1.0';
/** 한 번에 받는 캐릭터 수와 상한이다. 브라우저(ProfilePage.fetchAllPlots) 와 같은 값이라
 * 서버가 계산한 값과 화면이 보여 주는 값이 어긋나지 않는다. */
export const PLOT_PAGE = 200;
export const MAX_PLOTS = 2000;

/** ELO 는 재생성 포함 대화 수를 쓴다. ProfilePage 의 mapPlots 와 같은 우선순위다. */
const interactionOf = (plot) => Math.max(0, Math.floor(Number(plot?.interactionCountWithRegen ?? plot?.interactionCount ?? 0) || 0));
const createdOf = (plot) => plot?.createdAt || plot?.createdDate || null;
const count = (value) => Math.max(0, Math.floor(Number(value) || 0));

export function createZetaSource({ fetchImpl, base = ZETA_API_BASE, maxPlots = MAX_PLOTS } = {}) {
  const call = fetchImpl || globalThis.fetch;
  if (typeof call !== 'function') throw new Error('fetch is not available');

  /** 응답이 200 이 아니면 null 이다. 호출자가 404 와 장애를 구분해 다룬다. */
  async function getJson(path) {
    const response = await call(`${base}${path}`, { headers: { 'User-Agent': USER_AGENT } });
    if (!response || !response.ok) return null;
    return response.json();
  }

  /** 제작자의 캐릭터를 전부 받는다. 정렬이 대화 수 내림차순이라 첫 쪽에 상위 20개가 있다.
   * 그래도 캐릭터 수와 가장 오래된 생성일을 알아야 해서 끝까지 읽는다. 한 쪽이 상한보다
   * 적게 오면 마지막 쪽이다. */
  async function listPlots(creatorId) {
    const query = `creatorId=${encodeURIComponent(creatorId)}&limit=${PLOT_PAGE}`
      + '&orderBy.property=INTERACTION_COUNT_WITH_REGEN&orderBy.direction=DESC';
    const plots = [];
    for (let offset = 0; offset < maxPlots; offset += PLOT_PAGE) {
      const page = await getJson(`/plots?${query}&offset=${offset}`);
      const rows = Array.isArray(page?.plots) ? page.plots : [];
      plots.push(...rows);
      if (rows.length < PLOT_PAGE) break;
    }
    return plots;
  }

  /** ELO 계산에 필요한 값만 담은 한 벌이다. 상류에 제작자가 없으면 null 이다. */
  async function creatorSnapshot(id) {
    const [profile, stats] = await Promise.all([getJson(`/users/${id}`), getJson(`/creators/${id}/stats`)]);
    if (!profile || !stats) return null;

    const plots = await listPlots(id);
    const interactions = plots.map(interactionOf).sort((a, b) => b - a);
    // 음성 재생은 회수가 없으면 초를 쓴다. ProfilePage 가 화면에 쓰는 폴백과 같다.
    const voice = stats.voicePlayCount == null && stats.voicePlaySeconds != null
      ? Math.round(Number(stats.voicePlaySeconds) || 0)
      : stats.voicePlayCount;

    return {
      id,
      handle: typeof profile.username === 'string' ? profile.username : null,
      nickname: typeof profile.nickname === 'string' && profile.nickname ? profile.nickname : 'Unknown',
      profileImageUrl: typeof profile.profileImageUrl === 'string' ? profile.profileImageUrl : null,
      followerCount: count(stats.followerCount),
      plotInteractionCount: count(stats.plotInteractionCount),
      voicePlayCount: count(voice),
      // 삭제되거나 비공개된 캐릭터가 통계에 남는 일이 있어 실제 목록 길이를 쓴다.
      plotCount: plots.length,
      topCharInteractions: interactions.slice(0, 20),
      oldestCharCreatedAt: plots.reduce((oldest, plot) => {
        const made = createdOf(plot);
        if (!made) return oldest;
        return !oldest || made < oldest ? made : oldest;
      }, null),
    };
  }

  return { getJson, listPlots, creatorSnapshot };
}
