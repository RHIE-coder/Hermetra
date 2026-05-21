import * as React from 'react';
import * as Sep from '@radix-ui/react-separator';
import { cn } from '@/lib/utils';

export const Separator = React.forwardRef<
  React.ElementRef<typeof Sep.Root>,
  React.ComponentPropsWithoutRef<typeof Sep.Root>
>(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <Sep.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    {...props}
  />
));
Separator.displayName = 'Separator';
