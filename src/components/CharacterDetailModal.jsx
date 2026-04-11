import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getCharacterTier, formatCompactNumber, toKST } from '../utils/tierCalculator';
import ImageWithFallback from './ImageWithFallback';

const CACHE_PREFIX = 'char_detail_v1_';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4시간

/**
 * 이미지에서 지배적인 색조(hue)와 채도(saturation)를 추출한다.
 * - 50×50으로 다운샘플링 후 픽셀 전수 조사
 * - 명도 너무 낮거나(어두움) 너무 높은(밝음) 픽셀, 채도 낮은(회색) 픽셀 제외
 * - 10° 단위 36개 버킷으로 hue 집계, 채도를 가중치로 사용
 * - 인접 버킷을 병합하여 넓은 색상군에서 대표 hue 계산
 */
function extractImagePalette(imageUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const SIZE = 50;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE; canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

        // hue 버킷 (10° × 36개), 가중치 = 채도
        const buckets = new Float32Array(36);
        const satAcc  = new Float32Array(36);
        let total = 0;

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 100) continue;

          const r = data[i]     / 255;
          const g = data[i + 1] / 255;
          const b = data[i + 2] / 255;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const l = (max + min) / 2;

          // 너무 어둡거나(l<0.06), 너무 밝거나(l>0.92), 무채색(delta<0.1) 제외
          if (l < 0.06 || l > 0.92 || delta < 0.1) continue;

          const s = delta / (1 - Math.abs(2 * l - 1));
          if (s < 0.18) continue; // 채도 낮은 픽셀 제외

          let h = 0;
          if      (max === r) h = ((g - b) / delta + 6) % 6;
          else if (max === g) h =  (b - r) / delta + 2;
          else                h =  (r - g) / delta + 4;
          h = (h * 60 + 360) % 360;

          const bi = Math.floor(h / 10) % 36;
          buckets[bi] += s; // 채도 가중치
          satAcc[bi]  += s;
          total++;
        }

        if (total < 30) { resolve(null); return; }

        // 인접 3버킷(30°)을 합산하여 가장 강한 색상군 찾기
        let bestScore = 0, bestBucket = -1;
        for (let i = 0; i < 36; i++) {
          const score = buckets[i]
            + buckets[(i + 1) % 36] * 0.7
            + buckets[(i + 35) % 36] * 0.7;
          if (score > bestScore) { bestScore = score; bestBucket = i; }
        }

        if (bestBucket === -1) { resolve(null); return; }

        // 인접 버킷들의 가중 평균 hue 계산
        const candidates = [
          (bestBucket + 35) % 36,
          bestBucket,
          (bestBucket + 1)  % 36,
        ];
        let wSum = 0, hSin = 0, hCos = 0;
        for (const ci of candidates) {
          const w = buckets[ci];
          const hRad = (ci * 10 + 5) * Math.PI / 180;
          hSin += Math.sin(hRad) * w;
          hCos += Math.cos(hRad) * w;
          wSum += w;
        }
        if (wSum === 0) { resolve(null); return; }

        let hue = Math.atan2(hSin / wSum, hCos / wSum) * 180 / Math.PI;
        if (hue < 0) hue += 360;

        // 지배 색상의 평균 채도 (0~1)
        const avgSat = wSum > 0 ? (satAcc[bestBucket] / Math.max(1, buckets[bestBucket] / (wSum / candidates.length))) : 0.5;

        resolve({ hue: Math.round(hue), sat: Math.min(1, avgSat) });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

function getCache(id) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + id);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(CACHE_PREFIX + id); return null; }
    return data;
  } catch { return null; }
}

function setCache(id, data) {
  try { localStorage.setItem(CACHE_PREFIX + id, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

const TIER_COLORS = {
  x:  '#F56565',
  sr: '#F6AD55',
  r:  '#A78BFA',
  s:  '#60A5FA',
  a:  '#34D399',
  b:  '#9CA3AF',
};

const TIER_GRADIENTS = {
  x:  'linear-gradient(135deg, #F56565, #C53030)',
  sr: 'linear-gradient(135deg, #F6AD55, #DD6B20)',
  r:  'linear-gradient(135deg, #A78BFA, #7C3AED)',
  s:  'linear-gradient(135deg, #60A5FA, #2563EB)',
  a:  'linear-gradient(135deg, #34D399, #059669)',
  b:  'linear-gradient(135deg, #9CA3AF, #6B7280)',
};

const TIER_BADGE_TEXT = { sr: '#000', x: '#fff', r: '#fff', s: '#fff', a: '#fff', b: '#fff' };

export default function CharacterDetailModal({ char, isOpen, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bgPalette, setBgPalette] = useState(null); // { hue, sat }

  useEffect(() => {
    if (!isOpen || !char?.id) return;
    setDetail(null);

    const cached = getCache(char.id);
    if (cached) { setDetail(cached); return; }

    setLoading(true);
    fetch(`/api/zeta/plots/${char.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setCache(char.id, data); setDetail(data); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, char?.id]);

  // 이미지 색상 추출
  useEffect(() => {
    if (!isOpen) { setBgPalette(null); return; }
    if (!char?.imageUrl) { setBgPalette(null); return; }
    setBgPalette(null);
    extractImagePalette(char.imageUrl).then(setBgPalette);
  }, [isOpen, char?.imageUrl]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handler);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !char) return null;

  const tier = getCharacterTier(char.interactionCount || 0);
  const tc = TIER_COLORS[tier.key] || '#9CA3AF';
  const tg = TIER_GRADIENTS[tier.key] || TIER_GRADIENTS.b;
  const tbText = TIER_BADGE_TEXT[tier.key] || '#fff';

  const tags = (char.hashtags || char.tags || []).slice(0, 6);

  // 설명: API에서 가져온 longDescription > shortDescription 순으로 우선
  const description =
    detail?.longDescription ||
    detail?.shortDescription ||
    char.shortDescription ||
    null;

  const createdRaw = char.createdAt || char.createdDate;
  const createdDate = createdRaw ? toKST(createdRaw) : null;
  const isValidDate = createdDate && !isNaN(createdDate.getTime());
  const dateFormatted = isValidDate
    ? `${String(createdDate.getFullYear()).slice(2)}.${String(createdDate.getMonth() + 1).padStart(2, '0')}.${String(createdDate.getDate()).padStart(2, '0')}`
    : null;
  const daysSince = isValidDate ? Math.max(1, Math.floor((Date.now() - createdDate.getTime()) / 86400000)) : null;
  const avgPerDay = daysSince && char.interactionCount ? Math.round(char.interactionCount / daysSince) : null;
  const isNewChar = daysSince != null && daysSince < 30;
  const ageLabelShort = isNewChar
    ? daysSince < 1   ? '당일'
    : daysSince === 1 ? '하루'
    : daysSince < 7   ? `${daysSince}일`
    : `${Math.floor(daysSince / 7)}주`
    : null;

  const zetaUrl = char.id ? `https://zeta-ai.io/ko/plots/${char.id}/profile` : null;

  // 이미지 기반 배경 색상 계산
  const h = bgPalette?.hue ?? null;
  const imgSat = bgPalette?.sat ?? 0.5;
  // 배경: 이미지 색상 hue로 매우 어두운 그라디언트 생성, 채도는 고정 낮게
  const panelBg = h !== null
    ? `linear-gradient(160deg, hsl(${h},${Math.round(imgSat * 22 + 4)}%,7%) 0%, hsl(${h},${Math.round(imgSat * 12 + 2)}%,4%) 55%, #080808 100%)`
    : 'linear-gradient(160deg, #181411 0%, #0A0A0A 100%)';
  const glowColor = h !== null
    ? `hsla(${h},${Math.round(imgSat * 60 + 20)}%,55%,0.10)`
    : `${tc}0E`;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center"
      onClick={onClose}
    >
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      {/* 패널 */}
      <div
        className="relative w-full max-w-[480px] flex flex-col rounded-t-[28px] overflow-hidden animate-slide-up"
        style={{
          maxHeight: '96dvh',
          background: panelBg,
          transition: 'background 0.6s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 주변 글로우 */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[320px] h-[320px] rounded-full pointer-events-none"
          style={{ background: glowColor, filter: 'blur(70px)' }}
        />

        {/* 헤더 라인 + 닫기 */}
        <div className="flex justify-between items-center px-8 pt-10 pb-2 z-20 relative shrink-0">
          <div className="w-8 h-[1px]" style={{ background: `${tc}50` }} />
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-8 pb-4 relative z-20 scrollbar-hide">
          {/* 아바타 + 우상단 정보 */}
          <div className="flex justify-between items-start mt-2">
            <div className="relative">
              <div
                className="w-[87px] h-[87px] rounded-full overflow-hidden"
                style={{ border: `1px solid ${tc}35` }}
              >
                <div
                  className="w-full h-full rounded-full flex items-center justify-center overflow-hidden relative"
                  style={{ background: `linear-gradient(135deg, #1A1612, #0A0A0A)` }}
                >
                  {char.imageUrl ? (
                    <ImageWithFallback
                      src={char.imageUrl}
                      fallbackSrcs={(char.imageUrls || []).slice(1)}
                      alt={char.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0" style={{ background: `${tc}18` }} />
                      <span className="font-sans text-2xl font-bold z-10" style={{ color: `${tc}CC` }}>
                        {(char.name || '?')[0]}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {/* 티어 배지 */}
              <div
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-2 py-[2px] rounded font-bold leading-none whitespace-nowrap tracking-widest"
                style={{ background: '#111111', border: `1px solid ${tc}30`, color: tc, fontSize: '9px' }}
              >
                {tier.name}
              </div>
            </div>

            {/* 생성일 + 언리밋 + 누적 대화수 */}
            <div className="flex flex-col items-end gap-2 pt-1">
              {dateFormatted && (
                <span className="text-[13.5px] text-gray-500 tracking-wider">Est. {dateFormatted}</span>
              )}
              {char.unlimitedAllowed && (
                <div className="flex items-center gap-1.5" style={{ opacity: 0.65 }}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: `${tc}CC` }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span className="text-[12.5px] tracking-widest uppercase font-medium" style={{ color: `${tc}99` }}>언리밋</span>
                </div>
              )}
              <div className="flex flex-col items-end gap-0.5 mt-1">
                <span className="text-[9px] text-gray-600 uppercase tracking-widest">누적 대화수</span>
                <span className="text-[15px] font-bold text-gray-200">{formatCompactNumber(char.interactionCount || 0)}</span>
              </div>
            </div>
          </div>

          {/* 이름 */}
          <div className="mt-8">
            <h1 className="font-sans font-bold text-[27px] text-gray-100 tracking-tight leading-tight">{char.name}</h1>
          </div>

          {/* 태그 */}
          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-2 gap-y-1.5 text-[12px] font-medium text-gray-400 tracking-wider">
              {tags.map((tag, i) => (
                <React.Fragment key={tag}>
                  {i > 0 && <span style={{ color: `${tc}40` }}>/</span>}
                  <span>{tag}</span>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* 인용구 / 설명 */}
          <div className="mt-10 flex-1 min-h-[60px]">
            {loading ? (
              <div className="space-y-2">
                <div className="h-[17px] bg-white/[0.04] rounded animate-pulse w-full" />
                <div className="h-[17px] bg-white/[0.04] rounded animate-pulse w-4/5" />
                <div className="h-[17px] bg-white/[0.04] rounded animate-pulse w-2/3" />
              </div>
            ) : description ? (
              <>
                <span className="text-5xl font-serif leading-none" style={{ color: `${tc}25` }}>"</span>
                <p className="font-sans text-[16px] text-gray-300 leading-[1.6] -mt-2 ml-4 line-clamp-6">
                  {description}
                </p>
              </>
            ) : null}
          </div>

          {/* 스탯 로우 */}
          <div className="mt-10 mb-6 space-y-0">
            {(isNewChar || (avgPerDay && avgPerDay > 0)) && (
              <div className="flex items-center justify-between border-b border-white/[0.04] py-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest">
                    {isNewChar ? '성장 하이라이트' : '하루 평균'}
                  </span>
                  <span className="text-[22px] font-black tracking-tight" style={{ color: tc }}>
                    {isNewChar
                      ? `${ageLabelShort} 만에 ${formatCompactNumber(char.interactionCount || 0)}`
                      : `${formatCompactNumber(avgPerDay)}회 대화`}
                  </span>
                </div>
                <div className="w-8 h-[1px]" style={{ background: `${tc}40` }} />
              </div>
            )}
            {detail?.starCount != null && detail.starCount > 0 && (
              <div className="flex items-center justify-between border-b border-white/[0.04] py-4">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest">즐겨찾기</span>
                <span className="text-[15px] font-bold text-gray-200">{formatCompactNumber(detail.starCount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* CTA 버튼 */}
        <div
          className="px-8 pb-10 z-30 relative shrink-0"
          style={{ background: 'linear-gradient(to top, #0A0A0A 80%, transparent)' }}
        >
          {zetaUrl ? (
            <a
              href={zetaUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="w-full flex items-center justify-center gap-3 py-[15px] font-sans font-medium text-[14px] tracking-widest transition-all relative overflow-hidden group"
              style={{ border: `1px solid ${tc}40`, color: `${tc}CC` }}
            >
              <div
                className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"
                style={{ background: `linear-gradient(90deg, transparent, ${tc}18, transparent)` }}
              />
              <span>대화 시작하기</span>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          ) : (
            <button
              disabled
              className="w-full py-4 text-[13px] text-gray-600 border border-white/5 tracking-widest"
            >
              URL 없음
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
