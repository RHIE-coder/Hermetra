import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { MessageKey } from './messages';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Translator = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function relativeTime(ts: number, t?: Translator) {
  const diff = Date.now() - ts;
  if (t) {
    if (diff < 1000) return t('time.justNow');
    if (diff < 60_000) return t('time.secondsAgo', { n: Math.floor(diff / 1000) });
    if (diff < 3_600_000) return t('time.minutesAgo', { n: Math.floor(diff / 60_000) });
    return new Date(ts).toLocaleTimeString();
  }
  if (diff < 1000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}
