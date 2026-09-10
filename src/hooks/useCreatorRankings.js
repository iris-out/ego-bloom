import { useEffect, useState } from 'react';

const URL = '/api/get-rankings';

/** @type {Promise<any>|null} */
let inflight = null;
/** @type {any} */
let cache = null;

function load() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch(URL)
      .then((r) => {
        if (!r.ok) throw new Error(`get-rankings ${r.status}`);
        return r.json();
      })
      .then((data) => {
        cache = data;
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * ELO 상위 100명(전날 대비 순위 변동 포함)을 모듈 레벨에서 캐시해 불러온다.
 * `/api/get-rankings` 는 누군가 프로필을 열어야 갱신되므로, 캐시는 세션 동안만 유효하다.
 * @returns {{ data: any, loading: boolean, error: Error|null }}
 */
export function useCreatorRankings() {
  const [data, setData] = useState(() => cache);
  const [loading, setLoading] = useState(() => !cache);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cache) return; // 이미 lazy 초기값으로 반영했다.
    let cancelled = false;
    load()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
