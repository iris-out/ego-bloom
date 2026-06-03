import { useSyncExternalStore } from 'react';
import { subscribePwaInstall, getPwaInstallSnapshot } from '../lib/pwaInstall';

// PWA 설치 가능 여부 구독. { canInstall, installed } 반환.
export function usePwaInstall() {
  return useSyncExternalStore(
    subscribePwaInstall,
    getPwaInstallSnapshot,
    getPwaInstallSnapshot // 서버 스냅샷(SSR 안전)
  );
}
