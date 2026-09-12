import { describe, it, expect } from 'vitest';
import {
  slugify,
  padProblemNumber,
  getProblemFolderName,
  renderTemplate,
} from '../utils/slugify';

describe('slugify utility', () => {
  it('converts title to clean lowercase slug', () => {
    expect(slugify('Two Sum')).toBe('two-sum');
    expect(slugify('Longest Substring Without Repeating Characters')).toBe(
      'longest-substring-without-repeating-characters'
    );
  });

  it('handles invalid filesystem characters safely: / \\ : * ? " < > |', () => {
    expect(slugify('Valid/Invalid:Test*Problem? "Quotes" <Tags> | Pipes')).toBe(
      'validinvalidtestproblem-quotes-tags-pipes'
    );
  });

  it('pads problem numbers correctly to 4 digits', () => {
    expect(padProblemNumber(1)).toBe('0001');
    expect(padProblemNumber(24)).toBe('0024');
    expect(padProblemNumber(456)).toBe('0456');
    expect(padProblemNumber(1234)).toBe('1234');
    expect(padProblemNumber(10024)).toBe('10024');
  });

  it('generates consistent problem folder names', () => {
    expect(getProblemFolderName(1, 'Two Sum')).toBe('0001-two-sum');
    expect(getProblemFolderName(146, 'LRU Cache')).toBe('0146-lru-cache');
  });

  it('replaces all template tokens accurately', () => {
    const template = 'solutions/{padded_number}-{slug}/{filename}';
    const result = renderTemplate(template, {
      number: 1,
      title: 'Two Sum',
      slug: 'two-sum',
      language: 'Java',
      filename: 'Solution.java',
    });
    expect(result).toBe('solutions/0001-two-sum/Solution.java');
  });
});
