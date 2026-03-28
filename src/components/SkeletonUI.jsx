import React from 'react';

function Bone({ className = '' }) {
  return <div className={`skeleton-bone rounded ${className}`} />;
}

export default function SkeletonUI() {
  return (
    <div className="w-full animate-fade-in-up space-y-4 pt-4">
      {/* 프로필 헤더 스켈레톤 */}
      <div className="glass-card-sm p-5 flex flex-col items-center gap-3">
        <Bone className="w-20 h-20 rounded-full" />
        <Bone className="h-5 w-40" />
        <Bone className="h-4 w-28" />
        <div className="flex gap-2 flex-wrap justify-center">
          {[1, 2, 3].map(i => <Bone key={i} className="h-6 w-20 rounded-full" />)}
        </div>
      </div>

      {/* 스탯 행 스켈레톤 */}
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map(i => <Bone key={i} className="h-14 rounded-xl" />)}
      </div>

      {/* ELO 카드 스켈레톤 */}
      <div className="glass-card-sm p-4 space-y-3">
        <Bone className="h-4 w-24" />
        <Bone className="h-7 w-32" />
        <Bone className="h-2 w-full rounded-full" />
      </div>

      {/* 탭 바 스켈레톤 */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-secondary)]">
        {[1, 2, 3].map(i => <Bone key={i} className="flex-1 h-9 rounded-lg" />)}
      </div>

      {/* 스탯 그리드 스켈레톤 */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="glass-card-sm p-3 space-y-2">
            <Bone className="h-3 w-12" />
            <Bone className="h-5 w-16" />
          </div>
        ))}
      </div>

      {/* 캐릭터 목록 스켈레톤 */}
      <div className="glass-card-sm">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Bone className="w-4 h-4 rounded" />
            <Bone className="w-9 h-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Bone className="h-3.5 w-36" />
              <Bone className="h-3 w-24" />
            </div>
            <Bone className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
