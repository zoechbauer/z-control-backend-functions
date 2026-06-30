import { HttpsError } from 'firebase-functions/v2/https';

// IMPORTANT: Do not change the path of FireStoreConstants as it is used in both the functions and the Angular apps.
// BE: functions/src/shared/app.constants.ts
// FE: src/app/shared/app.constants.ts

/**
 * FireStoreConstants class provides constants and utility methods for Firestore collection paths and user mapping.
 * These constants are used for Firestore contingent data and user mapping collections.
 * Constants for GitHub analytics collections are defined in ./GitHubConstants.ts
 */
export class FireStoreConstants {
  // These constants are used for Firestore contingent data and user mapping collections.
  // Constants for GitHub analytics collections are defined in ./GitHubConstants.ts

  /**
   * The name of the Firestore collection used for storing contingent data and user mapping.
   * This collection is used to manage user translation and feature usage statistics.
   * @type {string}
   * @readonly
   */
  static readonly COLLECTION_NAME = 'ZC_ionic_setup';

  /**
   * Mapping of app IDs to their corresponding Firestore collection names.
   * This mapping is used to determine the correct collection for each app's contingent data.
   * @type {Record<string, string>}
   * @readonly
   * @throws {HttpsError} Throws an HttpsError if an unsupported appId is provided.
   */
  private static readonly APP_TO_COLLECTION: Record<string, string> = {
    ionic_setup: FireStoreConstants.COLLECTION_NAME,
    translator: 'MLT_translations_statistics',
    image_to_text: 'ZC_image_to_text_statistics',
  };

  /**
   * Returns the Firestore collection name for the given app ID.
   * @param {string} appId The ID of the app.
   * @return {string} The Firestore collection name associated with the app ID.
   * @throws {HttpsError} Throws an HttpsError if an unsupported appId is provided.
   */
  static readonly getCollectionByAppId = (appId: string): string => {
    const collection = FireStoreConstants.APP_TO_COLLECTION[appId];
    if (!collection) {
      throw new HttpsError('invalid-argument', `Unsupported appId: ${appId}`);
    }
    return collection;
  };

  /**
   * Returns the Firestore collection path for user mapping users.
   * @param {string} collection The Firestore collection name.
   * @return {string} The Firestore collection path for user mapping users.
   */
  static readonly getUserMappingUsersCollectionPath = (collection: string) => {
    return `${collection}/userMapping/users`;
  };

  /**
   * Returns the Firestore collection path for user mapping programmer devices.
   * @param {string} collection The Firestore collection name.
   * @return {string} The Firestore collection path for user mapping programmer devices.
   */
  static readonly getUserMappingProgrammerDevicesCollectionPath = (
    collection: string
  ) => {
    return `${collection}/userMapping/programmerDevices`;
  };

  /**
   * Returns the Firestore collection path for users.
   * @param {string} collection The Firestore collection name.
   * @return {string} The Firestore collection path for users.
   */
  static readonly getUsersCollectionPath = (collection: string) => {
    return `${collection}/${this.currentYearMonthPath()}/users`;
  };

  /**
   * Returns the Firestore document path for the total characters metadata.
   * @param {string} collection The Firestore collection name.
   * @return {string} The Firestore document path for the total characters metadata.
   */
  static readonly getMetaTotalCharsDocumentPath = (collection: string) => {
    return `${collection}/${this.currentYearMonthPath()}/meta/totalChars`;
  };

  /**
   * Returns the Firestore document path for the contingent data metadata.
   * @param {string} collection The Firestore collection name.
   * @return {string} The Firestore document path for the contingent data metadata.
   */
  static readonly getMetaContingentDataDocumentPath = (collection: string) => {
    return `${collection}/${this.currentYearMonthPath()}/meta/contingentData`;
  };

  /**
   * Returns the current year and month as a string in the format 'YYYY-MM'.
   * @return {string} The current year and month in 'YYYY-MM' format.
   */
  private static readonly currentYearMonthPath = (): string => {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  };
}

/**
 * User types in user mapping collection. 'P' for programmers, 'U' for regular users.
 */
export enum UserType {
  Programmer = 'P',
  User = 'U',
}

export enum FeatureType {
  MLT = 'translator',
  Feature = 'feature',
}
