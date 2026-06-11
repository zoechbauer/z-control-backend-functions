// keep in sync with src/app/shared/interfaces.ts

// used by z-control Translator (MLT)
export interface FirestoreContingentData {
  StopTranslationForAllUsers?: boolean;
  maxFreeTranslateCharsPerMonth?: number;
  maxFreeTranslateCharsBufferPerMonth?: number;
  maxFreeTranslateCharsPerMonthForUser?: number;
}

// used by z-control ionic setup
export interface FeatureContingentData {
  StopFeatureUsageForAllUsers?: boolean;
  maxFreeFeatureCharsPerMonth?: number;
  maxFreeFeatureCharsBufferPerMonth?: number;
  maxFreeFeatureCharsPerMonthForUser?: number;
}

// used to unify the structure of contingent data for both MLT and Feature, 
// allowing for easier handling in the service layer and potential future features 
// that may require similar contingent data structures.
export interface ContingentData {
  StopForAllUsers?: boolean;
  maxFreeCharsPerMonth?: number;
  maxFreeCharsBufferPerMonth?: number;
  maxFreeCharsPerMonthForUser?: number;
}
export interface SecureTranslateData {
  appId: string;
  text: string;
  baseLang: string;
  selectedLanguages: string[];
}
export interface TranslationResult {
  translations: Record<string, string>;
}
export interface SecureFeatureData {
  appId: string;
  text: string;
}
export interface FeatureResult {
  feature: Record<string, string>;
}
export interface CharCountAndTargetLangsResult {
  charCount: number;
  targetLanguages: string[];
}
export interface CharCountResult {
  charCount: number;
}
export interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  appVersion: {
    major: number;
    minor: number;
    date: string;
  };
}
export interface ProgrammerDeviceUID {
  userId: string;
  name: string;
}

export interface AddUserData {
  appId: string;
  userId?: string;
  programmerDeviceUIDs: ProgrammerDeviceUID[];
  deviceInfo: DeviceInfo;
  isNative?: boolean;
};

export interface UpdateProgrammerDeviceUIDsData {
  appId: string;
  userId?: string;
  programmerDeviceUIDs: ProgrammerDeviceUID[];
};