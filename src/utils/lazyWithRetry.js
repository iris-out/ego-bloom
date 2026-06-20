import { lazy } from 'react';

/**
 * React.lazy 래퍼: 배포 직후 stale 청크(옛 해시 파일 404)로 dynamic import 가
 * 실패하는 문제를 자동 복구한다.
 *
 * 시나리오: 사용자가 옛 index.html 을 띄워둔 상태에서 새 배포가 일어나면,
 * 옛 청크(예: AchievementsTab-DzPbi9-V.js)는 Vercel 과 SW 캐시에서 모두 사라진다.
 * 이때 탭을 눌러 dynamic import 가 호출되면 404 → "error loading dynamically
 * imported module" 가 터진다. 한 번만 새로고침하면 새 index.html + 새 해시로
 * 정상 로드된다.
 *
 * @param {() => Promise<any>} importFn  () => import('...') 형태의 동적 import
 * @param {string} name  재시도 플래그를 구분하기 위한 고유 키
 * @returns React.LazyExoticComponent
 */
export function lazyWithRetry(importFn, name) {
  const sessionKey = `lazy-retry-${name}`;

  return lazy(async () => {
    try {
      const component = await importFn();
      // 성공 시 재시도 플래그 정리 → 다음 stale 배포 때 다시 한 번 새로고침 허용.
      window.sessionStorage.removeItem(sessionKey);
      return component;
    } catch (error) {
      const alreadyRetried =
        window.sessionStorage.getItem(sessionKey) === 'true';

      // 아직 새로고침을 시도하지 않았다면, 한 번만 강제 리로드해서
      // 최신 index.html(새 청크 해시)을 받아온다.
      if (!alreadyRetried) {
        window.sessionStorage.setItem(sessionKey, 'true');
        window.location.reload();
        // 리로드가 진행되는 동안 Suspense 가 fallback 을 유지하도록
        // 영원히 resolve 되지 않는 Promise 를 반환한다.
        return new Promise(() => {});
      }

      // 새로고침 후에도 실패하면 진짜 에러이므로 그대로 전파한다.
      throw error;
    }
  });
}
