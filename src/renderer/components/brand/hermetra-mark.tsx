import { cn } from '@/lib/utils';
import logoUrl from '@/assets/brand/hermetra-app-icon.png';

interface HermetraMarkProps {
  className?: string;
}

export function HermetraMark({ className }: HermetraMarkProps) {
  return <img src={logoUrl} alt="" className={cn('shrink-0', className)} />;
}
