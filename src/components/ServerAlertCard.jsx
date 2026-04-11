// src/components/ServerAlertCard.jsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, AlertOctagon } from 'lucide-react';

const AUTO_DISMISS_MS = 10_000;

/**
 * props:
 *   status  — 'warning' | 'error'
 *   message — string | null  (Zeta emergency 메시지)
 */
export default function ServerAlertCard({ status, message }) {
  const [visible, setVisible] = useState(true);

  // 10초 자동 dismiss
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [visible]);

  // status/message 바뀌면 다시 표시
  useEffect(() => {
    setVisible(true);
  }, [status, message]);

  const isError = status === 'error';

  const colors = isError
    ? {
        border: 'rgba(248,113,113,0.35)',
        bg: 'rgba(248,113,113,0.08)',
        badgeBg: 'rgba(248,113,113,0.15)',
        badgeBorder: 'rgba(248,113,113,0.4)',
        badgeText: '#f87171',
        titleText: '#fca5a5',
        dot: '#f87171',
        dotGlow: 'rgba(248,113,113,0.6)',
      }
    : {
        border: 'rgba(251,191,36,0.35)',
        bg: 'rgba(251,191,36,0.07)',
        badgeBg: 'rgba(251,191,36,0.15)',
        badgeBorder: 'rgba(251,191,36,0.4)',
        badgeText: '#fbbf24',
        titleText: '#fde68a',
        dot: '#fbbf24',
        dotGlow: 'rgba(251,191,36,0.6)',
      };

  const Icon = isError ? AlertOctagon : AlertTriangle;
  const label = isError ? '서버 이상' : '서버 불안정';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`${status}-${message}`}
          initial={{ y: '-130%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-130%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          style={{
            position: 'fixed',
            top: 'calc(var(--nav-height, 54px) + 8px)',
            left: '12px',
            right: '12px',
            zIndex: 200,
            background: `linear-gradient(135deg, ${colors.bg}, rgba(8,12,20,0.92))`,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: `1px solid ${colors.border}`,
            borderRadius: '16px',
            padding: '12px 14px',
            boxShadow: `0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px ${colors.border}`,
            maxWidth: '480px',
            margin: '0 auto',
          }}
        >
          {/* 닫기 버튼 */}
          <button
            onClick={() => setVisible(false)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '10px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.3)',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="알림 닫기"
          >
            <X size={14} />
          </button>

          {/* 헤더 행: 아이콘 + 뱃지 + 출처 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
            <Icon size={14} style={{ color: colors.dot, flexShrink: 0 }} />
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: colors.badgeBg,
                border: `1px solid ${colors.badgeBorder}`,
                color: colors.badgeText,
                padding: '2px 8px',
                borderRadius: '8px',
              }}
            >
              {label}
            </span>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>
              emergency.zeta-ai.io
            </span>
          </div>

          {/* 메시지 */}
          {message && (
            <p
              style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.72)',
                lineHeight: 1.55,
                margin: 0,
                paddingRight: '18px',
              }}
            >
              {message}
            </p>
          )}

          {/* 10초 프로그레스 바 */}
          <motion.div
            key={`progress-${status}-${message}`}
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: colors.dot,
              opacity: 0.4,
              borderRadius: '0 0 16px 16px',
              transformOrigin: 'left',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
