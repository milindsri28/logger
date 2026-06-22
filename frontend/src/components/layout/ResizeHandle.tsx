import { Separator } from 'react-resizable-panels';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  direction?: 'horizontal' | 'vertical';
}

/**
 * Wider drag target for react-resizable-panels v4 Separator.
 * Default w-1/h-1 handles are nearly impossible to grab.
 */
export function ResizeHandle({ direction = 'horizontal' }: ResizeHandleProps) {
  const isHorizontal = direction === 'horizontal';

  return (
    <Separator
      className={cn(
        'relative shrink-0 bg-[#4a4a4a] transition-colors',
        'hover:bg-primary/60 active:bg-primary/80',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        'z-[1000] pointer-events-auto',
        isHorizontal
          ? 'w-[10px] min-w-[10px] cursor-col-resize'
          : 'h-[10px] min-h-[10px] cursor-row-resize'
      )}
    />
  );
}

export function PanelContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative isolate z-0 h-full w-full min-h-0 min-w-0 max-w-full overflow-hidden', className)}>
      {children}
    </div>
  );
}
