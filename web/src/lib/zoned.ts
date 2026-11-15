/**
 * Wall-clock helpers for the patient's own time zone (users.timezone). Same math as
 * my-agent/lib/db.mjs, so the dashboard and the scheduler agree on what "08:00" means.
 */

export function zonedParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hhmm: `${parts.hour}:${parts.minute}`, parts };
}

/** The UTC instant at which `day` (YYYY-MM-DD) + `hhmm` happens on the wall clock of `timeZone`. */
export function zonedInstant(day: string, hhmm: string, timeZone: string): Date {
  const guess = new Date(`${day}T${hhmm}:00Z`);
  const { parts } = zonedParts(guess, timeZone);
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess.getTime() - (shown - guess.getTime()));
}

/** "2026-11-15T08:00" for an <input type="datetime-local">, in the patient's zone. */
export function toLocalInput(iso: string, timeZone: string): string {
  const { day, hhmm } = zonedParts(new Date(iso), timeZone);
  return `${day}T${hhmm}`;
}

/** Reads an <input type="datetime-local"> value as the patient's wall clock. Null when malformed. */
export function fromLocalInput(value: string, timeZone: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return m ? zonedInstant(m[1], m[2], timeZone) : null;
}

export function formatDateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function formatDay(day: string) {
  // A bare YYYY-MM-DD: format at noon UTC so no zone shifts it to the neighbouring day.
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(
    new Date(`${day}T12:00:00Z`),
  );
}

/** "08:00:00" (Postgres time) → "8:00 AM". */
export function formatClock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
