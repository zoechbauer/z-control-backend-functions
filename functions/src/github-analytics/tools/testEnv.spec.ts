import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dotenvConfigMock = vi.fn();

vi.mock('dotenv', () => ({
  default: {
    config: dotenvConfigMock,
  },
}));

describe('testEnv', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load dotenv with .env.local', async () => {
    await import('./testEnv.js');

    expect(dotenvConfigMock).toHaveBeenCalledTimes(1);
    expect(dotenvConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringMatching(/\.env\.local$/),
      }),
    );
  });

  it('should log GITHUB_TOKEN to console', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => ({}));

    // Set a test value for GITHUB_TOKEN
    process.env.GITHUB_TOKEN = 'test_token_value';

    await import('./testEnv.js');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'GITHUB_TOKEN - process.env.GITHUB_TOKEN:',
      'test_token_value',
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'GITHUB_TOKEN - process.env[\'GITHUB_TOKEN\']:',
      'test_token_value',
    );

    // Clean up the test value
    delete process.env.GITHUB_TOKEN;
  });
});
