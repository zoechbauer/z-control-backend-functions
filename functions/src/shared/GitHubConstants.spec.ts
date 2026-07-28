import { describe, expect, it } from 'vitest';
import { COLLECTION, REPOS } from './GitHubConstants.js';

describe('GitHubConstants', () => {
  it('should contain all expected repositories', () => {
    expect(REPOS.map((r) => r.repo)).toHaveLength(9);
    expect(REPOS.map((r) => r.repo)).toEqual(
      expect.arrayContaining([
        'z-control-landing-page',
        'z-control-qr-code-generator',
        'z-control-Backup-scripts',
        'z-control-multi-language-translator',
        'z-control-ionic-setup',
        'z-control-backend-functions',
        'z-control-image-to-text',
        'copilot-learning-calculator',
        'ionic-angular21-vitest-setup',
      ]),
    );
  });

  it('should contain the expected collection names', () => {
    expect(COLLECTION).toEqual({
      GITHUB_ANALYTICS_TRAFFIC: 'githubAnalyticsTraffic',
      GITHUB_ANALYTICS_TRAFFIC_HISTORY: 'githubAnalyticsTrafficHistory',
    });
  });
});
