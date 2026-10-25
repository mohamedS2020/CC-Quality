/**
 * Call duration as typed on the score sheet: minutes:seconds ("03:30"). Also
 * accepts what people paste from the source sheets — "hh:mm:ss" (e.g.
 * "00:07:26", often with a trailing tab) — and a bare number as whole minutes.
 * Stored as seconds (`durationSeconds`).
 */

/** Seconds for a typed duration; null when blank; NaN when it can't be read. */
export function parseDuration(raw: string): number | null {
  const t = raw.replace(/\s+/g, "");
  if (t === "") return null;

  if (/^\d+$/.test(t)) return Number(t) * 60;

  const mmss = t.match(/^(\d+):(\d{1,2})$/);
  if (mmss) {
    const [m, s] = [Number(mmss[1]), Number(mmss[2])];
    return s < 60 ? m * 60 + s : NaN;
  }

  const hhmmss = t.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (hhmmss) {
    const [h, m, s] = [Number(hhmmss[1]), Number(hhmmss[2]), Number(hhmmss[3])];
    return m < 60 && s < 60 ? h * 3600 + m * 60 + s : NaN;
  }

  return NaN;
}

/** Seconds → "mm:ss" (minutes keep counting past 59, e.g. "75:10"). */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Normalise typed/pasted text to "mm:ss"; unreadable text is returned as-is. */
export function normalizeDuration(raw: string): string {
  const seconds = parseDuration(raw);
  return seconds === null || Number.isNaN(seconds) ? raw : formatDuration(seconds);
}

export function durationIsValid(raw: string): boolean {
  return !Number.isNaN(parseDuration(raw));
}
