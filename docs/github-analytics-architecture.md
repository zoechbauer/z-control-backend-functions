# GitHub Analytics Architecture for z-control Projects

## Table of Contents

- [GitHub Analytics Architecture for z-control Projects](#github-analytics-architecture-for-z-control-projects)
  - [Table of Contents](#table-of-contents)
  - [1. Overview](#1-overview)
  - [2. Firestore Structure](#2-firestore-structure)
  - [3. Shared Constants](#3-shared-constants)
  - [4. Cloud Function Implementation](#4-cloud-function-implementation)
    - [Example: `githubAnalytics.ts` (with query parameters)](#example-githubanalyticsts-with-query-parameters)
  - [5. Environment Setup](#5-environment-setup)
  - [6. Frontend Integration Example (Landing Page)](#6-frontend-integration-example-landing-page)
  - [7. Security \& Best Practices](#7-security--best-practices)
  - [8. References](#8-references)
  - [9. ADDING NEW REPOS \& Local Testing with Firebase Emulator Suite](#9-adding-new-repos--local-testing-with-firebase-emulator-suite)

---

## 1. Overview

- **Purpose:** Collect daily GitHub traffic insights for multiple repositories.
- **Storage:** Data is saved in Firestore under two collections:
  - `githubAnalyticsTraffic`: Stores the latest 14 days of analytics (overwrites data).
  - `githubAnalyticsTrafficHistory`: Appends each day's analytics, building a historical record.
- **Display:** The landing page fetches and displays analytics data from Firestore.
- **Security:** GitHub Personal Access Token is stored securely as a Firebase environment variable.

---

## 2. Firestore Structure

```text
githubAnalyticsTraffic/
  ├─ copilot-learning-calculator
  ├─ ionic-angular21-vitest-setup
  ├─ z-control-image-to-text
  ├─ z-control-ionic-setup
  ├─ z-control-multi-language-translator
  ├─ z-control-backend-functions
  ├─ z-control-qr-code-generator
  ├─ z-control-Backup-scripts
  └─ z-control-landing-page

githubAnalyticsTrafficHistory/
  ├─ copilot-learning-calculator
  ├─ ionic-angular21-vitest-setup
  ├─ z-control-image-to-text
  ├─ z-control-ionic-setup
  ├─ z-control-multi-language-translator
  ├─ z-control-backend-functions
  ├─ z-control-qr-code-generator
  ├─ z-control-Backup-scripts
  └─ z-control-landing-page
```

Each document in both collections contains:

- `timestamp`: ISO string of last update
- `views`: Object with total and daily view entries
- `clones`: Object with total and daily clone entries

In `githubAnalyticsTrafficHistory`, the `views` and `clones` arrays accumulate all daily entries since the function started.

---

## 3. Shared Constants

A shared constants file is used for both backend and frontend to keep repository and collection names in sync:

```typescript
// filepath: shared/GitHubConstants.ts
export const REPOS = [
  { owner: 'zoechbauer', repo: 'z-control-landing-page' },
  { owner: 'zoechbauer', repo: 'z-control-qr-code-generator' },
  { owner: 'zoechbauer', repo: 'z-control-Backup-scripts' },
  { owner: 'zoechbauer', repo: 'z-control-multi-language-translator' },
  { owner: 'zoechbauer', repo: 'z-control-ionic-setup' },
  { owner: 'zoechbauer', repo: 'z-control-backend-functions' },
  { owner: 'zoechbauer', repo: 'z-control-image-to-text' },
  { owner: 'zoechbauer', repo: 'copilot-learning-calculator' },
  { owner: 'zoechbauer', repo: 'ionic-angular21-vitest-setup' },
];

export const COLLECTION = {
  GITHUB_ANALYTICS_TRAFFIC: "githubAnalyticsTraffic",
  GITHUB_ANALYTICS_TRAFFIC_HISTORY: "githubAnalyticsTrafficHistory",
};
```

---

## 4. Cloud Function Implementation

- **Scheduled Trigger:** Runs every day at 18:00 Europe/Vienna time (`0 18 * * *`).
- **Repositories:** Iterates over all target repos defined in `REPOS`.
- **API Calls:** Uses GitHub REST API endpoints:
  - `/repos/{owner}/{repo}/traffic/views`
  - `/repos/{owner}/{repo}/traffic/clones`
- **Storage:**
  - `githubAnalyticsTraffic`: Overwrites with the latest analytics snapshot.
  - `githubAnalyticsTrafficHistory`: Appends only the previous day's entries to arrays.

### Example: `githubAnalytics.ts` (with query parameters)

```typescript
export const testGitHubAnalytics = functions.https.onRequest(async (req, res) => {
  // ...existing code...
});

/**
 * HTTP function to insert missing daily analytics data from
 * githubAnalyticsTraffic into githubAnalyticsTrafficHistory for each repo.
 * Only missing dates are inserted.
 *
 * Query parameters:
 *   - repoIndex: (optional) index of the repository to process (default: all repos)
 *
 * Example usage:
 *   curl "http://localhost:5001/<project-id>/us-central1/insertMissingAnalyticsHistory"
 *   curl "http://localhost:5001/<project-id>/us-central1/insertMissingAnalyticsHistory?repoIndex=0"
 */
export const insertMissingAnalyticsHistory = functions.https.onRequest(async (req, res) => {
  // ...existing code...
});
```


**Query Parameters:**

- `updateTraffic`: Set to `false` to skip updating Firestore with the latest traffic data (default is `true`).
- `repoIndex`: Set to a valid index (e.g., `0`, `1`, `2`) to process only the selected repository. If omitted, all repositories are processed.

**Examples:**

- Process all repos and update Firestore:

  ```bash
  curl "http://localhost:5001/<project-id>/us-central1/testGitHubAnalytics"
  ```

- Process only the first repo and skip Firestore update:

  ```bash
  curl "http://localhost:5001/<project-id>/us-central1/testGitHubAnalytics?updateTraffic=false&repoIndex=0"
  ```

- Insert missing analytics history for all repos:

  ```bash
  curl "http://localhost:5001/<project-id>/us-central1/insertMissingAnalyticsHistory"
  ```

- Insert missing analytics history for only the first repo:

  ```bash
  curl "http://localhost:5001/<project-id>/us-central1/insertMissingAnalyticsHistory?repoIndex=0"
  ```

---

**Notes:**

- The scheduled function runs automatically every day at **18:00 Europe/Vienna time** to ensure GitHub statistics are finalized.
- `githubAnalyticsTraffic` stores only the latest 14 days (overwrites).
- `githubAnalyticsTrafficHistory` accumulates all daily entries for historical analysis.
- For local testing, use `.env.local` in your project root with `GITHUB_TOKEN`.
- For production, set `GITHUB_TOKEN` as an environment variable in the Cloud Console for your function.

---

## 5. Environment Setup

- **Install dependencies:**

  ```bash
  cd functions
  npm install node-fetch
  npm install firebase-functions@latest firebase-admin@latest --save
  ```

- **Set GitHub token as environment variable in Cloud Console:**

  - Go to Cloud Functions in the Firebase or Google Cloud Console.
  - Edit your function and add `GITHUB_TOKEN` in the environment variables section.

- **Deploy function:**

  ```bash
  firebase deploy --only functions
  ```

---

## 6. Frontend Integration Example (Landing Page)

The landing page fetches analytics data from Firestore and displays it.
Here is a simplified example of how to retrieve and log the data:

```typescript
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { REPOS, COLLECTION } from "../../shared/GitHubConstants";

const db = getFirestore();
const docRef = doc(db, COLLECTION.GITHUB_ANALYTICS_TRAFFIC_HISTORY, REPOS[0].repo);

async function fetchAnalytics() {
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    // Display data in your app
    console.log("Views:", data.views);
    console.log("Clones:", data.clones);
  } else {
    console.log("No analytics data found.");
  }
}
```

> **Note:**  
> In Firestore, the `views` and `clones` collections may include entries with zero values. However, the frontend filters out these zero-value entries, displaying only dates where the values are greater than zero.

---

## 7. Security & Best Practices

- **Token Security:** Store GitHub token only as a Cloud Function environment variable, never in source code.
- **Error Handling:** Log errors for each repo fetch; do not halt the entire function on a single failure.
- **Data Retention:** `githubAnalyticsTraffic` stores only the latest analytics snapshot; `githubAnalyticsTrafficHistory` accumulates all daily entries for historical analysis.

---

## 8. References

- [GitHub Traffic API Docs](https://docs.github.com/en/rest/metrics/traffic)
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)

## 9. ADDING NEW REPOS & Local Testing with Firebase Emulator Suite

For detailed instructions, refer to [github-analytics-test-locally.md](github-analytics-test-locally.md).
