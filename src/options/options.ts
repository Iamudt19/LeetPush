import type { DuplicateStrategy, GitHubConfig, GitHubRepo, SyncRecord } from '../types';
import { getConfig, saveConfig, getSyncHistory, getSkippedSlugs, removeSkippedSlug } from '../storage/storage';
import { authenticateWithToken, disconnectGitHub } from '../github/github-auth';
import { GitHubApi } from '../github/github-api';

async function init() {
  // Elements
  const connectionBadge = document.getElementById('connection-badge')!;
  const tokenInput = document.getElementById('github-token') as HTMLInputElement;
  const toggleTokenBtn = document.getElementById('toggle-token-btn') as HTMLButtonElement;
  const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
  const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;

  const userInfoBanner = document.getElementById('user-info-banner')!;
  const userAvatar = document.getElementById('user-avatar') as HTMLImageElement;
  const userName = document.getElementById('user-name')!;
  const userLogin = document.getElementById('user-login')!;

  const repoSelect = document.getElementById('repo-select') as HTMLSelectElement;
  const refreshReposBtn = document.getElementById('refresh-repos-btn') as HTMLButtonElement;
  const repoCustom = document.getElementById('repo-custom') as HTMLInputElement;

  const branchInput = document.getElementById('branch-input') as HTMLInputElement;
  const baseDirInput = document.getElementById('base-dir-input') as HTMLInputElement;
  const commitTemplate = document.getElementById('commit-template') as HTMLInputElement;
  const duplicateStrategy = document.getElementById('duplicate-strategy') as HTMLSelectElement;

  // Feature 12: Co-author
  const coAuthorName = document.getElementById('coauthor-name') as HTMLInputElement;
  const coAuthorEmail = document.getElementById('coauthor-email') as HTMLInputElement;

  const genProblemReadme = document.getElementById('gen-problem-readme') as HTMLInputElement;
  const genGlobalReadme = document.getElementById('gen-global-readme') as HTMLInputElement;
  const enableWorkflow = document.getElementById('enable-workflow') as HTMLInputElement;    // Feature 4
  const enableContestFolder = document.getElementById('enable-contest-folder') as HTMLInputElement; // Feature 10
  const debugMode = document.getElementById('debug-mode') as HTMLInputElement;

  const saveSettingsBtn = document.getElementById('save-settings-btn') as HTMLButtonElement;
  const saveStatus = document.getElementById('save-status')!;

  const initialSyncBtn = document.getElementById('initial-sync-btn') as HTMLButtonElement;
  const initialSyncLimit = document.getElementById('initial-sync-limit') as HTMLSelectElement;
  const initialSyncStatus = document.getElementById('initial-sync-status')!;

  const historyTableBody = document.getElementById('history-table-body')!;
  const clearHistoryBtn = document.getElementById('clear-history-btn') as HTMLButtonElement;

  // Feature 11: Skipped problems
  const skippedSlugsList = document.getElementById('skipped-slugs-list')!;

  // Feature 14: Export backup
  const exportBackupBtn = document.getElementById('export-backup-btn') as HTMLButtonElement;

  let currentToken = '';

  // ─── Token Toggle Visibility ──────────────────────────────────────────────
  toggleTokenBtn.addEventListener('click', () => {
    if (tokenInput.type === 'password') {
      tokenInput.type = 'text';
      toggleTokenBtn.textContent = 'Hide';
    } else {
      tokenInput.type = 'password';
      toggleTokenBtn.textContent = 'Show';
    }
  });

  // ─── Load Initial Form Data ───────────────────────────────────────────────
  async function loadConfigData() {
    const config = await getConfig();
    if (config) {
      currentToken = config.token || '';
      if (currentToken) {
        tokenInput.value = currentToken;
        updateConnectionUi(true, config.username);
        loadRepositories(currentToken, config.repository);
      } else {
        updateConnectionUi(false);
      }

      repoCustom.value = config.repository || '';
      branchInput.value = config.branch || 'main';
      baseDirInput.value = config.baseDirectory || 'solutions';
      commitTemplate.value =
        config.commitMessageTemplate || 'LeetCode #{number} - {title} [{language}]';
      duplicateStrategy.value = config.duplicateStrategy || 'skip';

      // Feature 12: Co-author
      coAuthorName.value = config.coAuthorName || '';
      coAuthorEmail.value = config.coAuthorEmail || '';

      genProblemReadme.checked = config?.generateProblemReadme !== false;
      genGlobalReadme.checked = Boolean(config?.updateGlobalReadme);
      enableWorkflow.checked = Boolean(config?.enableWorkflowGeneration);       // Feature 4
      enableContestFolder.checked = config?.enableContestFolder !== false;       // Feature 10
      debugMode.checked = Boolean(config?.debugMode);
    } else {
      updateConnectionUi(false);
    }

    await loadHistory();
    await loadSkippedSlugs();
  }

  function updateConnectionUi(connected: boolean, username?: string) {
    if (connected) {
      connectionBadge.className = 'badge badge-connected';
      connectionBadge.textContent = 'Connected';
      connectBtn.textContent = 'Verified ✓';
      disconnectBtn.classList.remove('hidden');
      if (username) {
        userInfoBanner.classList.remove('hidden');
        userLogin.textContent = `@${username}`;
        userName.textContent = username;
      }
    } else {
      connectionBadge.className = 'badge badge-disconnected';
      connectionBadge.textContent = 'Disconnected';
      connectBtn.textContent = 'Verify & Connect';
      disconnectBtn.classList.add('hidden');
      userInfoBanner.classList.add('hidden');
      repoSelect.disabled = true;
      refreshReposBtn.disabled = true;
    }
  }

  // ─── Load Repositories ────────────────────────────────────────────────────
  async function loadRepositories(token: string, selectedRepo?: string) {
    repoSelect.disabled = true;
    refreshReposBtn.disabled = true;
    repoSelect.innerHTML = '<option value="">Loading your repositories...</option>';

    try {
      const api = new GitHubApi(token);
      const repos = await api.listRepositories();

      repoSelect.innerHTML = '<option value="">-- Choose a repository --</option>';
      repos.forEach((repo: GitHubRepo) => {
        const opt = document.createElement('option');
        opt.value = repo.full_name;
        opt.textContent = `${repo.full_name}${repo.private ? ' 🔒' : ''}`;
        if (selectedRepo && repo.full_name.toLowerCase() === selectedRepo.toLowerCase()) {
          opt.selected = true;
        }
        repoSelect.appendChild(opt);
      });

      repoSelect.disabled = false;
      refreshReposBtn.disabled = false;
    } catch (err: any) {
      repoSelect.innerHTML = `<option value="">Failed to load repos: ${err?.message || 'Error'}</option>`;
    }
  }

  repoSelect.addEventListener('change', () => {
    if (repoSelect.value) {
      repoCustom.value = repoSelect.value;
    }
  });

  refreshReposBtn.addEventListener('click', () => {
    if (currentToken) {
      loadRepositories(currentToken, repoCustom.value.trim());
    }
  });

  // ─── Connect / Disconnect Handlers ────────────────────────────────────────
  connectBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token) {
      alert('Please enter a GitHub Personal Access Token.');
      return;
    }

    connectBtn.disabled = true;
    connectBtn.textContent = 'Verifying...';

    try {
      const user = await authenticateWithToken(token);
      currentToken = token;
      updateConnectionUi(true, user.login);
      userAvatar.src = user.avatar_url;
      userLogin.textContent = `@${user.login}`;
      userName.textContent = user.name || user.login;
      await loadRepositories(token, repoCustom.value.trim());
      alert(`Connected successfully as @${user.login}!`);
    } catch (err: any) {
      alert(`Authentication failed: ${err?.message || 'Unknown error'}`);
      updateConnectionUi(false);
    } finally {
      connectBtn.disabled = false;
    }
  });

  disconnectBtn.addEventListener('click', async () => {
    if (confirm('Disconnect your GitHub account? Auto-sync will pause.')) {
      await disconnectGitHub();
      currentToken = '';
      tokenInput.value = '';
      updateConnectionUi(false);
      repoSelect.innerHTML = '<option value="">-- Connect GitHub first to load repositories --</option>';
    }
  });

  // ─── Save Settings ────────────────────────────────────────────────────────
  saveSettingsBtn.addEventListener('click', async () => {
    const existing = await getConfig();

    const repository = repoCustom.value.trim();
    if (repository && !repository.includes('/')) {
      alert('Repository must be in "owner/repo" format (e.g. username/leetcode-solutions).');
      return;
    }

    const updated: GitHubConfig = {
      token: currentToken || existing?.token || '',
      username: existing?.username || '',
      repository,
      branch: branchInput.value.trim() || 'main',
      baseDirectory: baseDirInput.value.trim() || 'solutions',
      commitMessageTemplate:
        commitTemplate.value.trim() || 'LeetCode #{number} - {title} [{language}]',
      fileNamingTemplate: existing?.fileNamingTemplate || '{padded_number}-{slug}/{filename}',
      duplicateStrategy: duplicateStrategy.value as DuplicateStrategy,
      generateProblemReadme: genProblemReadme.checked,
      updateGlobalReadme: genGlobalReadme.checked,
      enableWorkflowGeneration: enableWorkflow.checked,          // Feature 4
      enableContestFolder: enableContestFolder.checked,           // Feature 10
      debugMode: debugMode.checked,
      // Feature 12: Co-author
      coAuthorName: coAuthorName.value.trim(),
      coAuthorEmail: coAuthorEmail.value.trim(),
      // Preserve existing fields that may not be in form
      folderStructure: existing?.folderStructure || 'default',
      includeBeatsStats: existing?.includeBeatsStats !== false,
      tagDailyChallenge: existing?.tagDailyChallenge !== false,
    };

    await saveConfig(updated);

    saveStatus.textContent = '✓ Settings saved successfully!';
    saveStatus.style.color = '#10b981';
    setTimeout(() => {
      saveStatus.textContent = '';
    }, 3500);
  });

  // ─── Initial Sync (Import Past Solutions) ─────────────────────────────────
  initialSyncBtn.addEventListener('click', async () => {
    const limit = initialSyncLimit.value as any;
    if (!currentToken || !repoCustom.value.trim()) {
      alert('Please connect your GitHub account and specify a repository first.');
      return;
    }

    if (!confirm(`Import up to ${limit} accepted solutions from your LeetCode profile to GitHub?`)) {
      return;
    }

    initialSyncBtn.disabled = true;
    initialSyncBtn.textContent = 'Importing...';
    initialSyncStatus.classList.remove('hidden');
    initialSyncStatus.textContent = 'Fetching accepted solutions from LeetCode...';

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'INITIAL_SYNC',
        payload: { limit },
      });

      initialSyncStatus.textContent = `✓ Import completed! Synced: ${res.synced}, Skipped: ${res.skipped}, Failed: ${res.failed}`;
      await loadHistory();
    } catch (err: any) {
      initialSyncStatus.textContent = `✕ Import error: ${err?.message || 'Failed'}`;
    } finally {
      initialSyncBtn.disabled = false;
      initialSyncBtn.textContent = 'Start Import';
    }
  });

  // ─── Feature 11: Skipped Problems List ────────────────────────────────────
  async function loadSkippedSlugs() {
    const slugs = await getSkippedSlugs();
    skippedSlugsList.innerHTML = '';

    if (slugs.length === 0) {
      skippedSlugsList.innerHTML = '<div class="text-center text-muted" style="padding:12px 0;">No problems skipped yet.</div>';
      return;
    }

    slugs.forEach((slug) => {
      const row = document.createElement('div');
      row.className = 'skipped-item';
      row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border); font-size:13px;';
      row.innerHTML = `
        <code style="color:var(--text-main);">${slug}</code>
        <button data-slug="${slug}" class="secondary-btn unskip-btn" style="font-size:11px; padding:4px 10px;">Remove</button>
      `;
      row.querySelector('.unskip-btn')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        const s = btn.dataset['slug']!;
        await removeSkippedSlug(s);
        await chrome.runtime.sendMessage({ type: 'UNSKIP_PROBLEM', payload: { slug: s } });
        await loadSkippedSlugs();
      });
      skippedSlugsList.appendChild(row);
    });
  }

  // ─── Feature 14: Export Backup ─────────────────────────────────────────────
  exportBackupBtn.addEventListener('click', async () => {
    try {
      const allData = await chrome.storage.local.get(null);
      // Redact token from export for security
      if (allData['leetpush_config']?.token) {
        allData['leetpush_config'] = {
          ...allData['leetpush_config'],
          token: '[REDACTED]',
        };
      }

      const json = JSON.stringify(allData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `leetpush_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err?.message || 'Unknown error'}`);
    }
  });

  // ─── Sync History Table ───────────────────────────────────────────────────
  async function loadHistory() {
    const history = await getSyncHistory();
    if (!history || history.length === 0) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted">No synchronization records yet.</td>
        </tr>
      `;
      return;
    }

    historyTableBody.innerHTML = '';
    history.forEach((rec: SyncRecord) => {
      const tr = document.createElement('tr');
      const date = new Date(rec.syncedAt).toLocaleString();

      const pillClass = rec.status === 'synced' ? 'synced' : rec.status === 'skipped' ? 'skipped' : 'failed';
      const statusLabel = rec.status.charAt(0).toUpperCase() + rec.status.slice(1);

      tr.innerHTML = `
        <td><span class="status-pill ${pillClass}">${statusLabel}</span></td>
        <td>${rec.problemNumber}</td>
        <td><strong>${rec.problemTitle}</strong></td>
        <td>${rec.language}</td>
        <td><code>${rec.githubPath || '–'}</code></td>
        <td class="text-muted">${date}</td>
      `;
      historyTableBody.appendChild(tr);
    });
  }

  clearHistoryBtn.addEventListener('click', async () => {
    if (confirm('Clear local sync history log? (This will not delete files from GitHub).')) {
      await chrome.storage.local.set({ leetpush_sync_history: [] });
      await loadHistory();
    }
  });

  await loadConfigData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
