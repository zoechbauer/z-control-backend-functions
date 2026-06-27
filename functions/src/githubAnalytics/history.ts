import * as logger from 'firebase-functions/logger';
import { FieldValue } from 'firebase-admin/firestore';

import { db } from '../shared/firebase-admin.js';
import { COLLECTION } from '../shared/GitHubConstants.js';
import { GithubTrafficEntry, HistoryData, LogInfo } from './types.js';

// Temporary logs for debugging
let logInfo: LogInfo = {};

/**
 * Persists daily GitHub analytics data in Firestore.
 * The 'githubAnalyticsTrafficHistory' collection holds historical data
 * for each day, appending new entries to an array in each repo document.
 * Each document in 'githubAnalyticsTrafficHistory' matches the structure of
 * 'githubAnalyticsTraffic', but contains a 'views' and 'clones' array with all
 * daily entries since the function started.
 * @param {string} owner - GitHub repository owner.
 * @param {string} repo - GitHub repository name.
 */
export const saveGithubAnalyticsTrafficHistory = async (
  owner: string,
  repo: string,
): Promise<void> => {
  try {
    // Get latest analytics snapshot for the repo
    const docRef = db
      .collection(COLLECTION.GITHUB_ANALYTICS_TRAFFIC)
      .doc(repo);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      logger.warn(`No analytics data found for ${repo}.`);
      console.warn(`No analytics data found for ${repo}.`);
      return;
    }

    const analyticsData = docSnap.data();
    if (
      !analyticsData?.views ||
      !Array.isArray(analyticsData?.views.views) ||
      !analyticsData?.clones ||
      !Array.isArray(analyticsData?.clones.clones)
    ) {
      logger.warn(`Invalid analytics data structure for ${repo}.`);
      console.warn(`Invalid analytics data structure for ${repo}.`);
      return;
    }

    const docRefHistory = db
      .collection(COLLECTION.GITHUB_ANALYTICS_TRAFFIC_HISTORY)
      .doc(repo);
    const docSnapHistory = await docRefHistory.get();

    // Always set repo field and timestamp
    const updateData: Record<string, unknown> = {
      repo,
      timestamp: new Date().toISOString(),
    };

    if (docSnapHistory.exists) {
      // Subsequent runs: only append yesterday's views/clones if found
      const now = new Date();
      now.setDate(now.getDate() - 1);
      const yesterday = now.toISOString().slice(0, 10); // YYYY-MM-DD

      const yesterdayViews = analyticsData.views.views.find(
        (v: GithubTrafficEntry) =>
          v.timestamp?.slice(0, 10) === yesterday || v.date === yesterday,
      );
      const yesterdayClones = analyticsData.clones.clones.find(
        (c: GithubTrafficEntry) =>
          c.timestamp?.slice(0, 10) === yesterday || c.date === yesterday,
      );
      if (yesterdayViews) {
        updateData.views = FieldValue.arrayUnion(yesterdayViews);
      }
      if (yesterdayClones) {
        updateData.clones = FieldValue.arrayUnion(yesterdayClones);
      }
    } else {
      // First run: append all entries from githubAnalyticsTraffic
      updateData.views = analyticsData.views.views ?? [];
      updateData.clones = analyticsData.clones.clones ?? [];
      if (
        !(updateData.views as GithubTrafficEntry[]).length &&
        !(updateData.clones as GithubTrafficEntry[]).length
      ) {
        updateData.initialized = true;
      }
    }

    if (logInfo.calledBy === 'testGitHubAnalytics') {
      logger.log('[DEBUG] analyticsData:', analyticsData);
      logger.log('[DEBUG] updateData:', updateData);
      logInfo = {
        repo,
        analyticsData,
        updateData,
        calledBy: logInfo.calledBy,
      };
    }

    await docRefHistory.set(updateData, { merge: true });
  } catch (error) {
    logger.error(
      `[ERROR] saveGithubAnalyticsTrafficHistory for ${repo}:`,
      error,
    );
    console.error(
      `[ERROR] saveGithubAnalyticsTrafficHistory for ${repo}:`,
      error,
    );
  }
  logger.info('saveGithubAnalyticsTrafficHistory completed', { owner, repo });
  console.log('saveGithubAnalyticsTrafficHistory completed', { owner, repo });
};

// Helper to get analytics data for a repo
export const getAnalyticsData = async (repo: string) => {
  const docRef = db
    .collection(COLLECTION.GITHUB_ANALYTICS_TRAFFIC)
    .doc(repo);
  const docSnap = await docRef.get();
  return docSnap.exists ? docSnap.data() : undefined;
};

// Helper to get history data for a repo
export const getHistoryData = async (repo: string) => {
  const docRefHistory = db
    .collection(COLLECTION.GITHUB_ANALYTICS_TRAFFIC_HISTORY)
    .doc(repo);
  const docSnapHistory = await docRefHistory.get();
  return docSnapHistory.exists ? (docSnapHistory.data() as HistoryData) : {};
};

// Helper to extract history entries
export const getHistoryEntries = (historyData: HistoryData) => {
  const historyViews: GithubTrafficEntry[] = Array.isArray(historyData?.views)
    ? historyData.views
    : [];
  const historyClones: GithubTrafficEntry[] = Array.isArray(historyData?.clones)
    ? historyData.clones
    : [];
  return { historyViews, historyClones };
};

// Helper to update history data
export const updateHistoryData = async (
  repo: string,
  updateData: Record<string, unknown>,
) => {
  const docRefHistory = db
    .collection(COLLECTION.GITHUB_ANALYTICS_TRAFFIC_HISTORY)
    .doc(repo);
  await docRefHistory.set(updateData, { merge: true });
};
