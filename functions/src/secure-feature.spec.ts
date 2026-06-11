import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((optsOrHandler: any, maybeHandler?: any) =>
    typeof optsOrHandler === 'function' ? optsOrHandler : maybeHandler,
  ),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'HttpsError';
    }
  },
}));

vi.mock('firebase-functions/params', () => ({
  defineSecret: vi.fn(() => ({
    value: vi.fn(() => 'fake-api-key'),
  })),
}));

vi.mock('firebase-admin', () => ({
  default: {
    initializeApp: vi.fn(),
  },
}));

vi.mock('./firebase-firestore.service.js', () => ({
  FirebaseFirestoreService: vi.fn(),
}));

vi.mock('./firebase-firestore-utils.service.js', () => ({
  FirebaseFirestoreUtilsService: {
    validateFeatureContingentOrThrow: vi.fn(),
  },
}));

import { FirebaseFirestoreService } from './firebase-firestore.service.js';
import { FirebaseFirestoreUtilsService } from './firebase-firestore-utils.service.js';
import { secureFeature } from './secure-feature.js';
import { SecureFeatureData } from './shared/firebase-firestore.interfaces.js';

describe('secureFeature', () => {
  const COLLECTION = 'ZC_ionic_setup';
  const USER_ID = 'user1';
  const appId = 'ionic_setup';
  const VALID_DATA: SecureFeatureData = {
    appId,
    text: 'London',
  };

  const makeRequest = (data: SecureFeatureData, uid?: string) => ({
    auth: uid ? { uid } : undefined,
    data,
  });

  const invoke = (data: SecureFeatureData, uid?: string) =>
    (secureFeature as any)(makeRequest(data, uid));

  const mockFirestoreInstance = (
    addConsumedFeatureCharsImpl?: ReturnType<typeof vi.fn>,
  ) => {
    const addConsumedFeatureChars =
      addConsumedFeatureCharsImpl ?? vi.fn().mockResolvedValue(undefined);

    vi.mocked(FirebaseFirestoreService).mockImplementation(function (
      this: any,
    ) {
      this.addConsumedFeatureChars = addConsumedFeatureChars;
    } as any);

    return { addConsumedFeatureChars };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('input validation', () => {
    const invokeInvalid = (data: unknown, uid?: string) =>
      invoke(data as SecureFeatureData, uid);

    type ValidationCase = {
      name: string;
      data: unknown;
      expected: { code: string; message: string };
    };

    const invalidCases: ValidationCase[] = [
      {
        name: 'appId is empty',
        data: { ...VALID_DATA, appId: '' },
        expected: {
          code: 'invalid-argument',
          message: 'appId must be provided.',
        },
      },
      {
        name: 'unsupported appId is provided',
        data: { ...VALID_DATA, appId: 'unsupportedAppId' },
        expected: {
          code: 'invalid-argument',
          message: 'Unsupported appId: unsupportedAppId',
        },
      },
      {
        name: 'appId is blank',
        data: { ...VALID_DATA, appId: ' ' },
        expected: {
          code: 'invalid-argument',
          message: 'appId must be provided.',
        },
      },
      {
        name: 'appId is undefined',
        data: { ...VALID_DATA, appId: undefined },
        expected: {
          code: 'invalid-argument',
          message: 'appId must be provided.',
        },
      },
      {
        name: 'appId is null',
        data: { ...VALID_DATA, appId: null },
        expected: {
          code: 'invalid-argument',
          message: 'appId must be provided.',
        },
      },
      {
        name: 'appId is non-string',
        data: { ...VALID_DATA, appId: 123 },
        expected: {
          code: 'invalid-argument',
          message: 'appId must be provided.',
        },
      },
      {
        name: 'text and appId are undefined',
        data: { ...VALID_DATA, appId: undefined, text: undefined },
        expected: {
          code: 'invalid-argument',
          message: 'Missing required parameters.',
        },
      },
      {
        name: 'parameters are missing',
        data: {},
        expected: {
          code: 'invalid-argument',
          message: 'Missing required parameters.',
        },
      },
      {
        name: 'missing text',
        data: { appId, text: '' },
        expected: {
          code: 'invalid-argument',
          message: 'Missing required parameters.',
        },
      },
      {
        name: 'payload object only contains appId',
        data: { appId },
        expected: {
          code: 'invalid-argument',
          message: 'Missing required parameters.',
        },
      },
    ];
    it.for(invalidCases)(
      'throws validation error: $name',
      async ({ data, expected }) => {
        await expect(invokeInvalid(data, USER_ID)).rejects.toMatchObject(
          expected,
        );
      },
    );

    it('throws unauthenticated if auth is undefined', async () => {
      const expected = {
        code: 'unauthenticated',
        message: 'User must be authenticated.',
      };
      await expect(invokeInvalid(VALID_DATA, undefined)).rejects.toMatchObject(
        expected,
      );
    });
  });

  describe('service interactions', () => {
    it('validates contingent using auth uid', async () => {
      vi.mocked(
        FirebaseFirestoreUtilsService.validateFeatureContingentOrThrow,
      ).mockRejectedValue(new Error('Feature contingent exceeded'));

      await expect(invoke(VALID_DATA, USER_ID)).rejects.toThrow();

      expect(
        vi.mocked(
          FirebaseFirestoreUtilsService.validateFeatureContingentOrThrow,
        ),
      ).toHaveBeenCalledWith(COLLECTION, USER_ID);
    });

    it('calls addConsumedFeatureChars with computed count', async () => {
      vi.mocked(
        FirebaseFirestoreUtilsService.validateFeatureContingentOrThrow,
      ).mockResolvedValue(undefined);

      const text = 'Hallo';
      const expectedCharCount = text.length;
      const { addConsumedFeatureChars } = mockFirestoreInstance(
        vi
          .fn()
          .mockRejectedValue(new Error('Error adding consumed feature chars')),
      );

      await expect(invoke({ appId, text }, USER_ID)).rejects.toThrow();

      expect(vi.mocked(FirebaseFirestoreService)).toHaveBeenCalledWith(
        COLLECTION,
        USER_ID,
      );
      expect(addConsumedFeatureChars).toHaveBeenCalledWith(expectedCharCount);
    });
  });

  describe('datamuse.com API interaction', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('calls datamuse API with text', async () => {
      vi.mocked(
        FirebaseFirestoreUtilsService.validateFeatureContingentOrThrow,
      ).mockResolvedValue(undefined);

      const text = 'London';
      const expectedCharCount = text.length;

      const { addConsumedFeatureChars } = mockFirestoreInstance(
        vi.fn().mockResolvedValue(undefined),
      );

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => [
          { word: 'greater london' },
          { word: 'british capital' },
          { word: 'capital of the united kingdom' },
          {},
        ],
      });

      vi.stubGlobal('fetch', fetchMock);

      await expect(invoke({ appId, text }, USER_ID)).resolves.toEqual({
        feature: {
          input: text,
          related:
            'greater london, british capital, capital of the united kingdom',
        },
      });

      expect(vi.mocked(FirebaseFirestoreService)).toHaveBeenCalledWith(
        COLLECTION,
        USER_ID,
      );
      expect(addConsumedFeatureChars).toHaveBeenCalledWith(expectedCharCount);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.datamuse.com/words?ml=London&max=5',
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
      );
    });

    it('throws internal error if fetch fails', async () => {
      vi.mocked(
        FirebaseFirestoreUtilsService.validateFeatureContingentOrThrow,
      ).mockResolvedValue(undefined);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        invoke(
          {
            appId,
            text: 'London',
          },
          USER_ID,
        ),
      ).rejects.toMatchObject({
        code: 'internal',
        message: 'Function API error: 400 Bad Request',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws internal error if fetch throws an error', async () => {
      vi.mocked(
        FirebaseFirestoreUtilsService.validateFeatureContingentOrThrow,
      ).mockResolvedValue(undefined);
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        invoke(
          {
            appId,
            text: 'London',
          },
          USER_ID,
        ),
      ).rejects.toMatchObject({
        code: 'internal',
        message: 'Function API error: Network error',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
