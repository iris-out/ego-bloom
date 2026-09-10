import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

const ORDER = ['system', 'light', 'dark'];
const ICON = { system: Monitor, light: Sun, dark: Moon };
const LABEL = { system: '시스템', light: '라이트', dark: '다크' };

/**
 * 시스템 -> 라이트 -> 다크 순으로 순환하는 36px 원형 아이콘 버튼이다.
 * 헤더(데스크톱)와 모바일 메뉴 양쪽에서 쓴다.
 * @param {object} props
 * @param {string} [props.className]
 */
export default function ThemeToggle({ className = '' }) {
  const { pref, setPref } = useTheme();
  const Icon = ICON[pref];

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    setPref(next);
  };

  return (
    <button type="button" className={`eb-btn-icon ${className}`} onClick={cycle} aria-label={`테마: ${LABEL[pref]}`}>
      <Icon size={18} strokeWidth={2} />
    </button>
  );
}
