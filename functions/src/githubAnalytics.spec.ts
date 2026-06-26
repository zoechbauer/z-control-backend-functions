import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const setMock = vi.fn();
const getMock = vi.fn();
const collectionMock = vi.fn();
const docMock = vi.fn();
const dbMock = { collection: collectionMock };

vi.mock('../src/shared/firebase-admin.js', () => ({ db: dbMock }));

vi.mock('../src/shared/GitHubConstants.js', () => ({
  REPOS: [{ owner: 'octocat', repo: 'hello-world' }],
  COLLECTION: {
    GITHUB_ANALYTICS_TRAFFIC: 'githubAnalyticsTraffic',
    GITHUB_ANALYTICS_TRAFFIC_HISTORY: 'githubAnalyticsTrafficHistory',
  },
}));

vi.mock('firebase-functions/v2', () => ({
  https: { onRequest: (handler: any) => handler },
  scheduler: { onSchedule: (_opts: any, handler: any) => handler },
}));

vi.mock('firebase-functions/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
}));

vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));

let mod: typeof import('../src/githubAnalytics.js');

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  const firebaseAdmin = await import('../src/shared/firebase-admin.js');
  firebaseAdmin.db.collection = collectionMock;

  collectionMock.mockReturnValue({ doc: docMock });
  docMock.mockReturnValue({ get: getMock, set: setMock });

  mod = await import('../src/githubAnalytics.js');
});

afterEach(() => {
  delete process.env.GITHUB_TOKEN;
});

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

describe('runGitHubAnalyticsFetch', () => {
  it('processes only one repo when repoIndex is valid', async () => {
    process.env.GITHUB_TOKEN = 'token';

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ views: [{ timestamp: '2026-06-25' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clones: [{ timestamp: '2026-06-25' }] }),
      }) as any;

    getMock
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          views: { views: [{ timestamp: '2026-06-25' }] },
          clones: { clones: [{ timestamp: '2026-06-25' }] },
        }),
      })
      .mockResolvedValueOnce({ exists: false });

    await mod.runGitHubAnalyticsFetch(true, 0);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(setMock).toHaveBeenCalledTimes(2);
  });
});

describe('saveGithubAnalyticsTrafficHistory', () => {
  it('writes first-run history with all entries', async () => {
    getMock
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          views: { views: [{ timestamp: '2026-06-25', count: 1 }] },
          clones: { clones: [{ timestamp: '2026-06-25', count: 2 }] },
        }),
      })
      .mockResolvedValueOnce({ exists: false });

    await mod.saveGithubAnalyticsTrafficHistory('octocat', 'hello-world');

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: 'hello-world',
        views: [{ timestamp: '2026-06-25', count: 1 }],
        clones: [{ timestamp: '2026-06-25', count: 2 }],
      }),
      { merge: true },
    );
  });

  it('appends only yesterday entries on existing history', async () => {
    const today = new Date();
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const yd = y.toISOString().slice(0, 10);

    getMock
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          views: { views: [{ timestamp: `${yd}T10:00:00.000Z`, count: 1 }] },
          clones: { clones: [{ date: yd, count: 2 }] },
        }),
      })
      .mockResolvedValueOnce({ exists: true, data: () => ({}) });

    await mod.saveGithubAnalyticsTrafficHistory('octocat', 'hello-world');

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: 'hello-world',
        views: expect.any(Object),
        clones: expect.any(Object),
      }),
      { merge: true },
    );
  });
});

describe('testGitHubAnalytics', () => {
  it('returns 200 and calls fetch with parsed query options', async () => {
    const { req, res } = makeReqRes({ updateTraffic: 'false', repoIndex: '0' });

    await mod.testGitHubAnalytics(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) }),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/json',
    );
  });
});
