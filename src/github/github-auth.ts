import type { GitHubUser } from '../types';
import { getConfig, saveConfig } from '../storage/storage';
import { logger } from '../utils/logger';

/**
 * Validate a GitHub access token by querying /user
 * Returns user details if valid, throws on failure.
 */
export async function validateGitHubToken(token: string): Promise<GitHubUser> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    throw new Error('GitHub token cannot be empty');
  }

  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'LeetPush-Chrome-Extension',
    },
  });

  if (res.status === 401) {
    throw new Error('Invalid or expired GitHub token. Please verify your token.');
  }

  if (res.status === 403) {
    const rateLimitRemaining = res.headers.get('x-ratelimit-remaining');
    if (rateLimitRemaining === '0') {
      throw new Error('GitHub API rate limit exceeded. Please try again later.');
    }
    throw new Error('Permission denied. Ensure your token has "repo" scope.');
  }

  if (!res.ok) {
    throw new Error(`GitHub API error: HTTP ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return {
    login: data.login,
    name: data.name,
    avatar_url: data.avatar_url,
  };
}

/**
 * Authenticate using a GitHub Personal Access Token (Classic or Fine-Grained).
 * Verifies token validity and saves credentials securely in chrome.storage.local.
 */
export async function authenticateWithToken(token: string): Promise<GitHubUser> {
  const user = await validateGitHubToken(token);
  const currentConfig = await getConfig();

  await saveConfig({
    branch: currentConfig?.branch || 'main',
    baseDirectory: currentConfig?.baseDirectory || 'solutions',
    commitMessageTemplate:
      currentConfig?.commitMessageTemplate || 'LeetCode #{number} - {title} [{language}]',
    fileNamingTemplate:
      currentConfig?.fileNamingTemplate || '{padded_number}-{slug}/{filename}',
    duplicateStrategy: currentConfig?.duplicateStrategy || 'skip',
    folderStructure: currentConfig?.folderStructure || 'default',
    generateProblemReadme: currentConfig?.generateProblemReadme !== false,
    updateGlobalReadme: currentConfig?.updateGlobalReadme || false,
    includeBeatsStats: currentConfig?.includeBeatsStats !== false,
    tagDailyChallenge: currentConfig?.tagDailyChallenge !== false,
    debugMode: currentConfig?.debugMode || false,
    enableWorkflowGeneration: currentConfig?.enableWorkflowGeneration || false,
    enableContestFolder: currentConfig?.enableContestFolder !== false,
    coAuthorName: currentConfig?.coAuthorName || '',
    coAuthorEmail: currentConfig?.coAuthorEmail || '',
    token: token.trim(),
    username: user.login,
    repository: currentConfig?.repository || '',
  });

  logger.info(`Successfully authenticated GitHub user: ${user.login}`);
  return user;
}

/**
 * Disconnect GitHub account and clear credentials from storage.
 */
export async function disconnectGitHub(): Promise<void> {
  const current = await getConfig();
  if (current) {
    await saveConfig({
      ...current,
      token: '',
      username: '',
    });
  }
  logger.info('GitHub account disconnected');
}

/**
 * Check if the extension currently has a valid GitHub connection.
 */
export async function isAuthenticated(): Promise<boolean> {
  const config = await getConfig();
  return Boolean(config?.token && config?.username);
}
