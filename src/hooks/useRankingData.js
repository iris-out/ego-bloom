import { useEffect, useState } from 'react';

const URL = '/data/ranking_latest.json';

/** @type {Promise<any>|null} */
let inflight = null;
/** @type {any} */
let cache = null;

function load() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch(URL)
      .then((r) => {
        if (!r.ok) throw new Error(`ranking_latest.json ${r.status}`);
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
 * cron 이 매시 갱신하는 `/data/ranking_latest.json` 을 모듈 레벨에서 캐시해 불러온다.
 * 여러 컴포넌트가 동시에 호출해도 네트워크 요청은 한 번만 나간다.
 * @returns {{ data: any, loading: boolean, error: Error|null }}
 */
export function useRankingData() {
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
