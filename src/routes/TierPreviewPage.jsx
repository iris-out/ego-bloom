import React, { useState } from 'react';
import { THEMES } from '../components/tierThemes';
import { TIERS } from '../components/tierThemes/themeMeta';

const SIZE_OPTIONS = ['sm', 'md', 'lg', 'xl'];

// All cells rendered per theme row: 8 tiers + #1 apex + Top-10.
const CELLS = [
  ...TIERS.map((t) => ({ key: t.key, label: t.name, tier: t.key })),
  { key: 'rank1', label: '#1', tier: 'champion', rank: 1 },
  { key: 'top10', label: 'Top 10', tier: 'champion', rank: 5 },
];

const FAMILY_COLOR = { Heraldic: '#FBBF24', Gemstone: '#60A5FA', Cosmic: '#A78BFA' };
const VARIANT_LABEL = { base: '원본', A: '바리에이션 A', B: '바리에이션 B' };

export default function TierPreviewPage() {
  const [size, setSize] = useState('lg');
  const [dark, setDark] = useState(true);
  const [animate, setAnimate] = useState(true);

  const pageBg = dark ? '#0a0a0f' : '#eef1f6';
  const textColor = dark ? '#e5e7eb' : '#1f2937';
  const subColor = dark ? '#9ca3af' : '#6b7280';
  const cellBg = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
  const cardBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)';
  const cardBorder = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: textColor, padding: '24px 16px 80px', transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <header style={{ marginBottom: 8 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
            티어 아이콘 테스트 공간입니다
          </h1>
        </header>

        {/* Controls */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10, display: 'flex', flexWrap: 'wrap', gap: 16,
          alignItems: 'center', padding: '12px 14px', marginBottom: 24, borderRadius: 14,
          background: dark ? 'rgba(15,15,22,0.85)' : 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)', border: `1px solid ${cardBorder}`,
        }}>
          <ControlGroup label="크기">
            {SIZE_OPTIONS.map((s) => (
              <Pill key={s} active={size === s} onClick={() => setSize(s)} dark={dark}>{s}</Pill>
            ))}
          </ControlGroup>
          <ControlGroup label="배경">
            <Pill active={dark} onClick={() => setDark(true)} dark={dark}>다크</Pill>
            <Pill active={!dark} onClick={() => setDark(false)} dark={dark}>라이트</Pill>
          </ControlGroup>
          <ControlGroup label="애니메이션">
            <Pill active={animate} onClick={() => setAnimate(true)} dark={dark}>ON</Pill>
            <Pill active={!animate} onClick={() => setAnimate(false)} dark={dark}>OFF</Pill>
          </ControlGroup>
        </div>

        {/* Theme sections */}
        {THEMES.map(({ id, name, ko, family, variant, Component }, i) => {
          const badge = { color: FAMILY_COLOR[family] || '#9CA3AF', text: `${family} · ${VARIANT_LABEL[variant] || variant}` };
          return (
            <section key={id} style={{
              marginBottom: 22, padding: '18px 18px 22px', borderRadius: 16,
              background: cardBg, border: `1px solid ${cardBorder}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: subColor }}>{String(i + 1).padStart(2, '0')}</span>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{name}</h2>
                <span style={{ fontSize: 14, color: subColor }}>{ko}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  color: badge.color, background: `${badge.color}22`,
                }}>{badge.text}</span>
              </div>

              {!Component ? (
                <div style={{ color: '#f87171', fontSize: 13 }}>⚠ 컴포넌트 미연결</div>
              ) : (
                <div style={{
                  display: 'grid', gap: 10,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                }}>
                  {CELLS.map((cell) => (
                    <div key={cell.key} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      padding: '14px 6px', borderRadius: 12, background: cellBg,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 96 }}>
                        <Component tier={cell.tier} rank={cell.rank} size={size} animate={animate} />
                      </div>
                      <span style={{ fontSize: 11, color: subColor, textAlign: 'center', lineHeight: 1.2 }}>{cell.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ControlGroup({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, opacity: 0.6, fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>{children}</div>
    </div>
  );
}

function Pill({ active, onClick, dark, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
        padding: '5px 11px', borderRadius: 999, textTransform: 'uppercase',
        color: active ? (dark ? '#0a0a0f' : '#fff') : (dark ? '#cbd5e1' : '#475569'),
        background: active ? (dark ? '#e5e7eb' : '#1f2937') : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}
