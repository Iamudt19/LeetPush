// ─── Submission & Problem ──────────────────────────────────────────────────

/** Raw submission result from LeetCode's internal API */
export interface LeetCodeSubmissionRaw {
  submissionId: string;
  statusMsg: string; // "Accepted", "Wrong Answer", etc.
  lang: string;      // "python3", "java", "cpp", etc.
  code: string;
  runtime: string;
  memory: string;
  totalCorrect?: number;
  totalTestcases?: number;
}

/** Parsed problem metadata */
export interface ProblemInfo {
  number: number;
  title: string;
  slug: string;
  url: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Unknown';
  topics: string[];
  companyTags?: string[];          // Feature 7: company tags from LeetCode GraphQL
  description?: string;            // Problem statement in markdown/text
}

/** A fully resolved accepted submission ready for sync */
export interface AcceptedSubmission {
  submissionId: string;
  problem: ProblemInfo;
  language: string;         // Normalized display name e.g. "Java", "Python"
  langSlug: string;         // LeetCode slug e.g. "python3", "java"
  code: string;
  runtime: string;
  memory: string;
  runtimePercentile?: number; // e.g. 85.2 (%)
  memoryPercentile?: number;  // e.g. 70.1 (%)
  isDailyChallenge?: boolean;
  contestSlug?: string;        // Feature 10: populated when solved inside a contest
  notes?: string;              // Feature 2: user-written approach note
  complexity?: string;         // Feature 1: e.g. "Time: O(n log n) | Space: O(n)"
  submittedAt: number;      // Unix ms
}

// ─── GitHub Configuration ──────────────────────────────────────────────────

export type DuplicateStrategy = 'skip' | 'overwrite' | 'version';
export type FolderStructure = 'default' | 'difficulty' | 'topic';

export interface GitHubConfig {
  token: string;
  username: string;
  repository: string;
  branch: string;
  baseDirectory: string;               // e.g. "solutions"
  commitMessageTemplate: string;       // e.g. "LeetCode #{number} - {title} [{language}]"
  fileNamingTemplate: string;          // e.g. "{padded_number}-{slug}/{filename}"
  duplicateStrategy: DuplicateStrategy;
  folderStructure: FolderStructure;    // 'default' (0001-two-sum), 'difficulty' (Easy/0001-two-sum), 'topic' (Array/0001-two-sum)
  generateProblemReadme: boolean;
  updateGlobalReadme: boolean;
  includeBeatsStats: boolean;          // Include "Beats XX%" in commits and README
  tagDailyChallenge: boolean;          // Add [Daily Challenge] tag when applicable
  debugMode: boolean;
  // Feature 4: GitHub Actions CI
  enableWorkflowGeneration?: boolean;
  // Feature 10: Contest folder
  enableContestFolder?: boolean;
  // Feature 12: Commit co-author
  coAuthorName?: string;
  coAuthorEmail?: string;
}

export const DEFAULT_CONFIG: Omit<GitHubConfig, 'token' | 'username' | 'repository'> = {
  branch: 'main',
  baseDirectory: 'solutions',
  commitMessageTemplate: 'LeetCode #{number} - {title} [{language}]',
  fileNamingTemplate: '{padded_number}-{slug}/{filename}',
  duplicateStrategy: 'skip',
  folderStructure: 'default',
  generateProblemReadme: true,
  updateGlobalReadme: true,
  includeBeatsStats: true,
  tagDailyChallenge: true,
  debugMode: false,
  enableWorkflowGeneration: false,
  enableContestFolder: true,
  coAuthorName: '',
  coAuthorEmail: '',
};

// ─── Sync Records ──────────────────────────────────────────────────────────

export type SyncStatus = 'synced' | 'skipped' | 'failed' | 'pending';

export interface SyncRecord {
  submissionId: string;
  problemSlug: string;
  problemNumber: number;
  problemTitle: string;
  difficulty?: string;
  language: string;
  githubPath: string;
  runtime?: string;
  notes?: string;
  syncedAt: number;          // Unix ms
  status: SyncStatus;
  error?: string;
}

export interface PendingSync {
  submission: AcceptedSubmission;
  attemptCount: number;
  lastAttemptAt: number;     // Unix ms
  nextRetryAt: number;       // Unix ms
  error?: string;
}

// ─── Storage Schema ────────────────────────────────────────────────────────

export interface StorageData {
  githubConfig?: GitHubConfig;
  syncHistory: SyncRecord[];             // Recent syncs, capped at 500
  pendingQueue: PendingSync[];           // Submissions awaiting sync
  syncedSubmissionIds: string[];         // Fast lookup set (IDs only)
  skippedSlugs: string[];               // Feature 11: problem slugs to never push
  totalSynced: number;
  totalFailed: number;
  lastSyncAt?: number;
}

// ─── Messages ──────────────────────────────────────────────────────────────

export type MessageType =
  | 'SUBMISSION_ACCEPTED'
  | 'MANUAL_SYNC'
  | 'INITIAL_SYNC'
  | 'GET_STATUS'
  | 'AUTH_CONNECT'
  | 'AUTH_DISCONNECT'
  | 'SYNC_STATUS_UPDATE'
  | 'GET_PENDING'            // Feature 13: fetch pending queue for popup
  | 'DISMISS_PENDING'        // Feature 13: remove item from queue without syncing
  | 'RETRY_PENDING'          // Feature 13: immediately retry one item
  | 'SKIP_PROBLEM'           // Feature 11: add problem slug to skip list
  | 'UNSKIP_PROBLEM'         // Feature 11: remove problem slug from skip list
  | 'UPDATE_SUBMISSION_NOTE'; // Feature 2: save user note after sync

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
}

export interface SubmissionAcceptedPayload {
  submission: AcceptedSubmission;
}

export interface SyncStatusUpdatePayload {
  record: SyncRecord;
}

export interface InitialSyncPayload {
  limit: 10 | 50 | 100 | 'all';
}

export interface SkipProblemPayload {
  slug: string;
}

export interface UpdateNotePayload {
  submissionId: string;
  notes: string;
  complexity: string;
}

export interface RetryPendingPayload {
  submissionId: string;
}

export interface DismissPendingPayload {
  submissionId: string;
}

// ─── GitHub API Types ──────────────────────────────────────────────────────

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
}

export interface GitHubFileContent {
  sha: string;
  content: string;           // Base64-encoded
  encoding: 'base64';
  size: number;
  html_url: string;
  download_url: string;
}

export interface GitHubCreateFileResponse {
  content: {
    sha: string;
    html_url: string;
    path: string;
  };
  commit: {
    sha: string;
    html_url: string;
  };
}

export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number;             // Unix timestamp
}

export interface GitHubError {
  message: string;
  documentation_url?: string;
  status?: number;
}

// ─── UI State ──────────────────────────────────────────────────────────────

export interface PopupState {
  connected: boolean;
  username?: string;
  repository?: string;
  branch?: string;
  repoUrl?: string;
  lastSync?: SyncRecord;
  totalSynced: number;
  totalFailed: number;
  recentHistory: SyncRecord[];
}

// ─── Stats ─────────────────────────────────────────────────────────────────

export interface DifficultyStats {
  easy: number;
  medium: number;
  hard: number;
  unknown: number;
}

export interface LanguageStat {
  language: string;
  count: number;
}

export interface SolveStreakInfo {
  currentStreak: number;  // consecutive days
  longestStreak: number;
  solvedToday: number;
  solvedThisWeek: number;
  solvedThisMonth: number;
}
