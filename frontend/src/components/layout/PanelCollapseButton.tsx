'use client';

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PanelCollapseButtonProps {
  direction: 'left' | 'right' | 'up' | 'down';
  collapsed: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
}

const icons = {
  left: { expand: ChevronRight, collapse: ChevronLeft },
  right: { expand: ChevronLeft, collapse: ChevronRight },
  up: { expand: ChevronDown, collapse: ChevronUp },
  down: { expand: ChevronUp, collapse: ChevronDown },
};

export function PanelCollapseButton({
  direction,
  collapsed,
  onToggle,
  label,
  className,
}: PanelCollapseButtonProps) {
  const Icon = collapsed ? icons[direction].expand : icons[direction].collapse;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('size-6 shrink-0 text-muted-foreground hover:text-foreground', className)}
      onClick={onToggle}
      title={collapsed ? `Expand ${label}` : `Collapse ${label}`}
      aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
    >
      <Icon className="size-3.5" />
    </Button>
  );
}
