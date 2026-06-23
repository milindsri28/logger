'use client';

import { Separator } from 'react-resizable-panels';
import { GripHorizontal, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  id: string;
  /** Parent Group orientation: horizontal = col-resize, vertical = row-resize */
  groupOrientation: 'horizontal' | 'vertical';
}

export function ResizeHandle({ id, groupOrientation }: ResizeHandleProps) {
  const isColResize = groupOrientation === 'horizontal';

  return (
    <Separator
      id={id}
      className={cn(
        'panel-resize-handle group relative z-20 shrink-0',
        'bg-border/90 transition-colors hover:bg-primary/40 active:bg-primary/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        isColResize ? 'panel-resize-handle--col' : 'panel-resize-handle--row'
      )}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {isColResize ? (
          <GripVertical className="size-3.5 text-muted-foreground/70 group-hover:text-primary" />
        ) : (
          <GripHorizontal className="size-3.5 text-muted-foreground/70 group-hover:text-primary" />
        )}
      </div>
    </Separator>
  );
}

export function PanelContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden', className)}>
      {children}
    </div>
  );
}
