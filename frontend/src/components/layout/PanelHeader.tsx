import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface PanelHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PanelHeader({ icon: Icon, title, subtitle, actions }: PanelHeaderProps) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-3.5 shrink-0 text-primary/70" />
        <div className="min-w-0 flex items-baseline gap-2">
          <h2 className="text-[13px] font-medium">{title}</h2>
          {subtitle && (
            <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      className={cn(
        'h-7 rounded-md border border-border bg-background px-2 text-[12px] text-foreground',
        'appearance-none cursor-pointer transition-colors hover:border-primary/30',
        'focus:outline-none focus:ring-1 focus:ring-primary/50',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
