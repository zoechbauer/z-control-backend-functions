import {
  onCall,
  CallableRequest,
  HttpsError,
} from 'firebase-functions/v2/https';
import admin from 'firebase-admin';
import vision from '@google-cloud/vision';

import { FirebaseFirestoreService } from '../services/firebase-firestore.service.js';
import { FirebaseFirestoreUtilsService } from '../services/firebase-firestore-utils.service.js';
import { RecognizeResult } from '../../shared/firebase-firestore.interfaces.js';
import { FireStoreConstants } from '../../shared/app.constants.js';

// Initialization
if (admin.apps?.length === 0) {
  admin.initializeApp();
}

/**
 * Uses the Cloud Function's service account for authentication.
 * No API keys or secrets are required.
 */
const visionClient = new vision.ImageAnnotatorClient();

/**
 * Callable function that validates input, enforces contingent limits, updates usage,
 * and returns the extracted text from the image.
 * @param {CallableRequest} request The callable request containing appId and imageBase64.
 * @returns {Promise<RecognizeResult>} The result containing extracted text and feature type.
 */
export const extractTextFromImage = onCall(
  async (request: CallableRequest<{ appId: string; imageBase64: string }>) => {
    const { auth } = request;
    const { appId, imageBase64 } = request.data;

    // 1. Validation
    validateSecureExtractTextRequest(auth, imageBase64, appId);

    const collection = FireStoreConstants.getCollectionByAppId(appId);
    const uid = auth?.uid || '';

    console.log(`extractTextFromImage: uid=${uid}, appId=${appId}`);

    // 2. Quota check (your existing service)
    await FirebaseFirestoreUtilsService.validateFeatureContingentOrThrow(
      collection,
      uid,
    );

    // 3. Call Vision API via the official library
    const extractedText = await executeAnnotateImage(imageBase64);

    // 4. Log usage in Firestore
    const firestoreService = new FirebaseFirestoreService(collection, uid);
    // first 1000 images are free per month, we count each image as 1 character for quota purposes
    await firestoreService.addConsumedFeatureChars(1);

    // 5. Return result
    const result: RecognizeResult = {
      text: extractedText,
      featureType: 'text',
    };

    return result;
  },
);

/**
 * Executes the Vision API text detection on the provided base64 image.
 * Throws HttpsError if the Vision API call fails.
 * @param {string} imageBase64 Base64-encoded image contents (may include data URI prefix).
 * @return {Promise<string>} The extracted text (empty string if none).
 */
async function executeAnnotateImage(imageBase64: string): Promise<string> {
  try {
    // Library expects Base64 string without data-URI header (remove if present)
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const [result] = await visionClient.textDetection({
      image: { content: cleanBase64 },
    });

    const fullTextAnnotation = result.fullTextAnnotation;
    return fullTextAnnotation?.text || '';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Vision API Error:', error);
    throw new HttpsError('internal', `Error analyzing image: ${message}`);
  }
}

/**
 * Validates the request for secure text extraction from an image.
 * Throws HttpsError if validation fails.
 * @param {*} auth Authentication information from the callable request.
 * @param {string} imageBase64 The base64-encoded image string.
 * @param {string} appId The application ID.
 */
function validateSecureExtractTextRequest(
  auth: CallableRequest<{ appId: string; imageBase64: string }>['auth'],
  imageBase64: string,
  appId: string,
): void {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new HttpsError(
      'invalid-argument',
      'Image data is missing or invalid.',
    );
  }
  if (!appId || typeof appId !== 'string' || appId.trim() === '') {
    throw new HttpsError('invalid-argument', 'appId must be provided.');
  }
}
