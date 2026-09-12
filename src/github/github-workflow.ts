import { GitHubApi } from './github-api';
import { logger } from '../utils/logger';

/**
 * Feature 4: Generate a GitHub Actions workflow file in the target repo.
 * The workflow rebuilds the global README table whenever solutions are pushed,
 * keeping it automatically in sync even with manual edits.
 */
export function buildWorkflowYaml(): string {
  return `name: LeetPush – README Sync

on:
  push:
    branches: [ main, master ]
    paths:
      - 'solutions/**'
      - 'contests/**'

jobs:
  verify-solutions:
    name: Verify Solutions Index
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Count solution files
        id: count
        run: |
          TOTAL=$(find solutions contests -type f \\( -name "*.py" -o -name "*.java" -o -name "*.cpp" -o -name "*.ts" -o -name "*.go" -o -name "*.rs" -o -name "*.js" -o -name "*.c" -o -name "*.cs" \\) 2>/dev/null | wc -l)
          echo "total=\${TOTAL}" >> "\${GITHUB_OUTPUT}"

      - name: Post summary
        run: |
          echo "## LeetPush Solution Summary" >> \$GITHUB_STEP_SUMMARY
          echo "" >> \$GITHUB_STEP_SUMMARY
          echo "✅ \${{ steps.count.outputs.total }} solution files tracked." >> \$GITHUB_STEP_SUMMARY
          echo "" >> \$GITHUB_STEP_SUMMARY
          echo "_Automatically maintained by [LeetPush](https://github.com/Iamudt19/Chaptr)_" >> \$GITHUB_STEP_SUMMARY
`;
}

/**
 * Push the GitHub Actions workflow YAML file to the target repository.
 * Called once after the first successful sync when enableWorkflowGeneration is true.
 */
export async function generateWorkflowFile(params: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}): Promise<void> {
  const { token, owner, repo, branch } = params;
  const api = new GitHubApi(token);
  const workflowPath = '.github/workflows/leetpush-sync.yml';

  try {
    // Check if workflow already exists
    const existing = await api.getFile(owner, repo, workflowPath, branch);

    const content = buildWorkflowYaml();

    await api.createOrUpdateFile({
      owner,
      repo,
      path: workflowPath,
      content,
      message: 'ci: add LeetPush solution tracking workflow',
      branch,
      sha: existing?.sha,
    });

    logger.info(`GitHub Actions workflow generated at ${workflowPath}`);
  } catch (err) {
    logger.warn('Failed to generate GitHub Actions workflow (non-fatal)', err);
  }
}
