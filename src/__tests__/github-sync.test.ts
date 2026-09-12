import { describe, it, expect } from 'vitest';
import {
  generateProblemReadmeContent,
  updateGlobalReadmeContent,
} from '../github/github-sync';
import type { AcceptedSubmission } from '../types';

describe('github sync generator utilities', () => {
  const mockSubmission: AcceptedSubmission = {
    submissionId: '12345678',
    problem: {
      number: 1,
      title: 'Two Sum',
      slug: 'two-sum',
      url: 'https://leetcode.com/problems/two-sum/',
      difficulty: 'Easy',
      topics: ['Array', 'Hash Table'],
    },
    language: 'Java',
    langSlug: 'java',
    code: 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        return new int[]{0, 1};\n    }\n}',
    runtime: '2 ms',
    memory: '42.5 MB',
    submittedAt: 1700000000000,
  };

  it('generates markdown documentation for a problem', () => {
    const readme = generateProblemReadmeContent(mockSubmission);
    expect(readme).toContain('# LeetCode #1 - Two Sum');
    expect(readme).toContain('**Difficulty:** Easy');
    expect(readme).toContain('**Language:** Java');
    expect(readme).toContain('`Array` `Hash Table`');
    expect(readme).toContain('class Solution');
  });

  it('generates and updates a global table README', () => {
    const table1 = updateGlobalReadmeContent('', mockSubmission, 'solutions/0001-two-sum/Solution.java');
    expect(table1).toContain('| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | 🟢 Easy | Java | [Solution](solutions/0001-two-sum/Solution.java) |');

    // Add another problem
    const submission2: AcceptedSubmission = {
      ...mockSubmission,
      submissionId: '87654321',
      problem: {
        number: 2,
        title: 'Add Two Numbers',
        slug: 'add-two-numbers',
        url: 'https://leetcode.com/problems/add-two-numbers/',
        difficulty: 'Medium',
        topics: ['Linked List'],
      },
    };

    const table2 = updateGlobalReadmeContent(table1, submission2, 'solutions/0002-add-two-numbers/Solution.java');
    expect(table2).toContain('| 1 | [Two Sum]');
    expect(table2).toContain('| 2 | [Add Two Numbers]');
  });
});
