import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * An input is a well carved into its panel — inset shadow, never a raised one.
 * That is what separates "you type here" from "you press this".
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-8 w-full rounded-md border border-border bg-muted px-2.5 font-mono text-sm shadow-inner transition-colors placeholder:font-sans placeholder:text-placeholder disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
