import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// 가로 스크롤 컨테이너의 스크롤 가능 여부(좌/우)를 구독.
// targetRef 는 overflow-x-auto 스크롤 엘리먼트를 가리켜야 한다.
function useScrollEdges(ref) {
  const [edges, setEdges] = useState({ canLeft: false, canRight: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const canLeft = scrollLeft > 2;
      const canRight = scrollLeft + clientWidth < scrollWidth - 2;
      setEdges((prev) =>
        prev.canLeft === canLeft && prev.canRight === canRight
          ? prev
          : { canLeft, canRight }
      );
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // 자식(카드)이 비동기로 채워질 때도 갱신
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true });

    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [ref]);

  return edges;
}

/**
 * 가로 스크롤 영역의 좌/우 스크롤 어포던스. 스크롤 가능 방향에만 32 원형 버튼을 띄운다.
 * 호버 가능한 포인터(마우스)에서만 노출한다 — 터치 기기는 스와이프로 충분하다.
 * `position: relative` 부모 안에 둘 것.
 *
 * props: { targetRef, size? }
 */
export default function ScrollArrows({ targetRef, size = 32 }) {
  const { canLeft, canRight } = useScrollEdges(targetRef);

  const scroll = useCallback(
    (dir) => {
      const el = targetRef.current;
      if (el) {
        el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 220), behavior: 'smooth' });
      }
    },
    [targetRef]
  );

  const base =
    'hidden [@media(hover:hover)]:flex absolute top-1/2 -translate-y-1/2 z-30 items-center justify-center rounded-full ' +
    'bg-surface-2 border border-line text-fg-2 hover:text-fg transition-opacity duration-200 ' +
    'active:scale-95 motion-reduce:transition-none';
  const dim = { width: size, height: size };
  const icon = Math.round(size * 0.5);

  return (
    <>
      <button
        type="button"
        aria-label="이전으로 스크롤"
        onClick={() => scroll(-1)}
        className={`${base} left-1 ${canLeft ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        style={dim}
        tabIndex={canLeft ? 0 : -1}
      >
        <ChevronLeft size={icon} />
      </button>
      <button
        type="button"
        aria-label="다음으로 스크롤"
        onClick={() => scroll(1)}
        className={`${base} right-1 ${canRight ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        style={dim}
        tabIndex={canRight ? 0 : -1}
      >
        <ChevronRight size={icon} />
      </button>
    </>
  );
}
