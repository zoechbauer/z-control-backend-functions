# Firebase Functions Setup And Deployment For Multiple Apps

## Goal

This guide documents a safe setup for multiple apps (for example setup app, translator app, image-to-text app) that share the same Firestore data model for contingent statistics, while keeping each app's data isolated.

Current policy for this repository:

- Translator clients are already upgraded.
- Backend uses strict `appId` validation (no current legacy fallback).
- Setup app repository is the single deployment owner for shared Firebase Functions.

## Core Design

Use one request parameter from the frontend:

- `appId` in callable payloads

Convert `appId` to Firestore root collection on the backend:

- `ionic_setup -> ZC_ionic_setup`
- `translator -> MLT_translations_statistics`
- `imageToText -> ZC_image_to_text`

Never let clients send arbitrary collection paths directly. The backend owns the mapping.

## Shared Firestore Structure Per App

Each app gets its own root collection. Under each root collection, keep the same structure.

```text
<app-collection>/
	userMapping/
		users/
		programmerDevices/
	<YYYY-MM>/
		users/
		meta/
			totalChars
			contingentData
```

Example:

```text
ZC_ionic_setup/
MLT_translations_statistics/
ZC_image_to_text/
```

## Frontend Contract

All callable requests that affect contingent/user statistics should include `appId`.

Example payload pattern:

```ts
{
	appId: FireStoreConstants.APP_ID,
	...functionSpecificFields
}
```

Keep these constants in each FE app:

- `FireStoreConstants.COLLECTION_NAME` for local path helpers and readability
- `FireStoreConstants.APP_ID` for callable payloads

## Backend Contract

On BE callable handlers:

- Read `appId` from `request.data`
- Validate `appId`
- Resolve to collection using a central mapping function
- Construct services with resolved collection and current `auth.uid`

Suggested mapping location:

- `functions/src/shared/app.constants.ts`

Suggested helper:

```ts
static readonly getCollectionByAppId = (appId: string): string => {
	const map: Record<string, string> = {
		ionic_setup: FireStoreConstants.COLLECTION_NAME,
		translator: 'MLT_translations_statistics',
		imageToText: 'ZC_image_to_text',
	};
	const collection = map[appId];
	if (!collection) {
		throw new HttpsError('invalid-argument', `Unsupported appId: ${appId}`);
	}
	return collection;
};
```

## Backward Compatibility Strategy

Use this only when a specific app still has legacy clients.

- Deploy BE first with temporary fallback behavior
- Apply fallback only to the affected app
- Release FE updates that send `appId`
- Remove fallback after migration window and return to strict `appId`

Current state in this setup: translator fallback is not required.

## Best Long-Term Setups

### Way 1: One Shared Backend Repo And Codebase (For Shared Functions)

- Use one dedicated backend repository as the source of truth for all shared callables.
- Keep one appId-to-collection mapping in one place.
- Deploy shared functions only from that backend repository.
- In this repository family, use setup app repository as that deployment owner.
- Best when multiple apps consume the same function logic and release cadence can be coordinated.

Pros:

- Single ownership for shared backend behavior
- No duplicated function logic across app repos
- Easier to keep request contracts consistent

Tradeoff:

- Backend releases must be coordinated for all apps

### Way 2: Separate Firebase Projects Or Separate Function Codebases Per App

- Isolate deployments by app.
- You can do this with separate Firebase projects, or with separate Functions codebases in one Firebase project.
- Best when apps are released independently and should not affect each other.

Pros:

- Strong isolation between apps
- Lower risk of accidental overwrite/deletion
- App teams can deploy independently

Tradeoff:

- More configuration and operational overhead

If you run production apps with different release timelines, prefer Way 2.

## Important Warning For Shared Project Deployments

If this setup repository deploys to the same Firebase project as translator, removing `secure-translate.ts` and deploying functions can trigger deletion prompts for that function.

- If translator still needs it, do not delete it from the shared deployed backend yet.
- If you choose the deploy default of no deletion, existing live functions remain deployed.
- Treat deletion prompts as high-risk in shared projects.

Operational rule:

- Even if other app repositories contain a `functions` folder, do not deploy shared functions from them.

## Using Different Codebases In The Same Firebase Project

Yes, this is possible and recommended when you want isolation but keep one Firebase project.

- You can define multiple Functions codebases in `firebase.json`.
- Deploy a single codebase with `firebase deploy --only functions:<codebaseName>`.
- This lets app-specific functions coexist in the same Firebase project.
- Hosting (for example `z-control-4070.web.app`) can stay in the same project while functions are split by codebase ownership.

Important:

- Keep function names unique and ownership clear per codebase.
- Do not deploy from the wrong codebase path.
- Use explicit deploy commands in CI/CD to avoid cross-app changes.

### Ready-To-Copy `firebase.json` Sample (Two Codebases)

Use this when both apps deploy into the same Firebase project, but with isolated function codebases.

```json
{
  "functions": [
    {
      "source": "functions-setup",
      "codebase": "setup",
      "runtime": "nodejs20",
      "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log"]
    },
    {
      "source": "functions-translator",
      "codebase": "translator",
      "runtime": "nodejs20",
      "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log"]
    }
  ],
  "hosting": {
    "public": "www",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"]
  }
}
```

Notes:

- `source` folders are examples. Rename them to your real folder names.
- `codebase` names are used in deploy commands.
- Hosting config above is only a sample. Keep your real hosting setup if different.

### Deploy Commands For This Sample

Deploy setup functions only:

```bash
firebase deploy --only functions:setup
```

Deploy translator functions only:

```bash
firebase deploy --only functions:translator
```

Deploy both function codebases:

```bash
firebase deploy --only functions:setup,functions:translator
```

## Setup Checklist

1. Install tooling

- `npm install -g firebase-tools`
- `firebase login`

2. Initialize (once per repository)

- `firebase init functions`

3. Configure runtime

- Set Node version in `functions/package.json` engines
- Configure secrets for external APIs

4. Add appId mapping

- Central mapping in BE constants
- FE constants include `APP_ID`

5. Validate callable payloads

- Runtime checks for required fields
- Reject unknown `appId`

6. Test with emulator

- `npm --prefix functions run build`
- `firebase emulators:start --only functions,firestore`

7. Deploy safely

- `firebase deploy --only functions`
- Run deploy from setup app repository only
- Ensure deploy-capable credentials exist only in setup app CI/CD

## Commands

Build functions:

```bash
npm --prefix functions run build
```

Run tests:

```bash
npm --prefix functions run test
```

Start emulators:

```bash
firebase emulators:start --only functions,firestore
```

Deploy functions:

```bash
firebase deploy --only functions
```

## Common Pitfalls

- Reading `collection` from `request` instead of `request.data`
- Changing constructor signatures but not all call sites
- Removing functions from source and deleting live functions by accident during deploy
- Duplicating Firestore path logic in many files instead of one central mapping
- Allowing multiple repos to deploy the same shared functions

## Recommended Release Order (No Downtime)

1. Implement backend change in setup app repository
2. Deploy functions from setup app repository only
3. Release FE with `appId` in payload
4. Monitor logs/errors

For legacy migrations only:

1. Deploy BE with temporary app-specific fallback
2. Release FE update
3. Monitor adoption
4. Remove fallback and keep strict `appId`

## Security Notes

- Never trust incoming collection names from clients
- Keep appId-to-collection mapping server-side only
- Validate auth for all user-scoped callables
- Validate payload shape before processing

## Minimal Governance Rules

- One owner file for appId mapping
- One shared Firestore structure for contingent stats
- One compatibility window policy for breaking API changes
- One release checklist used by all apps
- One deployment owner repository for shared Firebase Functions
