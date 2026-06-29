import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  FeatureType,
  FireStoreConstants,
  UserType,
} from './app.constants.js';

describe('FireStoreConstants', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-28T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should map app ids to collection names', () => {
    expect(FireStoreConstants.getCollectionByAppId('ionic_setup')).toBe(
      'ZC_ionic_setup',
    );
    expect(FireStoreConstants.getCollectionByAppId('translator')).toBe(
      'MLT_translations_statistics',
    );
    expect(FireStoreConstants.getCollectionByAppId('image_to_text')).toBe(
      'ZC_image_to_text_statistics',
    );
  });

  it('should throw HttpsError for unsupported app ids', () => {
    expect(() => FireStoreConstants.getCollectionByAppId('unknown')).toThrowError(
      new HttpsError('invalid-argument', 'Unsupported appId: unknown'),
    );
  });

  it('should build user mapping paths', () => {
    expect(
      FireStoreConstants.getUserMappingUsersCollectionPath('ZC_ionic_setup'),
    ).toBe('ZC_ionic_setup/userMapping/users');

    expect(
      FireStoreConstants.getUserMappingProgrammerDevicesCollectionPath(
        'ZC_ionic_setup',
      ),
    ).toBe('ZC_ionic_setup/userMapping/programmerDevices');
  });

  it('should build date-based collection paths', () => {
    expect(FireStoreConstants.getUsersCollectionPath('ZC_ionic_setup')).toBe(
      'ZC_ionic_setup/2026-06/users',
    );
    expect(
      FireStoreConstants.getMetaTotalCharsDocumentPath('ZC_ionic_setup'),
    ).toBe('ZC_ionic_setup/2026-06/meta/totalChars');
    expect(
      FireStoreConstants.getMetaContingentDataDocumentPath('ZC_ionic_setup'),
    ).toBe('ZC_ionic_setup/2026-06/meta/contingentData');
  });

  it('should expose the enum values', () => {
    expect(UserType.Programmer).toBe('P');
    expect(UserType.User).toBe('U');
    expect(FeatureType.MLT).toBe('translator');
    expect(FeatureType.Feature).toBe('feature');
  });
});
