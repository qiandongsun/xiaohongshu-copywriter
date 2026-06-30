const DAILY_FREE_LIMIT = 3;

export function formatRemaining(remaining: number): string {
  if (remaining === Infinity || remaining > 999) {
    return '不限次';
  }
  return `每日 ${remaining}/${DAILY_FREE_LIMIT} 次`;
}
