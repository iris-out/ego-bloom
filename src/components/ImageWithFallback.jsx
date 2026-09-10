import { useState } from 'react';

/**
 * src 로딩 실패 시 fallbackSrcs 를 순서대로 시도하고, 전부 실패하면 자리표시자 아이콘을 보여준다.
 * @param {object} props
 * @param {string} [props.src]
 * @param {string[]} [props.fallbackSrcs]
 * @param {string} [props.alt]
 * @param {string} [props.className]
 */
export default function ImageWithFallback({ src, fallbackSrcs = [], alt = '', className = '', ...props }) {
  const sources = [src, ...fallbackSrcs].filter(Boolean);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const currentSrc = sources[currentIndex];

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
        className={`flex items-center justify-center ${className}`}
        style={{ background: 'var(--surface-2)', color: 'var(--fg-3)' }}
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
      className={className}
      loading="lazy"
      onError={handleError}
      {...props}
    />
  );
}
