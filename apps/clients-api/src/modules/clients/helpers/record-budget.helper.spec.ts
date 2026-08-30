import {
  RecordBudget,
  resolveSimulationMode,
  SimulationMode,
  TEST_MODE_MAX_RECORDS,
} from './record-budget.helper';

describe('record budget', () => {
  it('caps a test-mode run at 100 rows', () => {
    const budget = RecordBudget.forMode(SimulationMode.TEST);

    expect(budget.take(60)).toBe(60);
    expect(budget.take(60)).toBe(40);
    expect(budget.takeOne()).toBe(false);
    expect(budget.exhausted).toBe(true);
    expect(budget.spent).toBe(TEST_MODE_MAX_RECORDS);
  });

  it('does not limit a live run', () => {
    const budget = RecordBudget.forMode(SimulationMode.LIVE);

    expect(budget.take(1_000_000)).toBe(1_000_000);
    expect(budget.exhausted).toBe(false);
    expect(budget.describe()).toBe('1000000 rows (no limit)');
  });

  it('treats NODE_ENV=test as test mode', () => {
    expect(resolveSimulationMode(undefined, 'test')).toBe(SimulationMode.TEST);
    expect(resolveSimulationMode(undefined, 'production')).toBe(
      SimulationMode.LIVE,
    );
  });

  it('lets SIMULATION_MODE override NODE_ENV', () => {
    expect(resolveSimulationMode('live', 'test')).toBe(SimulationMode.LIVE);
    expect(resolveSimulationMode('test', 'production')).toBe(
      SimulationMode.TEST,
    );
  });
});
