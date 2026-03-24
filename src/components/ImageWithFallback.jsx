import React, { useState } from 'react';

export default function ImageWithFallback({ src, fallbackSrcs = [], alt = '', className = '', ...props }) {
  const sources = [src, ...fallbackSrcs].filter(Boolean);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const currentSrc = sources[currentIndex];
  // 프록시 도메인인지 확인 (zeta-image, zeta-s3)
  const isProxy = currentSrc?.startsWith('/zeta-image') || currentSrc?.startsWith('/zeta-s3');

  const handleError = () => {
    if (currentIndex < sources.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      setFailed(true);
    }
  };

  if (failed || !currentSrc) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--bg-secondary)] text-[var(--text-tertiary)] ${className}`}
        {...props}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={`${className} transition-opacity duration-500`}
      {...(isProxy ? {} : { crossOrigin: "anonymous" })}
      loading="lazy"
      onError={handleError}
      {...props}
    />
  );
}
