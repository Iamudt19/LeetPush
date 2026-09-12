import { SubmissionDetector } from '../leetcode/submission-detector';
import type { AcceptedSubmission, Message, SubmissionAcceptedPayload } from '../types';
import { logger } from '../utils/logger';

/**
 * Modern floating toast on the LeetCode page to display live synchronization status
 */
class LeetPushToast {
  private element: HTMLDivElement | null = null;
  private timeoutId: number | null = null;

  public show(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info', durationMs = 4000): void {
    if (!this.element) {
      this.createElement();
    }
    if (!this.element) return;

    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
    }

    const icons: Record<string, string> = {
      info: '⚡',
      success: '✓',
      warn: '⚠️',
      error: '✕',
    };

    const colors: Record<string, { bg: string; border: string; text: string }> = {
      info: { bg: '#1e293b', border: '#38bdf8', text: '#f8fafc' },
      success: { bg: '#064e3b', border: '#10b981', text: '#ecfdf5' },
      warn: { bg: '#451a03', border: '#f59e0b', text: '#fffbeb' },
      error: { bg: '#4c0519', border: '#f43f5e', text: '#fff1f2' },
    };

    const currentStyle = colors[type];
    this.element.style.background = currentStyle.bg;
    this.element.style.borderColor = currentStyle.border;
    this.element.style.color = currentStyle.text;

    this.element.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-weight:700; font-size:14px;">LeetPush</span>
        <span style="font-size:14px;">${icons[type]}</span>
        <span style="font-size:13px; font-weight:500;">${message}</span>
      </div>
    `;

    this.element.style.opacity = '1';
    this.element.style.transform = 'translateY(0)';

    this.timeoutId = window.setTimeout(() => {
      this.hide();
    }, durationMs);
  }

  public hide(): void {
    if (this.element) {
      this.element.style.opacity = '0';
      this.element.style.transform = 'translateY(16px)';
    }
  }

  private createElement(): void {
    const el = document.createElement('div');
    el.id = 'leetpush-status-toast';
    el.style.position = 'fixed';
    el.style.bottom = '24px';
    el.style.right = '24px';
    el.style.zIndex = '999999';
    el.style.padding = '12px 18px';
    el.style.borderRadius = '8px';
    el.style.border = '1px solid #38bdf8';
    el.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)';
    el.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    el.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.pointerEvents = 'none';

    document.body.appendChild(el);
    this.element = el;
  }
}

// ─── Feature 2 & 1: Post-Sync Notes + Complexity Panel ──────────────────────

/**
 * Show a non-blocking floating panel after a successful sync.
 * Lets the user optionally add an approach note and complexity annotation.
 * Feature 11: also includes a "Skip this problem forever" button.
 */
function showNotePanel(submission: AcceptedSubmission): void {
  // Remove any existing panel
  document.getElementById('leetpush-note-panel')?.remove();

  const panel = document.createElement('div');
  panel.id = 'leetpush-note-panel';
  Object.assign(panel.style, {
    position: 'fixed',
    bottom: '90px',
    right: '24px',
    zIndex: '999998',
    width: '340px',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '12px',
    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.7)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    color: '#f8fafc',
    overflow: 'hidden',
    opacity: '0',
    transform: 'translateY(20px) scale(0.97)',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  });

  panel.innerHTML = `
    <div style="background:#1e293b; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155;">
      <div style="display:flex; align-items:center; gap:6px; font-weight:700;">
        <span style="font-size:14px;">⚡</span> LeetPush – Add Details
      </div>
      <button id="lp-panel-close" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px; padding:2px 6px; border-radius:4px;" title="Dismiss">✕</button>
    </div>
    <div style="padding:12px 14px; display:flex; flex-direction:column; gap:10px;">
      <div style="color:#94a3b8; font-size:11px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase;">
        #${submission.problem.number} ${submission.problem.title}
      </div>

      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:12px; color:#94a3b8;" for="lp-complexity-input">Complexity (optional)</label>
        <input
          id="lp-complexity-input"
          type="text"
          placeholder="e.g. Time: O(n log n) | Space: O(n)"
          style="background:#1e293b; border:1px solid #334155; border-radius:6px; color:#f8fafc; font-size:12px; padding:7px 10px; outline:none; width:100%; box-sizing:border-box;"
        />
      </div>

      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:12px; color:#94a3b8;" for="lp-notes-input">Approach Note (optional)</label>
        <textarea
          id="lp-notes-input"
          placeholder="Briefly describe your approach, key insights, or algorithm used..."
          rows="3"
          style="background:#1e293b; border:1px solid #334155; border-radius:6px; color:#f8fafc; font-size:12px; padding:7px 10px; outline:none; width:100%; box-sizing:border-box; resize:vertical; font-family:inherit;"
        ></textarea>
      </div>

      <div style="display:flex; gap:8px; align-items:center;">
        <button id="lp-save-note" style="background:#38bdf8; color:#0f172a; border:none; border-radius:6px; font-size:12px; font-weight:700; padding:7px 14px; cursor:pointer; flex:1; transition:background 0.2s;">
          Save
        </button>
        <button id="lp-skip-note" style="background:#334155; color:#94a3b8; border:none; border-radius:6px; font-size:12px; font-weight:600; padding:7px 10px; cursor:pointer; transition:background 0.2s;">
          Skip
        </button>
        <button id="lp-block-problem" style="background:transparent; border:1px solid #f43f5e33; color:#f43f5e; border-radius:6px; font-size:11px; font-weight:600; padding:7px 10px; cursor:pointer; white-space:nowrap;" title="Never push this problem again">
          ⊘ Skip Problem
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0) scale(1)';
    });
  });

  const closePanel = () => {
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(20px) scale(0.97)';
    setTimeout(() => panel.remove(), 300);
  };

  document.getElementById('lp-panel-close')?.addEventListener('click', closePanel);
  document.getElementById('lp-skip-note')?.addEventListener('click', closePanel);

  // Save note + complexity
  document.getElementById('lp-save-note')?.addEventListener('click', async () => {
    const complexity = (document.getElementById('lp-complexity-input') as HTMLInputElement)?.value.trim();
    const notes = (document.getElementById('lp-notes-input') as HTMLTextAreaElement)?.value.trim();

    if (complexity || notes) {
      try {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_SUBMISSION_NOTE',
          payload: { submissionId: submission.submissionId, notes, complexity },
        });
        // Visual feedback
        const saveBtn = document.getElementById('lp-save-note')!;
        saveBtn.textContent = '✓ Saved!';
        saveBtn.style.background = '#10b981';
        setTimeout(closePanel, 900);
      } catch (err) {
        logger.warn('Failed to save note', err);
        closePanel();
      }
    } else {
      closePanel();
    }
  });

  // Feature 11: Add to skip list
  document.getElementById('lp-block-problem')?.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({
        type: 'SKIP_PROBLEM',
        payload: { slug: submission.problem.slug },
      });
      const btn = document.getElementById('lp-block-problem')!;
      btn.textContent = '✓ Problem Skipped';
      btn.style.color = '#10b981';
      btn.style.borderColor = '#10b981';
      setTimeout(closePanel, 1500);
    } catch (err) {
      logger.warn('Failed to skip problem', err);
    }
  });

  // Auto-dismiss after 45 seconds
  setTimeout(closePanel, 45000);
}

/**
 * Handle SPA (Single Page Application) navigation in LeetCode
 */
function setupSpaNavigation(onNavigate: () => void): void {
  let lastUrl = window.location.href;

  const checkUrlChange = () => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      logger.info('SPA navigation detected:', currentUrl);
      onNavigate();
    }
  };

  // Intercept history.pushState and replaceState
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    checkUrlChange();
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    checkUrlChange();
  };

  window.addEventListener('popstate', checkUrlChange);
}

// ─── Content Script Initialization ──────────────────────────────────────────

const toast = new LeetPushToast();

function init(): void {
  logger.info('LeetPush content script loaded on LeetCode');

  const detector = new SubmissionDetector(async (submission: AcceptedSubmission) => {
    logger.info(`Sending accepted submission #${submission.submissionId} to background`);
    toast.show(`Accepted: #${submission.problem.number} ${submission.problem.title}. Syncing to GitHub...`, 'info', 5000);

    try {
      const message: Message<SubmissionAcceptedPayload> = {
        type: 'SUBMISSION_ACCEPTED',
        payload: { submission },
      };

      const response = await chrome.runtime.sendMessage(message).catch((err) => {
        logger.warn('Service worker message error:', err);
        return null;
      });

      if (response?.status === 'synced') {
        toast.show(`✓ Synced #${submission.problem.number} ${submission.problem.title} to GitHub`, 'success', 4000);
        // Feature 1 & 2: Show note/complexity panel after successful sync
        setTimeout(() => showNotePanel(submission), 1200);
      } else if (response?.status === 'skipped') {
        toast.show(`✓ Solution for #${submission.problem.number} already exists on GitHub`, 'info', 4000);
      } else if (response?.status === 'failed') {
        if (response.error?.includes('skip list')) {
          toast.show(`⊘ #${submission.problem.number} is on your skip list — not pushed`, 'warn', 5000);
        } else {
          toast.show(`✕ Sync failed: ${response.error || 'Check extension popup'}`, 'error', 6000);
        }
      }
    } catch (err: any) {
      logger.error('Failed to communicate with LeetPush service worker', err);
      toast.show(`⚠️ Background worker unavailable: ${err?.message || 'Queued for retry'}`, 'warn', 5000);
    }
  });

  // Start detector
  detector.start();

  // Watch for page transitions
  setupSpaNavigation(() => {
    // URL changed (e.g. user moved to a new problem)
    logger.debug('URL updated, detector active for current page');
    // Remove any lingering note panels on navigation
    document.getElementById('leetpush-note-panel')?.remove();
  });

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    detector.stop();
  });
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
