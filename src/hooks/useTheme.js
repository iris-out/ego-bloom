import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'eb-theme';
const MEDIA = '(prefers-color-scheme: dark)';

function readStoredPref() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // localStorage 접근 불가(사생활 보호 모드 등) 시 기본값으로 진행한다.
  }
  return 'system';
}

function applyToDocument(resolved) {
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  const bg = resolved === 'light' ? '#F6F2FC' : '#1B1535';
  if (meta) meta.setAttribute('content', bg);
}

function subscribeToMedia(callback) {
  let mql;
  try {
    mql = window.matchMedia(MEDIA);
  } catch {
    return () => {};
  }
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function readMediaSnapshot() {
  try {
    return window.matchMedia(MEDIA).matches;
  } catch {
    return true;
  }
}

/**
 * 테마 선택 상태 훅이다. index.html 의 부트스트랩 스크립트가 첫 페인트 값을 정하고,
 * 이 훅은 이후 변경(사용자 선택, OS 설정 변경)을 반영한다.
 * @returns {{ pref: 'system'|'light'|'dark', resolved: 'light'|'dark', setPref: (p: 'system'|'light'|'dark') => void }}
 */
export function useTheme() {
  const [pref, setPrefState] = useState(readStoredPref);
  const prefersDark = useSyncExternalStore(subscribeToMedia, readMediaSnapshot, () => true);
  const resolved = pref === 'system' ? (prefersDark ? 'dark' : 'light') : pref;

  const setPref = useCallback((next) => {
    setPrefState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 저장 실패는 무시한다. 이번 세션 동안만 적용된다.
    }
  }, []);

  useEffect(() => {
    applyToDocument(resolved);
  }, [resolved]);

  return { pref, resolved, setPref };
}
