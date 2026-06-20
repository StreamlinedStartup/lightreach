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

  const currentTime = `${String(parseInt(get("hour"), 10)).padStart(2, "0")}:${get("minute").padStart(2, "0")}`;
  return currentTime >= windowStart && currentTime < windowEnd;
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
