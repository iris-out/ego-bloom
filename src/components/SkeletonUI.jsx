import React from 'react';

function Bone({ className = '', style = {} }) {
  return (
    <div
      className={`skeleton-bone rounded ${className}`}
      style={style}
    />
  );
}

export default function SkeletonUI() {
  return (
    <div className="w-full animate-fade-in-up space-y-4">
      {/* Banner skeleton */}
      <Bone className="w-full h-12 sm:h-14 rounded-xl" />

      {/* 2-Column Layout Container */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">
        {/* Left Sidebar Skeleton (Profile Header) */}
        <div className="w-full lg:w-[380px] shrink-0 space-y-4">
          <div className="card p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4 mt-10">
              <Bone className="w-14 h-14 sm:w-16 sm:h-16 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Bone className="h-6 w-3/4" />
                <Bone className="h-4 w-1/2" />
                <Bone className="h-5 w-24 rounded-full" />
              </div>
              <div className="space-y-2 flex flex-col items-center shrink-0">
                <Bone className="h-20 w-16" />
                <Bone className="h-4 w-12" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-[var(--border)]">
              <Bone className="h-16 w-full rounded-lg" />
              <Bone className="h-16 w-full rounded-lg" />
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[var(--border)]">
              <Bone className="h-16 w-full rounded-lg" />
              <Bone className="h-16 w-full rounded-lg" />
              <Bone className="h-16 w-full rounded-lg" />
            </div>
          </div>
        </div>

        {/* Right Main Content Skeleton (Tabs) */}
        <div className="flex-1 w-full min-w-0 flex flex-col gap-4">
          <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-secondary)]">
            <Bone className="flex-1 h-9 rounded-md" />
            <Bone className="flex-1 h-9 rounded-md" />
            <Bone className="flex-1 h-9 rounded-md" />
          </div>

          <div className="space-y-4">
            {/* Top Stats Skeleton */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="card p-4 space-y-2">
                  <Bone className="h-3 w-16" />
                  <Bone className="h-6 w-20" />
                </div>
              ))}
            </div>

            {/* Character Cards Skeleton */}
            <div className="card p-4 sm:p-5 space-y-4">
              <Bone className="h-4 w-32 mb-4" />
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-4 hover:bg-[var(--bg-secondary)] p-2 rounded-lg transition-colors">
                  <Bone className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Bone className="h-4 w-40" />
                    <Bone className="h-3 w-24" />
                  </div>
                  <div className="hidden sm:flex items-center gap-3">
                    <Bone className="h-4 w-16" />
                    <Bone className="h-4 w-16" />
                  </div>
                  <Bone className="h-6 w-12 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
