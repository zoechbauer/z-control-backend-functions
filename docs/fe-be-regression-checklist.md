# FE/BE Regression Checklist (Setup + Translator)

Use this checklist before each release to keep frontend/backend integration stable across the setup app and the legacy translator app.

## 1) Build Health

- [ ] Frontend build runs successfully.
- [ ] Functions build runs successfully.
- [ ] No TypeScript errors remain in touched areas.

## 2) Emulator Startup

- [ ] Firestore and Functions emulators start successfully.
- [ ] No Firebase Admin duplicate app initialization error appears.
- [ ] Callable functions are visible in Emulator UI.

## 3) Auth + Callable Sanity

- [ ] Test with a fresh session (or cleared auth/local state).
- [ ] User is authenticated before secure callable requests.
- [ ] One secureTranslate call completes successfully.

## 4) Firestore Write Verification

- [ ] User document exists and updates correctly.
- [ ] Character usage increments correctly for the request.
- [ ] Monthly total/aggregate counters update correctly.

## 5) appId Contract Checks

- [ ] Valid appId routes to the expected collection.
- [ ] Missing/invalid appId returns a controlled validation error.
- [ ] Legacy translator app still works against setup functions.

## 6) Error-Path Behavior

- [ ] Simulate one downstream failure (for example API key issue).
- [ ] Client receives controlled error handling (not crash).
- [ ] Emulator logs show no unhandled startup/runtime exceptions.

## 7) UI Integration Checks

- [ ] Loading state/spinner is shown during long calls.
- [ ] Success message/toast appears for successful requests.
- [ ] Error message/toast appears for failed requests.

## 8) Deployment Safety

- [ ] Deploy shared functions only from setup repository.
- [ ] No unintended function deletions in deploy preview.
- [ ] Correct deploy credentials are used (owner repo only).

## 9) Post-Deploy Smoke Test

- [ ] One real translation request works in target environment.
- [ ] Firestore updates are visible in the target project.
- [ ] Functions logs contain no unexpected internal errors.

## Sign-Off

- [ ] FE/BE integration verified end-to-end.
- [ ] Safe to release.
