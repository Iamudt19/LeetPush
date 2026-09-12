import { getConfig } from '../storage/storage';

const PREFIX = '[LeetPush]';

/**
 * Token and secret sanitizer. Ensures no tokens or sensitive headers leak into logs.
 */
function sanitize(arg: unknown): unknown {
  if (typeof arg === 'string') {
    // Redact Bearer tokens, GitHub personal tokens (ghp_, gho_, etc.)
    return arg
      .replace(/Bearer\s+[A-Za-z0-9_.~+-]+/gi, 'Bearer [REDACTED]')
      .replace(/gh[pousr]_[A-Za-z0-9_]{20,}/g, '[REDACTED_GH_TOKEN]');
  }
  if (typeof arg === 'object' && arg !== null) {
    if (Array.isArray(arg)) {
      return arg.map(sanitize);
    }
    const cleanObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(arg)) {
      const lower = key.toLowerCase();
      if (
        lower.includes('token') ||
        lower.includes('secret') ||
        lower.includes('auth') ||
        lower.includes('password')
      ) {
        cleanObj[key] = '[REDACTED]';
      } else {
        cleanObj[key] = sanitize(value);
      }
    }
    return cleanObj;
  }
  return arg;
}

export const logger = {
  async debug(...args: unknown[]): Promise<void> {
    try {
      const config = await getConfig();
      if (config?.debugMode) {
        const sanitized = args.map(sanitize);
        console.debug(PREFIX, ...sanitized);
      }
    } catch {
      // Chrome storage might not be accessible in all contexts
    }
  },

  info(...args: unknown[]): void {
    const sanitized = args.map(sanitize);
    console.info(PREFIX, ...sanitized);
  },

  warn(...args: unknown[]): void {
    const sanitized = args.map(sanitize);
    console.warn(PREFIX, ...sanitized);
  },

  error(...args: unknown[]): void {
    const sanitized = args.map(sanitize);
    console.error(PREFIX, ...sanitized);
  },
};
