import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load dotenv for local test with firebase emulators
// GITHUB_TOKEN for production must be defined as environment variable in https://console.cloud.google.com/
const runningInEmulator =
  Boolean(process.env.FUNCTIONS_EMULATOR) ||
  Boolean(process.env.FIREBASE_EMULATOR_HOST) ||
  Boolean(process.env.FIREBASE_EMULATOR_HUB_HOST) ||
  process.env.NODE_ENV === 'development';

const envPath = path.resolve(__dirname, '../../.env.local');

if (runningInEmulator) {
  console.log('loadEnv: runningInEmulator=true');
  console.log('loadEnv: NODE_ENV=', process.env.NODE_ENV ?? '(undefined)');
  console.log('loadEnv: envPath=', envPath);
  console.log('loadEnv: env exists=', fs.existsSync(envPath));
}

// Guard to avoid double-loading
if (
  !process.env.GITHUB_TOKEN &&
  !process.env.__ENV_LOADED &&
  runningInEmulator &&
  fs.existsSync(envPath)
) {
  dotenv.config({ path: envPath });
  process.env.__ENV_LOADED = '1';
  console.log('loadEnv: loaded .env.local');
}
