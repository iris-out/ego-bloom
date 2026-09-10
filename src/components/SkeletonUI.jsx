/**
 * 카드 모양 뼈대다. 프레임 2px --line, 이미지 영역 --surface-2, 텍스트 바 2줄.
 */
function CardBone() {
  return (
    <div
      className="w-full flex flex-col overflow-hidden"
      style={{ border: 'var(--border-w) solid var(--line)', borderRadius: 'var(--radius-m)' }}
    >
      <div className="eb-bone w-full aspect-[3/4]" style={{ borderRadius: 0 }} />
      <div className="flex flex-col gap-1.5 p-2">
        <div className="eb-bone h-3 w-4/5" />
        <div className="eb-bone h-3 w-2/5" />
      </div>
    </div>
  );
}

/** 펄스는 컨테이너 하나에만 건다(.eb-skel). 개별 뼈는 색만 가진다(.eb-bone). */
export default function SkeletonUI() {
  return (
    <div className="eb-skel w-full space-y-4 pt-4">
      <div className="eb-tile flex flex-col items-center gap-3">
        <div className="eb-bone w-20 h-20 rounded-full" />
        <div className="eb-bone h-5 w-40" />
        <div className="eb-bone h-4 w-28" />
        <div className="flex gap-2 flex-wrap justify-center">
          {[1, 2, 3].map(i => (
            <div key={i} className="eb-bone h-6 w-20" style={{ borderRadius: 'var(--radius-pill)' }} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="eb-bone h-16" style={{ borderRadius: 'var(--radius-l)' }} />
        ))}
      </div>

      <div className="flex gap-1 p-1" style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-m)' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="eb-bone flex-1 h-9" style={{ background: 'var(--surface)' }} />
        ))}
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => <CardBone key={i} />)}
      </div>
    </div>
  );
}
