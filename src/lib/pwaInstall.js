// PWA 설치 상태 외부 스토어.
//
// `beforeinstallprompt` 이벤트는 페이지 로드 직후 단 한 번만 발생하며 React 마운트보다
// 빠를 수 있다. 그래서 모듈 평가 시점(앱 부팅 시)에 곧바로 리스너를 등록해 이벤트를
// 놓치지 않고 붙잡아 둔다. 여러 컴포넌트(배너 + 햄버거 메뉴)가 동일한 설치 프롬프트를
// 공유해야 하므로 단일 싱글턴 스토어로 관리한다.

const DISMISS_COOKIE = 'pwa_install_dismissed';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.navigator.standalone === true // iOS Safari
  );
}

let rawPrompt = null;
let snapshot = { canInstall: false, installed: isStandalone() };
const listeners = new Set();

function set(next) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // 브라우저 기본 미니 인포바 억제 → 커스텀 UI로 유도
    rawPrompt = e;
    if (!snapshot.installed) set({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    rawPrompt = null;
    set({ canInstall: false, installed: true });
  });
}

export function subscribePwaInstall(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getPwaInstallSnapshot() {
  return snapshot;
}

// 네이티브 설치 프롬프트를 띄운다. 사용자가 수락하면 true 반환.
export async function triggerInstall() {
  if (!rawPrompt) return false;
  rawPrompt.prompt();
  const { outcome } = await rawPrompt.userChoice;
  rawPrompt = null; // 프롬프트는 1회용
  set({ canInstall: false });
  if (outcome === 'accepted') set({ installed: true });
  return outcome === 'accepted';
}

export function isInstallDismissed() {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split('; ')
    .some((c) => c.startsWith(`${DISMISS_COOKIE}=`));
}

// 배너 닫기 → 쿠키에 기록하여 일정 기간 다시 보여주지 않는다.
export function dismissInstall(days = 90) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${DISMISS_COOKIE}=1; expires=${expires}; path=/; SameSite=Lax`;
}
