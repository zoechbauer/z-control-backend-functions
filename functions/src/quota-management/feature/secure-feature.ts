import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FirebaseFirestoreUtilsService } from '../services/firebase-firestore-utils.service.js';
import { FirebaseFirestoreService } from '../services/firebase-firestore.service.js';
import { FeatureResult } from '../../shared/firebase-firestore.interfaces.js';
import { FireStoreConstants } from '../../shared/app.constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

if (admin.apps?.length === 0) {
  admin.initializeApp();
}

/**
 * Callable function that validates input, enforces contingent limits, updates usage,
 * and returns simulated function call.
 */
export const secureFeature = onCall(
  async (request: CallableRequest<{ appId: string; text: string }>) => {
    const auth = request.auth;
    const appId = request.data?.appId;
    const text = request.data?.text;

    await validateSecureFeatureRequest(auth, text, appId);

    const collection = FireStoreConstants.getCollectionByAppId(appId);
    await FirebaseFirestoreUtilsService.validateFeatureContingentOrThrow(
      collection,
      auth ? auth.uid : '',
    );

    const functionResult: FeatureResult = await executeFunctionApiOrThrow(text);

    const firestoreService = new FirebaseFirestoreService(collection, auth ? auth.uid : '');
    await firestoreService.addConsumedFeatureChars(text.length);

    return functionResult;
  });

/**
 * Validates the request for secureFeature Cloud Function.
 * Throws HttpsError if validation fails.
 * @param { CallableRequest } auth - Authentication information.
 * @param { string } text - Input text for the feature.
 * @param { string } appId - Application ID.
 */
async function validateSecureFeatureRequest(
  auth: CallableRequest<{ appId: string; text: string }>['auth'],
  text: string,
  appId: string,
): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }
  if (!text) {
    throw new HttpsError('invalid-argument', 'Missing required parameters.');
  }
  if (typeof appId !== 'string' || appId.trim() === '') {
    throw new HttpsError('invalid-argument', 'appId must be provided.');
  }
}

/**
 * Calls a free public API (Datamuse) and returns a result based on input text.
 * @param { string } text - Input text for the feature.
 * @return { Promise<FeatureResult> } - Result of the feature.
 */
async function executeFunctionApiOrThrow(text: string): Promise<FeatureResult> {
  const url = `https://api.datamuse.com/words?ml=${encodeURIComponent(text)}&max=5`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new HttpsError(
        'internal',
        `Function API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as Array<{ word?: string }>;

    const relatedWords = data
      .map((item) => item.word)
      .filter((w): w is string => typeof w === 'string' && w.length > 0)
      .join(', ');

    return {
      feature: {
        input: text,
        related: relatedWords,
      },
    };
  } catch (error: unknown) {
    if (error instanceof HttpsError) {
      throw error; // already formatted, don't wrap again
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new HttpsError('internal', `Function API error: ${message}`);
  }
}
