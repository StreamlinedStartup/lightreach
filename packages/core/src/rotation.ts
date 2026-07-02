/**
 * Mailbox rotation — round-robin across active connections respecting
 * per-connection daily send limits.
 *
 * This module is intentionally pure-data: it takes a snapshot of connections
 * and today's sent counts, and returns the next connection to use. The
 * scheduler is responsible for persisting state between ticks.
 */

export interface ConnectionSlot {
  id: number;
  /** 'active' | 'paused' | 'error' — only 'active' slots are eligible */
  status: string;
  dailyLimit: number;
}

export interface RotationState {
  /** Number of emails already sent today by each connectionId */
  sentTodayByConnection: Record<number, number>;
  /** Last connection id that was used (for round-robin ordering) */
  lastUsedConnectionId: number | null;
}

export interface PickResult {
  connectionId: number;
  /** Updated sent-today count to persist after the send */
  newSentCount: number;
}

/**
 * Pick the next eligible connection using round-robin, respecting daily limits.
 *
 * Returns `null` if no active connections have capacity remaining today.
 */
export function pickNext(
  connections: ConnectionSlot[],
  state: RotationState,
): PickResult | null {
  const eligible = connections.filter(
    (c) =>
      c.status === "active" &&
      (state.sentTodayByConnection[c.id] ?? 0) < c.dailyLimit,
  );

  if (eligible.length === 0) return null;

  // Sort by id for stable ordering, then rotate from last-used position
  const sorted = [...eligible].sort((a, b) => a.id - b.id);

  let chosen: ConnectionSlot;
  if (state.lastUsedConnectionId === null) {
    chosen = sorted[0]!;
  } else {
    const lastIdx = sorted.findIndex((c) => c.id > state.lastUsedConnectionId!);
    chosen = lastIdx === -1 ? sorted[0]! : sorted[lastIdx]!;
  }

  const sentToday = state.sentTodayByConnection[chosen.id] ?? 0;

  return {
    connectionId: chosen.id,
    newSentCount: sentToday + 1,
  };
}

/**
 * Check whether a scheduled send should proceed given the campaign's
 * send window and allowed days of week (in the campaign's timezone).
 *
 * @param now         - Current time as a Date object
 * @param timezone    - IANA timezone string, e.g. "America/New_York"
 * @param windowStart - "HH:MM" 24-hour start
 * @param windowEnd   - "HH:MM" 24-hour end
 * @param daysOfWeek  - Array of 0-6 (0 = Sunday)
 */
export function isWithinSendWindow(
  now: Date,
  timezone: string,
  windowStart: string,
  windowEnd: string,
  daysOfWeek: number[],
): boolean {
  // Get current time in the campaign's timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  const currentDay = weekdayMap[get("weekday")] ?? -1;
  if (!daysOfWeek.includes(currentDay)) return false;

  // Some ICU builds render midnight as hour "24" with hour12:false — normalize to 0.
  const hour = parseInt(get("hour"), 10) % 24;
  const currentTime = `${String(hour).padStart(2, "0")}:${get("minute").padStart(2, "0")}`;

  // Overnight windows (e.g. 22:00 -> 06:00) wrap past midnight, so "within window"
  // means outside the [end, start) gap rather than inside a simple [start, end) range.
  if (windowStart > windowEnd) {
    return currentTime >= windowStart || currentTime < windowEnd;
  }
  return currentTime >= windowStart && currentTime < windowEnd;
}

/**
 * Compute the start of "today" (00:00:00 local wall-clock time) for a given
 * IANA timezone, expressed as a UTC Date. Used to compute timezone-correct
 * daily send caps instead of resetting at server-local midnight.
 *
 * Note: this assumes a constant UTC offset across the day, so it can be off
 * by up to an hour on the exact day of a DST transition — an acceptable
 * approximation for a daily send-cap boundary.
 */
export function startOfDayInTimezone(now: Date, timezone: string): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";

  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const second = Number(get("second"));

  // Wall-clock time in `timezone`, reinterpreted as UTC — the gap between this
  // and the real `now` instant is the timezone's current UTC offset.
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMs = wallClockAsUtc - now.getTime();

  const midnightWallClockAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  return new Date(midnightWallClockAsUtc - offsetMs);
}

/**
 * Return a random delay (in ms) between minSeconds and maxSeconds.
 * Used by the scheduler to jitter sends.
 */
export function randomDelayMs(minSeconds: number, maxSeconds: number): number {
  const min = Math.min(minSeconds, maxSeconds);
  const max = Math.max(minSeconds, maxSeconds);
  return (min + Math.random() * (max - min)) * 1000;
}
