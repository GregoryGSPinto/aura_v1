'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

type DragHandleProps = {
  direction: 'vertical' | 'horizontal';
  onDrag: (delta: number) => void;
  onDoubleClick?: () => void;
  className?: string;
};

export function DragHandle({ direction, onDrag, onDoubleClick, className }: DragHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      lastPos.current = direction === 'vertical' ? e.clientX : e.clientY;
    },
    [direction],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const current = direction === 'vertical' ? e.clientX : e.clientY;
      const delta = current - lastPos.current;
      lastPos.current = current;
      onDrag(delta);
    },
    [isDragging, direction, onDrag],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp, direction]);

  const isVertical = direction === 'vertical';

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
      className={cn(
        'group relative z-10 flex shrink-0 items-center justify-center bg-white/5 transition-all',
        isVertical
          ? 'w-1 cursor-col-resize hover:w-2 hover:bg-blue-500/20'
          : 'h-1 cursor-row-resize hover:h-2 hover:bg-blue-500/20',
        isDragging && (isVertical ? 'w-2 bg-blue-500/30' : 'h-2 bg-blue-500/30'),
        className,
      )}
    >
      <div
        className={cn(
          'rounded-full bg-zinc-700 transition group-hover:bg-blue-400',
          isVertical ? 'h-8 w-0.5' : 'h-0.5 w-8',
          isDragging && 'bg-blue-400',
        )}
      />
    </div>
  );
}
