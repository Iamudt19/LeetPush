import type {
  AcceptedSubmission,
  GitHubConfig,
  SyncRecord,
  SyncStatus,
} from '../types';
import { GitHubApi, decodeUtf8Base64 } from './github-api';
import {
  isSubmissionSynced,
  markSubmissionSynced,
  addSyncRecord,
  incrementSynced,
  incrementFailed,
  hasWorkflowBeenGenerated,
  markWorkflowGenerated,
} from '../storage/storage';
import { getSolutionFilename, getLanguageMeta } from '../utils/language';
import { padProblemNumber, renderTemplate, slugify } from '../utils/slugify';
import { logger } from '../utils/logger';
import { generateWorkflowFile } from './github-workflow';

export interface SyncResult {
  status: SyncStatus;
  path: string;
  commitUrl?: string;
  error?: string;
}

// ─── Complexity Comment Helpers ───────────────────────────────────────────────

/**
 * Feature 1: Language-aware complexity comment prefix.
 */
function buildComplexityComment(complexity: string, langSlug: string): string {
  const lang = langSlug.toLowerCase();
  const prefix =
    lang === 'python' || lang === 'python3' || lang === 'ruby' || lang === 'elixir'
      ? '#'
      : lang === 'sql'
      ? '--'
      : '//';
  return `${prefix} ${complexity}\n`;
}

/**
 * Feature 1: Prepend complexity annotation to code if not already present.
 */
function annotateCodeWithComplexity(code: string, complexity: string, langSlug: string): string {
  if (!complexity) return code;
  // Avoid double-annotation
  if (code.trimStart().startsWith('// Time:') || code.trimStart().startsWith('# Time:')) {
    return code;
  }
  const comment = buildComplexityComment(complexity, langSlug);
  return `${comment}${code}`;
}

// ─── README Generators ────────────────────────────────────────────────────────

/**
 * Generate problem-specific README markdown content.
 * Features 1, 2, 7 are included here.
 */
export function generateProblemReadmeContent(submission: AcceptedSubmission): string {
  const { problem, language, runtime, memory, submittedAt } = submission;
  const dateStr = new Date(submittedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const topicsList =
    problem.topics.length > 0
      ? problem.topics.map((t) => `\`${t}\``).join(' ')
      : 'None';

  // Feature 7: company tags section
  const companySection =
    problem.companyTags && problem.companyTags.length > 0
      ? `\n## Companies\n\n${problem.companyTags.map((c) => `\`${c}\``).join(' ')}\n`
      : '';

  // Feature 2: approach/notes section
  const notesSection = submission.notes
    ? `\n## Approach\n\n${submission.notes}\n`
    : '';

  // Feature 1: complexity section
  const complexitySection = submission.complexity
    ? `\n## Complexity\n\n${submission.complexity}\n`
    : '';

  const descriptionSection = problem.description
    ? `\n## Problem Statement\n\n${problem.description}\n`
    : '';

  const codeToShow = submission.complexity
    ? annotateCodeWithComplexity(submission.code, submission.complexity, submission.langSlug)
    : submission.code;

  return `# LeetCode #${problem.number} - ${problem.title}

- **Difficulty:** ${problem.difficulty}
- **Language:** ${language}
- **Runtime:** ${runtime || 'N/A'}
- **Memory:** ${memory || 'N/A'}
- **Date:** ${dateStr}
- **Problem Link:** [LeetCode](${problem.url})
- **Topics:** ${topicsList}
${companySection}${notesSection}${complexitySection}${descriptionSection}
## Solution

\`\`\`${getLanguageMeta(submission.langSlug).monacoLanguage}
${codeToShow}
\`\`\`
`;
}

/**
 * Update or generate a global markdown table in README.md.
 */
export function updateGlobalReadmeContent(existingContent: string, submission: AcceptedSubmission, relativeFilePath: string): string {
  const { problem, language } = submission;
  const difficultyEmoji = problem.difficulty === 'Easy' ? '🟢' : problem.difficulty === 'Medium' ? '🟡' : problem.difficulty === 'Hard' ? '🔴' : '⚪';
  const row = `| ${problem.number} | [${problem.title}](${problem.url}) | ${difficultyEmoji} ${problem.difficulty} | ${language} | [Solution](${relativeFilePath}) |`;

  const header = `# LeetCode Solutions\n\nAutomatically synchronized from LeetCode via **LeetPush**.\n\n| # | Problem | Difficulty | Language | Solution |\n|---|---------|------------|----------|----------|`;

  if (!existingContent || !existingContent.includes('| # | Problem |')) {
    return `${header}\n${row}\n`;
  }

  // Check if problem already exists in table
  const lines = existingContent.split('\n');
  const problemRegex = new RegExp(`\\|\\s*${problem.number}\\s*\\|`);
  const existingRowIdx = lines.findIndex((l) => problemRegex.test(l));

  if (existingRowIdx !== -1) {
    // Replace row with latest solution link
    lines[existingRowIdx] = row;
    return lines.join('\n');
  }

  // Insert in sorted order by problem number
  let insertIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^\|\s*(\d+)\s*\|/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > problem.number) {
        insertIdx = i;
        break;
      }
    }
  }

  if (insertIdx !== -1) {
    lines.splice(insertIdx, 0, row);
    return lines.join('\n');
  } else {
    // Append at the end of the table
    return `${existingContent.trim()}\n${row}\n`;
  }
}

// ─── Path Resolution ──────────────────────────────────────────────────────────

/**
 * Feature 5: Resolve the problem folder path according to the configured folder structure.
 * - 'default'    → solutions/0001-two-sum/
 * - 'difficulty' → solutions/easy/0001-two-sum/
 * - 'topic'      → solutions/array/0001-two-sum/
 */
function resolveProblemFolder(
  submission: AcceptedSubmission,
  config: GitHubConfig
): string {
  const { problem } = submission;
  const baseDir = (config.baseDirectory || 'solutions').replace(/\/+$/, '');
  const problemFolder = `${padProblemNumber(problem.number)}-${slugify(problem.slug || problem.title)}`;

  // Feature 10: Contest folder
  if (submission.contestSlug && config.enableContestFolder !== false) {
    return `contests/${slugify(submission.contestSlug)}/${problemFolder}`;
  }

  switch (config.folderStructure) {
    case 'difficulty':
      return `${baseDir}/${problem.difficulty.toLowerCase()}/${problemFolder}`;
    case 'topic': {
      const tag = problem.topics[0] ? slugify(problem.topics[0]) : 'uncategorized';
      return `${baseDir}/${tag}/${problemFolder}`;
    }
    default:
      return `${baseDir}/${problemFolder}`;
  }
}

// ─── Commit Message ───────────────────────────────────────────────────────────

/**
 * Feature 12: Build commit message with optional co-author trailer.
 */
function buildCommitMessage(
  template: string,
  submission: AcceptedSubmission,
  defaultFilename: string,
  config: GitHubConfig
): string {
  const { problem, language } = submission;
  let msg = renderTemplate(template || 'LeetCode #{number} - {title} [{language}]', {
    number: problem.number,
    title: problem.title,
    slug: problem.slug,
    language,
    filename: defaultFilename,
  });

  if (config.coAuthorName && config.coAuthorEmail) {
    msg += `\n\nCo-authored-by: ${config.coAuthorName} <${config.coAuthorEmail}>`;
  }

  return msg;
}

// ─── Core Sync Orchestrator ───────────────────────────────────────────────────

/**
 * Core orchestrator for synchronizing an accepted LeetCode solution to GitHub.
 * Features 1, 2, 4, 5, 6, 7, 10, 12 are applied here.
 */
export async function syncSubmission(
  submission: AcceptedSubmission,
  config: GitHubConfig
): Promise<SyncResult> {
  const { problem, language, submissionId } = submission;
  logger.info(`Starting sync for #${problem.number} ${problem.title} (${submissionId})`);

  // Step 1: Check fast-path local deduplication
  if (await isSubmissionSynced(submissionId)) {
    logger.info(`Submission #${submissionId} is already marked as synced in local database`);
    return {
      status: 'skipped',
      path: '',
    };
  }

  // Validate GitHub configuration
  if (!config.token || !config.repository) {
    const errMsg = 'GitHub is not configured. Missing personal access token or repository name.';
    logger.error(errMsg);
    await recordSyncFailure(submission, '', errMsg);
    return { status: 'failed', path: '', error: errMsg };
  }

  const [owner, repo] = config.repository.split('/');
  if (!owner || !repo) {
    const errMsg = `Invalid repository format "${config.repository}". Expected "owner/repo".`;
    logger.error(errMsg);
    await recordSyncFailure(submission, '', errMsg);
    return { status: 'failed', path: '', error: errMsg };
  }

  const api = new GitHubApi(config.token);
  const langMeta = getLanguageMeta(submission.langSlug);
  const defaultFilename = getSolutionFilename(submission.langSlug);

  // Step 2: Determine file path
  const problemFolderPath = resolveProblemFolder(submission, config);
  let targetPath = `${problemFolderPath}/${defaultFilename}`;

  // Apply custom template if specified (overrides folder structure for filename part only)
  if (config.fileNamingTemplate && config.fileNamingTemplate !== '{padded_number}-{slug}/{filename}') {
    const rendered = renderTemplate(config.fileNamingTemplate, {
      number: problem.number,
      title: problem.title,
      slug: problem.slug,
      language,
      filename: defaultFilename,
    });
    const baseDir = (config.baseDirectory || 'solutions').replace(/\/+$/, '');
    targetPath = `${baseDir}/${rendered}`;
  }

  try {
    // Step 3: Check remote duplicate on GitHub
    const existingFile = await api.getFile(owner, repo, targetPath, config.branch);

    let shaToUpdate: string | undefined = undefined;

    if (existingFile) {
      const remoteContent = decodeUtf8Base64(existingFile.content);

      // Compare content hashes/exact strings
      if (remoteContent.trim() === submission.code.trim()) {
        logger.info(`File ${targetPath} already exists with identical content on GitHub. Skipping.`);
        await markSubmissionSynced(submissionId);
        await recordSyncSuccess(submission, targetPath, 'skipped');
        return { status: 'skipped', path: targetPath };
      }

      // Feature 6: Multi-language support
      // If this is the SAME language as existing → apply duplicate strategy
      // If this is a DIFFERENT language → always create as a new file (never triggers strategy)
      const remoteExt = targetPath.split('.').pop() ?? '';
      const currentExt = langMeta.extension.replace('.', '');
      const isSameLanguage = remoteExt.toLowerCase() === currentExt.toLowerCase();

      if (isSameLanguage) {
        // Existing file has DIFFERENT content → handle duplicateStrategy
        if (config.duplicateStrategy === 'skip') {
          logger.info(`Solution exists and strategy is "skip". Skipping ${targetPath}.`);
          await markSubmissionSynced(submissionId);
          await recordSyncSuccess(submission, targetPath, 'skipped');
          return { status: 'skipped', path: targetPath };
        } else if (config.duplicateStrategy === 'overwrite') {
          logger.info(`Overwriting existing solution at ${targetPath}.`);
          shaToUpdate = existingFile.sha;
        } else if (config.duplicateStrategy === 'version') {
          // Create versioned filename e.g. Solution_1700000000.java
          const ext = langMeta.extension;
          const baseNameWithoutExt = defaultFilename.replace(ext, '');
          const versionedFilename = `${baseNameWithoutExt}_${Date.now()}${ext}`;
          targetPath = `${problemFolderPath}/${versionedFilename}`;
          logger.info(`Creating versioned solution at ${targetPath}.`);
        }
      } else {
        // Feature 6: Different language – create side-by-side, no strategy applies
        logger.info(`Different language detected (existing: .${remoteExt}, new: .${currentExt}). Creating alongside.`);
      }
    }

    // Step 4: Optionally annotate code with complexity
    const codeToCommit = submission.complexity
      ? annotateCodeWithComplexity(submission.code, submission.complexity, submission.langSlug)
      : submission.code;

    // Step 5: Commit message (Feature 12: co-author)
    const commitMessage = buildCommitMessage(
      config.commitMessageTemplate,
      submission,
      defaultFilename,
      config
    );

    // Step 6: Push Solution File to GitHub
    logger.info(`Pushing solution code to ${owner}/${repo}/${targetPath}`);
    const uploadRes = await api.createOrUpdateFile({
      owner,
      repo,
      path: targetPath,
      content: codeToCommit,
      message: commitMessage,
      branch: config.branch,
      sha: shaToUpdate,
    });

    // Step 7: Problem README with question statement and code
    if (config.generateProblemReadme !== false) {
      try {
        const readmePath = `${problemFolderPath}/README.md`;
        const existingReadme = await api.getFile(owner, repo, readmePath, config.branch);
        const readmeContent = generateProblemReadmeContent(submission);

        await api.createOrUpdateFile({
          owner,
          repo,
          path: readmePath,
          content: readmeContent,
          message: `Docs: LeetCode #${problem.number} - ${problem.title} README`,
          branch: config.branch,
          sha: existingReadme?.sha,
        });
      } catch (readmeErr) {
        logger.warn('Failed to push problem README (non-fatal)', readmeErr);
      }
    }

    // Step 8: Optional Global README table
    if (config.updateGlobalReadme) {
      try {
        const globalReadmePath = 'README.md';
        const existingGlobal = await api.getFile(owner, repo, globalReadmePath, config.branch);
        const existingText = existingGlobal ? decodeUtf8Base64(existingGlobal.content) : '';
        const updatedGlobal = updateGlobalReadmeContent(existingText, submission, targetPath);

        await api.createOrUpdateFile({
          owner,
          repo,
          path: globalReadmePath,
          content: updatedGlobal,
          message: `Docs: update solutions table for #${problem.number} ${problem.title}`,
          branch: config.branch,
          sha: existingGlobal?.sha,
        });
      } catch (globalErr) {
        logger.warn('Failed to update global README table (non-fatal)', globalErr);
      }
    }

    // Step 9: Feature 4 – GitHub Actions workflow (once per repo)
    if (config.enableWorkflowGeneration) {
      const repoKey = `${owner}/${repo}`;
      const alreadyGenerated = await hasWorkflowBeenGenerated(repoKey);
      if (!alreadyGenerated) {
        await generateWorkflowFile({ token: config.token, owner, repo, branch: config.branch });
        await markWorkflowGenerated(repoKey);
      }
    }

    // Step 10: Finalize sync state
    await markSubmissionSynced(submissionId);
    await recordSyncSuccess(submission, targetPath, 'synced');
    await incrementSynced();

    return {
      status: 'synced',
      path: targetPath,
      commitUrl: uploadRes?.commit?.html_url,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Unknown GitHub API error';
    logger.error(`Sync failed for #${problem.number}:`, errorMsg);
    await recordSyncFailure(submission, targetPath, errorMsg);
    await incrementFailed();
    return {
      status: 'failed',
      path: targetPath,
      error: errorMsg,
    };
  }
}

async function recordSyncSuccess(
  submission: AcceptedSubmission,
  githubPath: string,
  status: SyncStatus
): Promise<void> {
  const record: SyncRecord = {
    submissionId: submission.submissionId,
    problemSlug: submission.problem.slug,
    problemNumber: submission.problem.number,
    problemTitle: submission.problem.title,
    difficulty: submission.problem.difficulty,
    language: submission.language,
    githubPath,
    syncedAt: Date.now(),
    status,
    notes: submission.notes,
  };
  await addSyncRecord(record);
}

async function recordSyncFailure(
  submission: AcceptedSubmission,
  githubPath: string,
  error: string
): Promise<void> {
  const record: SyncRecord = {
    submissionId: submission.submissionId,
    problemSlug: submission.problem.slug,
    problemNumber: submission.problem.number,
    problemTitle: submission.problem.title,
    difficulty: submission.problem.difficulty,
    language: submission.language,
    githubPath,
    syncedAt: Date.now(),
    status: 'failed',
    error,
  };
  await addSyncRecord(record);
}
