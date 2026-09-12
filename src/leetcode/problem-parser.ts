import type { ProblemInfo } from '../types';
import { logger } from '../utils/logger';

/** Cache of fetched problem metadata keyed by slug to avoid redundant network calls */
const problemCache = new Map<string, ProblemInfo>();

/**
 * Convert LeetCode HTML problem statement into clean GitHub-flavored Markdown.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  return html
    // Handle preformatted code blocks: <pre> ... </pre>
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => {
      const cleanCode = code
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
      return `\n\n\`\`\`text\n${cleanCode}\n\`\`\`\n\n`;
    })
    // Inline code: <code>...</code>
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    // Bold: <strong>...</strong>, <b>...</b>
    .replace(/<(?:strong|b)[^>]*>(.*?)<\/(?:strong|b)>/gi, '**$1**')
    // Italics: <em>...</em>, <i>...</i>
    .replace(/<(?:em|i)[^>]*>(.*?)<\/(?:em|i)>/gi, '*$1*')
    // Subscripts & Superscripts
    .replace(/<sup[^>]*>(.*?)<\/sup>/gi, '^$1')
    .replace(/<sub[^>]*>(.*?)<\/sub>/gi, '_$1')
    // List items: <li>...</li>
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    // Paragraphs & Line Breaks
    .replace(/<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    // HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Strip remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Clean up excessive whitespace and blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract problem slug from current or given URL.
 * e.g., 'https://leetcode.com/problems/two-sum/submissions/' -> 'two-sum'
 */
export function extractSlugFromUrl(url: string = window.location.href): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/problems\/([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Parse problem title and number from a combined string like "1. Two Sum" or "1024. Video Stitching"
 */
export function parseProblemTitleString(raw: string): { number: number; title: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d+)\s*[\.\-:]\s*(.+)$/);
  if (match && match[1] && match[2]) {
    return {
      number: parseInt(match[1], 10),
      title: match[2].trim(),
    };
  }
  return {
    number: 0,
    title: trimmed,
  };
}

/**
 * Fallback: extract problem metadata from DOM elements on the LeetCode problem page.
 */
export function extractProblemInfoFromDom(slug: string): ProblemInfo {
  let number = 0;
  let title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  let difficulty: ProblemInfo['difficulty'] = 'Unknown';
  const topics: string[] = [];

  // Try multiple selector patterns used across different LeetCode UI revisions
  const titleSelectors = [
    'div[data-cy="question-title"]',
    'a[href*="/problems/' + slug + '"]',
    '.text-title-large',
    'h4[data-cypress="QuestionTitle"]',
    '[class*="title__"]',
    'div.flex.items-start.justify-between h1',
    'div.flex.items-start.justify-between a',
  ];

  for (const selector of titleSelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent) {
      const parsed = parseProblemTitleString(el.textContent);
      if (parsed.number > 0) {
        number = parsed.number;
        title = parsed.title;
        break;
      }
    }
  }

  // Difficulty badge detection
  const diffSelectors = [
    'div[class*="text-difficulty-"]',
    'div[class*="text-olive"]', // Easy
    'div[class*="text-yellow"]', // Medium
    'div[class*="text-pink"]',   // Hard
    'span[data-degree]',
    'div[data-difficulty]',
  ];

  for (const sel of diffSelectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim().toLowerCase();
    if (text?.includes('easy')) {
      difficulty = 'Easy';
      break;
    } else if (text?.includes('medium')) {
      difficulty = 'Medium';
      break;
    } else if (text?.includes('hard')) {
      difficulty = 'Hard';
      break;
    }
  }

  // Topic tags detection
  const tagElements = document.querySelectorAll('a[href*="/tag/"]');
  tagElements.forEach((el) => {
    const tag = el.textContent?.trim();
    if (tag && !topics.includes(tag)) {
      topics.push(tag);
    }
  });

  // Extract description from DOM if present
  let description: string | undefined = undefined;
  const descEl = document.querySelector(
    '[data-track-load="description_content"], div[class*="elfjS"], .question-content'
  );
  if (descEl && descEl.innerHTML) {
    description = htmlToMarkdown(descEl.innerHTML);
  }

  return {
    number,
    title,
    slug,
    url: `https://leetcode.com/problems/${slug}/`,
    difficulty,
    topics,
    description,
  };
}

/**
 * Fetch authoritative problem info via LeetCode GraphQL API.
 * Retrieves title, frontendId, difficulty, topic tags, and the full question content statement.
 */
export async function fetchProblemInfoViaGraphQL(slug: string): Promise<ProblemInfo | null> {
  if (problemCache.has(slug)) {
    return problemCache.get(slug)!;
  }

  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        questionFrontendId
        title
        titleSlug
        content
        difficulty
        topicTags {
          name
          slug
        }
        companyTagStats
      }
    }
  `;

  try {
    const csrfMatch = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (csrfMatch && csrfMatch[1]) {
      headers['x-csrftoken'] = csrfMatch[1];
    }

    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        variables: { titleSlug: slug },
      }),
    });

    if (!res.ok) {
      logger.warn(`GraphQL question query returned HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const q = data?.data?.question;
    if (!q) return null;

    // Feature 7: Parse company tags from companyTagStats JSON string
    let companyTags: string[] = [];
    if (q.companyTagStats) {
      try {
        const parsed = typeof q.companyTagStats === 'string'
          ? JSON.parse(q.companyTagStats)
          : q.companyTagStats;
        // companyTagStats is an object keyed by timeframe ("1","2","3")
        const allTags = Object.values(parsed).flat() as Array<{ name: string }>;
        companyTags = [...new Set(allTags.map((t) => t.name))].sort();
      } catch {
        companyTags = [];
      }
    }

    const info: ProblemInfo = {
      number: parseInt(q.questionFrontendId, 10) || 0,
      title: q.title || slug,
      slug: q.titleSlug || slug,
      url: `https://leetcode.com/problems/${q.titleSlug || slug}/`,
      difficulty: (q.difficulty as ProblemInfo['difficulty']) || 'Unknown',
      topics: (q.topicTags || []).map((t: { name: string }) => t.name),
      companyTags,
      description: q.content ? htmlToMarkdown(q.content) : undefined,
    };

    problemCache.set(slug, info);
    return info;
  } catch (err) {
    logger.warn('Failed to fetch problem info via GraphQL, using fallback', err);
    return null;
  }
}

/**
 * Resolves full ProblemInfo by combining GraphQL and DOM fallback.
 */
export async function resolveProblemInfo(slug: string): Promise<ProblemInfo> {
  const cached = problemCache.get(slug);
  if (cached) return cached;

  const gqlInfo = await fetchProblemInfoViaGraphQL(slug);
  if (gqlInfo && gqlInfo.number > 0) {
    return gqlInfo;
  }

  // DOM fallback
  const domInfo = extractProblemInfoFromDom(slug);
  if (gqlInfo) {
    return {
      ...gqlInfo,
      number: gqlInfo.number > 0 ? gqlInfo.number : domInfo.number,
      difficulty: gqlInfo.difficulty !== 'Unknown' ? gqlInfo.difficulty : domInfo.difficulty,
      topics: gqlInfo.topics.length > 0 ? gqlInfo.topics : domInfo.topics,
      description: gqlInfo.description || domInfo.description,
    };
  }

  return domInfo;
}

/**
 * Checks if the given problem slug is LeetCode's active Daily Challenge question.
 */
export async function checkIfDailyChallenge(slug: string): Promise<boolean> {
  const query = `
    query questionOfToday {
      activeDailyCodingChallengeQuestion {
        question {
          titleSlug
        }
      }
    }
  `;

  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (res.ok) {
      const data = await res.json();
      const dailySlug = data?.data?.activeDailyCodingChallengeQuestion?.question?.titleSlug;
      return dailySlug === slug;
    }
  } catch {
    // Ignore
  }
  return false;
}
