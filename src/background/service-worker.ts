import type {
  Message,
  SubmissionAcceptedPayload,
  InitialSyncPayload,
  AcceptedSubmission,
  ProblemInfo,
  SkipProblemPayload,
  UpdateNotePayload,
  RetryPendingPayload,
  DismissPendingPayload,
} from '../types';
import {
  getConfig,
  getPendingQueue,
  removeFromPendingQueue,
  updatePendingItem,
  addToPendingQueue,
  getStorageData,
  isSubmissionSynced,
  addSkippedSlug,
  removeSkippedSlug,
  isSlugSkipped,
  updateSyncRecord,
} from '../storage/storage';
import { syncSubmission, SyncResult } from '../github/github-sync';
import { logger } from '../utils/logger';

const RETRY_ALARM_NAME = 'LEETPUSH_PROCESS_PENDING_QUEUE';
const MAX_RETRY_ATTEMPTS = 5;

// ─── Service Worker Lifecycle ───────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info(`LeetPush installed/updated: ${details.reason}`);

  // Setup periodic background alarm for pending queue
  await chrome.alarms.clear(RETRY_ALARM_NAME);
  chrome.alarms.create(RETRY_ALARM_NAME, {
    periodInMinutes: 5,
  });
});

// Periodic alarm handler for offline retry queue
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === RETRY_ALARM_NAME) {
    logger.debug('Running scheduled pending sync queue processor');
    await processPendingQueue();
  }
});

// ─── Notification Helper ────────────────────────────────────────────────────

function showNotification(title: string, message: string, isError = false): void {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: title,
      message: message,
      priority: isError ? 2 : 1,
    });
  } catch (err) {
    logger.warn('Could not display Chrome notification', err);
  }
}

// ─── Core Message Dispatcher ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: Message<any>, _sender, sendResponse) => {
  const handleAsync = async () => {
    switch (message.type) {
      case 'SUBMISSION_ACCEPTED': {
        const payload = message.payload as SubmissionAcceptedPayload;
        return await handleSubmissionAccepted(payload.submission);
      }

      case 'MANUAL_SYNC': {
        return await handleManualSync();
      }

      case 'INITIAL_SYNC': {
        const payload = message.payload as InitialSyncPayload;
        return await handleInitialSync(payload.limit);
      }

      case 'GET_STATUS': {
        return await getStorageData();
      }

      // ── Feature 13: Queue management ─────────────────────────────────────

      case 'GET_PENDING': {
        return await getPendingQueue();
      }

      case 'DISMISS_PENDING': {
        const { submissionId } = message.payload as DismissPendingPayload;
        await removeFromPendingQueue(submissionId);
        return { success: true };
      }

      case 'RETRY_PENDING': {
        const { submissionId } = message.payload as RetryPendingPayload;
        return await handleRetryPending(submissionId);
      }

      // ── Feature 11: Skip problem ─────────────────────────────────────────

      case 'SKIP_PROBLEM': {
        const { slug } = message.payload as SkipProblemPayload;
        await addSkippedSlug(slug);
        logger.info(`Problem "${slug}" added to skip list`);
        return { success: true };
      }

      case 'UNSKIP_PROBLEM': {
        const { slug } = message.payload as SkipProblemPayload;
        await removeSkippedSlug(slug);
        logger.info(`Problem "${slug}" removed from skip list`);
        return { success: true };
      }

      // ── Feature 2: Update notes/complexity after sync ─────────────────────

      case 'UPDATE_SUBMISSION_NOTE': {
        const { submissionId, notes, complexity } = message.payload as UpdateNotePayload;
        await updateSyncRecord(submissionId, { notes });
        logger.info(`Saved note for submission #${submissionId}`);
        return { success: true, submissionId, notes, complexity };
      }

      default:
        logger.warn(`Unknown message type: ${message.type}`);
        return { error: 'Unknown message type' };
    }
  };

  // Return true to keep message channel open for async response
  handleAsync()
    .then((res) => {
      try {
        sendResponse(res);
      } catch {
        // Message channel closed or Service Worker unloaded by Chrome
      }
    })
    .catch((err) => {
      logger.error('Unhandled error in background message handler', err);
      try {
        sendResponse({ error: err?.message || 'Internal error' });
      } catch {
        // Ignore response errors on closed channels
      }
    });

  return true;
});

// ─── Submission Accepted Handler ───────────────────────────────────────────

async function handleSubmissionAccepted(submission: AcceptedSubmission): Promise<SyncResult> {
  // Feature 11: Check if this problem slug is on the skip list
  if (await isSlugSkipped(submission.problem.slug)) {
    logger.info(`Problem "${submission.problem.slug}" is on the skip list. Ignoring submission.`);
    return { status: 'skipped', path: '', error: 'Problem is on the skip list' };
  }

  const config = await getConfig();

  if (!config || !config.token || !config.repository) {
    const errorMsg = 'GitHub is not connected. Please connect in LeetPush settings.';
    logger.warn(errorMsg);
    showNotification('LeetPush – GitHub Not Connected', errorMsg, true);

    // Queue for later when user connects GitHub
    await addToPendingQueue({
      submission,
      attemptCount: 0,
      lastAttemptAt: Date.now(),
      nextRetryAt: Date.now() + 60 * 1000,
      error: errorMsg,
    });

    return { status: 'failed', path: '', error: errorMsg };
  }

  const result = await syncSubmission(submission, config);

  if (result.status === 'synced') {
    showNotification(
      'LeetPush – Solved & Pushed! ✓',
      `#${submission.problem.number} ${submission.problem.title} [${submission.language}] pushed to ${config.repository}`
    );
  } else if (result.status === 'skipped') {
    showNotification(
      'LeetPush – Already Exists',
      `Solution for #${submission.problem.number} ${submission.problem.title} is already up-to-date on GitHub.`
    );
  } else if (result.status === 'failed') {
    showNotification(
      'LeetPush – Sync Failed ✕',
      `Failed to sync #${submission.problem.number} ${submission.problem.title}: ${result.error}`,
      true
    );

    // Add to pending queue with exponential backoff
    await addToPendingQueue({
      submission,
      attemptCount: 1,
      lastAttemptAt: Date.now(),
      nextRetryAt: Date.now() + 2 * 60 * 1000, // retry in 2 mins
      error: result.error,
    });
  }

  return result;
}

// ─── Process Pending Queue ──────────────────────────────────────────────────

async function processPendingQueue(): Promise<{ processed: number; succeeded: number }> {
  const queue = await getPendingQueue();
  if (queue.length === 0) return { processed: 0, succeeded: 0 };

  const config = await getConfig();
  if (!config || !config.token || !config.repository) {
    logger.debug('Pending queue: GitHub not configured yet');
    return { processed: 0, succeeded: 0 };
  }

  const now = Date.now();
  let processed = 0;
  let succeeded = 0;

  for (const item of queue) {
    if (now < item.nextRetryAt) {
      continue; // Not yet time for next retry
    }

    processed++;
    logger.info(`Retrying pending submission #${item.submission.submissionId} (attempt ${item.attemptCount + 1})`);

    const result = await syncSubmission(item.submission, config);

    if (result.status === 'synced' || result.status === 'skipped') {
      succeeded++;
      await removeFromPendingQueue(item.submission.submissionId);
      logger.info(`Pending submission #${item.submission.submissionId} resolved (${result.status})`);
    } else {
      const nextAttempt = item.attemptCount + 1;
      if (nextAttempt >= MAX_RETRY_ATTEMPTS) {
        logger.error(`Max retries reached for #${item.submission.submissionId}. Dropping from queue.`);
        await removeFromPendingQueue(item.submission.submissionId);
      } else {
        const backoffMs = Math.pow(2, nextAttempt) * 60 * 1000; // 2m, 4m, 8m, 16m
        await updatePendingItem(item.submission.submissionId, {
          attemptCount: nextAttempt,
          lastAttemptAt: now,
          nextRetryAt: now + backoffMs,
          error: result.error,
        });
      }
    }
  }

  return { processed, succeeded };
}

// ─── Manual Sync Handler ────────────────────────────────────────────────────

async function handleManualSync(): Promise<{ processed: number; succeeded: number }> {
  logger.info('Manual sync triggered');
  return await processPendingQueue();
}

// ─── Feature 13: Immediate retry for a single pending item ──────────────────

async function handleRetryPending(submissionId: string): Promise<SyncResult> {
  const queue = await getPendingQueue();
  const item = queue.find((q) => q.submission.submissionId === submissionId);

  if (!item) {
    return { status: 'failed', path: '', error: 'Item not found in pending queue' };
  }

  const config = await getConfig();
  if (!config || !config.token || !config.repository) {
    return { status: 'failed', path: '', error: 'GitHub not configured' };
  }

  const result = await syncSubmission(item.submission, config);

  if (result.status === 'synced' || result.status === 'skipped') {
    await removeFromPendingQueue(submissionId);
    showNotification(
      'LeetPush – Retry Succeeded ✓',
      `#${item.submission.problem.number} ${item.submission.problem.title} synced successfully.`
    );
  } else {
    const nextAttempt = item.attemptCount + 1;
    await updatePendingItem(submissionId, {
      attemptCount: nextAttempt,
      lastAttemptAt: Date.now(),
      nextRetryAt: Date.now() + 60 * 1000,
      error: result.error,
    });
  }

  return result;
}

// ─── Initial Sync (Bulk Import) Handler ──────────────────────────────────────

async function handleInitialSync(limit: 10 | 50 | 100 | 'all'): Promise<{ synced: number; skipped: number; failed: number }> {
  const config = await getConfig();
  if (!config || !config.token || !config.repository) {
    throw new Error('GitHub is not configured. Cannot perform initial sync.');
  }

  const targetLimit = limit === 'all' ? 1000 : limit;
  logger.info(`Starting initial batch sync (limit: ${limit})`);

  // Query user's accepted submissions via LeetCode GraphQL
  const query = `
    query recentAcSubmissions($limit: Int!) {
      recentAcSubmissionList(limit: $limit) {
        id
        title
        titleSlug
        timestamp
      }
    }
  `;

  let items: Array<{ id: string; title: string; titleSlug: string; timestamp: string }> = [];

  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query,
        variables: { limit: targetLimit },
      }),
    });

    if (res.ok) {
      const json = await res.json();
      items = json?.data?.recentAcSubmissionList || [];
    }
  } catch (err) {
    logger.error('Failed to fetch recent submissions from LeetCode GraphQL', err);
    throw new Error('Could not retrieve recent submissions from LeetCode. Ensure you are logged into LeetCode.');
  }

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    const subId = String(item.id);
    if (await isSubmissionSynced(subId)) {
      skipped++;
      continue;
    }

    // Feature 11: skip blacklisted slugs during bulk import too
    if (await isSlugSkipped(item.titleSlug)) {
      skipped++;
      continue;
    }

    try {
      // Fetch full submission detail
      const detailQuery = `
        query submissionDetail($submissionId: Int!) {
          submissionDetail(submissionId: $submissionId) {
            code
            runtimeDisplay
            memoryDisplay
            lang {
              name
              verboseName
            }
            question {
              questionFrontendId
              title
              titleSlug
              difficulty
              topicTags {
                name
              }
            }
          }
        }
      `;

      const detailRes = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: detailQuery,
          variables: { submissionId: parseInt(subId, 10) },
        }),
      });

      if (!detailRes.ok) {
        failed++;
        continue;
      }

      const detailJson = await detailRes.json();
      const detail = detailJson?.data?.submissionDetail;
      if (!detail || !detail.code) {
        failed++;
        continue;
      }

      const q = detail.question;
      const problem: ProblemInfo = {
        number: parseInt(q?.questionFrontendId || '0', 10),
        title: q?.title || item.title,
        slug: q?.titleSlug || item.titleSlug,
        url: `https://leetcode.com/problems/${q?.titleSlug || item.titleSlug}/`,
        difficulty: q?.difficulty || 'Unknown',
        topics: (q?.topicTags || []).map((t: { name: string }) => t.name),
      };

      const submission: AcceptedSubmission = {
        submissionId: subId,
        problem,
        language: detail.lang?.verboseName || detail.lang?.name || 'Text',
        langSlug: detail.lang?.name || '',
        code: detail.code,
        runtime: detail.runtimeDisplay || '',
        memory: detail.memoryDisplay || '',
        submittedAt: parseInt(item.timestamp, 10) * 1000 || Date.now(),
      };

      const result = await syncSubmission(submission, config);
      if (result.status === 'synced') synced++;
      else if (result.status === 'skipped') skipped++;
      else failed++;

      // Small delay between requests to be gentle on GitHub API
      await new Promise((r) => setTimeout(r, 400));
    } catch (itemErr) {
      logger.warn(`Failed initial sync for submission #${subId}`, itemErr);
      failed++;
    }
  }

  showNotification(
    'LeetPush – Initial Sync Complete',
    `Synced: ${synced}, Skipped (Already Existed): ${skipped}, Failed: ${failed}`
  );

  return { synced, skipped, failed };
}
