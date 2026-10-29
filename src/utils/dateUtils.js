/**
 * Utility functions for Student Portal date handling and formatting.
 * Uses Asia/Kolkata (IST) timezone.
 * Example: '2026-09-30' -> '30/09/2026'
 * Example: '2026-01-05' -> '05/01/2026'
 */

/**
 * Returns today's date string in YYYY-MM-DD format based on Asia/Kolkata (IST).
 * Prevents timezone issues where today could appear as yesterday or tomorrow.
 */
export function getISTTodayString() {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    // 'en-CA' outputs YYYY-MM-DD
    return formatter.format(new Date());
  } catch (e) {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Formats a date into DD/MM/YYYY (DAY / MONTH / YEAR) format.
 * Prevents off-by-one errors caused by UTC/browser timezone conversions.
 */
export function formatStudentDate(dateInput, useShortYear = false) {
  if (!dateInput || dateInput === '---' || dateInput === 'N/A') {
    return '---';
  }

  const str = String(dateInput).trim();
  if (!str) return '---';

  // 1. Check if string matches YYYY-MM-DD (e.g., 2026-09-30)
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const [, yyyy, mm, dd] = ymdMatch;
    const year = useShortYear ? yyyy.slice(-2) : yyyy;
    const mStr = mm.padStart(2, '0');
    const dStr = dd.padStart(2, '0');
    return `${dStr}/${mStr}/${year}`;
  }

  // 2. Check if string matches YYYY-MM-DD with time (e.g., 2026-09-30 14:30:00 or 2026-09-30T14:30:00)
  const ymdTimeMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[\sT](.+)$/);
  if (ymdTimeMatch) {
    const [, yyyy, mm, dd] = ymdTimeMatch;
    const year = useShortYear ? yyyy.slice(-2) : yyyy;
    const mStr = mm.padStart(2, '0');
    const dStr = dd.padStart(2, '0');
    return `${dStr}/${mStr}/${year}`;
  }

  // 3. Check if string matches DD/MM/YYYY (e.g., 30/09/2026)
  const dmy4Match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy4Match) {
    const [, dd, mm, yyyy] = dmy4Match;
    const year = useShortYear ? yyyy.slice(-2) : yyyy;
    const mStr = mm.padStart(2, '0');
    const dStr = dd.padStart(2, '0');
    return `${dStr}/${mStr}/${year}`;
  }

  // 4. Check if string is DD/MM/YY (e.g., 30/09/26)
  const dmy2Match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (dmy2Match) {
    const [, dd, mm, yy] = dmy2Match;
    const year = useShortYear ? yy : `20${yy}`;
    const mStr = mm.padStart(2, '0');
    const dStr = dd.padStart(2, '0');
    return `${dStr}/${mStr}/${year}`;
  }

  // 5. Fallback: Parse via JS Date with Asia/Kolkata timezone formatting
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: useShortYear ? '2-digit' : 'numeric'
      });
      const parts = formatter.formatToParts(d);
      const day = parts.find(p => p.type === 'day')?.value || '01';
      const month = parts.find(p => p.type === 'month')?.value || '01';
      const year = parts.find(p => p.type === 'year')?.value || (useShortYear ? '00' : '2000');
      return `${day}/${month}/${year}`;
    }
  } catch (err) {
    console.error('Error formatting date for student portal:', err);
  }

  return str;
}

export function formatStudentDateTime(dateTimeInput) {
  if (!dateTimeInput || dateTimeInput === '---') return '---';
  const str = String(dateTimeInput).trim();

  // If format is like "2026-09-30 11:40 AM" or "2026-09-30 11:40:00"
  const spaceParts = str.split(' ');
  if (spaceParts.length >= 2) {
    const dateFormatted = formatStudentDate(spaceParts[0]);
    const timePart = spaceParts.slice(1).join(' ');
    return `${dateFormatted} ${timePart}`;
  }

  return formatStudentDate(str);
}
