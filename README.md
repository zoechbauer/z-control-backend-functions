# z-control Backend Functions

Shared backend repository for z-control applications.

This repository contains the shared backend logic used by multiple z-control apps, including Firebase Cloud Functions, Firestore utilities, and related backend helpers. It is the canonical source for backend code that must stay consistent across the different frontend applications. 

## What belongs here

This repository is intended for:
- Shared Firebase Cloud Functions.
- Firestore-related backend utilities and helpers.
- Shared backend constants and services.
- Backend unit tests and test utilities.
- Documentation for backend development and deployment. 

This repository is not intended for frontend application code. Frontend-specific changes belong in the respective app repositories. 

## Features

- Central source of truth for shared backend code across z-control apps. 
- Firebase Cloud Functions for data processing, API handling, and Firebase integration. 
- Firestore utilities and rules-related backend support. 
- Quota management and backend-side error handling. 
- Unit tests with Vitest and coverage reporting. 
- Documentation for setup, usage, and development workflows. 

## Repository policy

- Implement shared backend changes only in this repository. 
- Deploy shared Firebase Functions only from this repository. 
- Do not deploy shared backend code from frontend repositories. 
- Keep frontend repositories independent, but connected to this shared backend. 

This separation keeps backend behavior consistent and reduces deployment risk across all z-control apps. 

## Tech stack

- TypeScript. 
- Firebase Cloud Functions and Firestore. 
- Vitest for unit testing. 
- Istanbul for coverage. 
- ESLint for linting. 

## Project structure

```text
z-control-backend-functions/
├── functions/
│   ├── lib/                  # Compiled output for deployment
│   ├── node_modules/         # Node dependencies
│   ├── src/                  # Source code
│   │   ├── learning-vitest/  # Vitest learning resources
│   │   ├── shared/           # Shared backend utilities
│   │   └── *.ts              # Function implementation files
│   ├── tsconfig.json         # TypeScript config
│   ├── tsconfig.dev.json     # TypeScript dev config
│   ├── vitest.config.ts      # Vitest config
│   ├── vitest.learn.config.ts
│   ├── package.json          # Scripts and dependencies
│   ├── package-lock.json
│   ├── .eslintrc.cjs
│   └── .gitignore
├── docs/
│   ├── unit-tests/
│   └── README.md
├── .firebaserc
├── firebase.json
├── LICENSE
└── README.md
```

## Development workflow

When you need backend changes for a frontend app:

1. Implement the shared backend change in this repository.
2. Run and verify the backend locally with Firebase emulators.
3. Connect the target frontend app to the emulator backend.
4. Test the frontend/backend integration.
5. Deploy Firebase Functions from this repository only.
6. Deploy the frontend app separately after backend validation. 

This workflow ensures one shared backend source of truth and predictable deployments. 

## Getting started

### Prerequisites

- Node.js v20 or compatible version.
- Firebase CLI. 

### Installation

```bash
git clone https://github.com/zoechbauer/z-control-backend-functions.git
cd z-control-backend-functions/functions
npm install
```

### Local backend run

```bash
cd functions
firebase init emulators  # Select Functions and Firestore only, configure ports
firebase emulators:start
```

## Testing

### Unit tests

```bash
cd functions
npm run test
npm run test:watch
npm run test:ui
npm run test:ui:coverage
npm run test:coverage
npm run test:learn
npm run test:learn:watch
```

### Linting

```bash
cd functions
npm run lint
npm run lint -- --fix
```

## TODOs and Documentation

- [TODO list: Open Activities](docs/TODO-list-open-activities.md)
- [Documentation index](docs/README.md) 

## Tools

The `tools/` folder contains helper scripts for:
- Backing up non-committed files.
- Generating environment files from `.env.local`. 

See `tools/README.md` for details. 

## Privacy

This repository is a local development utility for backend work. It does not collect or store personal data, and it does not use analytics or tracking services. 

## License

[MIT](LICENSE)

## Contact

For questions, feedback, or support:
- [z-control Support & Feedback](https://z-control-4070.web.app/home)
- [zcontrol.app.qr@gmail.com](mailto:zcontrol.app.qr@gmail.com)