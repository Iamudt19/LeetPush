import type {
  GitHubFileContent,
  GitHubCreateFileResponse,
  GitHubRepo,
  GitHubRateLimit,
} from '../types';
import { logger } from '../utils/logger';

const API_BASE = 'https://api.github.com';

/**
 * Base64 encode a UTF-8 string safely (handles Unicode characters without btoa errors).
 */
export function encodeUtf8Base64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 decode to a UTF-8 string safely.
 */
export function decodeUtf8Base64(base64: string): string {
  const cleaned = base64.replace(/\s/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Executes a GitHub API request with authentication, standard headers, and rate-limit parsing.
 */
async function githubFetch<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<{ data: T; headers: Headers }> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/vnd.github.v3+json');
  headers.set('User-Agent', 'LeetPush-Chrome-Extension');

  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
  if (rateLimitRemaining !== null && parseInt(rateLimitRemaining, 10) < 5) {
    logger.warn(`GitHub rate limit critically low: ${rateLimitRemaining} remaining`);
  }

  if (response.status === 401) {
    throw new Error('GitHub authentication failure: Token is invalid or revoked.');
  }

  if (response.status === 403) {
    if (rateLimitRemaining === '0') {
      const reset = response.headers.get('x-ratelimit-reset');
      const resetDate = reset ? new Date(parseInt(reset, 10) * 1000).toLocaleTimeString() : 'soon';
      throw new Error(`GitHub API rate limit exceeded. Resets at ${resetDate}.`);
    }
    throw new Error('GitHub permission denied. Verify repository permissions.');
  }

  if (!response.ok && response.status !== 404) {
    let errBody = '';
    try {
      const json = await response.json();
      errBody = json.message || response.statusText;
    } catch {
      errBody = response.statusText;
    }
    throw new Error(`GitHub API error (${response.status}): ${errBody}`);
  }

  if (response.status === 404) {
    return { data: null as unknown as T, headers: response.headers };
  }

  const data = await response.json();
  return { data, headers: response.headers };
}

/**
 * Generic retry wrapper with exponential backoff and jitter for transient network failures.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      // Do not retry on client authorization or 404 errors
      const msg = err?.message || '';
      if (
        msg.includes('401') ||
        msg.includes('invalid') ||
        msg.includes('rate limit exceeded')
      ) {
        throw err;
      }

      if (attempt < retries) {
        const jitter = Math.random() * 200;
        const sleepTime = delayMs * Math.pow(2, attempt - 1) + jitter;
        logger.warn(`GitHub API request failed (attempt ${attempt}/${retries}). Retrying in ${Math.round(sleepTime)}ms...`, err);
        await new Promise((resolve) => setTimeout(resolve, sleepTime));
      }
    }
  }
  throw lastError;
}

export class GitHubApi {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * List repositories accessible to the user (sorted by updated date).
   */
  public async listRepositories(): Promise<GitHubRepo[]> {
    const { data } = await githubFetch<GitHubRepo[]>(
      '/user/repos?sort=updated&per_page=100&type=all',
      this.token
    );
    return data || [];
  }

  /**
   * Verify repository exists and user has write access.
   */
  public async verifyRepository(owner: string, repo: string): Promise<{ exists: boolean; defaultBranch: string }> {
    const { data } = await githubFetch<GitHubRepo>(`/repos/${owner}/${repo}`, this.token);
    if (!data) {
      return { exists: false, defaultBranch: 'main' };
    }
    return { exists: true, defaultBranch: data.default_branch || 'main' };
  }

  /**
   * Get an existing file from a repository. Returns null if file does not exist (HTTP 404).
   */
  public async getFile(
    owner: string,
    repo: string,
    path: string,
    branch?: string
  ): Promise<GitHubFileContent | null> {
    const query = branch ? `?ref=${encodeURIComponent(branch)}` : '';
    const cleanPath = path.replace(/^\/+/, '');
    const { data } = await githubFetch<GitHubFileContent>(
      `/repos/${owner}/${repo}/contents/${cleanPath}${query}`,
      this.token
    );
    return data;
  }

  /**
   * Create or update a file in a repository.
   * If `sha` is provided, updates the existing file; otherwise creates a new file.
   */
  public async createOrUpdateFile(params: {
    owner: string;
    repo: string;
    path: string;
    content: string; // Plain text content (will be UTF-8 base64 encoded)
    message: string;
    branch?: string;
    sha?: string;
  }): Promise<GitHubCreateFileResponse> {
    const cleanPath = params.path.replace(/^\/+/, '');
    const encoded = encodeUtf8Base64(params.content);

    const body: Record<string, unknown> = {
      message: params.message,
      content: encoded,
    };

    if (params.sha) {
      body.sha = params.sha;
    }
    if (params.branch) {
      body.branch = params.branch;
    }

    return withRetry(async () => {
      const { data } = await githubFetch<GitHubCreateFileResponse>(
        `/repos/${params.owner}/${params.repo}/contents/${cleanPath}`,
        this.token,
        {
          method: 'PUT',
          body: JSON.stringify(body),
        }
      );
      return data;
    });
  }

  /**
   * Check current API rate limit status.
   */
  public async getRateLimit(): Promise<GitHubRateLimit> {
    const { data } = await githubFetch<{ rate: GitHubRateLimit }>('/rate_limit', this.token);
    return data.rate;
  }
}
