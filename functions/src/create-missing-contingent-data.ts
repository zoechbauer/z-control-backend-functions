import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FirebaseFirestoreService } from './firebase-firestore.service.js';
import { getErrorMsg } from './utils.js';
import { FeatureType, FireStoreConstants } from './shared/app.constants.js';

/**
 * Callable function to ensure the contingent data document exists for the current month.
 * Requires authentication and delegates creation to `FirebaseFirestoreService`.
 */
export const createMissingContingentData = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const appId = request.data?.appId;
  if (typeof appId !== 'string' || appId.trim() === '') {
    throw new HttpsError('invalid-argument', 'appId must be provided.');
  }

  const featureType = request.data?.featureType;
  if (featureType !== undefined && featureType !== FeatureType.MLT && featureType !== FeatureType.Feature) {
    throw new HttpsError('invalid-argument', 'featureType must be either undefined for MLT or "feature".');
  }
  
  try {
    const collection = FireStoreConstants.getCollectionByAppId(appId);
    const userId = auth.uid;
    
    const firestoreService = new FirebaseFirestoreService(collection, userId);
    if (featureType === FeatureType.Feature) {
      await firestoreService.createMissingFeatureContingentData();
    } else {
      await firestoreService.createMissingContingentData();
    }
    return { success: true };
  } catch (error) {
    let errorMessage = 'Error creating missing contingent data.';
    console.error(errorMessage, error);
    throw new HttpsError('internal', getErrorMsg(error, errorMessage));
  }
});
