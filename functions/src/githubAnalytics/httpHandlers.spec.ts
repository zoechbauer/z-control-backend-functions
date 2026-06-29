import { beforeEach, describe, expect, it, vi } from 'vitest';

const runGitHubAnalyticsFetchMock = vi.fn();
const getAnalyticsDataMock = vi.fn();
const getHistoryDataMock = vi.fn();
const getHistoryEntriesMock = vi.fn();
const updateHistoryDataMock = vi.fn();
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('firebase-functions/logger', () => ({
  info: loggerInfoMock,
  warn: loggerWarnMock,
  error: loggerErrorMock,
}));

vi.mock('./traffic.js', () => ({
  runGitHubAnalyticsFetch: runGitHubAnalyticsFetchMock,
}));

vi.mock('./history.js', () => ({
  getAnalyticsData: getAnalyticsDataMock,
  getHistoryData: getHistoryDataMock,
  getHistoryEntries: getHistoryEntriesMock,
  updateHistoryData: updateHistoryDataMock,
}));

vi.mock('../shared/GitHubConstants.js', () => ({
  REPOS: [
    { owner: 'zoechbauer', repo: 'z-control-ionic-setup' },
    { owner: 'zoechbauer', repo: 'z-control-backend-functions' },
  ],
}));

vi.mock('firebase-functions/v2', () => ({
  https: {
    onRequest: (handler: any) => handler,
  },
  scheduler: {
    onSchedule: (_opts: any, handler: any) => handler,
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    arrayUnion: vi.fn((...args: unknown[]) => ({ __arrayUnion: args })),
  },
}));

let mod: typeof import('./httpHandlers.js');

const makeReqRes = (query: Record<string, string | undefined> = {}) => {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const setHeader = vi.fn();
  return {
    req: { query } as any,
    res: { status, json, setHeader } as any,
    status,
    json,
    setHeader,
  };
};

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mod = await import('./httpHandlers.js');
});

describe('fetchGitHubAnalytics', () => {
  it('calls runGitHubAnalyticsFetch with default logging = false from the scheduled handler', async () => {
    await mod.fetchGitHubAnalytics({} as any, {} as any);
    expect(runGitHubAnalyticsFetchMock).toHaveBeenCalledWith();
  });
});

describe('testGitHubAnalytics', () => {
  it('returns 200 and calls runGitHubAnalyticsFetch with parsed query options and logging = true', async () => {
    const { req, res } = makeReqRes({ updateTraffic: 'false', repoIndex: '0' });
    await mod.testGitHubAnalytics(req, res);

    expect(runGitHubAnalyticsFetchMock).toHaveBeenCalledWith(false, 0, true);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/json',
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'GitHub analytics fetched and stored data with Firebase logging.',
      }),
    );
  });

  it('returns 500 and logs error string when runGitHubAnalyticsFetch throws', async () => {
    runGitHubAnalyticsFetchMock.mockRejectedValueOnce(
      'fetch failed error string',
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { req, res } = makeReqRes();

    await mod.testGitHubAnalytics(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal Server Error: fetch failed error string',
      }),
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Error in testGitHubAnalytics:',
      'fetch failed error string',
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error in testGitHubAnalytics:',
      'fetch failed error string',
    );
    consoleErrorSpy.mockRestore();
  });

  it('returns 500 and logs Error.message when runGitHubAnalyticsFetch throws', async () => {
    runGitHubAnalyticsFetchMock.mockRejectedValueOnce(
      new Error('fetch failed'),
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { req, res } = makeReqRes();

    await mod.testGitHubAnalytics(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal Server Error: fetch failed',
      }),
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Error in testGitHubAnalytics:',
      expect.any(Error),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error in testGitHubAnalytics:',
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });
});

describe('insertMissingAnalyticsHistory', () => {
  it('updates missing analytics for all repos and returns inserted summary', async () => {
    getAnalyticsDataMock.mockImplementation(async (repo: string) => {
      if (repo === 'z-control-ionic-setup') {
        return {
          views: {
            views: [
              { timestamp: '2026-06-25', count: 1 },
              { timestamp: '2026-06-24', count: 2 },
            ],
          },
          clones: {
            clones: [{ timestamp: '2026-06-25', count: 3 }],
          },
        };
      }
      if (repo === 'z-control-backend-functions') {
        return {
          views: {
            views: [
              { timestamp: '2026-06-25', count: 6, uniques: 4 },
              { timestamp: '2026-06-24', count: 4, uniques: 2 },
            ],
          },
          clones: {
            clones: [{ timestamp: '2026-06-24', count: 8, uniques: 5 }],
          },
        };
      }
      throw new Error(`Unexpected repo: ${repo}`);
    });

    getHistoryDataMock.mockImplementation(async (repo: string) => {
      if (repo === 'z-control-ionic-setup') {
        return {
          views: [{ timestamp: '2026-06-24', count: 2 }],
          clones: [],
        };
      }
      if (repo === 'z-control-backend-functions') {
        return {
          views: [{ timestamp: '2026-06-24', count: 9 }],
          clones: [],
        };
      }
      throw new Error(`Unexpected repo: ${repo}`);
    });

    getHistoryEntriesMock.mockImplementation((historyData: any) => ({
      historyViews: Array.isArray(historyData.views) ? historyData.views : [],
      historyClones: Array.isArray(historyData.clones)
        ? historyData.clones
        : [],
    }));

    const expectedFirstRepoUpdate = {
      repo: 'z-control-ionic-setup',
      views: { __arrayUnion: [{ timestamp: '2026-06-25', count: 1 }] },
      clones: { __arrayUnion: [{ timestamp: '2026-06-25', count: 3 }] },
    };

    const expectedSecondRepoUpdate = {
      repo: 'z-control-backend-functions',
      views: {
        __arrayUnion: [{ timestamp: '2026-06-25', count: 6, uniques: 4 }],
      },
      clones: {
        __arrayUnion: [{ timestamp: '2026-06-24', count: 8, uniques: 5 }],
      },
    };

    const { req, res } = makeReqRes();
    await mod.insertMissingAnalyticsHistory(req, res);

    expect(getAnalyticsDataMock).toHaveBeenCalledTimes(2);
    expect(getAnalyticsDataMock).toHaveBeenNthCalledWith(
      1,
      'z-control-ionic-setup',
    );
    expect(getAnalyticsDataMock).toHaveBeenNthCalledWith(
      2,
      'z-control-backend-functions',
    );

    expect(getHistoryDataMock).toHaveBeenCalledTimes(2);
    expect(getHistoryDataMock).toHaveBeenNthCalledWith(
      1,
      'z-control-ionic-setup',
    );
    expect(getHistoryDataMock).toHaveBeenNthCalledWith(
      2,
      'z-control-backend-functions',
    );

    expect(updateHistoryDataMock).toHaveBeenCalledTimes(2);
    expect(updateHistoryDataMock).toHaveBeenCalledWith(
      'z-control-ionic-setup',
      expect.objectContaining(expectedFirstRepoUpdate),
    );
    expect(updateHistoryDataMock).toHaveBeenCalledWith(
      'z-control-backend-functions',
      expect.objectContaining(expectedSecondRepoUpdate),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Insert missing analytics history completed.',
        inserted: {
          'z-control-ionic-setup': {
            views: ['2026-06-25'],
            clones: ['2026-06-25'],
          },
          'z-control-backend-functions': {
            views: ['2026-06-25'],
            clones: ['2026-06-24'],
          },
        },
      }),
    );
  });

  it('processes only the selected repo when repoIndex is provided', async () => {
    getAnalyticsDataMock.mockResolvedValue({
      views: {
        views: [{ timestamp: '2026-06-25', count: 1 }],
      },
      clones: {
        clones: [{ timestamp: '2026-06-25', count: 3 }],
      },
    });

    getHistoryDataMock.mockResolvedValue({
      views: [],
      clones: [],
    });

    getHistoryEntriesMock.mockImplementation((historyData: any) => ({
      historyViews: Array.isArray(historyData.views) ? historyData.views : [],
      historyClones: Array.isArray(historyData.clones)
        ? historyData.clones
        : [],
    }));

    const expectedRepoUpdate = {
      repo: 'z-control-ionic-setup',
      views: { __arrayUnion: [{ timestamp: '2026-06-25', count: 1 }] },
      clones: { __arrayUnion: [{ timestamp: '2026-06-25', count: 3 }] },
    };

    const { req, res } = makeReqRes({ repoIndex: '0' });
    await mod.insertMissingAnalyticsHistory(req, res);

    expect(getAnalyticsDataMock).toHaveBeenCalledTimes(1);
    expect(getAnalyticsDataMock).toHaveBeenCalledWith('z-control-ionic-setup');

    expect(getHistoryDataMock).toHaveBeenCalledTimes(1);
    expect(getHistoryDataMock).toHaveBeenCalledWith('z-control-ionic-setup');

    expect(updateHistoryDataMock).toHaveBeenCalledTimes(1);
    expect(updateHistoryDataMock).toHaveBeenCalledWith(
      'z-control-ionic-setup',
      expect.objectContaining(expectedRepoUpdate),
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('uses date when timestamp is missing', async () => {
    getAnalyticsDataMock.mockResolvedValue({
      views: {
        views: [{ date: '2026-06-25', count: 1 }],
      },
      clones: {
        clones: [{ date: '2026-06-25', count: 3 }],
      },
    });

    getHistoryDataMock.mockResolvedValue({
      views: [{ date: '2026-06-24', count: 2 }],
      clones: [{ date: '2026-06-24', count: 3 }],
    });

    getHistoryEntriesMock.mockImplementation((historyData: any) => ({
      historyViews: Array.isArray(historyData.views) ? historyData.views : [],
      historyClones: Array.isArray(historyData.clones)
        ? historyData.clones
        : [],
    }));

    const { req, res } = makeReqRes({ repoIndex: '0' });
    await mod.insertMissingAnalyticsHistory(req, res);

    expect(updateHistoryDataMock).toHaveBeenCalledTimes(1);
    expect(updateHistoryDataMock).toHaveBeenCalledWith(
      'z-control-ionic-setup',
      expect.objectContaining({
        repo: 'z-control-ionic-setup',
        views: { __arrayUnion: [{ date: '2026-06-25', count: 1 }] },
        clones: { __arrayUnion: [{ date: '2026-06-25', count: 3 }] },
      }),
    );
  });

  it('logs a warning and continues when no analytics data is found for a repo', async () => {
    getAnalyticsDataMock.mockImplementation(async (repo: string) => {
      if (repo === 'z-control-ionic-setup') {
        return null; // Simulate no analytics data for this repo
      }
      return {
        views: { views: [{ timestamp: '2026-06-25', count: 1 }] },
        clones: { clones: [{ timestamp: '2026-06-25', count: 3 }] },
      };
    });

    getHistoryDataMock.mockResolvedValue({
      views: [],
      clones: [],
    });

    getHistoryEntriesMock.mockImplementation((historyData: any) => ({
      historyViews: Array.isArray(historyData.views) ? historyData.views : [],
      historyClones: Array.isArray(historyData.clones)
        ? historyData.clones
        : [],
    }));

    const { req, res } = makeReqRes();
    await mod.insertMissingAnalyticsHistory(req, res);

    expect(loggerWarnMock).toHaveBeenCalledWith(
      'No analytics data found for z-control-ionic-setup.',
    );
    expect(updateHistoryDataMock).toHaveBeenCalledTimes(1);
    expect(updateHistoryDataMock).toHaveBeenCalledWith(
      'z-control-backend-functions',
      expect.objectContaining({
        repo: 'z-control-backend-functions',
        views: { __arrayUnion: [{ timestamp: '2026-06-25', count: 1 }] },
        clones: { __arrayUnion: [{ timestamp: '2026-06-25', count: 3 }] },
      }),
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('logs an info if no missing analytics data is found for a repo', async () => {
    getAnalyticsDataMock.mockResolvedValue({
      views: { views: [{ timestamp: '2026-06-25', count: 1 }] },
      clones: { clones: [{ timestamp: '2026-06-25', count: 3 }] },
    });

    getHistoryDataMock.mockResolvedValue({
      views: [{ timestamp: '2026-06-25', count: 1 }],
      clones: [{ timestamp: '2026-06-25', count: 3 }],
    });

    getHistoryEntriesMock.mockImplementation((historyData: any) => ({
      historyViews: Array.isArray(historyData.views) ? historyData.views : [],
      historyClones: Array.isArray(historyData.clones)
        ? historyData.clones
        : [],
    }));

    const { req, res } = makeReqRes({ repoIndex: '0' });
    await mod.insertMissingAnalyticsHistory(req, res);

    expect(loggerInfoMock).toHaveBeenCalledWith(
      'No missing analytics history to insert',
      { repo: 'z-control-ionic-setup' },
    );

    expect(updateHistoryDataMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 500 and logs Error.message when insertMissingAnalyticsHistory throws', async () => {
    getAnalyticsDataMock.mockRejectedValueOnce(new Error('fetch failed'));
    const { req, res } = makeReqRes();

    await mod.insertMissingAnalyticsHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal Server Error: fetch failed',
      }),
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Error in insertMissingAnalyticsHistory:',
      expect.any(Error),
    );
  });

  it('returns 500 and logs error string when insertMissingAnalyticsHistory throws', async () => {
    getAnalyticsDataMock.mockRejectedValueOnce('fetch failed error string');
    const { req, res } = makeReqRes();

    await mod.insertMissingAnalyticsHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal Server Error: fetch failed error string',
      }),
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Error in insertMissingAnalyticsHistory:',
      'fetch failed error string',
    );
  });
});
