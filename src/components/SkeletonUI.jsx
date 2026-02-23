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
    <div className="w-full max-w-3xl mx-auto animate-fade-in-up space-y-6">
      {/* Profile header skeleton */}
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <Bone className="w-16 h-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-6 w-40" />
            <Bone className="h-4 w-24" />
          </div>
          <div className="space-y-2 text-right">
            <Bone className="h-5 w-20 ml-auto" />
            <Bone className="h-4 w-16 ml-auto" />
          </div>
        </div>
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-4 space-y-2">
            <Bone className="h-4 w-16" />
            <Bone className="h-7 w-24" />
          </div>
        ))}
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2">
        <Bone className="h-9 w-20 rounded-lg" />
        <Bone className="h-9 w-20 rounded-lg" />
      </div>

      {/* Character cards skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="card p-4 flex items-center gap-4">
            <Bone className="w-12 h-12 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Bone className="h-4 w-32" />
              <Bone className="h-3 w-48" />
            </div>
            <Bone className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
