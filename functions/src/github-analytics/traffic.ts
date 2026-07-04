import * as logger from 'firebase-functions/logger';

import { COLLECTION, REPOS } from '../shared/GitHubConstants.js';
import { db } from '../shared/firebase-admin.js';
import { saveGithubAnalyticsTrafficHistory } from './history.js';

/**
 * Fetches GitHub analytics traffic data (views and clones) for each repository
 * in `REPOS`, optionally updates the Firestore collection with the latest
 * traffic data, and saves the traffic history for each repository.
 *
 * @param {boolean} updateTraffic - If `true`,
 *        updates the Firestore collection with the latest traffic data.
 * @param {number} [repoIndex] - Optional index of the repository in `REPOS`
 * @param {boolean} [isLogging=false] - If `true`, logs detailed information for debugging.
 * @return {Promise<void>} A Promise that resolves
 *        when all analytics data has been fetched and processed.
 */
export const runGitHubAnalyticsFetch = async (
  updateTraffic = true,
  repoIndex?: number,
  isLogging = false,
): Promise<void> => {
  // If repoIndex is a valid number, process only that repo,
  // else process all repos
  if (
    typeof repoIndex === 'number' &&
    repoIndex >= 0 &&
    repoIndex < REPOS.length
  ) {
    const { owner, repo } = REPOS[repoIndex];
    await processRepo(owner, repo, updateTraffic, isLogging);
  } else {
    for (const { owner, repo } of REPOS) {
      await processRepo(owner, repo, updateTraffic, isLogging);
    }
  }
};

/**
 * Fetches traffic analytics data from GitHub for the specified
 * repository and endpoint.
 * @param {string} owner - Repository owner (GitHub username).
 * @param {string} repo - Repository name.
 * @param {string} endpoint - Traffic endpoint ('views' or 'clones').
 * @return {Promise<unknown>} Resolves to the traffic data as a JSON object.
 */
export const fetchTraffic = async (
  owner: string,
  repo: string,
  endpoint: string,
): Promise<unknown> => {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is not defined');
  }
  const url = `https://api.github.com/repos/${owner}/${repo}/traffic/${endpoint}`;
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`,
      );
    }
    return await response.json();
  } catch (error) {
    logger.error(
      `Failed to fetch traffic for ${owner}/${repo} (${endpoint}):`,
      error,
    );
    throw error;
  }
};

/**
 * Processes a GitHub repository by fetching its traffic data and optionally updating Firestore.
 * @param { string } owner - Repository owner (GitHub username).
 * @param { string } repo - Repository name.
 * @param { boolean } updateTraffic - If `true`,
 *        updates the Firestore collection with the latest traffic data.
 * @param { boolean } isLogging - If `true`, logs detailed information for debugging.
 */
export const processRepo = async (
  owner: string,
  repo: string,
  updateTraffic: boolean,
  isLogging = false,
): Promise<void> => {
  try {
    const views = await fetchTraffic(owner, repo, 'views');
    const clones = await fetchTraffic(owner, repo, 'clones');
    if (updateTraffic) {
      await db
        .collection(COLLECTION.GITHUB_ANALYTICS_TRAFFIC)
        .doc(repo)
        .set({
          timestamp: new Date().toISOString(),
          views,
          clones,
        });
    }
    await saveGithubAnalyticsTrafficHistory(owner, repo, isLogging);
  } catch (error) {
    logger.error(`Error fetching analytics for ${repo}:`, error);
    console.error(`Error fetching analytics for ${repo}:`, error);
  }
};
