import { useState, useEffect } from 'react';

/**
 * CSS 미디어쿼리 매칭 여부를 반환. SPA(클라이언트 전용)이므로 초기값을
 * window.matchMedia로 동기 계산해 첫 페인트부터 레이아웃이 맞게 한다.
 * @param {string} query - 예: '(min-width: 1024px)'
 * @returns {boolean}
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange(); // 쿼리 문자열 변경 시 동기화
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** PC(데스크탑) 기준 — Tailwind lg 브레이크포인트(1024px)와 일치 */
export function useIsPC() {
  return useMediaQuery('(min-width: 1024px)');
}
