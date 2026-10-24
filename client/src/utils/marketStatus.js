/**
 * Market status utilities for Indian Stock Exchanges (NSE / BSE).
 * Computes status in IST regardless of user's local timezone.
 *
 * NOTE: Exchange holidays are not handled here (only standard Mon-Fri schedule).
 */

/**
 * Returns hours and minutes for a given date in IST (UTC + 5:30).
 * @param {Date} date
 * @returns {{ day: number, hours: number, minutes: number, totalMinutes: number }}
 */
export function getISTParts(date = new Date()) {
  // IST offset is UTC + 5h30m = +330 minutes
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
  const istDate = new Date(utcMs + 330 * 60 * 1000);

  const day = istDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  return { day, hours, minutes, totalMinutes };
}

/**
 * Determines market status in IST:
 * - OPEN: Mon-Fri 09:15 to 15:30 IST
 * - PRE-OPEN: Mon-Fri 09:00 to 09:15 IST
 * - CLOSED: All other times (weekends, before 09:00, after 15:30)
 *
 * @param {Date} [date=new Date()]
 * @returns {{ status: 'OPEN' | 'PRE-OPEN' | 'CLOSED', label: string, nextChangeText: string }}
 */
export function getMarketStatus(date = new Date()) {
  const { day, totalMinutes } = getISTParts(date);

  const PRE_OPEN_START = 9 * 60; // 09:00 -> 540 min
  const MARKET_OPEN = 9 * 60 + 15; // 09:15 -> 555 min
  const MARKET_CLOSE = 15 * 60 + 30; // 15:30 -> 930 min

  const isWeekday = day >= 1 && day <= 5;

  if (isWeekday && totalMinutes >= MARKET_OPEN && totalMinutes < MARKET_CLOSE) {
    const minsLeft = MARKET_CLOSE - totalMinutes;
    const hrs = Math.floor(minsLeft / 60);
    const mins = minsLeft % 60;
    const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    return {
      status: 'OPEN',
      label: 'Market Open',
      nextChangeText: `Closes in ${timeStr} (15:30 IST)`,
    };
  }

  if (isWeekday && totalMinutes >= PRE_OPEN_START && totalMinutes < MARKET_OPEN) {
    const minsLeft = MARKET_OPEN - totalMinutes;
    return {
      status: 'PRE-OPEN',
      label: 'Pre-open',
      nextChangeText: `Opens in ${minsLeft}m (09:15 IST)`,
    };
  }

  // CLOSED status
  let nextOpenText = 'Opens Mon 09:15 IST';
  if (isWeekday) {
    if (totalMinutes < PRE_OPEN_START) {
      const minsToPre = PRE_OPEN_START - totalMinutes;
      const hrs = Math.floor(minsToPre / 60);
      const mins = minsToPre % 60;
      nextOpenText = `Opens today at 09:15 IST (in ${hrs > 0 ? `${hrs}h ` : ''}${mins}m)`;
    } else if (day === 5) {
      nextOpenText = 'Opens Mon 09:15 IST';
    } else {
      nextOpenText = 'Opens tomorrow 09:15 IST';
    }
  }

  return {
    status: 'CLOSED',
    label: 'Market Closed',
    nextChangeText: nextOpenText,
  };
}
