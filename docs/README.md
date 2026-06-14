# Documentation Overview: z-control IONIC Setup App

The [docs](.) folder contains categorized guides, and best practices for developing, building, and deploying the z-control Backend Function Project using Google Firebase.

## A. Programming

- **todo-list-environment-programmer-devices.md**  
  Checklist for updating environment variables and programmer device UIDs, including required steps for Firestore user mapping updates.

- **coding-guidelines.md**  
  Clean code principles and best practices for naming, functions, error handling, formatting, and testing.

## B. Unit Testing

Guides for setting up, running, and improving unit tests with Vitest, including practical fixes and learning resources.

- **jasmine-vs-vitest.md**  
  Compares Jasmine and Vitest for Angular projects, including features, performance, ecosystem, and when to choose each option.

- **unit-testing-learning-roadmap.md**  
  A structured roadmap for mastering Angular unit testing, with recommended docs, courses, and hands-on practice steps.

- **unit-testing-quick-reference.md**  
  A compact command reference for running and troubleshooting Firebase unit tests with Vitest.

- **functions-vitest-setup.md**  
  Step-by-step guide for setting up Vitest in a Firebase project, including installation, configuration, and running tests.

-**test-types-fe-be.md**
Overview of different test types for frontend and backend, with examples and best practices for each.

## C. Google Firebase API

- **firebase-config-enviroment-files.md**  
  Instructions for managing Firebase configuration using environment files to keep credentials out of source control. Includes local setup, usage, and security notes.

- **firebase-functions-esm-build-guide.md**  
  Step-by-step guide for building Firebase Functions with ESM, native fetch, and strict type isolation in a monorepo. Includes troubleshooting for TypeScript and module issues.

- **firebase-codebase-runtime-and-appid-security.md**  
  Answers the questions:
  1. What does Firebase Functions deploy transfer: compiled files only, or also source files?
  2. If appId can be changed in FE payload, how should backend validation be designed?

- **firebase-functions-multi-app-deploy-playbook.md**  
  Best practices for deploying multiple apps to the same Firebase project, including deployment safety, shared codebase management, and CI guardrails.

- **firebase-functions-setup-and-deploy.md**  
  Comprehensive guide for setting up and deploying Firebase Functions, including project initialization, codebase structure, deployment commands, and best practices for safe deployments.

- **firebase-backup-restore-guide.md**  
  Guide for backing up and restoring Firestore collections for z-control applications. Includes backup and restore methods, and best practices.

- **firestore-export-import-troubleshooting.md**  
  Troubleshooting guide for Firestore export and import operations, including common errors, solutions, and best practices for data integrity and consistency.

- **fe-be-regression-checklist.md**  
  Release checklist for validating frontend/backend integration between setup and translator flows, including emulator startup, callable success, Firestore updates, appId contract checks, and deployment safety.

- **local-testing-guide-secureTranslate.md**  
  How to test the SecureTranslate Cloud Function locally using the Firebase Emulator Suite and dotenv for environment variables. Includes curl examples, debugging, and troubleshooting steps.

## D. z-control GitHub Analytics

- **github-analytics-architecture.md**  
  Detailed architecture document for the GitHub Analytics feature, covering data fetching, Firestore storage structure, shared constants, and local testing instructions.

- **github-analystics-test-locally.md**  
  Instructions for testing the GitHub Analytics Cloud Function locally using the Firebase Emulator Suite, including environment variable setup and curl examples.

---

Each document is self-contained and addresses a specific aspect of the app's development or deployment. For further details, open the relevant markdown file in this folder.
