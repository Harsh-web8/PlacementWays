/** Countdown text: 9:05 or 1:02:09. Negative values show as 0:00. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Spoken-style duration for results: "45 min 10 s", "1 h 5 min", "30 s". */
export function formatDurationWords(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return sec > 0 ? `${m} min ${sec} s` : `${m} min`;
  return `${sec} s`;
}

/** Marks without noise: 2 -> "2", 0.5 -> "0.5", 2.5 -> "2.5", -0.25 -> "-0.25". */
export function formatMarks(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Correct answers as a percentage of the questions actually attempted (0 if none were). */
export function accuracyPercent(correct: number, incorrect: number): number {
  const attempted = correct + incorrect;
  return attempted === 0 ? 0 : Math.round((correct / attempted) * 100);
}
