import type {
  GitHubConfig,
  StorageData,
  SyncRecord,
  PendingSync,
  AcceptedSubmission,
} from '../types/index.js';

const STORAGE_KEYS = {
  CONFIG: 'leetpush_config',
  SYNC_HISTORY: 'leetpush_sync_history',
  PENDING_QUEUE: 'leetpush_pending_queue',
  SYNCED_IDS: 'leetpush_synced_ids',
  TOTAL_SYNCED: 'leetpush_total_synced',
  TOTAL_FAILED: 'leetpush_total_failed',
  LAST_SYNC_AT: 'leetpush_last_sync_at',
  SKIPPED_SLUGS: 'leetpush_skipped_slugs',  // Feature 11
  WORKFLOW_GENERATED: 'leetpush_workflow_generated', // Feature 4
} as const;

/** Maximum number of sync history records to retain */
const MAX_HISTORY = 500;
/** Maximum number of IDs to track in fast-lookup set */
const MAX_SYNCED_IDS = 2000;

// ─── Config ─────────────────────────────────────────────────────────────────

export async function getConfig(): Promise<GitHubConfig | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CONFIG);
  return (result[STORAGE_KEYS.CONFIG] as GitHubConfig) ?? null;
}

export async function saveConfig(config: GitHubConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: config });
}

export async function clearConfig(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.CONFIG);
}

// ─── Sync History ───────────────────────────────────────────────────────────

export async function getSyncHistory(): Promise<SyncRecord[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SYNC_HISTORY);
  return (result[STORAGE_KEYS.SYNC_HISTORY] as SyncRecord[]) ?? [];
}

export async function addSyncRecord(record: SyncRecord): Promise<void> {
  const history = await getSyncHistory();
  // Prepend newest first, cap at MAX_HISTORY
  const updated = [record, ...history].slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_HISTORY]: updated });
}

export async function updateSyncRecord(
  submissionId: string,
  patch: Partial<SyncRecord>
): Promise<void> {
  const history = await getSyncHistory();
  const idx = history.findIndex((r) => r.submissionId === submissionId);
  if (idx !== -1) {
    history[idx] = { ...history[idx], ...patch } as SyncRecord;
    await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_HISTORY]: history });
  }
}

// ─── Synced Submission IDs (fast dedup lookup) ───────────────────────────────

export async function getSyncedIds(): Promise<Set<string>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SYNCED_IDS);
  const ids = (result[STORAGE_KEYS.SYNCED_IDS] as string[]) ?? [];
  return new Set(ids);
}

export async function markSubmissionSynced(submissionId: string): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SYNCED_IDS);
  const ids = (result[STORAGE_KEYS.SYNCED_IDS] as string[]) ?? [];
  if (!ids.includes(submissionId)) {
    const updated = [submissionId, ...ids].slice(0, MAX_SYNCED_IDS);
    await chrome.storage.local.set({ [STORAGE_KEYS.SYNCED_IDS]: updated });
  }
}

export async function isSubmissionSynced(submissionId: string): Promise<boolean> {
  const ids = await getSyncedIds();
  return ids.has(submissionId);
}

// ─── Pending Queue ───────────────────────────────────────────────────────────

export async function getPendingQueue(): Promise<PendingSync[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PENDING_QUEUE);
  return (result[STORAGE_KEYS.PENDING_QUEUE] as PendingSync[]) ?? [];
}

export async function addToPendingQueue(item: PendingSync): Promise<void> {
  const queue = await getPendingQueue();
  // Avoid duplicates in queue
  const exists = queue.some(
    (q) => q.submission.submissionId === item.submission.submissionId
  );
  if (!exists) {
    queue.push(item);
    await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_QUEUE]: queue });
  }
}

export async function updatePendingItem(
  submissionId: string,
  patch: Partial<PendingSync>
): Promise<void> {
  const queue = await getPendingQueue();
  const idx = queue.findIndex((q) => q.submission.submissionId === submissionId);
  if (idx !== -1) {
    queue[idx] = { ...queue[idx], ...patch } as PendingSync;
    await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_QUEUE]: queue });
  }
}

export async function removeFromPendingQueue(submissionId: string): Promise<void> {
  const queue = await getPendingQueue();
  const updated = queue.filter((q) => q.submission.submissionId !== submissionId);
  await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_QUEUE]: updated });
}

// ─── Counters ────────────────────────────────────────────────────────────────

export async function getTotals(): Promise<{ totalSynced: number; totalFailed: number }> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.TOTAL_SYNCED,
    STORAGE_KEYS.TOTAL_FAILED,
  ]);
  return {
    totalSynced: (result[STORAGE_KEYS.TOTAL_SYNCED] as number) ?? 0,
    totalFailed: (result[STORAGE_KEYS.TOTAL_FAILED] as number) ?? 0,
  };
}

export async function incrementSynced(): Promise<void> {
  const { totalSynced } = await getTotals();
  await chrome.storage.local.set({
    [STORAGE_KEYS.TOTAL_SYNCED]: totalSynced + 1,
    [STORAGE_KEYS.LAST_SYNC_AT]: Date.now(),
  });
}

export async function incrementFailed(): Promise<void> {
  const { totalFailed } = await getTotals();
  await chrome.storage.local.set({ [STORAGE_KEYS.TOTAL_FAILED]: totalFailed + 1 });
}

// ─── Feature 11: Skipped Slugs ───────────────────────────────────────────────

export async function getSkippedSlugs(): Promise<string[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SKIPPED_SLUGS);
  return (result[STORAGE_KEYS.SKIPPED_SLUGS] as string[]) ?? [];
}

export async function addSkippedSlug(slug: string): Promise<void> {
  const slugs = await getSkippedSlugs();
  if (!slugs.includes(slug)) {
    slugs.push(slug);
    await chrome.storage.local.set({ [STORAGE_KEYS.SKIPPED_SLUGS]: slugs });
  }
}

export async function removeSkippedSlug(slug: string): Promise<void> {
  const slugs = await getSkippedSlugs();
  const updated = slugs.filter((s) => s !== slug);
  await chrome.storage.local.set({ [STORAGE_KEYS.SKIPPED_SLUGS]: updated });
}

export async function isSlugSkipped(slug: string): Promise<boolean> {
  const slugs = await getSkippedSlugs();
  return slugs.includes(slug);
}

// ─── Feature 4: Workflow generation flag ──────────────────────────────────────

export async function hasWorkflowBeenGenerated(repo: string): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.WORKFLOW_GENERATED);
  const generated = (result[STORAGE_KEYS.WORKFLOW_GENERATED] as string[]) ?? [];
  return generated.includes(repo);
}

export async function markWorkflowGenerated(repo: string): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.WORKFLOW_GENERATED);
  const generated = (result[STORAGE_KEYS.WORKFLOW_GENERATED] as string[]) ?? [];
  if (!generated.includes(repo)) {
    generated.push(repo);
    await chrome.storage.local.set({ [STORAGE_KEYS.WORKFLOW_GENERATED]: generated });
  }
}

// ─── Full state dump for popup ───────────────────────────────────────────────

export async function getStorageData(): Promise<StorageData> {
  const all = await chrome.storage.local.get(null);
  const config = (all[STORAGE_KEYS.CONFIG] as GitHubConfig) ?? undefined;
  const history = (all[STORAGE_KEYS.SYNC_HISTORY] as SyncRecord[]) ?? [];
  const queue = (all[STORAGE_KEYS.PENDING_QUEUE] as PendingSync[]) ?? [];
  const ids = (all[STORAGE_KEYS.SYNCED_IDS] as string[]) ?? [];
  const totalSynced = (all[STORAGE_KEYS.TOTAL_SYNCED] as number) ?? 0;
  const totalFailed = (all[STORAGE_KEYS.TOTAL_FAILED] as number) ?? 0;
  const skippedSlugs = (all[STORAGE_KEYS.SKIPPED_SLUGS] as string[]) ?? [];
  const lastSyncAt = (all[STORAGE_KEYS.LAST_SYNC_AT] as number) ?? undefined;

  return {
    githubConfig: config,
    syncHistory: history,
    pendingQueue: queue,
    syncedSubmissionIds: ids,
    skippedSlugs,
    totalSynced,
    totalFailed,
    lastSyncAt,
  };
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.local.clear();
}

// ─── Queue pending submission ─────────────────────────────────────────────────

export async function queueSubmission(submission: AcceptedSubmission): Promise<void> {
  const now = Date.now();
  const pendingItem: PendingSync = {
    submission,
    attemptCount: 0,
    lastAttemptAt: now,
    nextRetryAt: now,
  };
  await addToPendingQueue(pendingItem);
}
