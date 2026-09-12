import type { AcceptedSubmission, ProblemInfo } from '../types';
import { logger } from '../utils/logger';
import { extractSlugFromUrl, resolveProblemInfo } from './problem-parser';
import {
  resolveSubmittedCode,
  fetchLatestAcceptedSubmissionForSlug,
} from './code-parser';
import { getLanguageMeta } from '../utils/language';

/**
 * Feature 10: Extract contest slug from current URL.
 * Matches: /contest/weekly-contest-412/problems/two-sum/
 * Returns null if not a contest URL.
 */
function extractContestSlugFromUrl(url: string = window.location.href): string | null {
  try {
    const match = url.match(/\/contest\/([^/]+)\/problems\//);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export type SubmissionAcceptedCallback = (submission: AcceptedSubmission) => void;

export class SubmissionDetector {
  private onAcceptedCallback: SubmissionAcceptedCallback;
  private processedIds = new Set<string>();
  private domObserver: MutationObserver | null = null;
  private isRunning = false;
  private isPollingAfterSubmit = false;

  constructor(onAccepted: SubmissionAcceptedCallback) {
    this.onAcceptedCallback = onAccepted;
  }

  /**
   * Start listening for submissions via network events, DOM observer, and click tracking.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.setupEventListener();
    this.setupDomObserver();
    this.setupSubmitButtonListener();
    logger.info('Submission detector active with multi-layer detection');
  }

  /**
   * Stop detection and clean up observers and listeners.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }
    window.removeEventListener('LEETPUSH_SUBMISSION_EVENT', this.handleNetworkEvent);
  }

  /**
   * Listen for events dispatched from the main-world interceptor script.
   */
  private setupEventListener(): void {
    window.addEventListener('LEETPUSH_SUBMISSION_EVENT', this.handleNetworkEvent);
  }

  private handleNetworkEvent = async (event: Event): Promise<void> => {
    try {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      if (!detail || !detail.data) return;

      const data = detail.data;
      logger.info('Received network submission event:', detail.source);

      // Handle classic check endpoint data
      if (
        data.status_msg === 'Accepted' ||
        data.state === 'SUCCESS' ||
        data.status_code === 10
      ) {
        const submissionId = String(
          data.submission_id || this.extractSubmissionIdFromUrl(detail.url) || ''
        );
        if (submissionId) {
          await this.handleAcceptedSubmission({
            submissionId,
            code: data.code,
            lang: data.lang,
            runtime: data.status_runtime || data.runtime || '',
            memory: data.status_memory || data.memory || '',
          });
        } else {
          // If submissionId wasn't in payload, poll via GraphQL
          this.triggerActivePollForAccepted();
        }
      }
    } catch (err) {
      logger.error('Error processing network submission event', err);
    }
  };

  /**
   * Track clicks on the "Submit" button to activate rapid polling for the result.
   */
  private setupSubmitButtonListener(): void {
    document.addEventListener(
      'click',
      (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;

        // Check if clicked element or its parent is the submit button
        const submitBtn = target.closest(
          '[data-e2e-locator="console-submit-button"], button[class*="submit"], button'
        );

        if (submitBtn && submitBtn.textContent?.trim().toLowerCase().includes('submit')) {
          logger.info('User clicked LeetCode Submit button. Starting active watcher...');
          this.triggerActivePollForAccepted();
        }
      },
      true
    );
  }

  /**
   * Active polling: runs after Submit is clicked or when Accepted is detected in DOM.
   * Polls LeetCode GraphQL recentAcSubmissionList every 1.5s for up to 25 seconds.
   */
  public triggerActivePollForAccepted(): void {
    if (this.isPollingAfterSubmit) return;
    this.isPollingAfterSubmit = true;

    const slug = extractSlugFromUrl();
    if (!slug) {
      this.isPollingAfterSubmit = false;
      return;
    }

    const startTime = Date.now();
    let attempts = 0;
    const maxAttempts = 15;

    const interval = window.setInterval(async () => {
      attempts++;
      logger.debug(`Polling for accepted submission (attempt ${attempts}/${maxAttempts})...`);

      // Check if DOM shows Accepted
      const domAccepted = this.isDomShowingAccepted();

      // Check LeetCode GraphQL for recently accepted submission of this problem
      const latest = await fetchLatestAcceptedSubmissionForSlug(slug);

      if (latest && latest.id && !this.processedIds.has(latest.id)) {
        // Ensure submission was made recently (within last 3 minutes)
        if (latest.timestamp > startTime - 180000) {
          window.clearInterval(interval);
          this.isPollingAfterSubmit = false;
          logger.info(`Detected fresh accepted submission via GraphQL: #${latest.id}`);
          await this.handleAcceptedSubmission({ submissionId: latest.id });
          return;
        }
      }

      // Check if DOM has submission link or URL changed
      const urlMatch = window.location.href.match(/\/submissions\/(\d+)/);
      if (urlMatch && urlMatch[1] && !this.processedIds.has(urlMatch[1]) && domAccepted) {
        window.clearInterval(interval);
        this.isPollingAfterSubmit = false;
        logger.info(`Detected accepted submission via URL match: #${urlMatch[1]}`);
        await this.handleAcceptedSubmission({ submissionId: urlMatch[1] });
        return;
      }

      if (attempts >= maxAttempts) {
        window.clearInterval(interval);
        this.isPollingAfterSubmit = false;
        logger.debug('Active submission polling ended');
      }
    }, 1500);
  }

  /**
   * MutationObserver monitoring DOM for the "Accepted" text badge.
   * Safe to run at document_start (uses documentElement if body is not ready).
   */
  private setupDomObserver(): void {
    let debounceTimer: number | null = null;

    this.domObserver = new MutationObserver(() => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        this.checkDomForAccepted();
      }, 600);
    });

    const targetNode = document.body || document.documentElement;
    if (targetNode) {
      this.domObserver.observe(targetNode, {
        childList: true,
        subtree: true,
      });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (this.domObserver && document.body) {
          this.domObserver.observe(document.body, {
            childList: true,
            subtree: true,
          });
        }
      });
    }
  }

  /**
   * Returns true if the DOM currently contains an "Accepted" verdict.
   */
  private isDomShowingAccepted(): boolean {
    const selectors = [
      '[data-e2e-locator="submission-result"]',
      'span[class*="text-green"]',
      'span[class*="text-olive"]',
      'div[class*="text-green"]',
      'div[class*="text-olive"]',
      'div[class*="text-sd-easy"]',
      'div.text-green-s',
    ];

    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel);
      for (const el of Array.from(elements)) {
        if (el.textContent?.trim() === 'Accepted') {
          return true;
        }
      }
    }

    // Secondary scan across any heading or strong element with exact "Accepted" text
    const headers = document.querySelectorAll('h1, h2, h3, h4, span, div');
    for (let i = 0; i < Math.min(headers.length, 300); i++) {
      const text = headers[i].textContent?.trim();
      if (text === 'Accepted') {
        return true;
      }
    }

    return false;
  }

  /**
   * Scan DOM when mutation occurs.
   */
  private async checkDomForAccepted(): Promise<void> {
    if (!this.isDomShowingAccepted()) return;

    // Check if URL contains submission ID
    const urlMatch = window.location.href.match(/\/submissions\/(\d+)/);
    if (urlMatch && urlMatch[1] && !this.processedIds.has(urlMatch[1])) {
      await this.handleAcceptedSubmission({ submissionId: urlMatch[1] });
      return;
    }

    // Check if any link on page contains /submissions/ or /submissions/detail/
    const links = document.querySelectorAll<HTMLAnchorElement>(
      'a[href*="/submissions/"], a[href*="/submissions/detail/"]'
    );
    for (const link of Array.from(links)) {
      const match = link.href.match(/\/submissions\/(?:detail\/)?(\d+)/);
      if (match && match[1] && !this.processedIds.has(match[1])) {
        await this.handleAcceptedSubmission({ submissionId: match[1] });
        return;
      }
    }

    // If "Accepted" is visible but no direct submission ID link exists in the DOM,
    // trigger active polling via GraphQL
    this.triggerActivePollForAccepted();
  }

  /**
   * Parse submissionId from URL e.g. /submissions/detail/123456789/check/
   */
  private extractSubmissionIdFromUrl(url: string): string | null {
    const match = url.match(/\/submissions\/(?:detail\/)?(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Full pipeline when an accepted submission is detected:
   * 1. Dedup check
   * 2. Problem extraction
   * 3. Submitted code resolution
   * 4. Trigger callback
   */
  private async handleAcceptedSubmission(raw: {
    submissionId: string;
    code?: string;
    lang?: string;
    runtime?: string;
    memory?: string;
  }): Promise<void> {
    const { submissionId } = raw;
    if (this.processedIds.has(submissionId)) {
      return;
    }
    this.processedIds.add(submissionId);

    logger.info(`Processing confirmed accepted submission: #${submissionId}`);

    const slug = extractSlugFromUrl();
    if (!slug) {
      logger.error(`Could not determine problem slug for submission #${submissionId}`);
      return;
    }

    // Step 1: Resolve problem info (GraphQL + DOM fallback)
    const problem: ProblemInfo = await resolveProblemInfo(slug);

    // Step 2: Resolve submitted source code (GraphQL + Monaco DOM fallback)
    const codeResult = await resolveSubmittedCode(submissionId, raw.code);
    if (!codeResult || !codeResult.code) {
      logger.error(`Failed to retrieve submitted code for #${submissionId}`);
      return;
    }

    // Step 3: Determine language
    let rawLang = raw.lang || codeResult.language || '';
    if (!rawLang) {
      // Try to detect language from LeetCode UI button
      const langBtn = document.querySelector('button[id*="headlessui-listbox-button"]');
      if (langBtn && langBtn.textContent) {
        rawLang = langBtn.textContent.trim();
      }
    }
    const langMeta = getLanguageMeta(rawLang);

    const acceptedSubmission: AcceptedSubmission = {
      submissionId,
      problem,
      language: langMeta.name,
      langSlug: rawLang,
      code: codeResult.code,
      runtime: raw.runtime || codeResult.runtime || '',
      memory: raw.memory || codeResult.memory || '',
      contestSlug: extractContestSlugFromUrl() ?? undefined,  // Feature 10
      submittedAt: Date.now(),
    };

    logger.info(`Ready to sync: #${problem.number} ${problem.title} [${langMeta.name}]`);
    this.onAcceptedCallback(acceptedSubmission);
  }
}
