import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./firebase-firestore.service.js', () => ({
  FirebaseFirestoreService: vi.fn(),
}));

import { FirebaseFirestoreUtilsService } from './firebase-firestore-utils.service.js';
import {
  ContingentData,
  FeatureContingentData,
  FirestoreContingentData,
} from '../../shared/firebase-firestore.interfaces.js';
import { FirebaseFirestoreService } from './firebase-firestore.service.js';

describe('FirebaseFirestoreUtilsService.isDeepEqual', () => {
  it('returns true for deeply equal objects with different key order', () => {
    const left = {
      b: 2,
      a: 1,
      nested: {
        y: 'value',
        x: [1, 2, 3],
      },
    };
    const right = {
      a: 1,
      b: 2,
      nested: {
        x: [1, 2, 3],
        y: 'value',
      },
    };

    expect(FirebaseFirestoreUtilsService.isDeepEqual(left, right)).toBe(true);
  });

  it('returns false for objects with different nested values', () => {
    const left = { a: 1, nested: { count: 5 } };
    const right = { a: 1, nested: { count: 10 } };

    expect(FirebaseFirestoreUtilsService.isDeepEqual(left, right)).toBe(false);
  });

  it('returns false if one object is null', () => {
    expect(FirebaseFirestoreUtilsService.isDeepEqual({ a: 1 }, null)).toBe(
      false,
    );
  });

  it('returns false if objects have different lengths', () => {
    expect(
      FirebaseFirestoreUtilsService.isDeepEqual({ a: 1, b: 2 }, { a: 1 }),
    ).toBe(false);
  });

  it('returns false if objects have different keys', () => {
    expect(
      FirebaseFirestoreUtilsService.isDeepEqual(
        { a: 1, nested: { count: 5 } },
        { 'a': 1, 'a-different': 1, 'nested': { count: 5 } },
      ),
    ).toBe(false);
  });

  it('returns true for same object reference', () => {
    const same = { a: 1, nested: { count: 5 } };
    expect(FirebaseFirestoreUtilsService.isDeepEqual(same, same)).toBe(true);
  });

  it('returns true for equal primitive values', () => {
    expect(FirebaseFirestoreUtilsService.isDeepEqual(5, 5)).toBe(true);
  });

  it('returns false for different primitive values', () => {
    expect(FirebaseFirestoreUtilsService.isDeepEqual(5, 6)).toBe(false);
  });
});

describe('isContingentExceeded', () => {
  it('returns true if StopForAllUsers is set', async () => {
    const service = new FirebaseFirestoreUtilsService({} as any);

    await expect(
      service.isContingentExceeded({ StopForAllUsers: true } as ContingentData),
    ).resolves.toBe(true);
  });

  it('returns true if total contingent is exceeded', async () => {
    const service = new FirebaseFirestoreUtilsService({} as any);
    vi.spyOn(service as any, 'isTotalContingentExceeded').mockResolvedValue(
      true,
    );

    const result = await service.isContingentExceeded({
      StopForAllUsers: false,
    } as ContingentData);

    expect(result).toBe(true);
    expect((service as any).isTotalContingentExceeded).toHaveBeenCalledOnce();
  });

  it('returns true if contingent for current user is exceeded', async () => {
    const service = new FirebaseFirestoreUtilsService({} as any);
    vi.spyOn(service as any, 'isTotalContingentExceeded').mockResolvedValue(
      false,
    );
    vi.spyOn(
      service as any,
      'isCurrentUserContingentExceeded',
    ).mockResolvedValue(true);

    const result = await service.isContingentExceeded({
      StopForAllUsers: false,
    } as ContingentData);

    expect(result).toBe(true);
    expect((service as any).isTotalContingentExceeded).toHaveBeenCalledOnce();
    expect(
      (service as any).isCurrentUserContingentExceeded,
    ).toHaveBeenCalledOnce();
  });

  it('returns false if all checks fail', async () => {
    const service = new FirebaseFirestoreUtilsService({} as any);
    vi.spyOn(service as any, 'isTotalContingentExceeded').mockResolvedValue(
      false,
    );
    vi.spyOn(
      service as any,
      'isCurrentUserContingentExceeded',
    ).mockResolvedValue(false);

    const result = await service.isContingentExceeded({
      StopForAllUsers: false,
    } as ContingentData);

    expect(result).toBe(false);
  });
});

describe('isTotalContingentExceeded', () => {
  const contingentData: ContingentData = {
    StopForAllUsers: false,
    maxFreeCharsPerMonth: 500_000,
    maxFreeCharsBufferPerMonth: 5_000,
    maxFreeCharsPerMonthForUser: 10_000,
  };

  it('returns true if total contingent limit is missing', async () => {
    const firestoreServiceMock = {
      getTotalCharCount: vi.fn(),
    };

    const service = new FirebaseFirestoreUtilsService(
      firestoreServiceMock as any,
    );

    const result = await (service as any).isTotalContingentExceeded({
      StopForAllUsers: false,
    } as ContingentData);

    expect(result).toBe(true);
    expect(firestoreServiceMock.getTotalCharCount).not.toHaveBeenCalled();
  });

  it('returns true if total char count exceeds limit minus buffer', async () => {
    const firestoreServiceMock = {
      getTotalCharCount: vi.fn().mockResolvedValue(495_000),
    };

    const service = new FirebaseFirestoreUtilsService(
      firestoreServiceMock as any,
    );

    const result = await (service as any).isTotalContingentExceeded(
      contingentData,
    );

    expect(result).toBe(true);
    expect(firestoreServiceMock.getTotalCharCount).toHaveBeenCalledOnce();
  });

  it('returns false if total char count is within limit minus buffer', async () => {
    const firestoreServiceMock = {
      getTotalCharCount: vi.fn().mockResolvedValue(494_000),
    };

    const service = new FirebaseFirestoreUtilsService(
      firestoreServiceMock as any,
    );

    const result = await (service as any).isTotalContingentExceeded(
      contingentData,
    );

    expect(result).toBe(false);
    expect(firestoreServiceMock.getTotalCharCount).toHaveBeenCalledOnce();
  });
});

describe('isCurrentUserContingentExceeded', () => {
  it('returns true if user char count exceeds per-user limit', async () => {
    const contingentData = {
      maxFreeCharsPerMonthForUser: 10_000,
    } as ContingentData;

    const firestoreServiceMock = {
      getCharCountForCurrentUser: vi.fn().mockResolvedValue(10_000),
    };

    const service = new FirebaseFirestoreUtilsService(
      firestoreServiceMock as any,
    );

    const result = await (service as any).isCurrentUserContingentExceeded(
      contingentData,
    );

    expect(result).toBe(true);
    expect(
      firestoreServiceMock.getCharCountForCurrentUser,
    ).toHaveBeenCalledOnce();
  });

  it('returns true if user contingent limit is missing', async () => {
    const firestoreServiceMock = {
      getCharCountForCurrentUser: vi.fn(),
    };

    const service = new FirebaseFirestoreUtilsService(
      firestoreServiceMock as any,
    );

    const result = await (service as any).isCurrentUserContingentExceeded(
      {} as ContingentData,
    );

    expect(result).toBe(true);
    expect(
      firestoreServiceMock.getCharCountForCurrentUser,
    ).not.toHaveBeenCalled();
  });
});

describe('FirebaseFirestoreUtilsService.validateContingentOrThrow', () => {
  const userId = 'testUserId';
  const collection = 'testCollection';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates missing contingent data if not found', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    vi.mocked(FirebaseFirestoreService).mockImplementation(function(
      this: any,
    ) {
      this.readContingentData = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ any: 'flags' });
      this.createMissingContingentData = vi.fn().mockResolvedValue(undefined);
    });

    vi.spyOn(
      FirebaseFirestoreUtilsService.prototype,
      'isContingentExceeded',
    ).mockResolvedValue(false);

    await expect(
      FirebaseFirestoreUtilsService.validateContingentOrThrow(
        collection,
        userId,
      ),
    ).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith(
      `Contingent data not found in collection ${collection} for user ${userId} -> created`,
    );
    expect(FirebaseFirestoreService).toHaveBeenCalledWith(collection, userId);
  });

  it('throws if contingent is exceeded', async () => {
    vi.mocked(FirebaseFirestoreService).mockImplementation(function(
      this: any,
    ) {
      this.readContingentData = vi.fn().mockResolvedValue({ any: 'flags' });
      this.createMissingContingentData = vi.fn().mockResolvedValue(undefined);
    });

    vi.spyOn(
      FirebaseFirestoreUtilsService.prototype,
      'isContingentExceeded',
    ).mockResolvedValue(true);

    await expect(
      FirebaseFirestoreUtilsService.validateContingentOrThrow(
        collection,
        userId,
      ),
    ).rejects.toThrow('Translation contingent exceeded.');
  });

  it('resolves if contingent is not exceeded', async () => {
    vi.mocked(FirebaseFirestoreService).mockImplementation(function(
      this: any,
    ) {
      this.readContingentData = vi.fn().mockResolvedValue({ any: 'flags' });
      this.createMissingContingentData = vi.fn().mockResolvedValue(undefined);
    });

    vi.spyOn(
      FirebaseFirestoreUtilsService.prototype,
      'isContingentExceeded',
    ).mockResolvedValue(false);

    await expect(
      FirebaseFirestoreUtilsService.validateContingentOrThrow(
        collection,
        userId,
      ),
    ).resolves.toBeUndefined();
  });
});

describe('FirebaseFirestoreUtilsService.validateFeatureContingentOrThrow', () => {
  const userId = 'testUserId';
  const collection = 'testCollection';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates missing feature contingent data if not found', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    vi.mocked(FirebaseFirestoreService).mockImplementation(function(
      this: any,
    ) {
      this.readFeatureContingentData = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ any: 'flags' });
      this.createMissingFeatureContingentData = vi
        .fn()
        .mockResolvedValue(undefined);
    });

    vi.spyOn(
      FirebaseFirestoreUtilsService.prototype,
      'isContingentExceeded',
    ).mockResolvedValue(false);

    await expect(
      FirebaseFirestoreUtilsService.validateFeatureContingentOrThrow(
        collection,
        userId,
      ),
    ).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith(
      `Contingent data not found in collection ${collection} for user ${userId} -> created`,
    );
    expect(FirebaseFirestoreService).toHaveBeenCalledWith(collection, userId);
  });

  it('throws if feature contingent is exceeded', async () => {
    vi.mocked(FirebaseFirestoreService).mockImplementation(function(
      this: any,
    ) {
      this.readFeatureContingentData = vi
        .fn()
        .mockResolvedValue({ any: 'flags' });
      this.createMissingFeatureContingentData = vi
        .fn()
        .mockResolvedValue(undefined);
    });

    vi.spyOn(
      FirebaseFirestoreUtilsService.prototype,
      'isContingentExceeded',
    ).mockResolvedValue(true);

    await expect(
      FirebaseFirestoreUtilsService.validateFeatureContingentOrThrow(
        collection,
        userId,
      ),
    ).rejects.toThrow('Feature contingent exceeded.');
  });

  it('resolves if feature contingent is not exceeded', async () => {
    vi.mocked(FirebaseFirestoreService).mockImplementation(function(
      this: any,
    ) {
      this.readFeatureContingentData = vi
        .fn()
        .mockResolvedValue({ any: 'flags' });
      this.createMissingFeatureContingentData = vi
        .fn()
        .mockResolvedValue(undefined);
    });

    vi.spyOn(
      FirebaseFirestoreUtilsService.prototype,
      'isContingentExceeded',
    ).mockResolvedValue(false);

    await expect(
      FirebaseFirestoreUtilsService.validateFeatureContingentOrThrow(
        collection,
        userId,
      ),
    ).resolves.toBeUndefined();
  });
});

describe('FirebaseFirestoreUtilsService.normalizeContingentData', () => {
  const normalizedContingentData: ContingentData = {
    StopForAllUsers: false,
    maxFreeCharsPerMonth: 500_000,
    maxFreeCharsBufferPerMonth: 5_000,
    maxFreeCharsPerMonthForUser: 10_000,
  };

  it('maps feature contingent data structure to normalized structure', () => {
    const contingentData: FeatureContingentData = {
      StopFeatureUsageForAllUsers: false,
      maxFreeFeatureCharsPerMonth: 500_000,
      maxFreeFeatureCharsBufferPerMonth: 5_000,
      maxFreeFeatureCharsPerMonthForUser: 10_000,
    };

    const normalized = (
      FirebaseFirestoreUtilsService as any
    ).normalizeContingentData(contingentData);
    expect(normalized).toEqual(normalizedContingentData);
  });

  it('maps translation contingent data structure to normalized structure', () => {
    const contingentData: FirestoreContingentData = {
      StopTranslationForAllUsers: false,
      maxFreeTranslateCharsPerMonth: 500_000,
      maxFreeTranslateCharsBufferPerMonth: 5_000,
      maxFreeTranslateCharsPerMonthForUser: 10_000,
    };

    const normalized = (
      FirebaseFirestoreUtilsService as any
    ).normalizeContingentData(contingentData);
    expect(normalized).toEqual(normalizedContingentData);
  });
});
