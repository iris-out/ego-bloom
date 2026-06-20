import React, { useEffect, useMemo, useRef } from 'react';
import { proxyThumbnailUrl } from '../utils/imageUtils';
import { getBirthdayCharacters, formatBirthDate } from '../utils/birthday';

// 생일 전용 축제 팔레트 — 차분한 네이비 UI 위 따뜻한 대비.
const PALETTE = ['#FFD166', '#FF6B9D', '#B57BFF', '#FFB05C', '#7AA3FF', '#FFFFFF'];

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * 배너 내부에서 터지는 폭죽 캔버스.
 * 의존성 없는 경량 파티클 시스템. reduced-motion 이면 아무것도 그리지 않는다.
 */
function useFireworks(canvasRef, hostRef, active) {
  useEffect(() => {
    if (!active || prefersReducedMotion()) return;
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const ctx = canvas.getContext('2d');
    let raf = null;
    let burstTimer = null;
    let particles = [];
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // 한 점에서 방사형으로 터지는 폭죽.
    const burst = (x, y) => {
      const count = 44;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
        const speed = 1.5 + Math.random() * 3.2;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.012 + Math.random() * 0.012,
          size: 1.4 + Math.random() * 2.4,
          color: PALETTE[(Math.random() * PALETTE.length) | 0],
          gravity: 0.03,
        });
      }
    };

    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(loop);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // 진입 시 아바타 부근에서 연속 폭죽, 이후 주기적으로 한 번씩.
    const fireSequence = () => {
      burst(w * 0.12, h * 0.5);
      setTimeout(() => burst(w * 0.28, h * 0.34), 200);
      setTimeout(() => burst(w * 0.2, h * 0.66), 420);
    };
    fireSequence();
    loop();
    burstTimer = setInterval(() => {
      if (document.hidden) return;
      burst(w * (0.1 + Math.random() * 0.5), h * (0.25 + Math.random() * 0.5));
    }, 3600);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (burstTimer) clearInterval(burstTimer);
      ro.disconnect();
      particles = [];
    };
  }, [canvasRef, hostRef, active]);
}

function Avatars({ chars }) {
  const main = chars[0];
  if (chars.length === 1) {
    return (
      <div className="bd-avatar-wrap">
        <div className="bd-avatar-ring" />
        <div className="bd-avatar">
          {main.imageUrl ? (
            <img src={proxyThumbnailUrl(main.imageUrl, 128)} alt={main.name || ''} />
          ) : (
            <span>{(main.name || '?')[0]}</span>
          )}
        </div>
        <div className="bd-cake-pin">🎂</div>
      </div>
    );
  }

  const shown = chars.slice(0, 3);
  const rest = chars.length - shown.length;
  return (
    <div className="bd-avatar-stack">
      {shown.map((c) => (
        <div key={c.id} className="bd-mini">
          {c.imageUrl ? (
            <img src={proxyThumbnailUrl(c.imageUrl, 96)} alt={c.name || ''} />
          ) : (
            <span>{(c.name || '?')[0]}</span>
          )}
        </div>
      ))}
      {rest > 0 && <div className="bd-more">+{rest}</div>}
    </div>
  );
}

/**
 * 제작자 프로필 상단 생일 축하 배너 (Variant A).
 * 오늘이 제작 기념일인 캐릭터가 없으면 아무것도 렌더링하지 않는다.
 */
export default function BirthdayBanner({ characters, creatorName }) {
  const chars = useMemo(() => getBirthdayCharacters(characters), [characters]);
  const hostRef = useRef(null);
  const canvasRef = useRef(null);

  useFireworks(canvasRef, hostRef, chars.length > 0);

  if (chars.length === 0) return null;

  const single = chars.length === 1;
  const main = chars[0];
  const ageChip = main.age >= 1 ? `${main.age}번째 생일` : '첫 생일';
  const dateStr = formatBirthDate(main.birthDate);
  const who = creatorName ? `${creatorName}님이 ` : '';

  return (
    <div className="bd-banner animate-slide-down" ref={hostRef} role="status">
      <canvas className="bd-fx" ref={canvasRef} aria-hidden="true" />

      <Avatars chars={chars} />

      <div className="bd-copy">
        <span className="bd-eyebrow">🎉 오늘의 생일</span>
        {single ? (
          <>
            <div className="bd-headline">
              오늘은 <span className="bd-name">『{main.name}』</span>의 생일이에요
            </div>
            <div className="bd-subline">
              {who}
              {dateStr}에 빚어낸 캐릭터예요. 함께 축하해 주세요.
            </div>
          </>
        ) : (
          <>
            <div className="bd-headline">
              오늘 생일을 맞은 캐릭터가 <span className="bd-name">{chars.length}명</span> 있어요
            </div>
            <div className="bd-subline">
              『{main.name}』 외 {chars.length - 1}명이 오늘 태어났어요. 함께 축하해 주세요.
            </div>
          </>
        )}
      </div>

      {single && <span className="bd-chip">{ageChip}</span>}

      <style>{`
        .bd-banner {
          position: relative;
          overflow: hidden;
          border-radius: 20px;
          margin-top: 16px;
          padding: 24px 26px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 22px;
          align-items: center;
          border: 1px solid rgba(255, 209, 102, 0.22);
          background:
            radial-gradient(420px 200px at 14% 120%, rgba(255,107,157,0.20), transparent 70%),
            radial-gradient(520px 240px at 80% -40%, rgba(181,123,255,0.20), transparent 70%),
            linear-gradient(100deg, #140A1E 0%, #0A0E22 52%, #0B1330 100%);
          box-shadow: 0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .bd-banner::before {
          content: "";
          position: absolute; top: 0; left: 0; right: 0; height: 2px; z-index: 3;
          background: linear-gradient(90deg, transparent, #FFD166, #FF6B9D, #B57BFF, transparent);
          background-size: 200% 100%;
          animation: bd-sheen 6s linear infinite;
        }
        @keyframes bd-sheen { to { background-position: 200% 0; } }

        .bd-fx { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2; }

        .bd-avatar-wrap { position: relative; z-index: 3; width: 80px; height: 80px; }
        .bd-avatar-ring {
          position: absolute; inset: -6px; border-radius: 50%;
          background: conic-gradient(from 0deg, #FFD166, #FF6B9D, #B57BFF, #FFB05C, #FFD166);
          animation: bd-spin 7s linear infinite;
        }
        @keyframes bd-spin { to { transform: rotate(360deg); } }
        .bd-avatar {
          position: absolute; inset: 0; border-radius: 50%; overflow: hidden;
          background: #1a1430; border: 3px solid #0A0E22;
          display: grid; place-items: center; font-size: 32px; font-weight: 800; color: #fff;
        }
        .bd-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .bd-cake-pin {
          position: absolute; right: -4px; bottom: -4px; z-index: 4;
          width: 30px; height: 30px; border-radius: 50%;
          background: linear-gradient(135deg, #FFD166, #FF6B9D);
          display: grid; place-items: center; font-size: 15px;
          box-shadow: 0 4px 12px rgba(255,107,157,0.5);
        }

        .bd-avatar-stack { position: relative; z-index: 3; display: flex; align-items: center; }
        .bd-mini, .bd-more {
          width: 50px; height: 50px; border-radius: 50%; border: 2px solid #0A0E22;
          margin-left: -14px; overflow: hidden;
          display: grid; place-items: center; font-size: 22px; font-weight: 700; color: #fff;
          background: #1a1430; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }
        .bd-mini:first-child { margin-left: 0; }
        .bd-mini img { width: 100%; height: 100%; object-fit: cover; }
        .bd-more {
          font-family: 'JetBrains Mono', monospace; font-size: 13px;
          background: linear-gradient(135deg, #FF6B9D, #B57BFF);
        }

        .bd-copy { position: relative; z-index: 3; min-width: 0; }
        .bd-eyebrow {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          letter-spacing: 0.22em; text-transform: uppercase;
          background: linear-gradient(90deg, #FFD166, #FF6B9D);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .bd-headline {
          font-family: 'Nanum Myeongjo', serif; font-weight: 800;
          font-size: clamp(20px, 3vw, 28px); line-height: 1.2; margin-top: 9px;
          letter-spacing: -0.01em; color: #fff;
        }
        .bd-name {
          background: linear-gradient(92deg, #FFD166 0%, #FF6B9D 45%, #B57BFF 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .bd-subline { color: rgba(255,255,255,0.72); font-size: 13.5px; margin-top: 8px; line-height: 1.5; }

        .bd-chip {
          position: relative; z-index: 3; white-space: nowrap;
          font-family: 'Plus Jakarta Sans', 'Pretendard Variable', sans-serif;
          font-weight: 700; font-size: 13px; color: #1a0e16;
          padding: 9px 16px; border-radius: 999px;
          background: linear-gradient(135deg, #FFD166, #FFB05C);
          box-shadow: 0 8px 24px rgba(255,176,92,0.30);
        }

        @media (max-width: 640px) {
          .bd-banner { grid-template-columns: auto 1fr; gap: 16px; padding: 18px; }
          .bd-chip { grid-column: 1 / -1; justify-self: start; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bd-banner::before, .bd-avatar-ring { animation: none; }
          .bd-fx { display: none; }
        }
      `}</style>
    </div>
  );
}
