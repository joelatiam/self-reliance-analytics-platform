/**
 * The simulator writes on the 5th, 15th, 25th, 35th, 45th and 55th minute of
 * every hour. The pipeline pulls on the 10-minute boundary (:00, :10, :20, ...),
 * so every pull reads data that settled five minutes earlier and no fetch ever
 * races a half-written tick.
 */

/** Minute offset within each 10-minute window at which a tick fires. */
export const ACTIVITY_TICK_MINUTE_OFFSET = 5;

/** Length of the window between two ticks, in minutes. */
export const ACTIVITY_TICK_WINDOW_MINUTES = 10;

/** Cron expression equivalent: every 10 minutes, starting at minute 5. */
export const ACTIVITY_TICK_CRON = '5-59/10 * * * *';

/** The six minutes past each hour on which a tick runs. */
export function getActivityTickMinutes(): number[] {
  const minutes: number[] = [];
  for (
    let minute = ACTIVITY_TICK_MINUTE_OFFSET;
    minute < 60;
    minute += ACTIVITY_TICK_WINDOW_MINUTES
  ) {
    minutes.push(minute);
  }
  return minutes;
}

/** True only on a scheduled tick minute (the cron guards with this). */
export function shouldExecuteActivityTick(now: Date = new Date()): boolean {
  return (
    now.getMinutes() % ACTIVITY_TICK_WINDOW_MINUTES ===
    ACTIVITY_TICK_MINUTE_OFFSET
  );
}

/** Next scheduled tick at or after `now`. */
export function getNextActivityTickAt(now: Date = new Date()): Date {
  const next = new Date(now.getTime());
  next.setSeconds(0, 0);

  const minutesIntoWindow = next.getMinutes() % ACTIVITY_TICK_WINDOW_MINUTES;
  const minutesAhead =
    minutesIntoWindow < ACTIVITY_TICK_MINUTE_OFFSET
      ? ACTIVITY_TICK_MINUTE_OFFSET - minutesIntoWindow
      : ACTIVITY_TICK_WINDOW_MINUTES -
        minutesIntoWindow +
        ACTIVITY_TICK_MINUTE_OFFSET;

  next.setMinutes(next.getMinutes() + minutesAhead);
  return next;
}

/** Human-readable slot label, e.g. "tick 3/6 (minute 25)". */
export function formatActivityTickSlot(now: Date = new Date()): string {
  const minutes = getActivityTickMinutes();
  const index = minutes.indexOf(now.getMinutes());
  if (index < 0) {
    return `off-schedule (minute ${now.getMinutes()})`;
  }
  return `tick ${index + 1}/${minutes.length} (minute ${now.getMinutes()})`;
}
