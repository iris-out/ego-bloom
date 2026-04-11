import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import './ZetaSpotlightCard.css';

function formatCount(num) {
  if (num >= 100000000) return (num / 100000000).toFixed(2) + '억';
  if (num >= 10000) return (num / 10000).toFixed(2) + '만';
  return num.toLocaleString();
}

const ZetaSpotlightCard = ({ characters }) => {
  const [index, setIndex] = useState(0);

  if (!characters || characters.length === 0) return null;

  const current = characters[index];
  
  // Determine rank type badge
  let rankType = '랭킹';
  if (current.globalRank === current.trendingRank) rankType = '트렌딩';
  else if (current.globalRank === current.bestRank) rankType = '베스트';
  else if (current.globalRank === current.newRank) rankType = '신작';

  const next = () => setIndex((prev) => (prev + 1) % characters.length);
  const prev = () => setIndex((prev) => (prev - 1 + characters.length) % characters.length);

  const isGold = current.globalRank === 1;
  const isSilver = current.globalRank === 2;
  const isBronze = current.globalRank === 3;
  const rankClass = isGold ? 'gold-rank' : isSilver ? 'silver-rank' : isBronze ? 'bronze-rank' : '';

  // Optimize image size (requesting 280px width)
  const baseImgUrl = current.imageUrl || current.imageUrls?.[0];
  const optimizedImgUrl = baseImgUrl ? (baseImgUrl.includes('?') ? `${baseImgUrl}&w=280` : `${baseImgUrl}?w=280`) : null;

  return (
    <div className={`zeta-spotlight-wrapper ${rankClass}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="zeta-spotlight-item"
        >
          <div className="spotlight-card">
            {/* Character Portal */}
            <div className="character-portal">
              <div className="orbit-ring" />
              <img
                src={optimizedImgUrl}
                alt={current.name}
                className="character-image"
              />
            </div>

            {/* Character Info */}
            <div className="character-info">
              <div className="badge-row">
                {(current.hashtags || current.tags || []).slice(0, 3).map((tag, i) => (
                  <span key={i} className="pill-badge">
                    #{tag}
                  </span>
                ))}
                <div className="pill-badge rank-type">
                  <div className="pill-icon" />
                  {rankType}
                </div>
              </div>
              
              <div>
                <h2 className="character-name" title={current.name}>{current.name}</h2>
                <p className="character-desc">{current.shortDescription}</p>
              </div>

              <div className="interaction-meter">
                <MessageSquare size={14} className="meter-icon" />
                <span className="interaction-text">
                  <strong>{formatCount(current.interactionCount)}</strong>
                </span>
              </div>
            </div>

            {/* Rank Display */}
            <div className="rank-display">
              <span className="rank-label">Global Rank</span>
              <div className="rank-number">
                <span>#</span>{String(current.globalRank).padStart(2, '0')}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Controls */}
      {characters.length > 1 && (
        <div className="zeta-controls-container">
          <div className="zeta-spotlight-nav-inline">
            <button className="zeta-nav-btn" onClick={prev}>
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
            <button className="zeta-nav-btn" onClick={next}>
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZetaSpotlightCard;
