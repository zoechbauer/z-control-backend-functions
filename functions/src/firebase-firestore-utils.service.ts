import { FirebaseFirestoreService } from './firebase-firestore.service.js';
import {
  ContingentData,
  FeatureContingentData,
  FirestoreContingentData,
} from './shared/firebase-firestore.interfaces.js';

export class FirebaseFirestoreUtilsService {
  private readonly firestoreService: FirebaseFirestoreService;

  constructor(firestoreService: FirebaseFirestoreService) {
    this.firestoreService = firestoreService;
  }

/**
 * Checks whether translation contingent limits are exceeded for a user.
 * @param flags The contingent data flags
 * @param userId The user ID to check
 * @returns A promise that resolves to true if the contingent is exceeded, false otherwise
 */
  async isContingentExceeded(
    flags: ContingentData,
    userId: string,
  ): Promise<boolean> {
    // 1. If translation is globally stopped for all users
    if (flags.StopForAllUsers) {
      return true;
    }
    // 2. If the total contingent for all users is exceeded
    if (await this.isTotalContingentExceeded(flags)) {
      return true;
    }
    // 3. If the contingent for the current user is exceeded
    if (await this.isContingentForUserExceeded(flags, userId)) {
      return true;
    }
    return false;
  }

  /**
   * Checks whether the contingent for a specific user is exceeded.
   * @param flags The contingent data flags
   * @param userId The user ID to check
   * @returns A promise that resolves to true if the contingent is exceeded, false otherwise
   */
  private async isContingentForUserExceeded(
    flags: ContingentData,
    userId: string,
  ): Promise<boolean> {
    const limit = flags.maxFreeCharsPerMonthForUser;
    if (limit === undefined) {
      return true;
    }
    const charCount = await this.firestoreService.getCharCountForUser();
    return charCount >= limit;
  }

  /**
   * Checks whether the total contingent for all users is exceeded.
   * @param flags The contingent data flags
   * @returns A promise that resolves to true if the total contingent is exceeded, false otherwise
   */
  private async isTotalContingentExceeded(
    flags: ContingentData,
  ): Promise<boolean> {
    const limit = flags.maxFreeCharsPerMonth;
    const buffer = flags.maxFreeCharsBufferPerMonth;
    if (limit === undefined || buffer === undefined) {
      return true;
    }
    const charCount = await this.firestoreService.getTotalCharCount();
    return charCount >= limit - buffer;
  }

  /**
   * Validates the contingent for the user and throws if exceeded or not found.
   * @param collection The Firestore collection name
   * @param userId The user ID to validate
   * @returns A promise that resolves if the contingent is valid, or throws an error if exceeded
   */
  static async validateContingentOrThrow(
    collection: string,
    userId: string,
  ): Promise<void> {
    const firestoreService = new FirebaseFirestoreService(collection, userId);
    let flags = await firestoreService.readContingentData();

    if (!flags) {
      // could occur on change to next month
      console.log(
        `Contingent data not found in collection ${collection} for user ${userId} -> created`,
      );
      await firestoreService.createMissingContingentData();
      flags = await firestoreService.readContingentData();
    }

    const utilsService = new FirebaseFirestoreUtilsService(firestoreService);
    const flagsUnified: ContingentData =
      FirebaseFirestoreUtilsService.normalizeContingentData(flags);
    if (await utilsService.isContingentExceeded(flagsUnified, userId)) {
      console.error('Contingent exceeded for user:', userId);
      throw new (await import('firebase-functions/v2/https')).HttpsError(
        'resource-exhausted',
        'Translation contingent exceeded.',
      );
    }
  }

/**
 * Validates the feature contingent for the user and throws if exceeded or not found.
 * @param collection The Firestore collection name
 * @param userId The user ID to validate
 * @returns A promise that resolves if the feature contingent is valid, or throws an error if exceeded
 */
  static async validateFeatureContingentOrThrow(
    collection: string,
    userId: string,
  ): Promise<void> {
    const firestoreService = new FirebaseFirestoreService(collection, userId);
    let flags = await firestoreService.readFeatureContingentData();

    if (!flags) {
      // could occur on change to next month
      console.log(
        `Contingent data not found in collection ${collection} for user ${userId} -> created`,
      );
      await firestoreService.createMissingFeatureContingentData();
      flags = await firestoreService.readFeatureContingentData();
    }

    const utilsService = new FirebaseFirestoreUtilsService(firestoreService);
    const flagsUnified: ContingentData =
      FirebaseFirestoreUtilsService.normalizeContingentData(flags);
    if (await utilsService.isContingentExceeded(flagsUnified, userId)) {
      console.error('Contingent exceeded for user:', userId);
      throw new (await import('firebase-functions/v2/https')).HttpsError(
        'resource-exhausted',
        'Feature contingent exceeded.',
      );
    }
  }

  /**
   * Normalizes contingent data to a unified format.
   * @param flags The contingent data to normalize.
   * @returns The normalized contingent data.
   */
  private static normalizeContingentData(
    flags: FeatureContingentData | FirestoreContingentData,
  ): ContingentData {
    const isFeatureFlags =
      'maxFreeFeatureCharsPerMonth' in flags ||
      'maxFreeFeatureCharsBufferPerMonth' in flags ||
      'maxFreeFeatureCharsPerMonthForUser' in flags ||
      'StopFeatureUsageForAllUsers' in flags;

    if (isFeatureFlags) {
      const featureFlags = flags as FeatureContingentData;
      return {
        StopForAllUsers: featureFlags.StopFeatureUsageForAllUsers ?? false,
        maxFreeCharsPerMonth: featureFlags.maxFreeFeatureCharsPerMonth,
        maxFreeCharsBufferPerMonth:
          featureFlags.maxFreeFeatureCharsBufferPerMonth,
        maxFreeCharsPerMonthForUser:
          featureFlags.maxFreeFeatureCharsPerMonthForUser,
      };
    }

    const translationFlags = flags as FirestoreContingentData;
    return {
      StopForAllUsers: translationFlags.StopTranslationForAllUsers ?? false,
      maxFreeCharsPerMonth: translationFlags.maxFreeTranslateCharsPerMonth,
      maxFreeCharsBufferPerMonth:
        translationFlags.maxFreeTranslateCharsBufferPerMonth,
      maxFreeCharsPerMonthForUser:
        translationFlags.maxFreeTranslateCharsPerMonthForUser,
    };
  }

/**
 * Performs a deep equality check between two objects.
 * @param obj1 The first object to compare
 * @param obj2 The second object to compare
 * @returns True if the objects are deeply equal, false otherwise
 */
  static isDeepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object')
      return obj1 === obj2;

    const keys1 = Object.keys(obj1).sort((a, b) => a.localeCompare(b));
    const keys2 = Object.keys(obj2).sort((a, b) => a.localeCompare(b));

    if (keys1.length !== keys2.length) return false;
    if (JSON.stringify(keys1) !== JSON.stringify(keys2)) return false;

    for (const key of keys1) {
      if (!FirebaseFirestoreUtilsService.isDeepEqual(obj1[key], obj2[key]))
        return false;
    }

    return true;
  }
}
