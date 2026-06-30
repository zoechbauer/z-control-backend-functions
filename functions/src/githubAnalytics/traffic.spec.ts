import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveGithubAnalyticsTrafficHistoryMock = vi.fn();
const collectionMock = vi.fn();
const docMock = vi.fn();
const setMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('firebase-functions/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: loggerErrorMock,
}));

vi.mock('./history.js', () => ({
  saveGithubAnalyticsTrafficHistory: saveGithubAnalyticsTrafficHistoryMock,
}));

vi.mock('../shared/GitHubConstants.js', () => ({
  COLLECTION: {
    GITHUB_ANALYTICS_TRAFFIC: 'githubAnalyticsTraffic',
  },
  REPOS: [
    { owner: 'zoechbauer', repo: 'z-control-ionic-setup' },
    { owner: 'zoechbauer', repo: 'z-control-backend-functions' },
  ],
}));

vi.mock('../shared/firebase-admin.js', () => ({
  db: {
    collection: collectionMock,
  },
}));

let mod: typeof import('./traffic.js');

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  collectionMock.mockReturnValue({ doc: docMock });
  docMock.mockReturnValue({ set: setMock });

  mod = await import('./traffic.js');
  delete process.env.GITHUB_TOKEN;
});

const mockFetchResponse = (data: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  statusText: ok ? 'OK' : 'Internal Server Error',
  json: async () => data,
});

describe('fetchTraffic', () => {
  it('throws when GITHUB_TOKEN is missing', async () => {
    await expect(
      mod.fetchTraffic('zoechbauer', 'z-control-ionic-setup', 'views'),
    ).rejects.toThrow('GITHUB_TOKEN is not defined');
  });

  it('fetches traffic data with the correct GitHub API request', async () => {
    process.env.GITHUB_TOKEN = 'token-123';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockFetchResponse({ views: [{ timestamp: '2026-06-25', count: 1 }] }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await mod.fetchTraffic(
      'zoechbauer',
      'z-control-ionic-setup',
      'views',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/zoechbauer/z-control-ionic-setup/traffic/views',
      {
        headers: {
          Authorization: 'token token-123',
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );
    expect(result).toEqual({ views: [{ timestamp: '2026-06-25', count: 1 }] });
  });

  it('throws on non-ok GitHub responses', async () => {
    process.env.GITHUB_TOKEN = 'token-123';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(mockFetchResponse({}, false)),
    );

    await expect(
      mod.fetchTraffic('zoechbauer', 'z-control-ionic-setup', 'views'),
    ).rejects.toThrow('GitHub API error: 500 Internal Server Error');
  });
});

describe('processRepo', () => {
  it('updates Firestore and saves history when updateTraffic is true', async () => {
    process.env.GITHUB_TOKEN = 'token-123';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockFetchResponse({ views: [{ timestamp: '2026-06-25', count: 1 }] }),
      )
      .mockResolvedValueOnce(
        mockFetchResponse({ clones: [{ timestamp: '2026-06-25', count: 2 }] }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await mod.processRepo('zoechbauer', 'z-control-ionic-setup', true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(setMock).toHaveBeenCalledWith({
      timestamp: expect.any(String),
      views: { views: [{ timestamp: '2026-06-25', count: 1 }] },
      clones: { clones: [{ timestamp: '2026-06-25', count: 2 }] },
    });
    expect(saveGithubAnalyticsTrafficHistoryMock).toHaveBeenCalledWith(
      'zoechbauer',
      'z-control-ionic-setup',
      false
    );
  });

  it('does not update Firestore when updateTraffic is false', async () => {
    process.env.GITHUB_TOKEN = 'token-123';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockFetchResponse({ views: [{ timestamp: '2026-06-25', count: 1 }] }),
      )
      .mockResolvedValueOnce(
        mockFetchResponse({ clones: [{ timestamp: '2026-06-25', count: 2 }] }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await mod.processRepo('zoechbauer', 'z-control-ionic-setup', false);

    expect(setMock).not.toHaveBeenCalled();
    expect(saveGithubAnalyticsTrafficHistoryMock).toHaveBeenCalledWith(
      'zoechbauer',
      'z-control-ionic-setup',
      false
    );
  });

  it('logs an error when fetchTraffic fails', async () => {
    process.env.GITHUB_TOKEN = 'token-123';
    const error = new Error('network error');

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            views: [{ timestamp: '2026-06-25', count: 1 }],
          }),
        })
        .mockRejectedValueOnce(error),
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await mod.processRepo('zoechbauer', 'z-control-ionic-setup', true);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(saveGithubAnalyticsTrafficHistoryMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Error fetching analytics for z-control-ionic-setup:',
      error,
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error fetching analytics for z-control-ionic-setup:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });
});

describe('runGitHubAnalyticsFetch', () => {
  it('processes only one repo when repoIndex is valid', async () => {
    process.env.GITHUB_TOKEN = 'token-123';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockFetchResponse({ views: [] }))
      .mockResolvedValueOnce(mockFetchResponse({ clones: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await mod.runGitHubAnalyticsFetch(true, 0);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(setMock).toHaveBeenCalledTimes(1);
    expect(saveGithubAnalyticsTrafficHistoryMock).toHaveBeenCalledWith(
      'zoechbauer',
      'z-control-ionic-setup',
      false
    );
  });

  it('processes all repos when repoIndex is not provided', async () => {
    process.env.GITHUB_TOKEN = 'token-123';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockFetchResponse({ views: [] }))
      .mockResolvedValueOnce(mockFetchResponse({ clones: [] }))
      .mockResolvedValueOnce(mockFetchResponse({ views: [] }))
      .mockResolvedValueOnce(mockFetchResponse({ clones: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await mod.runGitHubAnalyticsFetch(false);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(saveGithubAnalyticsTrafficHistoryMock).toHaveBeenCalledTimes(2);
  });
});
