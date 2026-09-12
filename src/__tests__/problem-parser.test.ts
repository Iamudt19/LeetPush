import { describe, it, expect } from 'vitest';
import {
  extractSlugFromUrl,
  parseProblemTitleString,
  extractProblemInfoFromDom,
} from '../leetcode/problem-parser';

describe('problem parser utility', () => {
  it('extracts slug from various LeetCode problem URLs', () => {
    expect(
      extractSlugFromUrl('https://leetcode.com/problems/two-sum/')
    ).toBe('two-sum');

    expect(
      extractSlugFromUrl('https://leetcode.com/problems/two-sum/submissions/')
    ).toBe('two-sum');

    expect(
      extractSlugFromUrl('https://leetcode.com/problems/trapping-rain-water/description/')
    ).toBe('trapping-rain-water');

    expect(
      extractSlugFromUrl('https://leetcode.com/contest/weekly-contest-300/')
    ).toBeNull();
  });

  it('parses problem title and number from combined strings', () => {
    expect(parseProblemTitleString('1. Two Sum')).toEqual({
      number: 1,
      title: 'Two Sum',
    });

    expect(parseProblemTitleString('42. Trapping Rain Water')).toEqual({
      number: 42,
      title: 'Trapping Rain Water',
    });

    expect(parseProblemTitleString('1024 - Video Stitching')).toEqual({
      number: 1024,
      title: 'Video Stitching',
    });

    expect(parseProblemTitleString('Two Sum')).toEqual({
      number: 0,
      title: 'Two Sum',
    });
  });

  it('falls back to parsing DOM when available', () => {
    document.body.innerHTML = `
      <div data-cy="question-title">1. Two Sum</div>
      <div class="text-olive">Easy</div>
      <a href="/tag/array/">Array</a>
      <a href="/tag/hash-table/">Hash Table</a>
    `;

    const info = extractProblemInfoFromDom('two-sum');
    expect(info.number).toBe(1);
    expect(info.title).toBe('Two Sum');
    expect(info.difficulty).toBe('Easy');
    expect(info.topics).toContain('Array');
    expect(info.topics).toContain('Hash Table');
  });
});
