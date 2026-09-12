import { logger } from '../utils/logger';

export interface SubmissionDetailsFromApi {
  submissionId: string;
  code: string;
  lang: string;
  runtime: string;
  memory: string;
  statusDisplay: string;
}

/**
 * Extracts the csrftoken cookie value required for LeetCode authenticated GraphQL queries.
 */
export function getCsrfToken(): string {
  try {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

/**
 * Fetch the latest accepted submission for a problem slug directly from LeetCode GraphQL.
 * Returns the submission ID and metadata.
 */
export async function fetchLatestAcceptedSubmissionForSlug(
  slug: string
): Promise<{ id: string; timestamp: number } | null> {
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

  try {
    const csrf = getCsrfToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (csrf) headers['x-csrftoken'] = csrf;

    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        query,
        variables: { limit: 10 },
      }),
    });

    if (!res.ok) {
      logger.warn(`recentAcSubmissionList query returned HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const list = data?.data?.recentAcSubmissionList;
    if (!Array.isArray(list)) return null;

    // Find the most recent submission matching this problem slug
    const match = list.find((item: any) => item.titleSlug === slug);
    if (match && match.id) {
      return {
        id: String(match.id),
        timestamp: parseInt(match.timestamp, 10) * 1000 || Date.now(),
      };
    }

    return null;
  } catch (err) {
    logger.warn('Failed to fetch recent accepted submissions list', err);
    return null;
  }
}

/**
 * Fetch the exact submitted code for a specific submission ID using LeetCode's GraphQL API.
 */
export async function fetchSubmittedCodeBySubmissionId(
  submissionId: string | number
): Promise<SubmissionDetailsFromApi | null> {
  const numericId = typeof submissionId === 'string' ? parseInt(submissionId, 10) : submissionId;
  if (!numericId || isNaN(numericId)) {
    logger.warn(`Invalid submission ID for code extraction: ${submissionId}`);
    return null;
  }

  const query = `
    query submissionDetails($submissionId: Int!) {
      submissionDetail(submissionId: $submissionId) {
        code
        timestamp
        statusDisplay
        lang {
          name
          verboseName
        }
        runtimeDisplay
        memoryDisplay
        runtimePercentile
        memoryPercentile
      }
    }
  `;

  try {
    const csrf = getCsrfToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (csrf) headers['x-csrftoken'] = csrf;

    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        query,
        variables: { submissionId: numericId },
      }),
    });

    if (!res.ok) {
      logger.warn(`GraphQL submissionDetail request failed with HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    const detail = json?.data?.submissionDetail;
    if (!detail || !detail.code) {
      logger.warn('GraphQL submissionDetail returned empty code', json);
      return null;
    }

    return {
      submissionId: String(numericId),
      code: detail.code,
      lang: detail.lang?.verboseName || detail.lang?.name || '',
      runtime: detail.runtimeDisplay || '',
      memory: detail.memoryDisplay || '',
      statusDisplay: detail.statusDisplay || '',
    };
  } catch (err) {
    logger.error('Failed to fetch submitted code via GraphQL', err);
    return null;
  }
}

/**
 * Fallback: Extract current code from Monaco Editor DOM elements
 */
export function extractCodeFromMonacoDom(): string | null {
  try {
    // Try accessing Monaco Editor model directly from window if accessible
    const win = window as any;
    if (win.monaco?.editor?.getModels) {
      const models = win.monaco.editor.getModels();
      if (models && models.length > 0) {
        const val = models[0].getValue();
        if (val && val.trim().length > 0) return val;
      }
    }
    // DOM Fallback (Note: view-lines only renders visible viewport lines due to virtual scrolling)
    const lines = document.querySelectorAll('.view-lines .view-line');
    if (lines && lines.length > 0) {
      const code = Array.from(lines)
        .map((l) => l.textContent || '')
        .join('\n');
      if (code.trim().length > 0) return code;
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Resolves the submitted source code.
 */
export async function resolveSubmittedCode(
  submissionId: string,
  initialCode?: string
): Promise<{ code: string; runtime?: string; memory?: string; language?: string } | null> {
  // 1. Initial code from intercepted check payload
  if (initialCode && initialCode.trim().length > 0) {
    return { code: initialCode };
  }

  // 2. Authoritative extraction via submission ID from LeetCode GraphQL
  if (submissionId) {
    const details = await fetchSubmittedCodeBySubmissionId(submissionId);
    if (details && details.code && details.code.trim().length > 0) {
      return {
        code: details.code,
        runtime: details.runtime,
        memory: details.memory,
        language: details.lang,
      };
    }
  }

  // 3. Fallback to Monaco editor DOM if API code retrieval failed
  const monacoCode = extractCodeFromMonacoDom();
  if (monacoCode && monacoCode.trim().length > 0) {
    logger.warn('Falling back to Monaco editor DOM for submitted code');
    return { code: monacoCode };
  }

  logger.error(
    `Could not retrieve submitted code for submission #${submissionId}.`
  );
  return null;
}
