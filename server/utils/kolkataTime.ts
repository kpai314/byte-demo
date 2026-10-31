/**
 * Asia/Kolkata Timezone Utilities for BYTE Campus Food OS
 * All campus operations (operating hours, slots, orders, audit) adhere to IST.
 */

export function getKolkataDate(date: Date = new Date()): string {
  // Returns 'YYYY-MM-DD'
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

export function getKolkataTime(date: Date = new Date()): string {
  // Returns 'HH:MM'
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

export function getKolkataDateTime(date: Date = new Date()): string {
  const d = getKolkataDate(date);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return `${d} ${formatter.format(date)}`;
}

export function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10) + minutes;

  h += Math.floor(m / 60);
  m = m % 60;
  if (m < 0) {
    m += 60;
    h -= 1;
  }
  h = (h % 24 + 24) % 24;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isValidDateFormat(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !isNaN(d.getTime());
}

export function isValidTimeFormat(timeStr: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return false;
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  return h >= 0 && h < 24 && m >= 0 && m < 60;
}

export function isPastKolkata(dateStr: string, timeStr: string, graceMinutes = 1): boolean {
  const currentDate = getKolkataDate();
  if (dateStr < currentDate) return true;
  if (dateStr > currentDate) return false;

  const currentTime = getKolkataTime();
  const [curH, curM] = currentTime.split(':').map(Number);
  const [reqH, reqM] = timeStr.split(':').map(Number);

  const curMinutes = curH * 60 + curM;
  const reqMinutes = reqH * 60 + reqM;

  return reqMinutes + graceMinutes < curMinutes;
}
