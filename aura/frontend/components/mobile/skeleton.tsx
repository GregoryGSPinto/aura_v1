'use client';

import { cn } from '@/lib/utils';

function Bone({ className }: { className?: string }) {
  return <div className={cn('animate-shimmer rounded-lg bg-zinc-800', className)} />;
}

export function ChatSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-start"><Bone className="h-16 w-3/4 rounded-2xl" /></div>
      <div className="flex justify-end"><Bone className="h-10 w-1/2 rounded-2xl" /></div>
      <div className="flex justify-start"><Bone className="h-24 w-4/5 rounded-2xl" /></div>
      <div className="flex justify-end"><Bone className="h-10 w-2/3 rounded-2xl" /></div>
    </div>
  );
}

export function FilesSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Bone className="h-5 w-5 rounded" />
          <Bone className="h-4 flex-1" />
          <Bone className="h-3 w-10" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <Bone key={i} className="h-28 w-[130px] shrink-0 rounded-xl" />
        ))}
      </div>
      <Bone className="h-24 rounded-xl" />
      <Bone className="h-40 rounded-xl" />
    </div>
  );
}
