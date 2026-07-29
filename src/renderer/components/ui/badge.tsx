import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Tinted variants pair a 15% wash with full-strength text of the same token.
 * The tokens are chosen so that pairing clears 4.5:1 in both themes — do not
 * lighten the text or deepen the wash without re-checking contrast.
 *
 * 15/25 are steps that exist on Tailwind's opacity scale. An off-scale step
 * such as /12 compiles to nothing and the badge silently loses its background.
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border bg-card text-muted-foreground shadow-sm',
        web: 'border-web/25 bg-web/15 text-web',
        mobile: 'border-mobile/25 bg-mobile/15 text-mobile',
        bridge: 'border-bridge/25 bg-bridge/15 text-bridge',
        success: 'border-success/25 bg-success/15 text-success',
        danger: 'border-danger/25 bg-danger/15 text-danger',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
