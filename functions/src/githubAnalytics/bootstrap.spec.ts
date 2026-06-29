import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dotenvConfigMock = vi.fn();

vi.mock('dotenv', () => ({
  default: {
    config: dotenvConfigMock,
  },
}));

vi.mock('firebase-functions/logger', () => ({
  error: vi.fn(),
}));

describe('bootstrap', () => {
  let uncaughtHandler: ((err: Error) => void) | undefined;
  let rejectionHandler: ((reason: unknown) => void) | undefined;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load dotenv with .env.local', async () => {
    await import('./bootstrap.js');

    expect(dotenvConfigMock).toHaveBeenCalledTimes(1);
    expect(dotenvConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringMatching(/\.env\.local$/),
      }),
    );
  });

  it('should register process error handlers', async () => {
    const onSpy = vi.spyOn(process, 'on').mockImplementation(() => process);

    await import('./bootstrap.js');

    expect(onSpy).toHaveBeenCalledWith(
      'uncaughtException',
      expect.any(Function),
    );
    expect(onSpy).toHaveBeenCalledWith(
      'unhandledRejection',
      expect.any(Function),
    );
  });

  it('should log uncaughtException to console and logger', async () => {
    vi.spyOn(process, 'on').mockImplementation((event, handler) => {
      if (event === 'uncaughtException') {
        uncaughtHandler = handler;
      }
      return process;
    });

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const logger = await import('firebase-functions/logger');

    await import('./bootstrap.js');

    const err = new Error('some error');
    uncaughtHandler?.(err);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Uncaught Exception:', err);
    expect(logger.error).toHaveBeenCalledWith('Uncaught Exception:', err);
  });

  it('should log unhandledRejection to console and logger', async () => {
    vi.spyOn(process, 'on').mockImplementation((event, handler) => {
      if (event === 'unhandledRejection') {
        rejectionHandler = handler;
      }
      return process;
    });

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const logger = await import('firebase-functions/logger');

    await import('./bootstrap.js');

    const reason = 'fail';
    rejectionHandler?.(reason);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Unhandled Rejection:',
      reason,
    );
    expect(logger.error).toHaveBeenCalledWith('Unhandled Rejection:', reason);
  });
});
