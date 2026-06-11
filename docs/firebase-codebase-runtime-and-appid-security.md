# Firebase Codebase Runtime And appId Security Notes

## Why This Document

This document answers two practical questions:

1. What does Firebase Functions deploy transfer: compiled files only, or also source files?
2. If appId can be changed in FE payload, how should backend validation be designed?

## 1) What Codebases Actually Give You

Codebases are a deployment ownership boundary, not a runtime request router.

With multiple codebases in one Firebase project:

- You can deploy codebase A without touching codebase B.
- You can keep app-specific function sets in separate folders and pipelines.
- You reduce accidental overwrite/deletion risk across apps.

What codebases do not do:

- They do not route requests by appId automatically.
- They do not allow two different implementations behind the same function name in the same project+region.

Runtime identity of a callable is still:

- Firebase project
- Region
- Function name

If two apps call the same callable name in the same project+region, they hit the same deployed endpoint behavior.

## 2) What Is Uploaded During Deploy

For Cloud Functions deployment, Firebase CLI packages the configured function source directory (respecting ignore rules) and deploys that build context.

Practical effect for TypeScript projects:

- The runtime executes compiled JavaScript entry points (for example from `lib/` if configured via `main`).
- Source files may still be part of the uploaded build context unless excluded by ignore rules.
- You should never rely on source secrecy for security.

Security rule:

- Always enforce authorization and data isolation in backend logic and Firestore rules.

## 3) appId Is Untrusted Input

`appId` in request payload is client-controlled and can be modified using browser dev tools.

Therefore:

- Treat `request.data.appId` as untrusted.
- Validate it against trusted backend signals before using it to select a collection.

## 4) Recommended Validation Flow

Use this flow for every callable that depends on app scope:

1. Validate `request.auth`.
2. Validate payload shape (`appId`, required fields).
3. Get trusted app identity from backend-verifiable context.
4. Compare trusted app identity with payload appId.
5. Reject mismatch with `permission-denied`.
6. Resolve collection from server mapping and continue.

## 5) Trusted Signals To Bind appId

Prefer combining multiple controls:

- Firebase App Check token / app metadata checks.
- Backend allowlist mapping (allowed appIds per uid/device/session).
- Server-side appId-to-collection mapping only (never raw collection from FE).

For migration windows (legacy clients):

- Temporarily allow missing appId for known old translator clients.
- Keep strict mismatch rejection when appId is present but does not match trusted app identity.

## 6) Suggested Error Policy

Use consistent errors:

- `unauthenticated` when no auth.
- `invalid-argument` when payload shape is invalid.
- `permission-denied` when appId does not match trusted app identity.

This separates malformed input from authorization failures.

## 7) Practical Conclusion

If you need independent app deployments in one Firebase project, codebases are still highly useful.

They help with:

- CI/CD separation
- Ownership boundaries
- Reduced accidental cross-app deploy impact

They do not replace:

- Backward-compatible API strategy
- Strict backend authorization checks for appId
- Clear function naming and versioning strategy

## 8) Quick Checklist

- [ ] Use separate codebases per app or domain
- [ ] Keep callable names/versioning intentional
- [ ] Validate appId as untrusted input
- [ ] Compare appId with trusted backend signal
- [ ] Reject appId mismatch with permission-denied
- [ ] Keep server-side appId-to-collection mapping centralized

## 9) Reusable TypeScript Helper Snippet

Use this helper pattern in callable handlers to validate `appId` consistently.

```ts
import { HttpsError } from "firebase-functions/v2/https";

type TrustedAppResolverInput = {
  uid: string;
  appCheckAppId?: string;
};

/**
 * Replace this function with your real trusted lookup logic.
 * Example sources:
 * - App Check app metadata
 * - Firestore allowlist by uid/device
 * - Custom claims
 */
async function resolveTrustedAppId(input: TrustedAppResolverInput): Promise<string | null> {
  // Example placeholder logic:
  if (input.appCheckAppId) {
    return input.appCheckAppId;
  }
  return null;
}

/**
 * Validates payload appId against trusted backend identity.
 * Throws permission-denied on mismatch.
 */
export async function assertTrustedAppId(uid: string, payloadAppId: string, appCheckAppId?: string): Promise<void> {
  if (typeof payloadAppId !== "string" || payloadAppId.trim() === "") {
    throw new HttpsError("invalid-argument", "appId must be provided.");
  }

  const trustedAppId = await resolveTrustedAppId({
    uid,
    appCheckAppId,
  });

  // Migration mode: if no trusted signal exists yet, skip hard reject.
  // Remove this branch when all clients provide trusted identity.
  if (!trustedAppId) {
    return;
  }

  if (trustedAppId !== payloadAppId) {
    throw new HttpsError("permission-denied", `appId mismatch. trusted=${trustedAppId}, payload=${payloadAppId}`);
  }
}
```

### Callable Usage Example

```ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertTrustedAppId } from "./security/assert-trusted-app-id.js";

export const addUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const appId = String(request.data?.appId ?? "");

  // App Check appId location can vary by SDK/version. Adapt as needed.
  const appCheckAppId = (request as any).app?.appId as string | undefined;

  await assertTrustedAppId(request.auth.uid, appId, appCheckAppId);

  // continue with getCollectionByAppId(appId) and business logic
  return { success: true };
});
```

### Integration Notes

- Keep the helper in one shared module and reuse it in all app-scoped callables.
- During migration, you can allow missing trusted signal and only hard-fail on explicit mismatches.
- After migration, remove permissive fallback and require strict trusted validation.

## 10) Concrete Firestore Allowlist Implementation

If you want a concrete first version for your current setup, use a per-user allowlist in Firestore.

### Allowlist Document Shape

Collection:

- `appAccess/{uid}`

Document example:

```json
{
  "allowedAppIds": ["ionic_setup", "translator"],
  "primaryAppId": "ionic_setup",
  "updatedAt": "serverTimestamp"
}
```

Notes:

- `allowedAppIds` is used for authorization.
- `primaryAppId` is optional but useful as fallback during migration.
- Restrict writes to this collection to backend/admin only.

### Resolver Using App Check + Firestore Allowlist

```ts
import admin from "firebase-admin";

type TrustedAppResolverInput = {
  uid: string;
  appCheckAppId?: string;
};

type UserAppAccess = {
  allowedAppIds?: string[];
  primaryAppId?: string;
};

async function resolveTrustedAppId(input: TrustedAppResolverInput): Promise<string | null> {
  // 1) Prefer App Check if available and already mapped to your internal appId values.
  if (input.appCheckAppId && input.appCheckAppId.trim() !== "") {
    return input.appCheckAppId;
  }

  // 2) Fallback to Firestore allowlist by user.
  const snap = await admin.firestore().doc(`appAccess/${input.uid}`).get();
  if (!snap.exists) {
    return null;
  }

  const data = snap.data() as UserAppAccess;

  if (Array.isArray(data.allowedAppIds) && data.allowedAppIds.length > 0) {
    // In strict mode you can remove primary fallback and require exact membership checks only.
    return data.primaryAppId ?? data.allowedAppIds[0] ?? null;
  }

  if (typeof data.primaryAppId === "string" && data.primaryAppId.trim() !== "") {
    return data.primaryAppId;
  }

  return null;
}
```

### Strict Membership Check Variant (Recommended)

Use this when a user can legitimately access multiple apps.

```ts
import { HttpsError } from "firebase-functions/v2/https";
import admin from "firebase-admin";

export async function assertAppIdAllowedForUser(uid: string, payloadAppId: string): Promise<void> {
  if (typeof payloadAppId !== "string" || payloadAppId.trim() === "") {
    throw new HttpsError("invalid-argument", "appId must be provided.");
  }

  const snap = await admin.firestore().doc(`appAccess/${uid}`).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "No app access profile for user.");
  }

  const data = snap.data() as { allowedAppIds?: string[] };
  const allowed = Array.isArray(data.allowedAppIds) ? data.allowedAppIds : [];

  if (!allowed.includes(payloadAppId)) {
    throw new HttpsError("permission-denied", `appId '${payloadAppId}' is not allowed for this user.`);
  }
}
```

### Recommended Hybrid Policy

For best security and compatibility:

1. Validate auth and payload shape.
2. If App Check identity is present, require match with payload appId.
3. Also require allowlist membership in `appAccess/{uid}`.
4. During migration only, allow legacy fallback for known old clients.
5. Remove fallback when rollout is complete.
