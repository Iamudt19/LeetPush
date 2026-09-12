/**
 * Convert a title to a clean, URL-safe and filesystem-safe slug.
 * Removes forbidden characters: / \ : * ? " < > | and strips non-ASCII or unsafe punctuation.
 */
export function slugify(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .trim()
    // Replace forbidden characters and punctuation with space or dash
    .replace(/[/\\:*?"<>|#]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Pad problem number to 4 digits (e.g. 1 -> "0001", 123 -> "0123", 1450 -> "1450")
 */
export function padProblemNumber(num: number): string {
  if (num < 0) return '0000';
  return String(num).padStart(4, '0');
}

/**
 * Generates the folder name for a problem directory.
 * e.g., 1, "Two Sum" -> "0001-two-sum"
 */
export function getProblemFolderName(num: number, slugOrTitle: string): string {
  const safeSlug = slugify(slugOrTitle);
  const padded = padProblemNumber(num);
  return `${padded}-${safeSlug}`;
}

/**
 * Replace template placeholders in path or commit message.
 * Supported tokens: {number}, {padded_number}, {title}, {slug}, {language}, {filename}
 */
export function renderTemplate(
  template: string,
  data: {
    number: number;
    title: string;
    slug: string;
    language: string;
    filename?: string;
  }
): string {
  return template
    .replace(/\{number\}/g, String(data.number))
    .replace(/\{padded_number\}/g, padProblemNumber(data.number))
    .replace(/\{title\}/g, data.title)
    .replace(/\{slug\}/g, data.slug)
    .replace(/\{language\}/g, data.language)
    .replace(/\{filename\}/g, data.filename || '');
}
