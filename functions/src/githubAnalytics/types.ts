export type HistoryData = {
  views?: GithubTrafficEntry[];
  clones?: GithubTrafficEntry[];
};

export interface GithubTrafficEntry {
  timestamp?: string;
  date?: string;
  count?: number;
  uniques?: number;
}

// Temporary logs for debugging
export type LogInfo = {
  calledBy?: string;
  repo?: string;
  analyticsData?: unknown;
  updateData?: unknown;
}
