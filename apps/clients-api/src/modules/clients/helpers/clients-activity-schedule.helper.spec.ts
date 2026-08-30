import {
  ACTIVITY_TICK_CRON,
  formatActivityTickSlot,
  getActivityTickMinutes,
  getNextActivityTickAt,
  shouldExecuteActivityTick,
} from './clients-activity-schedule.helper';

describe('clients activity schedule', () => {
  it('ticks on the 5th, 15th, 25th, 35th, 45th and 55th minute', () => {
    expect(getActivityTickMinutes()).toEqual([5, 15, 25, 35, 45, 55]);
  });

  it('advertises a cron expression matching those minutes', () => {
    expect(ACTIVITY_TICK_CRON).toBe('5-59/10 * * * *');
  });

  it('executes only on tick minutes', () => {
    expect(shouldExecuteActivityTick(new Date('2026-08-30T10:05:00Z'))).toBe(
      true,
    );
    expect(shouldExecuteActivityTick(new Date('2026-08-30T10:25:30Z'))).toBe(
      true,
    );
    expect(shouldExecuteActivityTick(new Date('2026-08-30T10:55:00Z'))).toBe(
      true,
    );
  });

  it('does not execute on the pipeline fetch minutes', () => {
    // The pipeline pulls on the ten-minute boundary; a tick must never land there.
    for (const minute of [0, 10, 20, 30, 40, 50]) {
      const at = new Date('2026-08-30T10:00:00Z');
      at.setMinutes(minute);
      expect(shouldExecuteActivityTick(at)).toBe(false);
    }
  });

  it('returns the next tick five minutes into the current window', () => {
    const next = getNextActivityTickAt(new Date('2026-08-30T10:02:13Z'));
    expect(next.getMinutes()).toBe(5);
    expect(next.getSeconds()).toBe(0);
  });

  it('rolls into the next window once the current tick has passed', () => {
    const next = getNextActivityTickAt(new Date('2026-08-30T10:07:00Z'));
    expect(next.getMinutes()).toBe(15);
  });

  it('labels the current slot', () => {
    const at = new Date('2026-08-30T10:00:00Z');
    at.setMinutes(25);
    expect(formatActivityTickSlot(at)).toBe('tick 3/6 (minute 25)');
  });
});
