import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './ZetaSpotlightCard.css';

function formatCount(num) {
  if (num >= 100000000) return (num / 100000000).toFixed(2) + '억';
  if (num >= 10000) return (num / 10000).toFixed(2) + '만';
  return (num ?? 0).toLocaleString();
}

const ZetaSpotlightCard = ({ characters }) => {
  const [index, setIndex] = useState(0);

  if (!characters || characters.length === 0) return null;

  const current = characters[index];

  // Determine rank type kicker label
  let kicker = '랭킹';
  if (current.globalRank === current.trendingRank) kicker = '트렌딩';
  else if (current.globalRank === current.bestRank) kicker = '베스트';
  else if (current.globalRank === current.newRank) kicker = '신작';

  const next = () => setIndex((prev) => (prev + 1) % characters.length);
  const prev = () => setIndex((prev) => (prev - 1 + characters.length) % characters.length);

  // Optimize image size (requesting 192px width for 96x96 thumb @2x)
  const baseImgUrl = current.imageUrl || current.imageUrls?.[0];
  const optimizedImgUrl = baseImgUrl
    ? (baseImgUrl.includes('?') ? `${baseImgUrl}&w=192` : `${baseImgUrl}?w=192`)
    : null;

  const rankDiff = current.rankDiff;
  let diffEl = null;
  if (typeof rankDiff === 'number' && rankDiff > 0) {
    diffEl = <span className="zeta-rank-diff up">▲ {rankDiff}</span>;
  } else if (typeof rankDiff === 'number' && rankDiff < 0) {
    diffEl = <span className="zeta-rank-diff down">▼ {Math.abs(rankDiff)}</span>;
  }

  return (
    <div className="zeta-spotlight-wrapper">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="zeta-spotlight-item"
        >
          <div className="zeta-spotlight-card">
            {/* Left column */}
            <div className="zeta-spotlight-left">
              <div className="zeta-kicker">{kicker}</div>

              <div className="zeta-left-main">
                <div className="zeta-thumb">
                  {optimizedImgUrl ? (
                    <img src={optimizedImgUrl} alt={current.name} />
                  ) : null}
                </div>

                <div className="zeta-text-block">
                  <h2 className="zeta-name" title={current.name}>
                    {current.name}
                  </h2>
                  {current.shortDescription ? (
                    <p className="zeta-desc">{current.shortDescription}</p>
                  ) : null}
                  <div className="zeta-interaction">
                    💬 {formatCount(current.interactionCount)}
                  </div>
                </div>
              </div>
            </div>

            {/* Right gold block */}
            <div className="zeta-gold-block">
              <div className="zeta-gold-top">순위</div>
              <div className="zeta-gold-number">
                {String(current.globalRank ?? 0).padStart(2, '0')}
              </div>
              <div className="zeta-gold-bottom">{diffEl}</div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Controls */}
      {characters.length > 1 && (
        <div className="zeta-controls-container">
          <div className="zeta-spotlight-nav-inline">
            <button className="zeta-nav-btn" onClick={prev} aria-label="이전">
              <ChevronLeft size={20} />
            </button>
            <div className="zeta-spotlight-dots-inline">
              {characters.map((_, i) => (
                <div
                  key={i}
                  className={`zeta-dot ${i === index ? 'active' : ''}`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
            <button className="zeta-nav-btn" onClick={next} aria-label="다음">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZetaSpotlightCard;
