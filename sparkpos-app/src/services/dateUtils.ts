/**
 * SparkPOS Date & Time Utility Service
 * Standardizes local date formatting (WIB / Local Device Time) to prevent UTC date mismatch bugs.
 */

/**
 * Returns YYYY-MM-DD for a given Date or now in local computer time.
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts any ISO timestamp, date string, or Date object into local YYYY-MM-DD string.
 */
export function toLocalDateString(isoOrDate: string | Date | undefined | null): string {
  if (!isoOrDate) return '';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a timestamp into Indonesian date & time display (e.g. "23 Okt 2026, 14:30")
 */
export function formatLocalDateTime(isoOrDate: string | Date | undefined | null): string {
  if (!isoOrDate) return '-';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a timestamp into Indonesian date only (e.g. "Jumat, 23 Okt 2026")
 */
export function formatLocalDateOnly(isoOrDate: string | Date | undefined | null): string {
  if (!isoOrDate) return '-';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formats time only (e.g. "14:30")
 */
export function formatLocalTimeOnly(isoOrDate: string | Date | undefined | null): string {
  if (!isoOrDate) return '-';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
