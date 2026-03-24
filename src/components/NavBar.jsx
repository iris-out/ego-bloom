import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, TrendingUp, Flower2, BarChart3 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { APP_VERSION } from '../data/changelog';

/**
 * variant:
 *   'home'    – 로고 + 랭킹 링크 + 테마 토글
 *   'profile' – 뒤로가기 + 버전 + 테마 토글
 *   'ranking' – 뒤로가기 + 로고 + 테마 토글
 */
export default function NavBar({ variant = 'home', onBack, serverStatus, onStatusClick }) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const statusDot = {
    checking: { bg: 'bg-gray-400', glow: '', pulse: true },
    ok:       { bg: 'bg-emerald-400', glow: 'shadow-[0_0_7px_2px_rgba(52,211,153,0.7)]', pulse: false },
    warning:  { bg: 'bg-amber-400',  glow: 'shadow-[0_0_7px_2px_rgba(251,191,36,0.7)]',  pulse: true  },
    error:    { bg: 'bg-red-400',    glow: 'shadow-[0_0_7px_2px_rgba(248,113,113,0.7)]', pulse: true  },
  };
  const statusLabel = { checking: '확인 중', ok: '정상', warning: '불안정', error: '이상' };
  const dot = statusDot[serverStatus] || statusDot.error;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <nav className="nav">
      <div className="nav-inner">
        {/* 왼쪽 영역 */}
        {variant === 'home' && (
          <span className="nav-logo">
            <em>Ego</em>Bloom
          </span>
        )}
        {variant === 'profile' && (
          <button className="nav-back" onClick={handleBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            홈으로
          </button>
        )}
        {variant === 'ranking' && (
          <button className="nav-back" onClick={handleBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            홈으로
          </button>
        )}

        {/* 서버 상태 (home/ranking 에서 표시) */}
        {serverStatus && variant !== 'profile' && (
          <button
            onClick={onStatusClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 select-none"
            style={{
              background: 'rgba(8,8,14,0.92)',
              border: '1px solid rgba(255,255,255,0.07)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot.bg} ${dot.glow} ${dot.pulse ? 'animate-pulse' : ''}`} />
            <span className="text-[11px] font-semibold text-white/80 tracking-wide hidden sm:inline">
              {statusLabel[serverStatus]}
            </span>
          </button>
        )}

        {/* 중간 spacer (profile 일 때 로고 표시 + 홈으로 이동) */}
        {variant === 'profile' && (
          <button className="nav-logo text-center" style={{ textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer' }} onClick={handleBack}>
            <em>Ego</em>Bloom
          </button>
        )}

        {/* 오른쪽 액션들 */}
        {variant === 'home' && (
          <button
            className="nav-btn"
            onClick={() => navigate('/ranking')}
            title="트렌드 랭킹"
            aria-label="트렌드 랭킹"
          >
            <BarChart3 size={16} />
          </button>
        )}

        <button
          className="nav-btn"
          onClick={toggleTheme}
          title="테마 전환"
          aria-label="테마 전환"
        >
          {theme === 'dark'
            ? <Sun size={16} />
            : <Moon size={16} />
          }
        </button>
      </div>
    </nav>
  );
}
