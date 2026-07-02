import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dotenvConfigMock = vi.fn();

vi.mock('dotenv', () => ({
  default: {
    config: dotenvConfigMock,
  },
}));

describe('loadEnv', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.FUNCTIONS_EMULATOR;
    vi.restoreAllMocks();
  });

  it('should load dotenv with .env.local', async () => {
    // Set a test values
    process.env.FUNCTIONS_EMULATOR = 'true';
    await import('./loadEnv.js');

    expect(dotenvConfigMock).toHaveBeenCalledTimes(1);
    expect(dotenvConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringMatching(/\.env\.local$/),
      }),
    );
  });

  it('should log infos to console', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Set a test values
    // process.env.GITHUB_TOKEN = 'test_token_value';
    process.env.FUNCTIONS_EMULATOR = 'true';

    await import('./loadEnv.js');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'loadEnv: runningInEmulator=true',
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'loadEnv: NODE_ENV=',
      'test',
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'loadEnv: envPath=',
      expect.stringMatching(/\.env\.local$/),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith('loadEnv: env exists=', true);
  });
});
