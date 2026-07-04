import { beforeEach, describe, expect, it, vi } from 'vitest';

const collectionMock = vi.fn();
const docMock = vi.fn();
const getMock = vi.fn();
const setMock = vi.fn();
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();
const loggerLogMock = vi.fn();
const arrayUnionMock = vi.fn((...args: unknown[]) => ({ __arrayUnion: args }));

vi.mock('firebase-functions/logger', () => ({
  info: loggerInfoMock,
  warn: loggerWarnMock,
  error: loggerErrorMock,
  log: loggerLogMock,
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    arrayUnion: arrayUnionMock,
  },
}));

vi.mock('../shared/firebase-admin.js', () => ({
  db: {
    collection: collectionMock,
  },
}));

vi.mock('../shared/GitHubConstants.js', () => ({
  COLLECTION: {
    GITHUB_ANALYTICS_TRAFFIC: 'githubAnalyticsTraffic',
    GITHUB_ANALYTICS_TRAFFIC_HISTORY: 'githubAnalyticsTrafficHistory',
  },
}));

let mod: typeof import('./history.js');

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  collectionMock.mockReturnValue({ doc: docMock });
  docMock.mockReturnValue({ get: getMock, set: setMock });

  mod = await import('./history.js');
  delete process.env.GITHUB_TOKEN;
});

describe('saveGithubAnalyticsTrafficHistory', () => {
  it('warns and exits when analytics snapshot does not exist', async () => {
    getMock.mockResolvedValueOnce({ exists: false }); // traffic doc
    await mod.saveGithubAnalyticsTrafficHistory(
      'zoechbauer',
      'z-control-ionic-setup',
    );

    expect(loggerWarnMock).toHaveBeenCalledWith(
      'No analytics data found for z-control-ionic-setup.',
    );
    expect(setMock).not.toHaveBeenCalled();
  });

  it('warns and exits when analytics snapshot structure is invalid', async () => {
    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ views: {}, clones: {} }),
    });

    await mod.saveGithubAnalyticsTrafficHistory(
      'zoechbauer',
      'z-control-ionic-setup',
    );

    expect(loggerWarnMock).toHaveBeenCalledWith(
      'Invalid analytics data structure for z-control-ionic-setup.',
    );
    expect(setMock).not.toHaveBeenCalled();
  });

  it('stores all entries on first run and sets initialized when arrays are empty', async () => {
    getMock
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          views: { views: [] },
          clones: { clones: [] },
        }),
      })
      .mockResolvedValueOnce({ exists: false });

    await mod.saveGithubAnalyticsTrafficHistory(
      'zoechbauer',
      'z-control-ionic-setup',
    );

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: 'z-control-ionic-setup',
        views: [],
        clones: [],
        initialized: true,
      }),
      { merge: true },
    );
  });

  it('stores all entries on first run with data', async () => {
    getMock
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          views: {
            views: [{ timestamp: '2026-06-25', count: 2, uniques: 1 }],
          },
          clones: {
            clones: [{ timestamp: '2026-06-25', count: 4, uniques: 3 }],
          },
        }),
      })
      .mockResolvedValueOnce({ exists: false });

    await mod.saveGithubAnalyticsTrafficHistory(
      'zoechbauer',
      'z-control-ionic-setup',
    );

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: 'z-control-ionic-setup',
        views: [{ timestamp: '2026-06-25', count: 2, uniques: 1 }],
        clones: [{ timestamp: '2026-06-25', count: 4, uniques: 3 }],
      }),
      { merge: true },
    );
  });

  it('appends yesterday entries on subsequent run', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yd = yesterday.toISOString().slice(0, 10);

    getMock
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          views: {
            views: [
              { timestamp: `${yd}T10:00:00.000Z`, count: 1 },
              { timestamp: '2026-06-20T10:00:00.000Z', count: 2 },
            ],
          },
          clones: {
            clones: [{ date: yd, count: 3 }],
          },
        }),
      })
      .mockResolvedValueOnce({ exists: true, data: () => ({}) });

    await mod.saveGithubAnalyticsTrafficHistory(
      'zoechbauer',
      'z-control-ionic-setup',
    );

    expect(arrayUnionMock).toHaveBeenCalledTimes(2);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: 'z-control-ionic-setup',
        views: {
          __arrayUnion: [{ timestamp: `${yd}T10:00:00.000Z`, count: 1 }],
        },
        clones: { __arrayUnion: [{ date: yd, count: 3 }] },
      }),
      { merge: true },
    );
  });

  it('logs caught errors', async () => {
    getMock.mockRejectedValueOnce(new Error('db failure'));

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => ({}));

    await mod.saveGithubAnalyticsTrafficHistory(
      'zoechbauer',
      'z-control-ionic-setup',
    );

    expect(loggerErrorMock).toHaveBeenCalledWith(
      '[ERROR] saveGithubAnalyticsTrafficHistory for z-control-ionic-setup:',
      expect.any(Error),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ERROR] saveGithubAnalyticsTrafficHistory for z-control-ionic-setup:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  it('logs completion info', async () => {
    getMock
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          views: {
            views: [{ timestamp: '2026-06-25', count: 2, uniques: 1 }],
          },
          clones: {
            clones: [{ timestamp: '2026-06-25', count: 4, uniques: 3 }],
          },
        }),
      })
      .mockResolvedValueOnce({ exists: false });

    await mod.saveGithubAnalyticsTrafficHistory(
      'zoechbauer',
      'z-control-ionic-setup',
    );

    expect(loggerInfoMock).toHaveBeenCalledWith(
      'saveGithubAnalyticsTrafficHistory completed',
      { owner: 'zoechbauer', repo: 'z-control-ionic-setup' },
    );
  });

  it('logs completion and logInfo data if isLogging is true', async () => {
    getMock
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          views: {
            views: [{ timestamp: '2026-06-25', count: 2, uniques: 1 }],
          },
          clones: {
            clones: [{ timestamp: '2026-06-25', count: 4, uniques: 3 }],
          },
        }),
      })
      .mockResolvedValueOnce({ exists: false });

    await mod.saveGithubAnalyticsTrafficHistory(
      'zoechbauer',
      'z-control-ionic-setup',
      true, // isLogging = true
    );

    expect(loggerInfoMock).toHaveBeenCalledWith(
      'saveGithubAnalyticsTrafficHistory completed',
      { owner: 'zoechbauer', repo: 'z-control-ionic-setup' },
    );

    expect(loggerLogMock).toHaveBeenCalledWith(
      '[DEBUG] logInfo:',
      expect.objectContaining({
        repo: 'z-control-ionic-setup',
        analyticsData: expect.objectContaining({
          views: { views: [{ timestamp: '2026-06-25', count: 2, uniques: 1 }] },
          clones: {
            clones: [{ timestamp: '2026-06-25', count: 4, uniques: 3 }],
          },
        }),
        updateData: expect.objectContaining({
          repo: 'z-control-ionic-setup',
          views: [{ timestamp: '2026-06-25', count: 2, uniques: 1 }],
          clones: [{ timestamp: '2026-06-25', count: 4, uniques: 3 }],
        }),
      }),
    );
  });
});

describe('getAnalyticsData', () => {
  it('returns data when the doc exists', async () => {
    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ foo: 'bar' }),
    });

    await expect(
      mod.getAnalyticsData('z-control-ionic-setup'),
    ).resolves.toEqual({ foo: 'bar' });
  });

  it('returns undefined when the doc does not exist', async () => {
    getMock.mockResolvedValueOnce({ exists: false });

    await expect(
      mod.getAnalyticsData('z-control-ionic-setup'),
    ).resolves.toBeUndefined();
  });
});

describe('getHistoryData', () => {
  it('returns history data when the doc exists', async () => {
    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ views: [], clones: [] }),
    });

    await expect(mod.getHistoryData('z-control-ionic-setup')).resolves.toEqual({
      views: [],
      clones: [],
    });
  });

  it('returns empty object when the doc does not exist', async () => {
    getMock.mockResolvedValueOnce({ exists: false });

    await expect(mod.getHistoryData('z-control-ionic-setup')).resolves.toEqual(
      {},
    );
  });
});

describe('getHistoryEntries', () => {
  it('extracts arrays from history data', () => {
    expect(
      mod.getHistoryEntries({
        views: [{ timestamp: '2026-06-25', count: 1 }],
        clones: [{ timestamp: '2026-06-25', count: 2 }],
      }),
    ).toEqual({
      historyViews: [{ timestamp: '2026-06-25', count: 1 }],
      historyClones: [{ timestamp: '2026-06-25', count: 2 }],
    });
  });

  it('returns empty arrays for invalid input', () => {
    expect(mod.getHistoryEntries({})).toEqual({
      historyViews: [],
      historyClones: [],
    });
  });
});

describe('updateHistoryData', () => {
  it('writes history data with merge true', async () => {
    await mod.updateHistoryData('z-control-ionic-setup', {
      repo: 'z-control-ionic-setup',
    });

    expect(setMock).toHaveBeenCalledWith(
      { repo: 'z-control-ionic-setup' },
      { merge: true },
    );
  });
});
