// Unit tests for the quota ledger (ADR-0009). Mocks '@fyi/database' so no DB is
// needed. Covers usedUnitsToday (joint with uploads), checkQuota, getQuotaStatus,
// recordUnitsConsumed, and the QUOTA_LIMIT constant.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findManyMock = vi.fn();
const countMock = vi.fn();
const updateMock = vi.fn();

vi.mock('@fyi/database', () => ({
  prisma: {
    analyticsIngestionLog: {
      findMany: (...a: unknown[]) => findManyMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
    },
    scheduledPublish: {
      count: (...a: unknown[]) => countMock(...a),
    },
  },
}));

const {
  QUOTA_LIMIT,
  UPLOAD_UNITS,
  usedUnitsToday,
  checkQuota,
  getQuotaStatus,
  recordUnitsConsumed,
} = await import('../src/quota.js');

const FIXED = new Date('2026-08-06T12:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  findManyMock.mockResolvedValue([]);
  countMock.mockResolvedValue(0);
  updateMock.mockResolvedValue({});
  process.env.QUOTA_LIMIT = '10000';
});

describe('quota ledger', () => {
  it('exposes the daily limit (10k units, shared with uploads)', () => {
    expect(QUOTA_LIMIT).toBe(10000);
    expect(UPLOAD_UNITS).toBe(1600);
  });

  it('usedUnitsToday sums analytics runs only (excludes upload rows from analytics sum)', async () => {
    findManyMock.mockResolvedValue([
      { status: 'completed', units_consumed: 100 },
      { status: 'completed', units_consumed: 50 },
      { status: 'failed', units_consumed: 10 },
      { status: 'upload', units_consumed: 1600 }, // upload debit, counted separately
    ]);
    countMock.mockResolvedValue(0);
    const used = await usedUnitsToday(FIXED);
    // analytics (100+50+10=160, status='upload' excluded from analytics sum)
    // + upload debit (1600) = 1760
    expect(used).toBe(1760);
  });

  it('usedUnitsToday adds upload debits from logged upload rows', async () => {
    findManyMock.mockResolvedValue([
      { status: 'completed', units_consumed: 100 },
      { status: 'upload', units_consumed: 1600 },
    ]);
    const used = await usedUnitsToday(FIXED);
    expect(used).toBe(1700);
  });

  it('usedUnitsToday estimates uploads from published videos when none logged', async () => {
    findManyMock.mockResolvedValue([{ status: 'completed', units_consumed: 200 }]);
    countMock.mockResolvedValue(3); // 3 uploads today -> 3 * 1600 = 4800
    const used = await usedUnitsToday(FIXED);
    expect(used).toBe(200 + 3 * 1600);
  });

  it('checkQuota is true when within budget', async () => {
    findManyMock.mockResolvedValue([{ status: 'completed', units_consumed: 100 }]);
    countMock.mockResolvedValue(0);
    expect(await checkQuota(50, FIXED)).toBe(true); // 150 <= 10000
  });

  it('checkQuota is false when the budget would be exceeded', async () => {
    findManyMock.mockResolvedValue([{ status: 'completed', units_consumed: 9950 }]);
    countMock.mockResolvedValue(0);
    expect(await checkQuota(100, FIXED)).toBe(false); // 10050 > 10000
  });

  it('checkQuota is false exactly at the boundary when exceeded', async () => {
    findManyMock.mockResolvedValue([{ status: 'completed', units_consumed: 9999 }]);
    countMock.mockResolvedValue(0);
    expect(await checkQuota(2, FIXED)).toBe(false); // 10001 > 10000
    expect(await checkQuota(1, FIXED)).toBe(true); // 10000 <= 10000
  });

  it('getQuotaStatus reports used, remaining, and wouldFit', async () => {
    findManyMock.mockResolvedValue([{ status: 'completed', units_consumed: 2500 }]);
    countMock.mockResolvedValue(0);
    const status = await getQuotaStatus(100, FIXED);
    expect(status.usedToday).toBe(2500);
    expect(status.limit).toBe(10000);
    expect(status.remaining).toBe(7500);
    expect(status.wouldFit).toBe(true);
  });

  it('recordUnitsConsumed clamps remaining at zero and marks status', async () => {
    updateMock.mockImplementation((arg: { where: { id: string }; data: Record<string, unknown> }) =>
      Promise.resolve({ id: arg.where.id, ...arg.data }),
    );
    const remaining = await recordUnitsConsumed('log1', 13000, { status: 'completed', runFinishedAt: new Date() });
    expect(remaining).toBe(0);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0]![0].data.status).toBe('completed');
  });
});
