import * as logger from 'firebase-functions/logger';
import { https, scheduler } from 'firebase-functions/v2';

import { REPOS } from '../shared/GitHubConstants.js';
import { runGitHubAnalyticsFetch } from './traffic.js';
import { GithubTrafficEntry, LogInfo } from './types.js';
import { FieldValue } from 'firebase-admin/firestore';
import { getAnalyticsData, getHistoryData, getHistoryEntries, updateHistoryData } from './history.js';

// Temporary logs for debugging
const logInfo: LogInfo = {};

/**
 * Scheduled function to fetch GitHub analytics and store in Firestore.
 * Runs every day at 18:00 Europe/Vienna time to be sure that GitHub
 * has finalized the previous day's data.
 *
 * cron expression '0 18 * * *' means:
 * minute: 0
 * hour: 18
 * day: every day
 * month: every month
 * day-of-week: every day of the week
 */
export const fetchGitHubAnalytics = scheduler.onSchedule(
  {
    schedule: '0 18 * * *', // Runs at 18:00 (6 PM) local time
    timeZone: 'Europe/Vienna',
  },
  async () => {
    await runGitHubAnalyticsFetch();
  },
);

/**
 * HTTP function for testing of GitHub analytics fetch.
 * examples:
 * curl "http://localhost:5001/<project-id>/us-central1/testGitHubAnalytics
 *    ?updateTraffic=false"&repoIndex=0 -> updateTraffic=false, only first repo
 * curl "http://localhost:5001/<project-id>/us-central1/testGitHubAnalytics"
 *    -> updateTraffic=true & process all repos
 * @param req - The HTTP request object.
 * @param res - The HTTP response object.
 * @returns {Promise<void>} Resolves when response is sent.
 */
export const testGitHubAnalytics = https.onRequest(async (req, res) => {
  logger.info('testGitHubAnalytics HTTP function started');
  console.log('testGitHubAnalytics HTTP function started');
  try {
    logInfo.calledBy = 'testGitHubAnalytics';
    const updateTraffic = req.query.updateTraffic !== 'false';
    const repoIndexString = req.query.repoIndex;
    const repoIndex = repoIndexString
      ? Number.parseInt(repoIndexString as string, 10)
      : undefined;

    await runGitHubAnalyticsFetch(updateTraffic, repoIndex);

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      message: 'GitHub analytics fetched and stored.',
      logInfo: logInfo,
    });
  } catch (error) {
    logger.error('Error in testGitHubAnalytics:', error);
    console.error('Error in testGitHubAnalytics:', error);
    // Send error details in response
    res.status(500).json({
      error: `Internal Server Error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
  logger.info('testGitHubAnalytics HTTP function ended');
  console.log('testGitHubAnalytics HTTP function ended');
});

/**
 * HTTP function to insert missing daily analytics data from
 * githubAnalyticsTraffic into githubAnalyticsTrafficHistory for each repo.
 * Only missing dates are inserted.
 * @param req - The HTTP request object
 * @param res - The HTTP response object.
 * @returns {Promise<void>} Resolves when response is sent.
 */
export const insertMissingAnalyticsHistory = https.onRequest(
  async (req, res) => {
    logger.info('insertMissingAnalyticsHistory HTTP function started');
    console.log('insertMissingAnalyticsHistory HTTP function started');
    try {
      const reposToProcess = getReposToProcess(req);

      const inserted: Record<string, { views: string[]; clones: string[] }> =
        {};

      for (const repoObj of reposToProcess) {
        const { repo } = repoObj;
        inserted[repo] = { views: [], clones: [] };

        const analyticsData = await getAnalyticsData(repo);
        if (!analyticsData) {
          logger.warn(`No analytics data found for ${repo}.`);
          continue;
        }

        const historyData = await getHistoryData(repo);

        const { historyViews, historyClones } = getHistoryEntries(historyData);

        const historyViewDates = new Set(
          historyViews.map((v) =>
            v.timestamp ? v.timestamp.slice(0, 10) : v.date,
          ),
        );
        const historyCloneDates = new Set(
          historyClones.map((c) =>
            c.timestamp ? c.timestamp.slice(0, 10) : c.date,
          ),
        );

        const trafficViews: GithubTrafficEntry[] =
          analyticsData?.views?.views ?? [];
        const missingViews = trafficViews.filter((v) => {
          const date = v.timestamp ? v.timestamp.slice(0, 10) : v.date;
          return date && !historyViewDates.has(date);
        });

        const trafficClones: GithubTrafficEntry[] =
          analyticsData?.clones?.clones ?? [];
        const missingClones = trafficClones.filter((c) => {
          const date = c.timestamp ? c.timestamp.slice(0, 10) : c.date;
          return date && !historyCloneDates.has(date);
        });

        const updateData: Record<string, unknown> = {
          repo,
          timestamp: new Date().toISOString(),
        };
        if (missingViews.length > 0) {
          updateData.views = FieldValue.arrayUnion(...missingViews);
          inserted[repo].views = missingViews
            .map((v) => v.timestamp || v.date)
            .filter((d): d is string => typeof d === 'string');
        }
        if (missingClones.length > 0) {
          updateData.clones = FieldValue.arrayUnion(...missingClones);
          inserted[repo].clones = missingClones
            .map((c) => c.timestamp || c.date)
            .filter((d): d is string => typeof d === 'string');
        }
        if (missingViews.length > 0 || missingClones.length > 0) {
          await updateHistoryData(repo, updateData);
          logger.info('Repo:', repo, 'updateData:', updateData);
          console.log('Repo:', repo, 'updateData:', updateData);
        } else {
          logger.info('No missing analytics history to insert', { repo });
        }
      }
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json({
        message: 'Insert missing analytics history completed.',
        inserted,
      });
    } catch (error) {
      logger.error('Error in insertMissingAnalyticsHistory:', error);
      res.status(500).json({
        error: `Internal Server Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  },
);

const getReposToProcess = (
  req: https.Request,
): { owner: string; repo: string }[] => {
  const repoIndexString = req.query.repoIndex;
  const repoIndex = repoIndexString
    ? Number.parseInt(repoIndexString as string, 10)
    : undefined;
  const reposToProcess =
    typeof repoIndex === 'number' && repoIndex >= 0 && repoIndex < REPOS.length
      ? [REPOS[repoIndex]]
      : REPOS;
  return reposToProcess;
};
