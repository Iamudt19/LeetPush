import type { StorageData, SyncRecord, PendingSync, DifficultyStats, LanguageStat, SolveStreakInfo } from '../types';
import { getStorageData } from '../storage/storage';

async function init() {
  const disconnectedView = document.getElementById('disconnected-view')!;
  const connectedView = document.getElementById('connected-view')!;
  const settingsBtn = document.getElementById('settings-btn')!;
  const connectBtn = document.getElementById('connect-btn')!;
  const openRepoBtn = document.getElementById('open-repo-btn') as HTMLButtonElement;
  const syncNowBtn = document.getElementById('sync-now-btn') as HTMLButtonElement;

  const statusUser = document.getElementById('status-user')!;
  const statusRepo = document.getElementById('status-repo')!;
  const statusLastSync = document.getElementById('status-last-sync')!;

  const statSynced = document.getElementById('stat-synced')!;
  const statFailed = document.getElementById('stat-failed')!;
  const statPending = document.getElementById('stat-pending')!;

  const historyList = document.getElementById('history-list')!;
  const actionBanner = document.getElementById('action-banner')!;

  // Tab elements
  const tabBtns = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
  const queueBadge = document.getElementById('queue-badge')!;

  function showBanner(text: string, type: 'info' | 'success' | 'error' = 'info', ms = 3000) {
    actionBanner.textContent = text;
    actionBanner.className = `action-banner ${type}`;
    actionBanner.classList.remove('hidden');
    setTimeout(() => {
      actionBanner.classList.add('hidden');
    }, ms);
  }

  // Open Options / Settings page
  const openSettings = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  };

  settingsBtn.addEventListener('click', openSettings);
  connectBtn?.addEventListener('click', openSettings);

  // ─── Tab Switching ──────────────────────────────────────────────────────

  function switchTab(tabName: string) {
    tabBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset['tab'] === tabName);
    });
    document.querySelectorAll('.tab-content').forEach((el) => {
      el.classList.toggle('hidden', !el.id.endsWith(tabName));
      el.classList.toggle('active', el.id.endsWith(tabName));
    });

    if (tabName === 'queue') {
      renderQueueTab();
    }
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset['tab']!;
      switchTab(tab);
    });
  });

  // ─── Stats Computation ──────────────────────────────────────────────────

  function computeDifficultyStats(history: SyncRecord[]): DifficultyStats {
    const synced = history.filter((r) => r.status === 'synced');
    return {
      easy: synced.filter((r) => r.difficulty?.toLowerCase() === 'easy').length,
      medium: synced.filter((r) => r.difficulty?.toLowerCase() === 'medium').length,
      hard: synced.filter((r) => r.difficulty?.toLowerCase() === 'hard').length,
      unknown: synced.filter((r) => !r.difficulty || r.difficulty.toLowerCase() === 'unknown').length,
    };
  }

  function computeTopLanguages(history: SyncRecord[]): LanguageStat[] {
    const synced = history.filter((r) => r.status === 'synced');
    const counts: Record<string, number> = {};
    synced.forEach((r) => {
      if (r.language) counts[r.language] = (counts[r.language] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([language, count]) => ({ language, count }));
  }

  function computeStreak(history: SyncRecord[]): SolveStreakInfo {
    const synced = history.filter((r) => r.status === 'synced');
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekAgo = todayStart.getTime() - 6 * 86400000;
    const monthAgo = todayStart.getTime() - 29 * 86400000;

    const solvedToday = synced.filter((r) => r.syncedAt >= todayStart.getTime()).length;
    const solvedThisWeek = synced.filter((r) => r.syncedAt >= weekAgo).length;
    const solvedThisMonth = synced.filter((r) => r.syncedAt >= monthAgo).length;

    // Build a set of unique "day" strings
    const daySet = new Set(
      synced.map((r) => new Date(r.syncedAt).toDateString())
    );

    // Compute consecutive day streak from today backwards
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let checkDate = new Date(todayStart);

    for (let i = 0; i < 365; i++) {
      if (daySet.has(checkDate.toDateString())) {
        tempStreak++;
        if (i === 0 || currentStreak > 0) currentStreak = tempStreak;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        if (i === 0) {
          // Didn't solve today; check if solved yesterday to preserve streak
        } else {
          if (currentStreak === 0) currentStreak = 0;
          tempStreak = 0;
        }
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return { currentStreak, longestStreak, solvedToday, solvedThisWeek, solvedThisMonth };
  }

  function renderStats(history: SyncRecord[]) {
    const diff = computeDifficultyStats(history);
    const langs = computeTopLanguages(history);
    const streak = computeStreak(history);

    // Streak section
    document.getElementById('streak-current')!.textContent = String(streak.currentStreak);
    document.getElementById('stats-today')!.textContent = String(streak.solvedToday);
    document.getElementById('stats-week')!.textContent = String(streak.solvedThisWeek);
    document.getElementById('stats-month')!.textContent = String(streak.solvedThisMonth);

    // Difficulty bars
    const total = diff.easy + diff.medium + diff.hard + diff.unknown || 1;
    const setBar = (barId: string, countId: string, count: number) => {
      const pct = Math.round((count / total) * 100);
      const bar = document.getElementById(barId) as HTMLElement;
      const countEl = document.getElementById(countId)!;
      if (bar) bar.style.width = `${pct}%`;
      countEl.textContent = String(count);
    };
    setBar('bar-easy', 'count-easy', diff.easy);
    setBar('bar-medium', 'count-medium', diff.medium);
    setBar('bar-hard', 'count-hard', diff.hard);

    // Top languages
    const langList = document.getElementById('lang-list')!;
    if (langs.length === 0) {
      langList.innerHTML = '<div class="empty-state">No data yet.</div>';
      return;
    }
    const maxLang = langs[0].count || 1;
    langList.innerHTML = '';
    langs.forEach(({ language, count }) => {
      const pct = Math.round((count / maxLang) * 100);
      const row = document.createElement('div');
      row.className = 'lang-item';
      row.innerHTML = `
        <span class="lang-name">${language}</span>
        <div class="lang-bar-wrap"><div class="lang-bar" style="width:${pct}%"></div></div>
        <span class="lang-count">${count}</span>
      `;
      langList.appendChild(row);
    });
  }

  // ─── Queue Tab (Feature 13) ─────────────────────────────────────────────

  async function renderQueueTab() {
    const queueList = document.getElementById('queue-list')!;
    queueList.innerHTML = '';

    let queue: PendingSync[] = [];
    try {
      queue = (await chrome.runtime.sendMessage({ type: 'GET_PENDING' })) as PendingSync[];
    } catch {
      queueList.innerHTML = '<div class="empty-state">Could not load queue.</div>';
      return;
    }

    if (!queue || queue.length === 0) {
      queueList.innerHTML = '<div class="empty-state">No pending submissions. ✓</div>';
      return;
    }

    queue.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'queue-item';
      const nextRetryIn = Math.max(0, Math.round((item.nextRetryAt - Date.now()) / 1000 / 60));
      const retryLabel = nextRetryIn > 0 ? `~${nextRetryIn}m` : 'Now';

      el.innerHTML = `
        <div class="queue-item-header">
          <span class="queue-problem">#${item.submission.problem.number} ${item.submission.problem.title}</span>
          <span class="queue-attempt">Attempt ${item.attemptCount + 1} · ${retryLabel}</span>
        </div>
        ${item.error ? `<div class="queue-error">${item.error}</div>` : ''}
        <div class="queue-actions">
          <button class="queue-retry-btn" data-id="${item.submission.submissionId}">↻ Retry Now</button>
          <button class="queue-dismiss-btn" data-id="${item.submission.submissionId}">✕ Dismiss</button>
        </div>
      `;

      el.querySelector('.queue-retry-btn')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        const id = btn.dataset['id']!;
        btn.disabled = true;
        btn.textContent = 'Retrying...';
        try {
          const res = await chrome.runtime.sendMessage({ type: 'RETRY_PENDING', payload: { submissionId: id } });
          if (res?.status === 'synced' || res?.status === 'skipped') {
            showBanner(`✓ Synced successfully!`, 'success');
            await renderQueueTab();
            await updateQueueBadge();
          } else {
            showBanner(`Retry failed: ${res?.error || 'Unknown'}`, 'error');
            btn.disabled = false;
            btn.textContent = '↻ Retry Now';
          }
        } catch (err: any) {
          showBanner(`Error: ${err?.message}`, 'error');
          btn.disabled = false;
          btn.textContent = '↻ Retry Now';
        }
      });

      el.querySelector('.queue-dismiss-btn')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        const id = btn.dataset['id']!;
        btn.disabled = true;
        await chrome.runtime.sendMessage({ type: 'DISMISS_PENDING', payload: { submissionId: id } });
        el.remove();
        await updateQueueBadge();
        if (document.querySelectorAll('.queue-item').length === 0) {
          queueList.innerHTML = '<div class="empty-state">No pending submissions. ✓</div>';
        }
      });

      queueList.appendChild(el);
    });
  }

  async function updateQueueBadge() {
    try {
      const queue = (await chrome.runtime.sendMessage({ type: 'GET_PENDING' })) as PendingSync[];
      const count = queue?.length ?? 0;
      queueBadge.textContent = String(count);
      queueBadge.classList.toggle('hidden', count === 0);
      statPending.textContent = String(count);
    } catch {
      // ignore
    }
  }

  // ─── Main Render ────────────────────────────────────────────────────────

  async function render() {
    let data: StorageData;
    try {
      data = await getStorageData();
    } catch {
      data = {
        syncHistory: [],
        pendingQueue: [],
        syncedSubmissionIds: [],
        skippedSlugs: [],
        totalSynced: 0,
        totalFailed: 0,
      };
    }

    const config = data.githubConfig;
    const isConnected = Boolean(config?.token && config?.repository);

    if (!isConnected) {
      disconnectedView.classList.remove('hidden');
      connectedView.classList.add('hidden');
      return;
    }

    disconnectedView.classList.add('hidden');
    connectedView.classList.remove('hidden');

    // Populate connected details
    statusUser.textContent = `Connected as @${config?.username || 'User'}`;
    statusRepo.textContent = config?.repository || 'Not set';

    // Last Sync display
    const latestRecord: SyncRecord | undefined = data.syncHistory[0];
    if (latestRecord) {
      const date = new Date(latestRecord.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      statusLastSync.textContent = `#${latestRecord.problemNumber} ${latestRecord.problemTitle} (${date})`;
    } else {
      statusLastSync.textContent = 'None yet';
    }

    // Stats
    statSynced.textContent = String(data.totalSynced || 0);
    statFailed.textContent = String(data.totalFailed || 0);

    const pendingCount = data.pendingQueue?.length ?? 0;
    statPending.textContent = String(pendingCount);
    queueBadge.textContent = String(pendingCount);
    queueBadge.classList.toggle('hidden', pendingCount === 0);

    // Open Repo button
    openRepoBtn.onclick = () => {
      if (config?.repository) {
        chrome.tabs.create({ url: `https://github.com/${config.repository}` });
      }
    };

    // Sync Now button
    syncNowBtn.onclick = async () => {
      syncNowBtn.disabled = true;
      syncNowBtn.textContent = 'Syncing...';
      try {
        const res = await chrome.runtime.sendMessage({ type: 'MANUAL_SYNC' });
        showBanner(`Queue processed: ${res?.succeeded ?? 0} synced`, 'success');
        await render();
      } catch (err: any) {
        showBanner(`Sync error: ${err?.message || 'Failed'}`, 'error');
      } finally {
        syncNowBtn.disabled = false;
        syncNowBtn.textContent = 'Sync Now ↻';
      }
    };

    // Render Recent History (up to 5 items)
    renderHistory(data.syncHistory.slice(0, 5));

    // Render Stats tab data
    renderStats(data.syncHistory);
  }

  function renderHistory(records: SyncRecord[]) {
    if (!records || records.length === 0) {
      historyList.innerHTML = '<div class="empty-state">No submissions synced yet.</div>';
      return;
    }

    historyList.innerHTML = '';
    records.forEach((rec) => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const iconClass = rec.status === 'synced' ? 'synced' : rec.status === 'skipped' ? 'skipped' : 'failed';
      const iconChar = rec.status === 'synced' ? '✓' : rec.status === 'skipped' ? '↷' : '✕';

      item.innerHTML = `
        <div class="history-info">
          <span class="history-icon ${iconClass}">${iconChar}</span>
          <span class="history-title" title="${rec.problemTitle}">#${rec.problemNumber} ${rec.problemTitle}</span>
        </div>
        <span class="history-lang">${rec.language}</span>
      `;
      historyList.appendChild(item);
    });
  }

  await render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
