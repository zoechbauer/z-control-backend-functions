import { db } from './shared/firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { FireStoreConstants, UserType } from './shared/app.constants.js';
import {
  CharCountAndTargetLangsResult,
  DeviceInfo,
  FeatureContingentData,
  FirestoreContingentData,
  ProgrammerDeviceUID,
} from './shared/firebase-firestore.interfaces.js';
import { getDeviceName, getUserType, isValidDevice } from './utils.js';
import { FirebaseFirestoreUtilsService } from './firebase-firestore-utils.service.js';

/**
 * Service for interacting with Firebase Firestore, specifically for managing user and feature contingent data.
 */
export class FirebaseFirestoreService {
  private readonly db = db;
  private readonly collection: string;
  private readonly userId: string;

  /**
   * Creates a new instance of FirebaseFirestoreService.
   * @param {string} collection The Firestore collection name.
   * @param {string} userId The user ID.
   */
  constructor(collection: string, userId: string) {
    this.collection = collection;
    this.userId = userId;
  }

  /**
   * Reads the MLT contingent data document containing global feature limits and control flags.
   *
   * @return {Promise<FirestoreContingentData>} Promise resolving to the contingent data object with MLT quotas and control flags.
   * @throws {Error} If the document read operation fails.
   */
  async readContingentData(): Promise<FirestoreContingentData> {
    const doc = await this.db
      .doc(
        `${FireStoreConstants.getMetaContingentDataDocumentPath(this.collection)}`,
      )
      .get();
    return doc.data() as FirestoreContingentData;
  }

  /**
   * Reads the feature contingent data document containing global feature limits and control flags.
   *
   * @return {Promise<FeatureContingentData>} Promise resolving to the feature contingent data object with feature quotas and control flags.
   * @throws {Error} If the document read operation fails.
   */
  async readFeatureContingentData(): Promise<FeatureContingentData> {
    const doc = await this.db
      .doc(
        `${FireStoreConstants.getMetaContingentDataDocumentPath(this.collection)}`,
      )
      .get();
    return doc.data() as FeatureContingentData;
  }

  /**
   * Retrieves the MLT character count and target languages for the current user.
   *
   * Returns the user's cumulative translated character count and their selected target languages
   * for translations. If the user document doesn't exist or lacks character count data, returns 0.
   *
   * @return {Promise<CharCountAndTargetLangsResult>} Promise resolving to an object with charCount and targetLanguages array.
   * @throws {Error} If the document read operation fails.
   */
  async getCharCountAndTargetLangsForUser(): Promise<CharCountAndTargetLangsResult> {
    const doc = await this.db
      .doc(`${FireStoreConstants.getUsersCollectionPath(this.collection)}/${this.userId}`)
      .get();
    return doc.exists && doc.data()?.charCount
      ? {
        charCount: doc.data()!.charCount,
        targetLanguages: doc.data()?.targetLanguages || [],
      }
      : { charCount: 0, targetLanguages: [] };
  }

  /**
   * Retrieves the feature character count for the current user.
   *
   * Returns the user's cumulative consumed feature character count.
   * If the user document doesn't exist or lacks character count data, returns 0.
   *
   * @return {Promise<number>} Promise resolving to the character count as a number.
   * @throws {Error} If the document read operation fails.
   */
  async getCharCountForUser(): Promise<number> {
    const doc = await this.db
      .doc(
        `${FireStoreConstants.getUsersCollectionPath(this.collection)}/${this.userId}`,
      )
      .get();
    return doc.exists && doc.data()?.charCount ? doc.data()!.charCount : 0;
  }

  /**
   * Retrieves the total consumed feature/MLT character count across all users for the current month.
   *
   * Reads the meta document that tracks cumulative feature/MLT usage. Used for monitoring
   * global quotas and enforcing rate limits.
   *
   * @return {Promise<number>} Promise resolving to the total character count as a number, or 0 if not found.
   * @throws {Error} If the document read operation fails.
   */
  async getTotalCharCount(): Promise<number> {
    try {
      const doc = await this.db
        .doc(
          `${FireStoreConstants.getMetaTotalCharsDocumentPath(this.collection)}`,
        )
        .get();
      return doc.exists && doc.data()?.charCount ? doc.data()!.charCount : 0;
    } catch (error) {
      console.error('Error getting total char count:', error);
      throw error;
    }
  }

  /**
   * If the MLT contingent data document is missing, it creates it with default values.
   * Existing values are never overwritten.
   */
  async createMissingContingentData(): Promise<void> {
    const contingentData: FirestoreContingentData = {
      StopTranslationForAllUsers: false,
      maxFreeTranslateCharsPerMonthForUser: 10000,
      maxFreeTranslateCharsPerMonth: 500000,
      maxFreeTranslateCharsBufferPerMonth: 5000,
    };

    await this.createMissingContingentDataExec(contingentData);
  }

  /**
   * If the feature contingent data document is missing, it creates it with default values.
   * Existing values are never overwritten.
   */
  async createMissingFeatureContingentData(): Promise<void> {
    const contingentData: FeatureContingentData = {
      StopFeatureUsageForAllUsers: false,
      maxFreeFeatureCharsPerMonthForUser: 10000,
      maxFreeFeatureCharsPerMonth: 500000,
      maxFreeFeatureCharsBufferPerMonth: 5000,
    };

    await this.createMissingContingentDataExec(contingentData);
  }

  /**
   * Creates the contingent data document with default values if it doesn't exist.
   * Existing values are never overwritten.
   * @param {FirestoreContingentData | FeatureContingentData} contingentData The contingent data to create.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   * @throws {Error} If the document creation operation fails.
   */
  private async createMissingContingentDataExec(
    contingentData: FirestoreContingentData | FeatureContingentData,
  ): Promise<void> {
    try {
      const docRef = this.db.doc(
        `${FireStoreConstants.getMetaContingentDataDocumentPath(this.collection)}`,
      );
      const doc = await docRef.get();
      if (!doc.exists) {
        await docRef.set(
          {
            ...contingentData,
            lastUpdated: new Date(),
          },
          { merge: true },
        );
      }
    } catch (error) {
      console.error('Error creating missing contingent data:', error);
      throw error;
    }
  }

  /**
   * Initializes or syncs programmer device UIDs from client configuration to Firestore.
   *
   * **Initial Setup Workflow:**
   * This function is called once from the client (via Cloud Function) to populate the
   * `programmerDevices` collection with UIDs from .env.local. After initial setup,
   * programmer UIDs can be maintained manually in Firestore or change .env.local
   * and call again to sync new UIDs without redeploying.
   *
   * **Behavior:**
   * For each device in the provided array:
   *   - Creates a document in `programmerDevices` collection if it doesn't exist
   *   - Updates the `users` mapping: if a user mapping exists with type 'User', updates to 'Programmer'
   *   - If no user mapping exists, creates a new one as 'Programmer'
   *   - Skips devices with missing userId or name
   *
   * **Important:**
   * - Existing `programmerDevices` documents are NOT overwritten
   * - Manual changes in Firestore are preserved
   * - This function is idempotent - safe to call multiple times
   *
   * **Path Structure:**
   * - User mappings: `{collection}/userMapping/users/{userId}`
   * - Programmer devices: `{collection}/userMapping/programmerDevices/{userId}`
   *
   * @param {ProgrammerDeviceUID[]} programmerDeviceUIDs Array of programmer device objects from client (.env.local).
   * @return {Promise<void>} Promise that resolves when all device updates are complete.
   * @throws {TypeError} If programmerDeviceUIDs is not an array.
   * @throws {Error} Is caught and logged for individual device update failures.
   *
   * @example
   * // Initial setup - called once from client
   * await service.updateProgrammerDeviceUIDs([
   *   { userId: 'abc123', name: 'Hans-Laptop' }
   * ]);
   * // After this, update UIDs directly in Firestore programmerDevices collection or
   * // change .env.local and call again to sync new UIDs without redeploying.
   */
  async updateProgrammerDeviceUIDs(
    programmerDeviceUIDs: ProgrammerDeviceUID[],
  ): Promise<void> {
    if (!Array.isArray(programmerDeviceUIDs)) {
      throw new TypeError('programmerDeviceUIDs must be an array');
    }

    for (const device of programmerDeviceUIDs) {
      if (!isValidDevice(device)) continue;
      try {
        await this.updateUserMappingUsers(device, programmerDeviceUIDs);
        await this.createUserMappingProgrammerDevices(device);
      } catch (error) {
        console.error(
          'Error updating user mapping for programmer device:',
          device,
          error,
        );
      }
    }
  }

  /**
 * Updates or creates a user mapping document for a single programmer device.
   * Internal helper for updateProgrammerDeviceUIDs.
   * @param {ProgrammerDeviceUID} device - Programmer device object containing userId and device name.
   * @param {ProgrammerDeviceUID[]} allDevices - Array of all programmer device objects.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   * @throws {Error} If the Firestore write operation fails.
   */
  private async updateUserMappingUsers(
    device: ProgrammerDeviceUID,
    allDevices: ProgrammerDeviceUID[],
  ): Promise<void> {
    const docRef = this.db.doc(
      `${FireStoreConstants.getUserMappingUsersCollectionPath(this.collection)}/${
        device.userId
      }`,
    );
    const doc = await docRef.get();

    if (doc.exists) {
      if (doc.data()?.type === UserType.User) {
        // Update existing document to type Programmer
        await docRef.set(
          {
            name: await this.getUserName(device.userId, allDevices),
            type: UserType.Programmer,
            device: device.name,
            lastUpdated: new Date(),
          },
          { merge: true },
        );
      }
    } else {
      // Create new document for programmer device
      this.logCreatingDevice(device);
      await docRef.set(
        {
          name: await this.getUserName(device.userId, allDevices),
          type: UserType.Programmer,
          userId: device.userId,
          device: device.name,
          createdAt: new Date(),
        },
        { merge: true },
      );
    }
  }

  /**
   * Creates or updates a programmer device mapping in Firestore.
   *
   * Stores the device UID and name in the programmerDevices collection,
   * using the userId as the document ID. This allows direct modification
   * of programmer device UIDs in Firestore without redeploying the app.
   *
   * Path: {collection}/userMapping/programmerDevices/{userId}
   *
   * @param {ProgrammerDeviceUID} device - Programmer device object containing userId and device name.
   * @return {Promise<void>} A promise that resolves when the document is created or confirmed to exist.
   * @throws {Error} If the Firestore write operation fails.
   *
   * @example
   * await service.createUserMappingProgrammerDevices({
   *   userId: 'abc123',
   *   name: 'Chrome Browser'
   * });
   */
  private async createUserMappingProgrammerDevices(
    device: ProgrammerDeviceUID,
  ): Promise<void> {
    const docRef = this.db.doc(
      `${FireStoreConstants.getUserMappingProgrammerDevicesCollectionPath(this.collection)}/${
        device.userId
      }`,
    );
    const doc = await docRef.get();

    if (!doc.exists) {
      await docRef.set(
        {
          userId: device.userId,
          device: device.name,
          createdAt: new Date(),
        },
        { merge: true },
      );
    }
  }

  /**
   * Retrieves all programmer device UIDs from Firestore.
   *
   * Reads all documents from the programmerDevices collection and returns them
   * as an array. This is the source of truth for determining which UIDs belong
   * to programmer devices, allowing you to update programmer UIDs directly in
   * Firestore without modifying .env.local or redeploying.
   *
   * Path: {collection}/userMapping/programmerDevices/*
   *
   * @return {Promise<ProgrammerDeviceUID[]>} Promise resolving to array of all programmer device UIDs stored in Firestore.
   *          Returns empty array if the collection is empty or doesn't exist.
   * @throws {Error} If the Firestore read operation fails.
   *
   * @example
   * const devices = await service.getProgrammerDeviceUIDs();
   * // Returns: [{ userId: 'abc123', name: 'Chrome Browser' }, ...]
   */
  async getProgrammerDeviceUIDs(): Promise<ProgrammerDeviceUID[]> {
    try {
      const collectionRef = this.db.collection(
        `${FireStoreConstants.getUserMappingProgrammerDevicesCollectionPath(this.collection)}`,
      );
      const snapshot = await collectionRef.get();

      if (snapshot.empty) {
        console.log('No programmer devices found in Firestore.');
        return [];
      }
      return snapshot.docs.map((doc) => doc.data() as ProgrammerDeviceUID);
    } catch (error) {
      console.error(
        'Error retrieving programmer devices from Firestore:',
        error,
      );
      throw error;
    }
  }

  /**
   * Checks if the current device is a programmer device.
   * @return {Promise<boolean>} Promise resolving to true if the device is a programmer device, false otherwise.
   */
  async isProgrammerDevice(): Promise<boolean> {
    try {
      const collectionRef = this.db.collection(
        `${FireStoreConstants.getUserMappingProgrammerDevicesCollectionPath(this.collection)}`,
      );
      const snapshot = await collectionRef.get();

      if (snapshot.empty) {
        console.log('No programmer devices found in Firestore.');
        return false;
      }
      return snapshot.docs.some(
        (doc) => (doc.data() as ProgrammerDeviceUID).userId === this.userId,
      );
    } catch (error) {
      console.error(
        'Error checking if device is a programmer device from Firestore:',
        error,
      );
      throw error;
    }
  }

  /**
   * Logs the creation of a new device mapping document.
   * Internal helper for debugging device mapping lifecycle.
   * @param {ProgrammerDeviceUID} device - The programmer device object containing userId and device name.
   */
  private logCreatingDevice(device: ProgrammerDeviceUID): void {
    console.log(
      `User mapping document for user ${device.userId} does not exist. Creating new document...`,
    );
  }

  /**
   * Creates or updates a user mapping document with device information.
   *
   * Creates a new user mapping if the document doesn't exist, or updates the deviceInfo
   * and isNative flag if the document exists but has missing/different deviceInfo.
   * Property order differences in deviceInfo are properly handled to avoid unnecessary updates.
   * Uses deep equality comparison with locale-aware sorting to detect actual content changes.
   *
   * @param {string} userId The unique identifier of the user (required).
   * @param {ProgrammerDeviceUID[]} programmerDeviceUIDs Array of programmer device UIDs to determine user type and device name.
   * @param {DeviceInfo} deviceInfo Device information object (userAgent, platform, language, appVersion) to store.
   * @param {boolean} [isNative] Optional flag indicating if user is on a native platform (default: false).
   * @return {Promise<void>} A promise that resolves when the user document is created or updated.
   * @throws {Error} If userId is not provided, or if the write operation fails.
   */
  async addUser(
    userId: string,
    programmerDeviceUIDs: ProgrammerDeviceUID[],
    deviceInfo: DeviceInfo,
    isNative?: boolean,
  ): Promise<void> {
    if (!userId) {
      throw new Error('userId must be provided');
    }
    try {
      const docRef = this.db.doc(
        `${FireStoreConstants.getUserMappingUsersCollectionPath(this.collection)}/${userId}`,
      );
      const doc = await docRef.get();
      if (!doc.exists) {
        // Create new document for user
        await docRef.set(
          {
            name: await this.getUserName(userId, programmerDeviceUIDs),
            type: getUserType(userId, programmerDeviceUIDs),
            device: getDeviceName(userId, programmerDeviceUIDs),
            deviceInfo: deviceInfo,
            isNative: isNative ?? false,
            userId: userId,
            createdAt: new Date(),
          },
          { merge: true },
        );
      } else if (
        !doc.data()?.deviceInfo ||
        !FirebaseFirestoreUtilsService.isDeepEqual(
          doc.data()?.deviceInfo,
          deviceInfo,
        )
      ) {
        // If document exists but deviceInfo is missing or different, update it
        await docRef.set(
          {
            deviceInfo: deviceInfo,
            isNative: isNative ?? false,
            lastUpdated: new Date(),
          },
          { merge: true },
        );
      }
    } catch (error) {
      console.error('Error upserting user:', userId, error);
    }
  }

  /**
   * Generates a unique user name based on type and count.
   * Format: '{userType}-{sequenceNumber}' (e.g., 'User-42', 'Programmer-5').
   * Internal helper for creating consistent user identifiers.
   * @param {string} userId The unique identifier of the user.
   * @param {ProgrammerDeviceUID[]} programmerDeviceUIDs Array of programmer device UIDs to determine user type.
   * @return {Promise<string>} A promise that resolves to the generated user name.
   */
  private async getUserName(
    userId: string,
    programmerDeviceUIDs: ProgrammerDeviceUID[],
  ): Promise<string> {
    const type = getUserType(userId, programmerDeviceUIDs);
    const userNumber = await this.countUser(type);
    return `${type}-${userNumber + 1}`;
  }

  /**
   * Counts the number of existing user mappings of a given type.
   * Used to determine the sequence number for new user names.
   * @param {string} type The type of user to count.
   * @return {Promise<number>} A promise that resolves to the number of users of the given type.
   */
  private async countUser(type: string): Promise<number> {
    try {
      const collectionRef = this.db.collection(
        `${FireStoreConstants.getUserMappingUsersCollectionPath(this.collection)}`,
      );
      return await collectionRef
        .where('type', '==', type)
        .get()
        .then((snapshot) => snapshot.size || 0);
    } catch (error) {
      console.error('Error getting user number for type:', type, error);
      throw new Error('Error counting users for type: ' + type);
    }
  }

  /**
   * Increments the translated character count for the current user, used by secureTranslate feature.
   * Also updates the lastUpdated timestamp for both the user and the total statistics document and the selected languages.
   *
   * - Updates the user's document with the incremented character count and timestamp.
   * - Updates the total statistics document with the incremented character count and timestamp.
   * - Count = text length x number of target languages.
   *
   * @param {number} count Number of characters to add to both user and total character counts.
   * @param {string[]} selectedLanguages Array of target language codes selected for the translation.
   * @return {Promise<void>} A promise that resolves when both user and total counts are updated.
   * @throws {Error} If an error occurs during the update operation.
   */
  async addTranslatedChars(
    count: number,
    selectedLanguages: string[],
  ): Promise<void> {
    if (!this.userId) return;

    try {
      await this.updateUserCharCountAndTargetLanguages(
        count,
        selectedLanguages,
      );
    } catch (error) {
      console.error('Error writing user char count document:', error);
    }

    try {
      await this.updateTotalCharCount(count);
    } catch (error) {
      console.error('Error writing total char count document:', error);
    }
  }

  /**
   * Increments the consumed feature usage character count for the current user, used by secureFeature.
   * Also updates the lastUpdated timestamp for both the user and the total statistics document.
   *
   * - Updates the user's document with the incremented character count and timestamp.
   * - Updates the total statistics document with the incremented character count and timestamp.
   *
   * @param {number} count Number of characters to add to the user's and total feature usage character counts.
   * @return {Promise<void>} A promise that resolves when both user and total counts are updated.
   * @throws {Error} If an error occurs during the update operation.
   */
  async addConsumedFeatureChars(count: number): Promise<void> {
    if (!this.userId) return;

    try {
      await this.updateUserCharCount(count);
    } catch (error) {
      console.error('Error writing user char count document:', error);
    }

    try {
      await this.updateTotalCharCount(count);
    } catch (error) {
      console.error('Error writing total char count document:', error);
    }
  }

  /**
   * Updates the character count and target languages for the current user.
   * Internal helper for addTranslatedChars that updates the user's usage statistics.
   * @param {number} count Number of characters to add to the user's character count.
   * @param {string[]} selectedLanguages Array of target language codes selected for the translation.
   * @return {Promise<void>} A promise that resolves when the user's character count and target languages are updated.
   * @throws {Error} If an error occurs during the update operation.
   */
  private async updateUserCharCountAndTargetLanguages(
    count: number,
    selectedLanguages: string[],
  ): Promise<void> {
    const docRef = this.db.doc(
      `${FireStoreConstants.getUsersCollectionPath(this.collection)}/${this.userId}`,
    );
    await docRef.set(
      {
        charCount: FieldValue.increment(count),
        targetLanguages: selectedLanguages,
        lastUpdated: new Date(),
      },
      { merge: true },
    );
  }

  /**
   * Updates the character count for the current user.
   * Internal helper for addConsumedFeatureChars that updates the user's usage statistics.
   * @param {number} count Number of characters to add to the user's character count.
   * @return {Promise<void>} A promise that resolves when the user's character count is updated.
   * @throws {Error} If an error occurs during the update operation.
   */
  private async updateUserCharCount(count: number): Promise<void> {
    const docRef = this.db.doc(
      `${FireStoreConstants.getUsersCollectionPath(this.collection)}/${this.userId}`,
    );
    await docRef.set(
      {
        charCount: FieldValue.increment(count),
        lastUpdated: new Date(),
      },
      { merge: true },
    );
  }

  /**
   * Updates the total feature/translation character count across all users for the current month.
   * Internal helper for addTranslatedChars and addConsumedFeatureChars that updates global usage statistics.
   * @param {number} count Number of characters to add to the total character count.
   * @return {Promise<void>} A promise that resolves when the total character count is updated.
   * @throws {Error} If an error occurs during the update operation.
   */
  private async updateTotalCharCount(count: number): Promise<void> {
    const totalRef = this.db.doc(
      `${FireStoreConstants.getMetaTotalCharsDocumentPath(this.collection)}`,
    );
    await totalRef.set(
      {
        charCount: FieldValue.increment(count),
        lastUpdated: new Date(),
      },
      { merge: true },
    );
  }
}
